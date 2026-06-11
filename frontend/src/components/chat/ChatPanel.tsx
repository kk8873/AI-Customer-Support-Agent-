import { Fragment, useEffect, useRef } from "react";

import type { ChatMessage } from "@/types/chat";
import { Composer } from "@/components/chat/Composer";
import { BotIcon } from "@/components/icons";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { QuickReplies } from "@/components/chat/QuickReplies";

interface Props {
  caseId: string;
  messages: ChatMessage[];
  typing: boolean;
  onSend: (text: string, opts?: { speak?: boolean }) => void;
}

export function ChatPanel({ caseId, messages, typing, onSend }: Props) {
  const msgsRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view as the conversation grows.
  useEffect(() => {
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  return (
    <div className="chat-panel">
      <div className="chat-head">
        <div className="chat-bot">
          <BotIcon />
        </div>
        <div className="t">
          <b>Refund assistant</b>
          <span>
            <span className="chat-dot" />
            Online · replies instantly
          </span>
        </div>
        <span className="chat-case">CASE {caseId}</span>
      </div>

      <div className="chat-msgs" ref={msgsRef}>
        <span className="chat-stamp">Today, 2:41 PM</span>
        {messages.map((message) => (
          <Fragment key={message.id}>
            <MessageBubble message={message} />
            {message.chips && <QuickReplies replies={message.chips} onSelect={onSend} />}
          </Fragment>
        ))}
        {typing && (
          <div className="msg-a">
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
      </div>

      <Composer onSend={onSend} disabled={typing} />
    </div>
  );
}
