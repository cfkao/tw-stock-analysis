"""
ORM Models — 股票相關資料表
"""
from datetime import date, datetime

from sqlalchemy import BigInteger, Integer, Boolean, Date, DateTime, Index, Numeric, String, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StockInfo(Base):
    """股票基本資訊"""
    __tablename__ = "stock_info"

    stock_id: Mapped[str] = mapped_column(String(10), primary_key=True)
    stock_name: Mapped[str] = mapped_column(String(100), nullable=False)
    industry_category: Mapped[str | None] = mapped_column(String(100))
    market_type: Mapped[str] = mapped_column(String(20), nullable=False, default="twse")
    listed_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DailyPrice(Base):
    """日線價格"""
    __tablename__ = "daily_price"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stock_id: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    trading_volume: Mapped[int | None] = mapped_column(BigInteger)
    trading_money: Mapped[int | None] = mapped_column(BigInteger)
    open: Mapped[float | None] = mapped_column(Numeric(12, 2))
    high: Mapped[float | None] = mapped_column(Numeric(12, 2))
    low: Mapped[float | None] = mapped_column(Numeric(12, 2))
    close: Mapped[float | None] = mapped_column(Numeric(12, 2))
    spread: Mapped[float | None] = mapped_column(Numeric(12, 2))
    trading_turnover: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_daily_price_stock_date", "stock_id", "date", unique=True),
        UniqueConstraint("stock_id", "date", name="uq_daily_price_stock_date"),
    )


class StockNewsAnalysis(Base):
    """個股新聞 LLM 洞察分析 (快取表)"""
    __tablename__ = "stock_news_analysis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stock_id: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    analysis_date: Mapped[date] = mapped_column(Date, nullable=False, default=func.current_date())
    
    # 儲存 JSON 字串
    sentiment_score: Mapped[int] = mapped_column(Integer, nullable=False)
    themes: Mapped[str] = mapped_column(String, nullable=False) # JSON literal
    pros: Mapped[str] = mapped_column(String, nullable=False)   # JSON literal
    cons: Mapped[str] = mapped_column(String, nullable=False)   # JSON literal
    summary: Mapped[str] = mapped_column(String, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # 每天只允許一筆快取
        Index("idx_news_analysis_stock_date", "stock_id", "analysis_date", unique=True),
        UniqueConstraint("stock_id", "analysis_date", name="uq_news_analysis_stock_date"),
    )

