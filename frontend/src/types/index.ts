/** Mirrors the backend API contract (app/api/schemas.py). */

export type Verdict = "approve" | "deny" | "escalate";

export interface OrderBrief {
  id: string;
  product_name: string;
  amount: number;
  currency: string;
  delivered_at: string | null;
}

export interface ChatResponse {
  conversation_id: number;
  reply: string;
  verdict: Verdict | null;
  order: OrderBrief | null;
  ticket: string | null;
}

export interface Step {
  id: number;
  step_no: number;
  created_at: string;
  type: string; // llm_call | tool_call | tool_result | decision | error | retry
  tool_name: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  status: string; // success | error | retried
  latency_ms: number | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
}

export interface CaseSummary {
  conversation_id: number;
  customer_name: string | null;
  verdict: Verdict | null;
  order_id: string | null;
  order_product: string | null;
  order_amount: number | null;
  currency: string | null;
  created_at: string;
  step_count: number;
}

export interface CaseCustomer {
  id: string;
  name: string;
  email: string;
  tier: string | null;
}

export interface OrderDetail {
  id: string;
  product_name: string;
  amount: number;
  currency: string;
  delivered_at: string | null;
  is_opened: boolean;
  is_final_sale: boolean;
  is_defective: boolean;
  over_threshold: boolean;
}

export interface CaseEscalation {
  ref: string;
  assigned_to: string;
  reason: string;
  status: string;
}

export interface CaseDetail {
  conversation_id: number;
  verdict: Verdict | null;
  channel: string;
  customer: CaseCustomer | null;
  order: OrderDetail | null;
  escalation: CaseEscalation | null;
  steps: Step[];
}

/** A live event off /admin/stream — a Step plus the conversation it belongs to. */
export interface StepEvent extends Step {
  conversation_id: number;
}
