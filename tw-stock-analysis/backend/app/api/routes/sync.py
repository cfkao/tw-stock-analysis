"""
資料同步 API 路由
提供手動觸發同步、查詢同步狀態等功能
"""
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.sync_log import SyncLog
from app.services.sync import sync_service

router = APIRouter()


# ==============================
# 同步觸發 API
# ==============================

@router.post("/stock-info", summary="同步股票基本資訊")
async def trigger_sync_stock_info(background_tasks: BackgroundTasks):
    """
    觸發同步台股總覽 (TaiwanStockInfo)
    這是使用系統前的第一步：取得所有上市櫃股票清單
    """
    background_tasks.add_task(_run_sync_stock_info)
    return {
        "message": "股票基本資訊同步已啟動",
        "status": "running",
        "hint": "請透過 GET /api/v1/sync/status 查詢進度",
    }


@router.post("/stock/{stock_id}", summary="同步個股全部資料")
async def trigger_sync_stock(
    stock_id: str,
    background_tasks: BackgroundTasks,
):
    """
    觸發完整同步單檔個股的所有資料
    包含：日線價格、PER/PBR、財報三表、股利、月營收
    ⚠️ 首次同步約需 1-2 分鐘（受 FinMind API 速率限制）
    """
    background_tasks.add_task(_run_full_sync_stock, stock_id)
    return {
        "message": f"個股 {stock_id} 完整同步已啟動",
        "status": "running",
        "estimated_time": "1~2 分鐘",
    }


@router.post("/stock/{stock_id}/prices", summary="同步個股日線價格")
async def trigger_sync_prices(
    stock_id: str,
    start_date: str = Query(default=None, description="起始日期 (YYYY-MM-DD)"),
    background_tasks: BackgroundTasks = None,
):
    """同步個股日線價格"""
    result = await sync_service.sync_daily_prices(stock_id, start_date)
    return {"message": "同步完成", "result": result}


@router.post("/stock/{stock_id}/per", summary="同步個股 PER 資料")
async def trigger_sync_per(
    stock_id: str,
    start_date: str = Query(default=None),
):
    """同步個股 PER/PBR/殖利率"""
    result = await sync_service.sync_stock_per(stock_id, start_date)
    return {"message": "同步完成", "result": result}


@router.post("/stock/{stock_id}/financials", summary="同步個股財務三表")
async def trigger_sync_financials(
    stock_id: str,
    background_tasks: BackgroundTasks,
):
    """同步個股財務三表（損益表 + 現金流 + 資產負債表）"""
    background_tasks.add_task(_run_sync_financials, stock_id)
    return {
        "message": f"{stock_id} 財務三表同步已啟動",
        "status": "running",
    }


@router.post("/batch", summary="批次同步多檔個股")
async def trigger_batch_sync(
    stock_ids: list[str],
    sync_types: list[str] = Query(
        default=["daily_prices", "stock_per"],
        description="同步類型: daily_prices, stock_per, financial_statements, dividends, monthly_revenue",
    ),
    background_tasks: BackgroundTasks = None,
):
    """
    批次同步多檔個股
    ⚠️ 受 FinMind API 限制 (600 requests/hour)，建議每批不超過 50 檔
    """
    if len(stock_ids) > 100:
        raise HTTPException(status_code=400, detail="單次批次最多 100 檔股票")

    background_tasks.add_task(_run_batch_sync, stock_ids, sync_types)
    return {
        "message": f"批次同步已啟動: {len(stock_ids)} 檔",
        "stock_ids": stock_ids,
        "sync_types": sync_types,
        "status": "running",
    }


# ==============================
# 同步狀態查詢 API
# ==============================

