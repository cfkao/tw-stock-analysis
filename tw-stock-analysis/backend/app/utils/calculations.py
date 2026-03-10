"""
財務指標計算工具
提供 ROE、FCF、毛利率、營益率等指標的計算與資料清洗
"""
from datetime import date, timedelta
from typing import Any

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.financial import FinancialStatement, StockPER, MonthlyRevenue
from app.models.stock import DailyPrice


async def calculate_roe_trend(
    session: AsyncSession,
    stock_id: str,
    quarters: int = 8,
) -> list[dict]:
    """
    計算 ROE 趨勢 (近 N 季)
    ROE = 稅後淨利 / 股東權益
    FinMind type: 'ReturnOnEquity' 或需透過 淨利/權益 計算
    """
    stmt = (
        select(FinancialStatement)
        .where(
            FinancialStatement.stock_id == stock_id,
            FinancialStatement.type.in_(["ReturnOnEquity", "ROE(%)"]),
        )
        .order_by(FinancialStatement.date.desc())
        .limit(quarters)
    )
    result = await session.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "date": row.date.isoformat(),
            "value": float(row.value) if row.value else None,
            "label": row.origin_name or "ROE",
        }
        for row in reversed(rows)
    ]


async def calculate_fcf_trend(
    session: AsyncSession,
    stock_id: str,
    quarters: int = 8,
) -> list[dict]:
    """
    計算自由現金流趨勢 (近 N 季)
    FCF = 營業活動現金流 - 資本支出
    FinMind cash_flow type: 'CashFlowsFromOperatingActivities', 'CapitalExpenditures'
    """
    # 取營業現金流
    operating_cf = await _get_financial_values(
        session, stock_id, "cash_flow",
        ["CashFlowsFromOperatingActivities", "營業活動之淨現金流入（流出）"],
        quarters,
    )

    # 取資本支出 (近似: 取得不動產、廠房及設備)
    capex = await _get_financial_values(
        session, stock_id, "cash_flow",
        ["CapitalExpenditures", "取得不動產、廠房及設備"],
        quarters,
    )

    # 合併計算 FCF
    fcf_data = []
    for op_row in operating_cf:
        cap_value = next(
            (c["value"] for c in capex if c["date"] == op_row["date"]),
            0,
        )
        fcf = (op_row["value"] or 0) - abs(cap_value or 0)
        fcf_data.append({
            "date": op_row["date"],
            "value": fcf,
            "label": "自由現金流",
        })

    return fcf_data


async def calculate_margin_trends(
    session: AsyncSession,
    stock_id: str,
    quarters: int = 8,
) -> dict[str, list[dict]]:
    """
    計算毛利率與營益率趨勢
    """
    gross_margin = await _get_financial_values(
        session, stock_id, "income_statement",
        ["GrossProfit", "毛利率(%)"],
        quarters,
    )

    op_margin = await _get_financial_values(
        session, stock_id, "income_statement",
        ["OperatingIncome", "營益率(%)"],
        quarters,
    )

    return {
        "gross_margin": gross_margin,
        "operating_margin": op_margin,
    }


async def calculate_pe_band(
    session: AsyncSession,
    stock_id: str,
    years: int = 5,
) -> dict[str, Any]:
    """
    計算 P/E Band (本益比河流圖)

    返回:
    - dates: 日期序列
    - prices: 股價序列
    - pe_high / pe_mean / pe_low: 本益比線
    - current_zone: 目前位於哪個區間
    """
    start = date.today() - timedelta(days=365 * years)

    # 取得 PER 資料
    stmt = (
        select(StockPER)
        .where(
            StockPER.stock_id == stock_id,
            StockPER.date >= start,
        )
        .order_by(StockPER.date.asc())
    )
    result = await session.execute(stmt)
    per_rows = result.scalars().all()

    if not per_rows:
        return {"error": "無 PER 資料"}

    # 計算 PER 統計值
    per_values = [float(r.per) for r in per_rows if r.per and float(r.per) > 0]
    if not per_values:
        return {"error": "無有效 PER 資料"}

    per_values.sort()
    per_high = per_values[int(len(per_values) * 0.9)]    # 90 百分位
    per_mean = sum(per_values) / len(per_values)          # 平均值
    per_low = per_values[int(len(per_values) * 0.1)]      # 10 百分位

    # 取得對應的價格與 EPS 來畫 P/E Band
    dates = [r.date.isoformat() for r in per_rows]
    per_series = [float(r.per) if r.per else None for r in per_rows]

    # 判斷目前位於哪個區間
    current_per = per_values[-1] if per_values else 0
    if current_per <= per_low:
        zone = "cheap"      # 便宜
    elif current_per >= per_high:
        zone = "expensive"  # 昂貴
    else:
        zone = "fair"       # 合理

    return {
        "stock_id": stock_id,
        "dates": dates,
        "per_values": per_series,
        "pe_high": per_high,
        "pe_mean": round(per_mean, 2),
        "pe_low": per_low,
        "current_per": current_per,
        "current_zone": zone,
        "total_data_points": len(per_rows),
    }


async def calculate_dividend_yield_history(
    session: AsyncSession,
    stock_id: str,
    years: int = 10,
) -> list[dict]:
    """
    計算歷史殖利率
    """
    start = date.today() - timedelta(days=365 * years)

    from app.models.dividend import DividendHistory
    stmt = (
        select(DividendHistory)
        .where(
            DividendHistory.stock_id == stock_id,
            DividendHistory.date >= start,
        )
        .order_by(DividendHistory.date.asc())
    )
    result = await session.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "year": row.year,
            "date": row.date.isoformat(),
            "cash_dividend": float(
                (row.cash_earnings_distribution or 0) +
                (row.cash_statutory_surplus or 0)
            ),
            "stock_dividend": float(
                (row.stock_earnings_distribution or 0) +
                (row.stock_statutory_surplus or 0)
            ),
            "total_dividend": float(
                (row.cash_earnings_distribution or 0) +
                (row.cash_statutory_surplus or 0) +
                (row.stock_earnings_distribution or 0) +
                (row.stock_statutory_surplus or 0)
            ),
        }
        for row in rows
    ]


# ==============================
# 內部輔助函式
# ==============================

async def _get_financial_values(
    session: AsyncSession,
    stock_id: str,
    source: str,
    type_names: list[str],
    limit: int = 8,
) -> list[dict]:
    """
    從財務報表取得指定科目的值
    支援多個可能的 type 名稱 (中英文都嘗試)
    """
    stmt = (
        select(FinancialStatement)
        .where(
            FinancialStatement.stock_id == stock_id,
            FinancialStatement.source == source,
            FinancialStatement.type.in_(type_names),
        )
        .order_by(FinancialStatement.date.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "date": row.date.isoformat(),
            "value": float(row.value) if row.value else None,
            "label": row.origin_name or row.type,
        }
        for row in reversed(rows)
    ]
