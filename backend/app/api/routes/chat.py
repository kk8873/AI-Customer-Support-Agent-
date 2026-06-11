"""POST /chat — the customer entry point."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.runner import run_chat_turn
from app.api.deps import get_llm_client
from app.api.schemas import ChatRequest, ChatResponse, OrderBrief
from app.db.database import get_session
from app.events.bus import event_bus
from app.llm.client import LLMClient

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    session: AsyncSession = Depends(get_session),
    llm: LLMClient = Depends(get_llm_client),
) -> ChatResponse:
    result = await run_chat_turn(
        session,
        message=request.message,
        conversation_id=request.conversation_id,
        llm=llm,
        bus=event_bus,
        customer_email=request.customer_email,
    )
    order = (
        OrderBrief(
            id=result.order.id,
            product_name=result.order.product_name,
            amount=float(result.order.amount),
            currency=result.order.currency,
            delivered_at=result.order.delivered_at,
        )
        if result.order is not None
        else None
    )
    return ChatResponse(
        conversation_id=result.conversation_id,
        reply=result.reply,
        verdict=result.verdict,
        order=order,
        ticket=result.ticket,
    )
