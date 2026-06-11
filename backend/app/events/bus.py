"""In-memory pub/sub event bus for streaming agent reasoning steps.

Producers (the tracer) publish step events; consumers (the admin SSE stream)
subscribe, optionally filtered to a single conversation. Each subscriber gets its
own queue so a slow consumer cannot block the agent. Single-process only — Redis
pub/sub would replace this to scale across instances.
"""

import asyncio
from typing import Any

Event = dict[str, Any]


class EventBus:
    def __init__(self) -> None:
        self._subscribers: list[tuple[asyncio.Queue[Event], int | None]] = []

    def subscribe(self, conversation_id: int | None = None) -> asyncio.Queue[Event]:
        """Subscribe to all events, or only those for one conversation."""
        queue: asyncio.Queue[Event] = asyncio.Queue()
        self._subscribers.append((queue, conversation_id))
        return queue

    def unsubscribe(self, queue: asyncio.Queue[Event]) -> None:
        self._subscribers = [(q, f) for q, f in self._subscribers if q is not queue]

    async def publish(self, event: Event) -> None:
        conversation_id = event.get("conversation_id")
        for queue, conversation_filter in self._subscribers:
            if conversation_filter is None or conversation_filter == conversation_id:
                queue.put_nowait(event)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)


# Single process-wide bus shared by the tracer and the admin stream.
event_bus = EventBus()
