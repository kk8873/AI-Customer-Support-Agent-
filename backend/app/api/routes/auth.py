"""Mock sign-in: an email selects one of the seeded customers — no password.

This is identity-by-reference made visible, not real authentication. It exists so a
signed-in customer's identity can flow into the chat (the agent then skips asking
for an email). Real auth/RBAC is intentionally out of scope.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import CaseCustomer, LoginRequest
from app.db.database import get_session
from app.db.models import Customer

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=CaseCustomer)
async def login(
    payload: LoginRequest, session: AsyncSession = Depends(get_session)
) -> CaseCustomer:
    email = payload.email.strip().lower()
    customer = (
        await session.execute(select(Customer).where(func.lower(Customer.email) == email))
    ).scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="No account found for that email.")
    return CaseCustomer(
        id=customer.id,
        name=customer.name,
        email=customer.email,
        tier=customer.tier.value if customer.tier else None,
    )
