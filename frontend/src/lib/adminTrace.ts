/* Derives the admin dashboard's views from raw agent_steps. */

import type { CaseDetail, Step } from "@/types";

export const VCLASS: Record<string, string> = { approve: "ok", deny: "deny", escalate: "esc" };
export const VBADGE: Record<string, string> = { approve: "b-ok", deny: "b-deny", escalate: "b-esc" };
export const VLABEL: Record<string, string> = { approve: "APPROVE", deny: "DENY", escalate: "ESCALATE" };

export function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatMs(ms: number | null): string {
  if (ms == null) return "";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface AnyObj {
  [key: string]: any;
}

function out(step: Step): AnyObj {
  return (step.output ?? {}) as AnyObj;
}

export interface TraceCheck {
  name: string;
  pass: boolean;
  why: string;
}

export interface TraceRow {
  key: string;
  time: string;
  name: string;
  desc: string;
  tag: string;
  ms: string;
  kind?: "llm" | "warn";
  checks?: TraceCheck[];
  raw?: { input: Record<string, unknown> | null; output: Record<string, unknown> | null };
}

function toolTag(name: string): string {
  if (name === "check_refund_eligibility") return "POLICY";
  if (name === "issue_refund" || name === "escalate_to_manager") return "ACTION";
  return "TOOL";
}

function describeLlm(step: Step): string {
  const o = out(step);
  const calls = (o.tool_calls ?? []) as AnyObj[];
  if (calls.length > 0) return `Plans next step — calls ${calls.map((c) => c.name).join(", ")}`;
  if (o.text) return "Composes the customer reply";
  return "Model reasoning";
}

function describeTool(step: Step): string {
  const name = step.tool_name ?? "tool";
  const o = out(step);
  switch (name) {
    case "lookup_customer":
      return o.found
        ? `Email matched → ${o.customer?.id} · ${(o.orders ?? []).length} orders on account`
        : "No customer found for that email";
    case "get_order":
      return o.found
        ? `${o.order?.id} · ${o.order?.product_name} · ${formatInr(o.order?.amount ?? 0)}`
        : `${o.order_id} not found`;
    case "list_customer_orders":
      return `${(o.orders ?? []).length} orders on the account`;
    case "check_refund_eligibility":
      return o.found === false
        ? "Order not found"
        : `Deterministic policy engine — 5 checks → ${String(o.verdict ?? "").toUpperCase()}`;
    case "issue_refund":
      return o.executed
        ? "Refund issued"
        : `Refused — verdict is ${String(o.verdict ?? "").toUpperCase()}, not APPROVE (defense-in-depth)`;
    case "escalate_to_manager":
      return `Ticket #E-${o.escalation_id} created — ${o.reason ?? "routed to a manager"}`;
    case "request_more_info":
      return `Asks the customer for ${o.missing_field}`;
    case "get_policy_section":
      return `Quotes policy — ${o.topic}`;
    default:
      return name;
  }
}

function describeWarn(step: Step): string {
  const o = out(step);
  if (step.type === "retry") return `Retry ${o.attempt ?? ""} — ${o.error ?? "transient error"}, recovered`;
  return `Error — ${o.error ?? "unexpected failure"}`;
}

function extractChecks(step: Step): TraceCheck[] | undefined {
  if (step.tool_name !== "check_refund_eligibility") return undefined;
  const checks = out(step).checks as AnyObj[] | undefined;
  if (!checks) return undefined;
  return checks.map((c) => ({ name: `_check_${c.name}`, pass: Boolean(c.passed), why: String(c.detail ?? "") }));
}

export function deriveTrace(steps: Step[]): TraceRow[] {
  const rows: TraceRow[] = [];
  // Tool args live on the tool_call step; pair them with the following tool_result.
  const pendingArgs = new Map<string, Record<string, unknown> | null>();
  for (const step of steps) {
    if (step.type === "tool_call") {
      if (step.tool_name) pendingArgs.set(step.tool_name, step.input);
      continue;
    }
    if (step.type === "decision") continue;
    const base = { key: String(step.id), time: formatTime(step.created_at), ms: formatMs(step.latency_ms) };
    if (step.type === "llm_call") {
      rows.push({
        ...base,
        name: "llm_call",
        desc: describeLlm(step),
        tag: "LLM",
        kind: "llm",
        raw: { input: step.input, output: step.output },
      });
    } else if (step.type === "tool_result") {
      const name = step.tool_name ?? "tool";
      rows.push({
        ...base,
        name,
        desc: describeTool(step),
        tag: toolTag(name),
        checks: extractChecks(step),
        raw: { input: pendingArgs.get(name) ?? null, output: step.output },
      });
    } else if (step.type === "retry" || step.type === "error") {
      rows.push({
        ...base,
        name: step.type,
        desc: describeWarn(step),
        tag: "FAILURE",
        kind: "warn",
        raw: { input: step.input, output: step.output },
      });
    }
  }
  return rows;
}

export function deriveReason(detail: CaseDetail): string {
  const elig = detail.steps.find((s) => s.tool_name === "check_refund_eligibility" && s.type === "tool_result");
  const reason = elig ? out(elig).reason : null;
  if (reason) return String(reason);
  if (detail.verdict === "escalate") return "Over the approval threshold — routed to a manager.";
  if (detail.verdict === "deny") return "Does not meet the refund policy.";
  if (detail.verdict === "approve") return "Within policy — refund approved.";
  return "In progress.";
}

export interface RunStats {
  model: string;
  tokens: string;
  steps: string;
}

export function deriveRunStats(detail: CaseDetail): RunStats {
  const llm = detail.steps.filter((s) => s.type === "llm_call");
  const model = llm.find((s) => s.model)?.model ?? "—";
  const tokensIn = llm.reduce((sum, s) => sum + (s.tokens_in ?? 0), 0);
  const tokensOut = llm.reduce((sum, s) => sum + (s.tokens_out ?? 0), 0);
  const retries = detail.steps.filter((s) => s.type === "retry").length;
  return {
    model,
    tokens: `${tokensIn.toLocaleString()} / ${tokensOut.toLocaleString()}`,
    steps: `${llm.length} of MAX 6${retries ? ` (+${retries} retries)` : ""}`,
  };
}

export interface Flag {
  label: string;
  kind: "good" | "bad";
}

export function deriveFlags(detail: CaseDetail): Flag[] {
  const o = detail.order;
  if (!o) return [];
  const flags: Flag[] = [];
  flags.push(o.is_opened ? { label: "Opened", kind: "bad" } : { label: "Sealed", kind: "good" });
  const elig = detail.steps.find((s) => s.tool_name === "check_refund_eligibility" && s.type === "tool_result");
  const checks = elig ? (out(elig).checks as AnyObj[] | undefined) : undefined;
  const rw = checks?.find((c) => c.name === "return_window");
  if (rw) flags.push(rw.passed ? { label: "In window", kind: "good" } : { label: "Out of window", kind: "bad" });
  flags.push(o.is_final_sale ? { label: "Final sale", kind: "bad" } : { label: "Not final-sale", kind: "good" });
  flags.push(o.over_threshold ? { label: "Over ₹50,000", kind: "bad" } : { label: "Within limit", kind: "good" });
  return flags;
}

export function mergeSteps(persisted: Step[], live: Step[]): Step[] {
  const byId = new Map<number, Step>();
  for (const step of persisted) byId.set(step.id, step);
  for (const step of live) byId.set(step.id, step);
  return [...byId.values()].sort((a, b) => a.step_no - b.step_no);
}
