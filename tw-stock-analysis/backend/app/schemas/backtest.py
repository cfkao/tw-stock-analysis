"""
回測 Pydantic Schemas
"""
from pydantic import BaseModel, Field
from typing import Any


class BacktestRequest(BaseModel):
    """回測請求"""
    stock_id: str = Field(description="股票代碼, e.g. '2330'")
    strategy: str = Field(
        description="策略名稱: ma_cross, pe_value, dividend_yield, buy_and_hold, monthly_dca"
    )
    start_date: str = Field(description="回測起始日 YYYY-MM-DD")
    end_date: str | None = Field(default=None, description="回測結束日")
    initial_capital: float = Field(default=1_000_000, ge=100_000, description="初始資金")
    params: dict[str, Any] = Field(default_factory=dict, description="策略參數")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "stock_id": "2330",
                    "strategy": "ma_cross",
                    "start_date": "2020-01-01",
                    "initial_capital": 1000000,
                    "params": {"fast_period": 20, "slow_period": 60},
                }
            ]
        }
    }


class TradeRecord(BaseModel):
    """交易紀錄"""
    date: str
    action: str
    price: float
    shares: int
    cost: float
    reason: str


class BacktestResponse(BaseModel):
    """回測結果"""
    config: dict[str, Any]
    # 績效指標
    total_return: float = Field(description="總報酬率 (%)")
    annualized_return: float = Field(description="年化報酬率 (%)")
    max_drawdown: float = Field(description="最大回撤 (%)")
    win_rate: float = Field(description="勝率 (%)")
    total_trades: int = Field(description="總交易次數")
    sharpe_ratio: float = Field(description="Sharpe Ratio")
    final_value: float = Field(description="最終資產")
    # 序列
    equity_curve: list[dict[str, Any]] = Field(description="資產曲線")
    trades: list[TradeRecord] = Field(description="交易紀錄")
    benchmark_return: float = Field(description="大盤報酬率 (%)")
    benchmark_curve: list[dict[str, Any]] = Field(description="大盤曲線")


class StrategiesResponse(BaseModel):
    """可用策略清單"""
    strategies: list[dict[str, Any]]
