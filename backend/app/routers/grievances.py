from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.context import SYSTEM_PROMPT, build_context
from app.db import get_session
from app.llm import extract_json
from app.models import Grievance, User
from app.routers.earnings import recent_earnings
from app.schemas import GrievanceIn, GrievanceOut

router = APIRouter(prefix="/grievances", tags=["grievances"])

DRAFT_SYSTEM = (
    SYSTEM_PROMPT
    + """
TASK: Draft a complaint the worker can send to the platform, contractor or authority.
Return ONLY JSON with keys:
- draft_local: the complaint in the worker's language (from the context), polite but firm,
  5-10 short sentences, with a clear ask (refund, explanation, reinstatement, payment).
- draft_english: the same complaint in formal English.
Cite relevant earnings entries from the context as evidence (dates and amounts).
Use placeholders like [ORDER ID] or [DATE] for details you do not have. No markdown.
"""
)


@router.post("/draft", response_model=GrievanceOut, status_code=status.HTTP_201_CREATED)
async def draft(
    body: GrievanceIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> GrievanceOut:
    earnings = await recent_earnings(session, user.id, 7)
    prompt = (
        f"{build_context(user, earnings)}\n\n"
        f"COMPLAINT TYPE: {body.kind}\nWORKER'S DESCRIPTION: {body.description}"
    )
    stub = {
        "draft_local": f"[stub] {body.kind}: {body.description}",
        "draft_english": f"[stub] {body.kind}: {body.description}",
    }
    data = extract_json(prompt, DRAFT_SYSTEM, stub=stub)
    item = Grievance(
        user_id=user.id,
        kind=body.kind,
        description=body.description,
        draft_local=str(data.get("draft_local") or stub["draft_local"]),
        draft_english=str(data.get("draft_english") or stub["draft_english"]),
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return GrievanceOut.model_validate(item)


@router.get("", response_model=list[GrievanceOut])
async def list_grievances(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[GrievanceOut]:
    rows = await session.scalars(
        select(Grievance).where(Grievance.user_id == user.id).order_by(Grievance.id.desc())
    )
    return [GrievanceOut.model_validate(g) for g in rows]
