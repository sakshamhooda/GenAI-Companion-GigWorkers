""" "Meri Samasya": the worker describes a problem; the model returns grounded legal options.

Grounding: the model may only cite entries from ``app/data/legal_kb.json`` (by id); anything
else is dropped. Every result carries a disclaimer and the NALSA free legal aid number.
"""

import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import ratelimit
from app.auth import get_current_user
from app.context import build_context, system_prompt_for, worker_input
from app.db import get_session
from app.llm import aextract_json
from app.models import Problem, User
from app.routers.earnings import recent_earnings
from app.schemas import ProblemIn, ProblemOut, ProblemResult

router = APIRouter(prefix="/problems", tags=["problems"])

KB_PATH = Path(__file__).resolve().parents[1] / "data" / "legal_kb.json"

CATEGORIES = {
    "payout_deduction",
    "deactivation",
    "wage_nonpayment",
    "accident",
    "harassment",
    "police_rto",
    "platform_penalty",
    "other",
}
URGENCIES = {"low", "medium", "high"}
NALSA_CONTACT = {"name": "NALSA free legal aid", "number": "15100"}
EMERGENCY_CONTACT = {"name": "Emergency", "number": "112"}
DISCLAIMER_EN = (
    "This is general guidance from Saathi, not legal advice. Rules change and differ by "
    "state. For your case call free legal aid on 15100."
)

TASK = """The worker describes a problem inside <worker_input>. Using ONLY the knowledge base
entries below (cite them by id), return JSON:
{"category": one of payout_deduction, deactivation, wage_nonpayment, accident, harassment,
  police_rto, platform_penalty, other;
 "urgency": "low" | "medium" | "high" (high = safety, injury, harassment, or money needed now);
 "summary": one or two plain sentences saying what this is, in the worker's language;
 "rights": [{"kb_id": id from the knowledge base, "title": short title in the worker's
   language, "what_it_says": one or two sentences in the worker's language}] (2 to 4 items,
   most relevant first);
 "options": [{"title": ..., "effort": "low"|"medium"|"high", "time": e.g. "1-7 days",
   "cost": e.g. "free", "steps": [3 to 5 short steps], "documents": [what to collect]}]
   (2 to 4 options, easiest first, all in the worker's language);
 "contacts": [{"name": ..., "number": ...}] (only real numbers from the knowledge base:
   112, 1091, 15100; or empty);
 "disclaimer": one sentence in the worker's language saying this is guidance, not legal
   advice, and to call 15100 for free legal aid.}
Never cite a law that is not in the knowledge base. Never promise an outcome."""

STUB_RESULT = {
    "category": "payout_deduction",
    "urgency": "medium",
    "summary": "[stub] A platform deducted money without explanation.",
    "rights": [
        {
            "kb_id": "platform_grievance_ladder",
            "title": "Platform grievance process",
            "what_it_says": "Raise a ticket, then escalate to the grievance officer.",
        },
        {"kb_id": "not_in_kb", "title": "Invented law", "what_it_says": "should be dropped"},
    ],
    "options": [
        {
            "title": "Raise an in-app ticket and escalate",
            "effort": "low",
            "time": "1-7 days",
            "cost": "free",
            "steps": ["Open support in the app", "Quote the order IDs", "Ask for a written reason"],
            "documents": ["Payout screenshot", "Order IDs"],
        }
    ],
    "contacts": [],
    "disclaimer": "",
}


@lru_cache(maxsize=1)
def load_kb() -> list[dict]:
    """The curated legal knowledge base (loaded once)."""
    return json.loads(KB_PATH.read_text(encoding="utf-8"))


def _kb_block() -> str:
    lines = ["KNOWLEDGE BASE (cite by id)"]
    for e in load_kb():
        lines.append(
            f"[{e['id']}] {e['title']} | applies to: {', '.join(e['applies_to'])}\n"
            f"  {e['summary']}\n  How to use: {e['how_to_use']}"
        )
    return "\n".join(lines)


def normalise(result: dict, language: str) -> ProblemResult:
    """Validate, drop uncited laws, and guarantee the disclaimer and legal-aid contact."""
    kb_ids = {e["id"] for e in load_kb()}
    kb_titles = {e["id"]: e["title"] for e in load_kb()}
    category = result.get("category") if result.get("category") in CATEGORIES else "other"
    urgency = result.get("urgency") if result.get("urgency") in URGENCIES else "medium"
    rights = []
    for r in result.get("rights") or []:
        if isinstance(r, dict) and r.get("kb_id") in kb_ids:
            rights.append(
                {
                    "kb_id": r["kb_id"],
                    "title": str(r.get("title") or kb_titles[r["kb_id"]]),
                    "what_it_says": str(r.get("what_it_says") or ""),
                }
            )
    options = [o for o in result.get("options") or [] if isinstance(o, dict) and o.get("title")]
    contacts = [
        c
        for c in result.get("contacts") or []
        if isinstance(c, dict) and c.get("name") and str(c.get("number", "")).strip()
    ]
    if not any(str(c.get("number")) == NALSA_CONTACT["number"] for c in contacts):
        contacts.append(dict(NALSA_CONTACT))
    if urgency == "high" and not any(str(c.get("number")) == "112" for c in contacts):
        contacts.insert(0, dict(EMERGENCY_CONTACT))
    disclaimer = str(result.get("disclaimer") or "").strip() or DISCLAIMER_EN
    return ProblemResult(
        category=category,
        urgency=urgency,
        summary=str(result.get("summary") or ""),
        rights=rights,
        options=options,
        contacts=contacts,
        disclaimer=disclaimer,
    )


@router.post(
    "/analyze",
    response_model=ProblemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(ratelimit.per_user("problems-analyze", 10))],
)
async def analyze(
    body: ProblemIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProblemOut:
    earnings = await recent_earnings(session, user.id, 7)
    prompt = (
        f"{build_context(user, earnings)}\n\n{_kb_block()}\n\n{TASK}\n\n{worker_input(body.text)}"
    )
    raw = await aextract_json(prompt, system_prompt_for(user), stub=STUB_RESULT)
    result = normalise(raw, user.language)
    row = Problem(
        user_id=user.id,
        text=body.text,
        result_json=result.model_dump_json(),
        category=result.category,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return ProblemOut(id=row.id, text=row.text, created_at=row.created_at, **result.model_dump())


@router.get("", response_model=list[ProblemOut])
async def list_problems(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ProblemOut]:
    rows = await session.scalars(
        select(Problem)
        .where(Problem.user_id == user.id)
        .order_by(Problem.created_at.desc(), Problem.id.desc())
        .limit(20)
    )
    out = []
    for row in rows:
        result = ProblemResult.model_validate_json(row.result_json)
        out.append(
            ProblemOut(id=row.id, text=row.text, created_at=row.created_at, **result.model_dump())
        )
    return out


async def recent_problem_lines(session: AsyncSession, user_id: int, limit: int = 3) -> list[str]:
    """Short lines for the chat context: category and summary of the latest problems."""
    rows = await session.scalars(
        select(Problem)
        .where(Problem.user_id == user_id)
        .order_by(Problem.created_at.desc(), Problem.id.desc())
        .limit(limit)
    )
    lines = []
    for row in rows:
        try:
            summary = json.loads(row.result_json).get("summary", "")
        except json.JSONDecodeError:
            summary = ""
        lines.append(f"- {row.category}: {summary[:160]}")
    return lines
