"""Platform connectors.

Gig platforms do not expose worker-facing APIs today, so most connectors are listed as
"coming soon" and only record interest. The registry and the ``Connector`` protocol are
the seam a real integration (for example an MCP server for a platform) plugs into: add a
class with ``sync`` and register it in ``IMPLEMENTATIONS``.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Earning, User

DEMO_PLATFORM = "Sample Platform"


@dataclass(frozen=True)
class ConnectorInfo:
    id: str
    name: str
    kind: str  # available | demo | coming_soon
    description: str
    icon: str


CONNECTORS: list[ConnectorInfo] = [
    ConnectorInfo(
        "screenshot",
        "Import a payout screenshot",
        "available",
        "Upload a screenshot of your earnings screen; Saathi reads the numbers for you.",
        "📷",
    ),
    ConnectorInfo(
        "demo",
        "Sample platform (demo data)",
        "demo",
        "Connect a sample platform to see how automatic syncing will work.",
        "🧪",
    ),
    ConnectorInfo("swiggy", "Swiggy", "coming_soon", "Automatic earnings sync.", "🛵"),
    ConnectorInfo("zomato", "Zomato", "coming_soon", "Automatic earnings sync.", "🍽️"),
    ConnectorInfo("uber", "Uber", "coming_soon", "Trips and payouts.", "🚗"),
    ConnectorInfo("ola", "Ola", "coming_soon", "Trips and payouts.", "🚕"),
    ConnectorInfo("rapido", "Rapido", "coming_soon", "Rides and payouts.", "🏍️"),
    ConnectorInfo("amazon_flex", "Amazon Flex", "coming_soon", "Blocks and payouts.", "📦"),
    ConnectorInfo("urban_company", "Urban Company", "coming_soon", "Jobs and payouts.", "🧰"),
    ConnectorInfo("eshram", "e-Shram", "coming_soon", "Registration status and benefits.", "🪪"),
]

BY_ID: dict[str, ConnectorInfo] = {c.id: c for c in CONNECTORS}


class Connector(Protocol):
    """A source of earnings entries for a worker."""

    async def sync(self, user: User, session: AsyncSession, since: date) -> list[Earning]:
        """Create any entries missing since ``since`` and return the ones created."""
        ...


class DemoConnector:
    """Creates five sample entries for the last five days, once per worker."""

    _SAMPLE = [
        (5, 640, 90, 4.5),
        (4, 720, 100, 5),
        (3, 580, 80, 4),
        (2, 810, 120, 6),
        (1, 700, 95, 5),
    ]

    async def sync(self, user: User, session: AsyncSession, since: date) -> list[Earning]:
        existing = await session.scalar(
            select(Earning.id).where(Earning.user_id == user.id, Earning.platform == DEMO_PLATFORM)
        )
        if existing is not None:
            return []
        today = date.today()
        created = [
            Earning(
                user_id=user.id,
                date=today - timedelta(days=days_ago),
                amount=amount,
                expenses=expenses,
                hours=hours,
                platform=DEMO_PLATFORM,
                note="synced from sample platform",
            )
            for days_ago, amount, expenses, hours in self._SAMPLE
            if today - timedelta(days=days_ago) >= since
        ]
        session.add_all(created)
        await session.flush()
        return created

    async def disconnect(self, user: User, session: AsyncSession) -> None:
        rows = await session.scalars(
            select(Earning).where(Earning.user_id == user.id, Earning.platform == DEMO_PLATFORM)
        )
        for row in rows:
            await session.delete(row)


IMPLEMENTATIONS: dict[str, Connector] = {"demo": DemoConnector()}
