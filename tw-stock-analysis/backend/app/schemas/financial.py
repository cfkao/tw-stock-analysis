"""
Pydantic Schemas — 財務報表相關
"""
from datetime import date
from pydantic import BaseModel


class StockPERResponse(BaseModel):
    date: date
    per: float | None
    pbr: float | None
    dividend_yield: float | None

    class Config:
        from_attributes = True


class FinancialStatementResponse(BaseModel):
    date: date
    source: str
    type: str
    value: float | None
    origin_name: str | None

    class Config:
        from_attributes = True


class HealthCheckResult(BaseModel):
    """財務健診結果"""
    stock_id: str
    stock_name: str
    roe_trend: list[dict]           # ROE 趨勢 (近 8 季)
    fcf_trend: list[dict]           # 自由現金流趨勢
    gross_margin_trend: list[dict]  # 毛利率趨勢
    op_margin_trend: list[dict]     # 營益率趨勢
    pe_band: dict                   # P/E Band 資料
    verdict: str                    # 綜合評語


class PEBandData(BaseModel):
    """P/E Band 圖表資料"""
    stock_id: str
    dates: list[date]
    prices: list[float]
    pe_high: list[float]     # 歷史高 PE 線
    pe_mean: list[float]     # 平均 PE 線
    pe_low: list[float]      # 歷史低 PE 線
    current_zone: str        # cheap / fair / expensive
