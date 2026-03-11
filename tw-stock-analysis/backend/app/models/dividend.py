"""
ORM Models — 股利紀錄
"""
from datetime import date, datetime

from sqlalchemy import BigInteger, Integer, Date, DateTime, Index, Numeric, String, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DividendHistory(Base):
    """股利政策紀錄"""
    __tablename__ = "dividend_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stock_id: Mapped[str] = mapped_column(String(10), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    year: Mapped[str | None] = mapped_column(String(10))
    cash_earnings_distribution: Mapped[float | None] = mapped_column(Numeric(12, 4), default=0)
    cash_statutory_surplus: Mapped[float | None] = mapped_column(Numeric(12, 4), default=0)
    stock_earnings_distribution: Mapped[float | None] = mapped_column(Numeric(12, 4), default=0)
    stock_statutory_surplus: Mapped[float | None] = mapped_column(Numeric(12, 4), default=0)
    cash_ex_dividend_date: Mapped[date | None] = mapped_column(Date)
    stock_ex_dividend_date: Mapped[date | None] = mapped_column(Date)
    cash_dividend_payment_date: Mapped[date | None] = mapped_column(Date)
    announcement_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_dividend_stock", "stock_id", "date"),
        UniqueConstraint("stock_id", "date", name="uq_dividend_stock_date"),
    )
