"""Idempotent demo data so evaluators can log in without registering."""

from datetime import date, timedelta

from sqlalchemy import select

from app.auth import hash_pin
from app.db import get_engine, get_sessionmaker
from app.models import Earning, User

DEMO_PHONE = "9999999999"
DEMO_PIN = "1234"  # not a secret: shown on the landing page for evaluators

_DEMO_EARNINGS = [
    (6, 720, 110, "12 orders, evening"),
    (5, 850, 120, "15 orders"),
    (4, 600, 80, "rain, slow day"),
    (3, 950, 150, "weekend surge"),
    (2, 780, 100, "14 orders"),
    (1, 690, 90, "one order cancelled, ₹50 deducted"),
]


async def seed_demo() -> None:
    if get_engine() is None:
        return
    async with get_sessionmaker()() as session:
        user = await session.scalar(select(User).where(User.phone == DEMO_PHONE))
        if user is None:
            user = User(
                phone=DEMO_PHONE,
                pin_hash=hash_pin(DEMO_PIN),
                name="Ramesh",
                language="hi",
                work_type="delivery",
                platform="Zomato",
                city="Jaipur",
                memory="Delivers for Zomato in Jaipur, mostly evening shifts.",
            )
            session.add(user)
            await session.flush()
            today = date.today()
            for days_ago, amount, expenses, note in _DEMO_EARNINGS:
                session.add(
                    Earning(
                        user_id=user.id,
                        date=today - timedelta(days=days_ago),
                        amount=amount,
                        expenses=expenses,
                        platform="Zomato",
                        note=note,
                    )
                )
            await session.commit()
