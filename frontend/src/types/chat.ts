export interface OrderInfo {
  product: string;
  meta: string; // e.g. "ORD-1002 · delivered Jun 6"
  price: string; // e.g. "₹2,39,900"
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  order?: OrderInfo; // embeds an OrderCard inside an assistant bubble
  ticket?: string; // ticket ref (e.g. "E-7") -> embeds a TicketStrip
  chips?: string[]; // quick replies shown after the message
}
