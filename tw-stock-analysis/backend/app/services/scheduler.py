"""
排程服務
使用 APScheduler 設定定期資料同步任務
"""
import asyncio
import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


class SchedulerService:
    """資料同步排程器"""

    def __init__(self):
        self.scheduler = AsyncIOScheduler(timezone="Asia/Taipei")
        self._setup_jobs()

    def _setup_jobs(self):
        """設定排程任務"""

        # === 每日任務 ===

        # 1. 每個交易日 18:00 同步股票基本資訊
        self.scheduler.add_job(
            self._daily_sync_stock_info,
            CronTrigger(day_of_week="mon-fri", hour=18, minute=0),
            id="daily_stock_info",
            name="每日同步股票資訊",
            replace_existing=True,
        )

        # 2. 每個交易日 18:30 同步所觀察股票的日線價格 + PER
        self.scheduler.add_job(
            self._daily_sync_prices,
            CronTrigger(day_of_week="mon-fri", hour=18, minute=30),
            id="daily_prices",
            name="每日同步股價與PER",
            replace_existing=True,
        )

        # === 每月任務 ===

        # 3. 每月 12 號同步月營收 (上月營收通常在次月 10 號前公布)
        self.scheduler.add_job(
            self._monthly_sync_revenue,
            CronTrigger(day=12, hour=20, minute=0),
            id="monthly_revenue",
            name="每月同步營收",
            replace_existing=True,
        )

        # === 每季任務 ===

        # 4. 每季度同步財務三表 (4/1, 7/1, 10/1, 1/1)
        self.scheduler.add_job(
            self._quarterly_sync_financials,
            CronTrigger(month="1,4,7,10", day=15, hour=20, minute=0),
            id="quarterly_financials",
            name="每季同步財報",
            replace_existing=True,
        )

    def start(self):
        """啟動排程器"""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("⏰ 排程器已啟動")
            self._log_scheduled_jobs()

    def stop(self):
        """停止排程器"""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("⏰ 排程器已停止")

    def _log_scheduled_jobs(self):
        """記錄所有排程任務"""
        jobs = self.scheduler.get_jobs()
        for job in jobs:
            logger.info(f"  📌 {job.name} (ID: {job.id}) - 下次執行: {job.next_run_time}")

    def get_jobs_info(self) -> list[dict]:
        """取得所有排程任務資訊"""
        jobs = self.scheduler.get_jobs()
        return [
            {
                "id": job.id,
                "name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
            }
            for job in jobs
        ]

    # ==============================
    # 排程任務實作
    # ==============================

    async def _daily_sync_stock_info(self):
        """每日同步股票資訊"""
        from app.services.sync import sync_service
        logger.info("⏰ [排程] 開始每日同步股票資訊")
        try:
            result = await sync_service.sync_stock_info()
            logger.info(f"⏰ [排程] 股票資訊同步完成: {result}")
        except Exception as e:
            logger.error(f"⏰ [排程] 股票資訊同步失敗: {e}")

    async def _daily_sync_prices(self):
        """
        每日同步股價與 PER
        同步邏輯: 查詢所有 is_active 的股票，同步最近的日線價格
        ⚠️ 受 API 限制，每次只同步資料庫中已有資料的股票（而非全市場）
        """
        from app.services.sync import sync_service
        from app.database import async_session
        from app.models.stock import StockInfo
        from sqlalchemy import select

        logger.info("⏰ [排程] 開始每日同步股價")

        try:
            # 取得需要同步的股票清單 (僅同步已有日線資料的股票)
            async with async_session() as session:
                stmt = (
                    select(StockInfo.stock_id)
                    .where(StockInfo.is_active == True)
                    .order_by(StockInfo.stock_id)
                )
                result = await session.execute(stmt)
                stock_ids = [row[0] for row in result.fetchall()]

            if not stock_ids:
                logger.warning("⏰ [排程] 無需同步的股票")
                return

            # 批次同步日線 + PER
            logger.info(f"⏰ [排程] 準備同步 {len(stock_ids)} 檔股票")
            await sync_service.batch_sync(
                stock_ids[:50],  # 每次最多 50 檔，避免超過 API 限制
                sync_types=["daily_prices", "stock_per"],
            )
            logger.info("⏰ [排程] 每日同步完成")

        except Exception as e:
            logger.error(f"⏰ [排程] 每日同步失敗: {e}")

    async def _monthly_sync_revenue(self):
        """每月同步月營收"""
        from app.services.sync import sync_service
        from app.database import async_session
        from app.models.stock import StockInfo
        from sqlalchemy import select

        logger.info("⏰ [排程] 開始每月同步營收")

        try:
            async with async_session() as session:
                stmt = select(StockInfo.stock_id).where(StockInfo.is_active == True)
                result = await session.execute(stmt)
                stock_ids = [row[0] for row in result.fetchall()]

            await sync_service.batch_sync(
                stock_ids[:50],
                sync_types=["monthly_revenue"],
            )
            logger.info("⏰ [排程] 月營收同步完成")

        except Exception as e:
            logger.error(f"⏰ [排程] 月營收同步失敗: {e}")

    async def _quarterly_sync_financials(self):
        """每季同步財務三表"""
        from app.services.sync import sync_service
        from app.database import async_session
        from app.models.stock import StockInfo
        from sqlalchemy import select

        logger.info("⏰ [排程] 開始每季同步財報")

        try:
            async with async_session() as session:
                stmt = select(StockInfo.stock_id).where(StockInfo.is_active == True)
                result = await session.execute(stmt)
                stock_ids = [row[0] for row in result.fetchall()]

            await sync_service.batch_sync(
                stock_ids[:30],  # 財報同步較慢，每次 30 檔
                sync_types=["financial_statements", "dividends"],
            )
            logger.info("⏰ [排程] 季度財報同步完成")

        except Exception as e:
            logger.error(f"⏰ [排程] 季度財報同步失敗: {e}")


# 全域單例
scheduler_service = SchedulerService()
