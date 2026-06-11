"""Deterministic refund policy engine.

All hard rules — dates, money thresholds, condition flags — are evaluated here in
code, never by the LLM. Each rule is a pure function returning a CheckResult;
check_refund_eligibility aggregates them into a single verdict and keeps every
check so the reasoning log can show the full evaluation.

Fail-closed: missing or ambiguous data denies rather than guessing — the LLM is
never the fallback for a policy decision.
"""

import json
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

from app.db.models import Customer, CustomerTier, Order, Verdict

_CONFIG_PATH = Path(__file__).resolve().parent / "policy_config.json"


class PolicyConfig(BaseModel):
    return_window_days: int
    vip_return_window_days: int
    manager_approval_threshold: Decimal
    currency: str


@lru_cache
def load_policy_config() -> PolicyConfig:
    return PolicyConfig.model_validate(json.loads(_CONFIG_PATH.read_text()))


@dataclass(frozen=True)
class CheckResult:
    name: str
    passed: bool
    detail: str


@dataclass(frozen=True)
class EligibilityResult:
    verdict: Verdict
    reason: str
    checks: list[CheckResult]


def _check_ownership(order: Order, customer: Customer) -> CheckResult:
    owned = order.customer_id == customer.id
    detail = (
        "Order belongs to the requesting customer."
        if owned
        else "Order is not associated with this customer's account."
    )
    return CheckResult("ownership", owned, detail)


def _check_already_refunded(order: Order) -> CheckResult:
    refunded = order.refunded_at is not None
    detail = (
        "Order has already been refunded."
        if refunded
        else "Order has not been refunded before."
    )
    return CheckResult("already_refunded", not refunded, detail)


def _check_return_window(
    order: Order, customer: Customer, now: datetime, config: PolicyConfig
) -> CheckResult:
    if order.delivered_at is None:
        return CheckResult("return_window", False, "Order has no delivery date on record.")
    is_vip = customer.tier == CustomerTier.VIP
    window_days = config.vip_return_window_days if is_vip else config.return_window_days
    age_days = (now - order.delivered_at).days
    within = age_days <= window_days
    tier_note = " (VIP)" if is_vip else ""
    detail = (
        f"Delivered {age_days} days ago, within the {window_days}-day window{tier_note}."
        if within
        else f"Delivered {age_days} days ago, outside the {window_days}-day window{tier_note}."
    )
    return CheckResult("return_window", within, detail)


def _check_item_condition(order: Order) -> CheckResult:
    if order.is_final_sale:
        return CheckResult("item_condition", False, "Final-sale items are non-refundable.")
    if order.is_opened and not order.is_defective:
        return CheckResult(
            "item_condition", False, "Opened items are refundable only if defective."
        )
    detail = (
        "Item is opened but defective, which is refundable."
        if order.is_opened
        else "Item is factory-sealed."
    )
    return CheckResult("item_condition", True, detail)


def _check_amount_threshold(order: Order, config: PolicyConfig) -> CheckResult:
    over = order.amount > config.manager_approval_threshold
    detail = (
        f"Amount {order.amount} exceeds the {config.manager_approval_threshold} "
        "manager-approval threshold."
        if over
        else f"Amount {order.amount} is within the auto-approval limit."
    )
    return CheckResult("amount_threshold", not over, detail)


def check_refund_eligibility(
    order: Order,
    customer: Customer,
    *,
    now: datetime,
    config: PolicyConfig | None = None,
) -> EligibilityResult:
    config = config or load_policy_config()

    ownership = _check_ownership(order, customer)
    already_refunded = _check_already_refunded(order)
    return_window = _check_return_window(order, customer, now, config)
    item_condition = _check_item_condition(order)
    amount_threshold = _check_amount_threshold(order, config)
    checks = [ownership, already_refunded, return_window, item_condition, amount_threshold]

    # A failed hard rule denies. Order matters: ownership first (security), then the
    # remaining violations. Only an otherwise-valid order that is over the threshold
    # escalates — so a real violation always beats escalation.
    for check in (ownership, already_refunded, return_window, item_condition):
        if not check.passed:
            return EligibilityResult(Verdict.DENY, check.detail, checks)

    if not amount_threshold.passed:
        return EligibilityResult(Verdict.ESCALATE, amount_threshold.detail, checks)

    return EligibilityResult(
        Verdict.APPROVE, "Within policy; eligible for an automatic refund.", checks
    )
