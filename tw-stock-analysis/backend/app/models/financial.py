"""
ORM Models — 財務報表相關資料表
"""
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StockPER(Base):
    """本益比 / 股價淨值比"""
    __tablename__ = "stock_per"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    stock_id: Mapped[str] = mapped_column(String(10), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    per: Mapped[float | None] = mapped_column(Numeric(12, 4))
    pbr: Mapped[float | None] = mapped_column(Numeric(12, 4))
    dividend_yield: Mapped[float | None] = mapped_column(Numeric(8, 4))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_stock_per_stock_date", "stock_id", "date", unique=True),
    )


class FinancialStatement(Base):
    """財務報表 — 長表格式 (type + value)"""
    __tablename__ = "financial_statement"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    stock_id: Mapped[str] = mapped_column(String(10), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    type: Mapped[str] = mapped_column(String(200), nullable=False)
    value: Mapped[float | None] = mapped_column(Numeric(20, 4))
    origin_name: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_financial_stock_date", "stock_id", "date"),
        Index("idx_financial_type", "type", "stock_id"),
    )


class MonthlyRevenue(Base):
    """月營收"""
    __tablename__ = "monthly_revenue"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    stock_id: Mapped[str] = mapped_column(String(10), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    country: Mapped[str | None] = mapped_column(String(10), default="TW")
    revenue: Mapped[int | None] = mapped_column(BigInteger)
    revenue_month: Mapped[int | None]
    revenue_year: Mapped[int | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_monthly_revenue_stock_date", "stock_id", "date", unique=True),
    )
