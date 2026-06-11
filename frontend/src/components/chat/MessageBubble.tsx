import type { ChatMessage } from "@/types/chat";
import { OrderCard } from "@/components/chat/OrderCard";
import { TicketStrip } from "@/components/chat/TicketStrip";

export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={message.role === "user" ? "msg-u" : "msg-a"}>
      {message.text}
      {message.order && <OrderCard order={message.order} />}
      {message.ticket && <TicketStrip ticketRef={message.ticket} />}
    </div>
  );
}
