import { useEffect, useState } from "react";

import { streamUrl } from "@/api/client";
import type { StepEvent } from "@/types";

/** Subscribe to the live reasoning stream; pass a conversationId to scope to one case. */
export function useSSE(conversationId?: number) {
  const [events, setEvents] = useState<StepEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setEvents([]);
    const source = new EventSource(streamUrl(conversationId));
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      const step = JSON.parse(event.data) as StepEvent;
      setEvents((prev) => [...prev, step]);
    };
    return () => source.close();
  }, [conversationId]);

  return { events, connected };
}
