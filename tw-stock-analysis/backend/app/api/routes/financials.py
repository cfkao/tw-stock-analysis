"""
財務報表 API 路由
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.financial import StockPER, FinancialStatement, MonthlyRevenue
from app.schemas.financial import StockPERResponse, FinancialStatementResponse

router = APIRouter()


@router.get("/{stock_id}/per", response_model=list[StockPERResponse])
async def get_stock_per(
    stock_id: str,
    start_date: date = Query(default=None),
    end_date: date = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """取得個股本益比 / 股價淨值比 — 用於 P/E Band 圖"""
    if not start_date:
        start_date = date.today() - timedelta(days=365 * 5)  # 預設 5 年
    if not end_date:
        end_date = date.today()

    stmt = (
        select(StockPER)
        .where(
            StockPER.stock_id == stock_id,
            StockPER.date >= start_date,
            StockPER.date <= end_date,
        )
        .order_by(StockPER.date.asc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{stock_id}/statements", response_model=list[FinancialStatementResponse])
async def get_financial_statements(
    stock_id: str,
    source: str = Query(default=None, description="報表來源: income_statement, cash_flow, balance_sheet"),
    start_date: date = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """取得個股財務報表 — 用於財務健診"""
    if not start_date:
        start_date = date.today() - timedelta(days=365 * 10)

    stmt = select(FinancialStatement).where(
        FinancialStatement.stock_id == stock_id,
        FinancialStatement.date >= start_date,
    )
    if source:
        stmt = stmt.where(FinancialStatement.source == source)
    stmt = stmt.order_by(FinancialStatement.date.asc())

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{stock_id}/revenue")
async def get_monthly_revenue(
    stock_id: str,
    start_date: date = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """取得個股月營收"""
    if not start_date:
        start_date = date.today() - timedelta(days=365 * 3)

    stmt = (
        select(MonthlyRevenue)
        .where(
            MonthlyRevenue.stock_id == stock_id,
            MonthlyRevenue.date >= start_date,
        )
        .order_by(MonthlyRevenue.date.asc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()
