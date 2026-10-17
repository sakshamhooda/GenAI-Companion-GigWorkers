"""Connectors: list, connect (demo / interest), disconnect, and screenshot import."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import ratelimit
from app.auth import get_current_user
from app.connectors import BY_ID, CONNECTORS, IMPLEMENTATIONS, DemoConnector
from app.db import get_session
from app.llm import _get_client, aextract_json_multimodal
from app.models import Connection, User
from app.schemas import ConnectorOut, ConnectResult, ScreenshotEntry, ScreenshotImportOut
from app.util import split_csv

router = APIRouter(prefix="/connectors", tags=["connectors"])

MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}

SCREENSHOT_SYSTEM = """You read a screenshot of a gig platform's earnings or payout screen
(Swiggy, Zomato, Blinkit, Zepto, Uber, Ola, Rapido, Amazon Flex, Urban Company or similar).
Return ONLY JSON: {"platform": string, "entries": [{"date": ISO date or null, "amount": number,
"expenses": number, "hours": number or null, "note": short string}]}.
One entry per day or payout line visible. amount = rupees earned; expenses = deductions or
fuel shown (0 if none). Do not invent lines that are not on the screen."""

STUB_IMPORT = {
    "platform": "Zomato",
    "entries": [{"date": None, "amount": 850, "expenses": 0, "hours": None, "note": "[stub]"}],
}


async def _status_map(session: AsyncSession, user_id: int) -> dict[str, str]:
    rows = await session.scalars(select(Connection).where(Connection.user_id == user_id))
    return {c.connector: c.status for c in rows}


@router.get("", response_model=list[ConnectorOut])
async def list_connectors(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ConnectorOut]:
    statuses = await _status_map(session, user.id)
    return [
        ConnectorOut(
            id=c.id,
            name=c.name,
            kind=c.kind,
            description=c.description,
            icon=c.icon,
            status=statuses.get(c.id, "none"),
        )
        for c in CONNECTORS
    ]


async def _upsert(session: AsyncSession, user_id: int, connector: str, state: str) -> None:
    row = await session.scalar(
        select(Connection).where(Connection.user_id == user_id, Connection.connector == connector)
    )
    if row is None:
        session.add(Connection(user_id=user_id, connector=connector, status=state))
    else:
        row.status = state


@router.post("/{connector_id}/connect", response_model=ConnectResult)
async def connect(
    connector_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ConnectResult:
    info = BY_ID.get(connector_id)
    if info is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown connector")
    if info.kind == "available":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Use the import endpoint for this one")
    if info.kind == "coming_soon":
        await _upsert(session, user.id, connector_id, "interested")
        await session.commit()
        return ConnectResult(status="interested")
    impl = IMPLEMENTATIONS[connector_id]
    created = await impl.sync(user, session, date.today() - timedelta(days=30))
    await _upsert(session, user.id, connector_id, "connected")
    await session.commit()
    return ConnectResult(status="connected", synced=len(created))


@router.delete("/{connector_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect(
    connector_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    if connector_id not in BY_ID:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown connector")
    row = await session.scalar(
        select(Connection).where(
            Connection.user_id == user.id, Connection.connector == connector_id
        )
    )
    if row is not None:
        await session.delete(row)
    impl = IMPLEMENTATIONS.get(connector_id)
    if isinstance(impl, DemoConnector):
        await impl.disconnect(user, session)
    await session.commit()


@router.post(
    "/screenshot/import",
    response_model=ScreenshotImportOut,
    dependencies=[Depends(ratelimit.per_user("screenshot-import", 10))],
)
async def import_screenshot(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> ScreenshotImportOut:
    """Read a payout screenshot and propose entries. Nothing is saved until the worker confirms."""
    content_type = (file.content_type or "").lower()
    if content_type not in IMAGE_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload a PNG, JPEG or WebP")
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image larger than 5 MB")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty image")
    platforms = split_csv(user.platform)
    if _get_client() is None:
        result = dict(STUB_IMPORT)
    else:
        prompt = (
            f"Today's date: {date.today().isoformat()}. "
            f"Worker's platforms: {', '.join(platforms) or 'unknown'}."
        )
        result = await aextract_json_multimodal(prompt, data, content_type, SCREENSHOT_SYSTEM)
    entries: list[ScreenshotEntry] = []
    for raw in result.get("entries") or []:
        if not isinstance(raw, dict):
            continue
        try:
            entries.append(ScreenshotEntry.model_validate(raw))
        except ValueError:
            continue
    platform = str(result.get("platform") or (platforms[0] if platforms else ""))
    return ScreenshotImportOut(platform=platform, entries=entries)
