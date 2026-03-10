"""
回測引擎 API 路由
提供回測執行、策略查詢等功能
"""
from fastapi import APIRouter, HTTPException
from app.schemas.backtest import BacktestRequest, BacktestResponse, StrategiesResponse
from app.services.backtest_engine import backtest_engine, BacktestConfig
from app.services.sync import sync_service

router = APIRouter()


@router.get("/strategies", response_model=StrategiesResponse, summary="取得可用策略清單")
async def list_strategies():
    """列出所有可用的回測策略及其參數說明"""
    return {
        "strategies": [
            {
                "id": "ma_cross",
                "name": "均線交叉策略",
                "description": "短均線上穿長均線時買入，下穿時賣出",
                "params": {
                    "fast_period": {"type": "int", "default": 20, "label": "短均線天數"},
                    "slow_period": {"type": "int", "default": 60, "label": "長均線天數"},
                },
                "icon": "📊",
            },
            {
                "id": "pe_value",
                "name": "本益比估值策略",
                "description": "股價處於近一年低位 20% 時買入，高位 80% 時賣出",
                "params": {},
                "icon": "💎",
            },
            {
                "id": "dividend_yield",
                "name": "殖利率策略",
                "description": "股價低於 MA200 的 85% 時買入，高於 115% 時賣出",
                "params": {},
                "icon": "💰",
            },
            {
                "id": "buy_and_hold",
                "name": "買入持有",
                "description": "第一天全額買入並持有到結束",
                "params": {},
                "icon": "🏦",
            },
            {
                "id": "monthly_dca",
                "name": "每月定期定額",
                "description": "每月第一個交易日買入一張",
                "params": {},
                "icon": "📅",
            },
        ]
    }


@router.post("/run", response_model=BacktestResponse, summary="執行回測")
async def run_backtest(request: BacktestRequest):
    """
    執行回測

    ⚠️ 需要事先同步好目標股票的日線資料
    如果沒有資料，會使用 Mock 資料進行回測
    """
    # 取得目標股票價格
    prices = await _get_price_data(request.stock_id)

    # 取得 0050 大盤基準
    benchmark_prices = await _get_price_data("0050")

    config = BacktestConfig(
        stock_id=request.stock_id,
        strategy=request.strategy,
        start_date=request.start_date,
        end_date=request.end_date,
        initial_capital=request.initial_capital,
        params=request.params,
    )

    try:
        result = backtest_engine.run(prices, benchmark_prices, config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"回測錯誤: {str(e)}")

    return BacktestResponse(
        config=result.config,
        total_return=result.total_return,
        annualized_return=result.annualized_return,
        max_drawdown=result.max_drawdown,
        win_rate=result.win_rate,
        total_trades=result.total_trades,
        sharpe_ratio=result.sharpe_ratio,
        final_value=result.final_value,
        equity_curve=result.equity_curve,
        trades=result.trades,
        benchmark_return=result.benchmark_return,
        benchmark_curve=result.benchmark_curve,
    )


async def _get_price_data(stock_id: str) -> list[dict]:
    """
    取得價格資料
    優先嘗試從資料庫取，若無則使用 Mock
    """
    try:
        from app.database import async_session
        from app.models.stock import DailyPrice
        from sqlalchemy import select

        async with async_session() as session:
            stmt = (
                select(DailyPrice)
                .where(DailyPrice.stock_id == stock_id)
                .order_by(DailyPrice.date.asc())
            )
            result = await session.execute(stmt)
            rows = result.scalars().all()

            if rows and len(rows) > 100:
                return [
                    {
                        "date": r.date.isoformat(),
                        "open": float(r.open) if r.open else 0,
                        "high": float(r.high) if r.high else 0,
                        "low": float(r.low) if r.low else 0,
                        "close": float(r.close) if r.close else 0,
                    }
                    for r in rows
                ]
    except Exception:
        pass

    # Fallback: 生成 Mock 資料
    return _generate_mock_prices(stock_id)


def _generate_mock_prices(stock_id: str, years: int = 5) -> list[dict]:
    """生成回測用 Mock 價格資料"""
    import random
    from datetime import date, timedelta

    base_prices = {
        "2330": 550, "2317": 100, "2454": 700, "2308": 280,
        "2881": 55, "2882": 45, "2412": 110, "2002": 26,
        "0050": 120, "0056": 32,
    }
    base = base_prices.get(stock_id, 100)
    prices = []
    price = base * 0.7
    current = date.today() - timedelta(days=365 * years)
    end = date.today()

    random.seed(hash(stock_id))  # 確保同一股票產生一致的 Mock 數據

    while current <= end:
        if current.weekday() < 5:  # 跳過週末
            change = (random.random() - 0.48) * base * 0.025
            price = max(price + change, base * 0.3)
            high = price + random.random() * base * 0.015
            low = price - random.random() * base * 0.015
            open_p = low + random.random() * (high - low)

            prices.append({
                "date": current.isoformat(),
                "open": round(open_p, 2),
                "high": round(high, 2),
                "low": round(low, 2),
                "close": round(price, 2),
            })
        current += timedelta(days=1)

    return prices
