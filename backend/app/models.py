"""ORM models. Keep in sync with `alembic/versions`; migrations are the source of truth."""

from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Phone + PIN login. Nullable because Google sign-in users may not have set one.
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, index=True, nullable=True)
    pin_hash: Mapped[str] = mapped_column(String(255))
    # Google sign-in (migration 0003).
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(100), default="")
    language: Mapped[str] = mapped_column(String(10), default="hi")
    # Comma-separated lists; see app.util.split_csv / join_csv.
    work_type: Mapped[str] = mapped_column(String(255), default="")
    platform: Mapped[str] = mapped_column(String(255), default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    memory: Mapped[str] = mapped_column(Text, default="")
    role: Mapped[str] = mapped_column(String(20), default="worker")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Earning(Base):
    __tablename__ = "earnings"
    __table_args__ = (Index("ix_earnings_user_date", "user_id", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Float)
    expenses: Mapped[float] = mapped_column(Float, default=0.0)
    platform: Mapped[str] = mapped_column(String(50), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    # Hours worked that day (migration 0004). Optional: workers often don't track it.
    hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    channel: Mapped[str] = mapped_column(String(20), default="web")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Grievance(Base):
    __tablename__ = "grievances"
    __table_args__ = (Index("ix_grievances_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text)
    draft_local: Mapped[str] = mapped_column(Text, default="")
    draft_english: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Connection(Base):
    """A worker's relationship with a platform connector (migration 0005)."""

    __tablename__ = "connections"
    __table_args__ = (
        UniqueConstraint("user_id", "connector", name="uq_connections_user_connector"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    connector: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20))  # connected | interested
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Problem(Base):
    """A "Meri Samasya" analysis: the worker's description and the structured result."""

    __tablename__ = "problems"
    __table_args__ = (Index("ix_problems_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text)
    result_json: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
