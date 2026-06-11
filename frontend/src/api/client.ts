import type { CaseDetail, CaseSummary, ChatResponse, Customer, OrderListItem } from "@/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function postChat(
  message: string,
  conversationId: number | null,
  customerEmail?: string | null,
): Promise<ChatResponse> {
  return request<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      customer_email: customerEmail ?? null,
    }),
  });
}

export function login(email: string): Promise<Customer> {
  return request<Customer>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function getOrders(customerId: string): Promise<OrderListItem[]> {
  return request<OrderListItem[]>(`/customers/${customerId}/orders`);
}

export function getCases(): Promise<CaseSummary[]> {
  return request<CaseSummary[]>("/admin/cases");
}

export function getCase(conversationId: number): Promise<CaseDetail> {
  return request<CaseDetail>(`/admin/cases/${conversationId}`);
}

export function streamUrl(conversationId?: number): string {
  const query = conversationId != null ? `?conversation_id=${conversationId}` : "";
  return `${API_URL}/admin/stream${query}`;
}

export async function transcribe(audio: Blob): Promise<string> {
  const response = await fetch(`${API_URL}/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": audio.type || "audio/webm" },
    body: audio,
  });
  if (!response.ok) throw new Error(`Transcribe failed: ${response.status}`);
  const data = (await response.json()) as { text: string };
  return data.text;
}

export async function fetchSpeech(text: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/voice/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`Speak failed: ${response.status}`);
  return response.blob();
}
