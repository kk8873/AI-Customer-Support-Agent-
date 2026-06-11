"""Persist and broadcast agent reasoning steps.

The Tracer is wired into the loop as its `emit` callback. For each StepEvent it
writes an agent_steps row (the durable trace) and publishes a serialized event to
the event bus (the live stream) — the single point where a step becomes both
durable and observable.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.loop import StepEvent
from app.db.models import AgentStep, StepStatus, StepType
from app.events.bus import Event, EventBus


class Tracer:
    def __init__(
        self,
        session: AsyncSession,
        conversation_id: int,
        bus: EventBus,
        refund_request_id: int | None = None,
    ) -> None:
        self._session = session
        self._conversation_id = conversation_id
        self._bus = bus
        self._refund_request_id = refund_request_id
        self._step_no = 0

    async def record(self, event: StepEvent) -> None:
        self._step_no += 1
        step = AgentStep(
            conversation_id=self._conversation_id,
            refund_request_id=self._refund_request_id,
            step_no=self._step_no,
            type=StepType(event.type),
            tool_name=event.tool_name,
            input_json=event.input,
            output_json=event.output,
            status=StepStatus(event.status),
            latency_ms=event.latency_ms,
            model=event.model,
            tokens_in=event.tokens_in,
            tokens_out=event.tokens_out,
        )
        self._session.add(step)
        await self._session.flush()
        await self._bus.publish(self._serialize(step))

    def _serialize(self, step: AgentStep) -> Event:
        return {
            "id": step.id,
            "conversation_id": step.conversation_id,
            "step_no": step.step_no,
            "created_at": step.created_at.isoformat() if step.created_at else None,
            "type": step.type.value,
            "tool_name": step.tool_name,
            "input": step.input_json,
            "output": step.output_json,
            "status": step.status.value,
            "latency_ms": step.latency_ms,
            "model": step.model,
            "tokens_in": step.tokens_in,
            "tokens_out": step.tokens_out,
        }
