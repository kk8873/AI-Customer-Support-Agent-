"""GET a signed-in customer's orders — read-only, for the Orders page.

Thin handler: the query lives in app.orders.service.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import OrderListItem
from app.db.database import get_session
from app.orders import service as orders_service

router = APIRouter(tags=["orders"])


@router.get("/customers/{customer_id}/orders", response_model=list[OrderListItem])
async def list_orders(
    customer_id: str, session: AsyncSession = Depends(get_session)
) -> list[OrderListItem]:
    return await orders_service.list_customer_orders(session, customer_id)
