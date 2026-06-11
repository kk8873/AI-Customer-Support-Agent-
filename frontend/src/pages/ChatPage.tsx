import { useState } from "react";
import { Link } from "react-router-dom";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { BoltIcon, LockIcon } from "@/components/icons";
import { fetchSpeech, postChat } from "@/api/client";
import type { OrderBrief } from "@/types";
import "@/styles/chat.css";
import type { ChatMessage, OrderInfo } from "@/types/chat";

const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  text:
    "Hi! I'm KaranKart's refund assistant. Share your order ID and the email you used at " +
    "checkout, and I'll help you with a refund.",
};

function formatPrice(amount: number, currency: string): string {
  if (currency === "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return `${currency} ${amount}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toOrderInfo(order: OrderBrief): OrderInfo {
  const date = formatDate(order.delivered_at);
  return {
    product: order.product_name,
    meta: date ? `${order.id} · delivered ${date}` : order.id,
    price: formatPrice(order.amount, order.currency),
  };
}

async function speak(text: string): Promise<void> {
  const blob = await fetchSpeech(text);
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener("ended", () => URL.revokeObjectURL(url));
  await audio.play();
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);

  async function handleSend(text: string, opts?: { speak?: boolean }) {
    if (typing) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
    setTyping(true);
    try {
      const response = await postChat(text, conversationId);
      setConversationId(response.conversation_id);
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: response.reply,
          order: response.order ? toOrderInfo(response.order) : undefined,
          ticket: response.ticket ?? undefined,
        },
      ]);
      if (opts?.speak && response.reply) {
        speak(response.reply).catch(() => undefined);
      }
    } catch {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Sorry — something went wrong. Please try again.",
        },
      ]);
    }
  }

  return (
    <div className="chat">
      <nav className="chat-nav">
        <div className="chat-brand">
          <div className="chat-mark">
            <BoltIcon />
          </div>
          <b>KaranKart</b>
        </div>
        <div className="chat-links">
          <span>Orders</span>
          <span className="on">Support</span>
          <Link to="/admin">Admin</Link>
          <div className="chat-me">PN</div>
        </div>
      </nav>

      <div className="chat-page">
        <p className="chat-h">How can we help?</p>
        <p className="chat-sub">Our AI assistant resolves most refund requests in under a minute</p>
        <ChatPanel caseId="RR-2031" messages={messages} typing={typing} onSend={handleSend} />
        <p className="trust">
          <LockIcon />
          Verified by order lookup · Powered by KaranKart AI support
        </p>
      </div>
    </div>
  );
}
