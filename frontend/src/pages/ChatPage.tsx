import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { fetchSpeech, postChat } from "@/api/client";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { BoltIcon, LockIcon } from "@/components/icons";
import { useSession } from "@/lib/session";
import type { Customer, OrderBrief } from "@/types";
import "@/styles/chat.css";
import type { ChatMessage, OrderInfo } from "@/types/chat";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function greetingFor(customer: Customer | null): ChatMessage {
  if (customer) {
    const firstName = customer.name.split(" ")[0];
    return {
      id: "greeting",
      role: "assistant",
      text: `Hi ${firstName}! I can see your account — tell me which order you need help with and what's wrong, and I'll sort out the refund.`,
    };
  }
  return {
    id: "greeting",
    role: "assistant",
    text:
      "Hi! I'm KaranKart's refund assistant. Share your order ID and the email you used at " +
      "checkout, and I'll help you with a refund.",
  };
}

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
  const { customer } = useSession();
  const location = useLocation();
  const autoSentRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greetingFor(customer)]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);

  async function handleSend(text: string, opts?: { speak?: boolean }) {
    if (typing) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
    setTyping(true);
    try {
      const response = await postChat(text, conversationId, customer?.email);
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

  // On arrival from an Orders-page "Request a refund", auto-send the order context once.
  useEffect(() => {
    if (autoSentRef.current) return;
    const auto = (location.state as { autoMessage?: string } | null)?.autoMessage;
    if (auto) {
      autoSentRef.current = true;
      void handleSend(auto);
    }
  }, []);

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
          <Link to="/orders">Orders</Link>
          <span className="on">Support</span>
          {customer ? (
            <div className="chat-me" title={customer.name}>
              {initials(customer.name)}
            </div>
          ) : (
            <Link to="/">Sign in</Link>
          )}
        </div>
      </nav>

      <div className="chat-page">
        <p className="chat-h">How can we help?</p>
        <p className="chat-sub">Our AI assistant resolves most refund requests in under a minute</p>
        <ChatPanel
          caseId={conversationId != null ? `RR-${conversationId}` : "NEW"}
          messages={messages}
          typing={typing}
          onSend={handleSend}
        />
        <p className="trust">
          <LockIcon />
          Verified by order lookup · Powered by KaranKart AI support
        </p>
      </div>
    </div>
  );
}
