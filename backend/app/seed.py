"""Idempotent demo data so evaluators can log in without registering."""

from datetime import date, timedelta

from sqlalchemy import select

from app.auth import hash_pin
from app.db import get_engine, get_sessionmaker
from app.models import Earning, User
from app.util import join_csv

DEMO_PHONE = "9999999999"
DEMO_PIN = "1234"  # not a secret: shown on the landing page for evaluators
DEMO_PLATFORMS = ["Zomato", "Swiggy"]
DEMO_WORK_TYPES = ["delivery"]

_DEMO_EARNINGS = [
    (6, 720, 110, "Zomato", "12 orders, evening", 5.0),
    (5, 850, 120, "Zomato", "15 orders", 6.0),
    (4, 600, 80, "Swiggy", "rain, slow day", 4.0),
    (3, 950, 150, "Zomato", "weekend surge", 7.0),
    (2, 780, 100, "Swiggy", "14 orders", 5.5),
    (1, 690, 90, "Zomato", "one order cancelled, ₹50 deducted", 5.0),
]


async def seed_demo() -> None:
    """Create the demo worker and a week of earnings; on re-runs only refresh the profile lists.

    Safe to call on every startup. Does nothing when no database is configured.
    """
    if get_engine() is None:
        return
    async with get_sessionmaker()() as session:
        user = await session.scalar(select(User).where(User.phone == DEMO_PHONE))
        if user is not None:
            # Keep the demo profile current without touching anything else, and backfill
            # hours on seeded entries created before migration 0004.
            user.platform = join_csv(DEMO_PLATFORMS)
            user.work_type = join_csv(DEMO_WORK_TYPES)
            rows = await session.scalars(
                select(Earning).where(Earning.user_id == user.id, Earning.hours.is_(None))
            )
            today = date.today()
            by_date = {today - timedelta(days=d): h for d, _, _, _, _, h in _DEMO_EARNINGS}
            for row in rows:
                row.hours = by_date.get(row.date, 5.0)
            await session.commit()
            return
        user = User(
            phone=DEMO_PHONE,
            pin_hash=hash_pin(DEMO_PIN),
            name="Ramesh",
            language="hi",
            work_type=join_csv(DEMO_WORK_TYPES),
            platform=join_csv(DEMO_PLATFORMS),
            city="Jaipur",
            memory="Delivers for Zomato and Swiggy in Jaipur, mostly evening shifts.",
        )
        session.add(user)
        await session.flush()
        today = date.today()
        for days_ago, amount, expenses, platform, note, hours in _DEMO_EARNINGS:
            session.add(
                Earning(
                    user_id=user.id,
                    date=today - timedelta(days=days_ago),
                    amount=amount,
                    expenses=expenses,
                    platform=platform,
                    note=note,
                    hours=hours,
                )
            )
        await session.commit()
