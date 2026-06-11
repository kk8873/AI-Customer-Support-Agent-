"""Application service: run one chat turn end to end.

Wraps the agent loop with conversation persistence and tracing so any entry point
(HTTP now, voice later) handles a turn by calling one function — no orchestration
leaks into the route.
"""

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.loop import StepEvent, run_agent
from app.agent.tools import ToolContext
from app.agent.tracing import Tracer
from app.db.models import (
    Conversation,
    ConversationChannel,
    Customer,
    Escalation,
    Message,
    MessageRole,
    Order,
    RefundRequest,
    Verdict,
)
from app.events.bus import EventBus
from app.llm.client import LLMClient
from app.llm.client import Message as LLMMessage
from app.llm.client import assistant_message, user_message


@dataclass
class ChatTurnResult:
    conversation_id: int
    reply: str
    verdict: str | None
    order: Order | None = None
    ticket: str | None = None


async def _load_or_create_conversation(
    session: AsyncSession, conversation_id: int | None, channel: ConversationChannel
) -> Conversation:
    if conversation_id is not None:
        existing = await session.get(Conversation, conversation_id)
        if existing is not None:
            return existing
    conversation = Conversation(channel=channel)
    session.add(conversation)
    await session.flush()
    return conversation


async def _load_history(session: AsyncSession, conversation_id: int) -> list[LLMMessage]:
    rows = (
        await session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at, Message.id)
        )
    ).scalars().all()
    history: list[LLMMessage] = []
    for row in rows:
        if row.role is MessageRole.USER:
            history.append(user_message(row.content))
        elif row.role is MessageRole.ASSISTANT:
            history.append(assistant_message(row.content))
    return history


async def _focused_order(session: AsyncSession, steps: list[StepEvent]) -> Order | None:
    """The last order the agent touched in its tool calls (powers the OrderCard)."""
    order_id = None
    for step in steps:
        if step.type == "tool_call" and step.input and "order_id" in step.input:
            order_id = step.input["order_id"]
    return await session.get(Order, order_id) if order_id else None


async def _ticket_ref(session: AsyncSession, conversation_id: int) -> str | None:
    escalation = (
        await session.execute(
            select(Escalation)
            .join(RefundRequest, Escalation.refund_request_id == RefundRequest.id)
            .where(RefundRequest.conversation_id == conversation_id)
            .order_by(Escalation.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    return f"E-{escalation.id}" if escalation else None


async def run_chat_turn(
    session: AsyncSession,
    *,
    message: str,
    conversation_id: int | None,
    llm: LLMClient,
    bus: EventBus,
    channel: ConversationChannel = ConversationChannel.TEXT,
) -> ChatTurnResult:
    conversation = await _load_or_create_conversation(session, conversation_id, channel)
    history = await _load_history(session, conversation.id)
    session.add(Message(conversation_id=conversation.id, role=MessageRole.USER, content=message))

    ctx = ToolContext(session=session, conversation=conversation, now=datetime.now(timezone.utc))
    if conversation.customer_id is not None:
        ctx.customer = await session.get(Customer, conversation.customer_id)

    tracer = Tracer(session, conversation.id, bus)
    result = await run_agent(message, llm=llm, ctx=ctx, history=history, emit=tracer.record)

    order = await _focused_order(session, result.steps)
    if result.verdict is not None:
        conversation.verdict = Verdict(result.verdict)
    if order is not None:
        conversation.order_id = order.id
    session.add(
        Message(conversation_id=conversation.id, role=MessageRole.ASSISTANT, content=result.answer)
    )
    await session.commit()

    ticket = await _ticket_ref(session, conversation.id) if result.verdict == "escalate" else None

    return ChatTurnResult(conversation.id, result.answer, result.verdict, order, ticket)
