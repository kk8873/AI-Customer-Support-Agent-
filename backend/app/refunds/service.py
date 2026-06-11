"""Refund and escalation actions (the side-effecting layer).

issue_refund re-validates eligibility before changing anything: the action itself is
the policy boundary, so an ineligible order cannot be refunded even if a caller —
including a manipulated LLM — invokes it directly.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Conversation,
    Customer,
    DecidedBy,
    Escalation,
    EscalationStatus,
    Order,
    RefundRequest,
    RefundStatus,
    Verdict,
)
from app.policy.engine import CheckResult, PolicyConfig, check_refund_eligibility


@dataclass(frozen=True)
class RefundOutcome:
    executed: bool
    verdict: Verdict
    reason: str
    checks: list[CheckResult]
    refund_request_id: int | None = None


ASSIGNED_MANAGER = "Refunds Manager"


@dataclass(frozen=True)
class EscalationOutcome:
    escalated: bool
    reason: str
    assigned_to: str
    escalation_id: int | None = None
    refund_request_id: int | None = None


async def issue_refund(
    order: Order,
    customer: Customer,
    *,
    now: datetime,
    session: AsyncSession | None = None,
    conversation: Conversation | None = None,
    config: PolicyConfig | None = None,
) -> RefundOutcome:
    eligibility = check_refund_eligibility(order, customer, now=now, config=config)

    # Anything other than APPROVE is refused before any state changes, so a refund
    # cannot fire on an ineligible order regardless of what the caller intended.
    if eligibility.verdict is not Verdict.APPROVE:
        return RefundOutcome(
            executed=False,
            verdict=eligibility.verdict,
            reason=f"Refund not issued — eligibility is {eligibility.verdict.value.upper()}. {eligibility.reason}",
            checks=eligibility.checks,
        )

    if session is None or conversation is None:
        raise ValueError("issue_refund requires a session and conversation to execute an approved refund.")

    order.refunded_at = now
    refund_request = RefundRequest(
        order_id=order.id,
        conversation_id=conversation.id,
        status=RefundStatus.DECIDED,
        verdict=Verdict.APPROVE,
        reason=eligibility.reason,
        amount=order.amount,
        decided_by=DecidedBy.AGENT,
        resolved_at=now,
    )
    session.add(refund_request)
    await session.commit()
    await session.refresh(refund_request)

    return RefundOutcome(
        executed=True,
        verdict=Verdict.APPROVE,
        reason="Refund issued.",
        checks=eligibility.checks,
        refund_request_id=refund_request.id,
    )


async def escalate_to_manager(
    order: Order,
    reason: str,
    *,
    session: AsyncSession,
    conversation: Conversation,
) -> EscalationOutcome:
    refund_request = RefundRequest(
        order_id=order.id,
        conversation_id=conversation.id,
        status=RefundStatus.DECIDED,
        verdict=Verdict.ESCALATE,
        reason=reason,
        amount=order.amount,
        decided_by=DecidedBy.AGENT,
    )
    session.add(refund_request)
    await session.flush()

    escalation = Escalation(
        refund_request_id=refund_request.id,
        reason=reason,
        status=EscalationStatus.OPEN,
        assigned_to=ASSIGNED_MANAGER,
    )
    session.add(escalation)
    await session.commit()
    await session.refresh(escalation)

    return EscalationOutcome(
        escalated=True,
        reason=reason,
        assigned_to=ASSIGNED_MANAGER,
        escalation_id=escalation.id,
        refund_request_id=refund_request.id,
    )
