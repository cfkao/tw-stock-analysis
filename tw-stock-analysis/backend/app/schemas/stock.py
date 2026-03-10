"""
Pydantic Schemas — 股票相關 API 請求/回應格式
"""
from datetime import date
from pydantic import BaseModel


class StockInfoResponse(BaseModel):
    stock_id: str
    stock_name: str
    industry_category: str | None = None
    market_type: str
    is_active: bool

    class Config:
        from_attributes = True


class DailyPriceResponse(BaseModel):
    date: date
    open: float | None
    high: float | None
    low: float | None
    close: float | None
    trading_volume: int | None
    spread: float | None

    class Config:
        from_attributes = True


class StockSearchQuery(BaseModel):
    """股票搜尋參數"""
    keyword: str | None = None
    industry: str | None = None
    market_type: str | None = None


class PriceQuery(BaseModel):
    """價格查詢參數"""
    stock_id: str
    start_date: date | None = None
    end_date: date | None = None
    period: str = "daily"  # daily / weekly / monthly
