"""
ORM Model — 資料同步紀錄
"""
from datetime import datetime

from sqlalchemy import BigInteger, Integer, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SyncLog(Base):
    """資料同步紀錄"""
    __tablename__ = "sync_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset: Mapped[str] = mapped_column(String(100), nullable=False)
    stock_id: Mapped[str | None] = mapped_column(String(10))
    sync_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sync_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")
    records_synced: Mapped[int | None] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
