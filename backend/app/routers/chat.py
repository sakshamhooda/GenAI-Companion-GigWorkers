from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import ratelimit
from app.auth import get_current_user
from app.context import build_context, system_prompt_for, worker_input
from app.db import get_session
from app.llm import generate
from app.models import Message, User
from app.routers.earnings import recent_earnings
from app.routers.problems import recent_problem_lines
from app.schemas import ChatIn, ChatOut, MessageOut

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/history", response_model=list[MessageOut])
async def history(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[MessageOut]:
    rows = await session.scalars(
        select(Message)
        .where(Message.user_id == user.id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(50)
    )
    return [MessageOut.model_validate(m) for m in reversed(list(rows))]


@router.post("", response_model=ChatOut, dependencies=[Depends(ratelimit.per_user("chat", 30))])
async def chat(
    body: ChatIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ChatOut:
    earnings = await recent_earnings(session, user.id, 7)
    monthly = await recent_earnings(session, user.id, 30)
    issues = await recent_problem_lines(session, user.id)
    recent = await session.scalars(
        select(Message)
        .where(Message.user_id == user.id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(10)
    )

    def _line(m: Message) -> str:
        if m.role == "user":
            return f"Worker: {worker_input(m.content)}"
        return f"Saathi: {m.content}"

    transcript = "\n".join(_line(m) for m in reversed(list(recent)))
    prompt = (
        f"{build_context(user, earnings, monthly, issues)}\n\n"
        f"RECENT CONVERSATION\n{transcript or '(none)'}\n\n"
        f"Worker: {worker_input(body.message)}\nSaathi:"
    )
    reply = generate(prompt, system_prompt_for(user))
    session.add_all(
        [
            Message(user_id=user.id, role="user", content=body.message),
            Message(user_id=user.id, role="assistant", content=reply),
        ]
    )
    await session.commit()
    return ChatOut(reply=reply)