@router.get("/status", summary="查詢同步狀態")
async def get_sync_status(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """查詢最近的同步紀錄"""
    stmt = (
        select(SyncLog)
        .order_by(desc(SyncLog.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return {
        "total": len(logs),
        "logs": [
            {
                "id": log.id,
                "dataset": log.dataset,
                "stock_id": log.stock_id,
                "status": log.status,
                "records_synced": log.records_synced,
                "sync_start": log.sync_start.isoformat() if log.sync_start else None,
                "sync_end": log.sync_end.isoformat() if log.sync_end else None,
                "error_message": log.error_message,
            }
            for log in logs
        ],
    }


# ==============================
# 背景任務實作
# ==============================

async def _run_sync_stock_info():
    """背景執行：同步股票資訊"""
    from app.database import async_session

    async with async_session() as session:
        log = SyncLog(
            dataset="TaiwanStockInfo",
            sync_start=datetime.now(timezone.utc),
            status="running",
        )
        session.add(log)
        await session.commit()
        await session.refresh(log)
        log_id = log.id

    try:
        result = await sync_service.sync_stock_info()

        async with async_session() as session:
            log = await session.get(SyncLog, log_id)
            log.status = "success"
            log.records_synced = result.get("processed", 0)
            log.sync_end = datetime.now(timezone.utc)
            await session.commit()

    except Exception as e:
        async with async_session() as session:
            log = await session.get(SyncLog, log_id)
            log.status = "failed"
            log.error_message = str(e)
            log.sync_end = datetime.now(timezone.utc)
            await session.commit()


async def _run_full_sync_stock(stock_id: str):
    """背景執行：完整同步個股"""
    from app.database import async_session

    async with async_session() as session:
        log = SyncLog(
            dataset="full_sync",
            stock_id=stock_id,
            sync_start=datetime.now(timezone.utc),
            status="running",
        )
        session.add(log)
        await session.commit()
        await session.refresh(log)
        log_id = log.id

    try:
        result = await sync_service.full_sync_stock(stock_id)
        total_records = sum(
            r.get("records", 0)
            for r in result.get("results", {}).values()
            if isinstance(r, dict) and "records" in r
        )

        async with async_session() as session:
            log = await session.get(SyncLog, log_id)
            log.status = "success"
            log.records_synced = total_records
            log.sync_end = datetime.now(timezone.utc)
            await session.commit()

    except Exception as e:
        async with async_session() as session:
            log = await session.get(SyncLog, log_id)
            log.status = "failed"
            log.error_message = str(e)
            log.sync_end = datetime.now(timezone.utc)
            await session.commit()


async def _run_sync_financials(stock_id: str):
    """背景執行：同步財務三表"""
    from app.database import async_session

    async with async_session() as session:
        log = SyncLog(
            dataset="financial_statements",
            stock_id=stock_id,
            sync_start=datetime.now(timezone.utc),
            status="running",
        )
        session.add(log)
        await session.commit()
        await session.refresh(log)
        log_id = log.id

    try:
        result = await sync_service.sync_financial_statements(stock_id)

        async with async_session() as session:
            log = await session.get(SyncLog, log_id)
            log.status = "success"
            log.records_synced = result.get("records", 0)
            log.sync_end = datetime.now(timezone.utc)
            await session.commit()

    except Exception as e:
        async with async_session() as session:
            log = await session.get(SyncLog, log_id)
            log.status = "failed"
            log.error_message = str(e)
            log.sync_end = datetime.now(timezone.utc)
            await session.commit()


async def _run_batch_sync(stock_ids: list[str], sync_types: list[str]):
    """背景執行：批次同步"""
    from app.database import async_session

    async with async_session() as session:
        log = SyncLog(
            dataset=f"batch_sync({','.join(sync_types)})",
            stock_id=",".join(stock_ids[:5]) + ("..." if len(stock_ids) > 5 else ""),
            sync_start=datetime.now(timezone.utc),
            status="running",
        )
        session.add(log)
        await session.commit()
        await session.refresh(log)
        log_id = log.id

    try:
        result = await sync_service.batch_sync(stock_ids, sync_types)
        total_records = 0
        for stock_result in result.get("results", {}).values():
            for type_result in stock_result.values():
                if isinstance(type_result, dict) and "records" in type_result:
                    total_records += type_result["records"]

        async with async_session() as session:
            log = await session.get(SyncLog, log_id)
            log.status = "success"
            log.records_synced = total_records
            log.sync_end = datetime.now(timezone.utc)
            await session.commit()

    except Exception as e:
        async with async_session() as session:
            log = await session.get(SyncLog, log_id)
            log.status = "failed"
            log.error_message = str(e)
            log.sync_end = datetime.now(timezone.utc)
            await session.commit()
