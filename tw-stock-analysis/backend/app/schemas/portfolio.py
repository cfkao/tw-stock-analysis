"""
Pydantic Schemas — 投資組合相關
"""
from datetime import date
from uuid import UUID

from pydantic import BaseModel


class PortfolioCreate(BaseModel):
    stock_id: str
    trade_type: str = "buy"
    trade_date: date
    price: float
    quantity: int
    fee: float = 0
    tax: float = 0
    notes: str | None = None


class PortfolioResponse(BaseModel):
    id: int
    stock_id: str
    trade_type: str
    trade_date: date
    price: float
    quantity: int
    fee: float | None
    tax: float | None
    notes: str | None

    class Config:
        from_attributes = True


class PortfolioSummary(BaseModel):
    """投資組合總覽"""
    total_cost: float            # 總投入成本
    total_market_value: float    # 總市值
    total_pnl: float             # 總損益
    total_pnl_percent: float     # 總報酬率 (%)
    holdings: list[dict]         # 各持股明細
    allocation: list[dict]       # 資產配置
