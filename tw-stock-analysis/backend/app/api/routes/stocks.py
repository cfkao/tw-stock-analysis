"""
股票相關 API 路由
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.stock import StockInfo, DailyPrice
from app.schemas.stock import StockInfoResponse, DailyPriceResponse

router = APIRouter()


@router.get("/search", response_model=list[StockInfoResponse])
async def search_stocks(
    keyword: str = Query(..., min_length=1, description="搜尋關鍵字（代碼或名稱）"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """搜尋股票 — 支援代碼與名稱模糊搜尋"""
    stmt = (
        select(StockInfo)
        .where(
            StockInfo.is_active == True,
            or_(
                StockInfo.stock_id.ilike(f"%{keyword}%"),
                StockInfo.stock_name.ilike(f"%{keyword}%"),
            ),
        )
        .limit(limit)
    )
    result = await db.execute(stmt)
    stocks = result.scalars().all()
    return stocks


@router.get("/{stock_id}", response_model=StockInfoResponse)
async def get_stock_info(
    stock_id: str,
    db: AsyncSession = Depends(get_db),
):
    """取得個股基本資訊"""
    stmt = select(StockInfo).where(StockInfo.stock_id == stock_id)
    result = await db.execute(stmt)
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail=f"找不到股票: {stock_id}")
    return stock


@router.get("/{stock_id}/prices", response_model=list[DailyPriceResponse])
async def get_stock_prices(
    stock_id: str,
    start_date: date = Query(default=None, description="起始日期"),
    end_date: date = Query(default=None, description="結束日期"),
    db: AsyncSession = Depends(get_db),
):
    """取得個股歷史價格 — 用於 K 線圖"""
    if not start_date:
        start_date = date.today() - timedelta(days=365)
    if not end_date:
        end_date = date.today()

    stmt = (
        select(DailyPrice)
        .where(
            DailyPrice.stock_id == stock_id,
            DailyPrice.date >= start_date,
            DailyPrice.date <= end_date,
        )
        .order_by(DailyPrice.date.asc())
    )
    result = await db.execute(stmt)
    prices = result.scalars().all()

    # 自動補齊機制：如果查不到任何資料，即時觸發同步 (抓近一年)
    if not prices:
        from app.services.sync import sync_service
        try:
            sync_start = (date.today() - timedelta(days=365)).isoformat()
            await sync_service.sync_daily_prices(stock_id=stock_id, start_date=sync_start)
            # 同步完成後再查一次
            result = await db.execute(stmt)
            prices = result.scalars().all()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"自動同步 {stock_id} 股價失敗: {e}")

    return prices
