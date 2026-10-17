from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db import get_session
from app.llm import extract_json
from app.models import Earning, User
from app.schemas import EarningIn, EarningOut, EarningsSummary, ParsedEarning, ParseIn
from app.util import split_csv

router = APIRouter(prefix="/earnings", tags=["earnings"])

PARSE_SYSTEM = """You extract a single day's gig-work earnings entry from a short message.
The message may be in Hindi, Hinglish (Hindi in Latin script), English or any Indian language.
Return ONLY JSON with keys:
- amount: number, rupees earned (0 if not mentioned)
- expenses: number, rupees spent on petrol/fuel/food/repairs etc. (0 if none)
- platform: string. If the message names a platform, use it. Otherwise pick the best match
  from the worker's platforms list given in the prompt (e.g. "rides"/"sawari" -> Uber/Ola/
  Rapido, "orders"/"delivery" -> Zomato/Swiggy/Blinkit). If still unclear, use the first
  platform in the list. "" only if the list is empty.
- date: ISO date. "aaj"/"today" = today's date given; "kal"/"yesterday" = the day before.
- note: short English note with extra detail (cancellations, deductions, incidents), or ""
Examples: "aaj 850 kamaye, 120 petrol" -> amount 850, expenses 120.
"""


async def recent_earnings(session: AsyncSession, user_id: int, days: int) -> list[Earning]:
    since = date.today() - timedelta(days=days - 1)
    rows = await session.scalars(
        select(Earning)
        .where(Earning.user_id == user_id, Earning.date >= since)
        .order_by(Earning.date.asc(), Earning.id.asc())
    )
    return list(rows)


@router.get("", response_model=EarningsSummary)
async def list_earnings(
    days: int = Query(default=7, ge=1, le=90),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EarningsSummary:
    entries = await recent_earnings(session, user.id, days)
    total = sum(e.amount for e in entries)
    expenses = sum(e.expenses for e in entries)
    return EarningsSummary(
        entries=[EarningOut.model_validate(e) for e in entries],
        total_amount=total,
        total_expenses=expenses,
        net=total - expenses,
    )


@router.post("", response_model=EarningOut, status_code=status.HTTP_201_CREATED)
async def add_earning(
    body: EarningIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EarningOut:
    platforms = split_csv(user.platform)
    entry = Earning(
        user_id=user.id,
        date=body.date or date.today(),
        amount=body.amount,
        expenses=body.expenses,
        platform=body.platform or (platforms[0] if platforms else ""),
        note=body.note,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return EarningOut.model_validate(entry)


@router.post("/parse", response_model=ParsedEarning)
async def parse_earning(body: ParseIn, user: User = Depends(get_current_user)) -> ParsedEarning:
    today = date.today()
    platforms = split_csv(user.platform)
    default_platform = platforms[0] if platforms else ""
    prompt = (
        f"Today's date: {today.isoformat()}.\n"
        f"Worker's platforms (pick from these when the message does not name one): "
        f"{', '.join(platforms) or 'none'}.\n"
        f"Worker's work types: {', '.join(split_csv(user.work_type)) or 'unknown'}.\n"
        f"Message: {body.text}"
    )
    stub = {"amount": 0, "expenses": 0, "platform": default_platform, "date": today.isoformat()}
    data = extract_json(prompt, PARSE_SYSTEM, stub=stub)
    try:
        parsed_date = date.fromisoformat(str(data.get("date") or today.isoformat()))
    except ValueError:
        parsed_date = today
    return ParsedEarning(
        amount=float(data.get("amount") or 0),
        expenses=float(data.get("expenses") or 0),
        platform=str(data.get("platform") or default_platform),
        date=parsed_date,
        note=str(data.get("note") or ""),
    )
