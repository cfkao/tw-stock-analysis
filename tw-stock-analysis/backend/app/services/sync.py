"""
資料同步服務
負責從 FinMind API 取得資料並寫入本地 PostgreSQL 資料庫
支援：增量同步、批次處理、速率限制、錯誤重試
"""
import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import select, func, text
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.stock import StockInfo, DailyPrice
from app.models.financial import StockPER, FinancialStatement, MonthlyRevenue
from app.models.dividend import DividendHistory
from app.services.finmind import finmind_service

logger = logging.getLogger(__name__)


class SyncService:
    """資料同步核心服務"""

    # FinMind 免費帳號限制: 600 requests/hour
    REQUEST_DELAY = 6.0  # 每次請求間隔 (秒)，確保不超過限制

    # ========================
    # 1. 同步股票基本資訊
    # ========================
    async def sync_stock_info(self) -> dict[str, int]:
        """
        同步台股總覽 (TaiwanStockInfo)
        返回: {"inserted": N, "updated": M}
        """
        logger.info("📋 開始同步股票基本資訊...")
        data = await finmind_service.get_stock_info()

        if not data:
            logger.warning("⚠️ 未取得任何股票資訊")
            return {"inserted": 0, "updated": 0}

        inserted, updated = 0, 0
        async with async_session() as session:
            for row in data:
                stmt = sqlite_insert(StockInfo).values(
                    stock_id=row["stock_id"],
                    stock_name=row.get("stock_name", ""),
                    industry_category=row.get("industry_category"),
                    market_type=self._map_market_type(row.get("type", "")),
                    is_active=True,
                ).on_conflict_do_update(
                    index_elements=["stock_id"],
                    set_={
                        "stock_name": row.get("stock_name", ""),
                        "industry_category": row.get("industry_category"),
                        "market_type": self._map_market_type(row.get("type", "")),
                        "updated_at": func.now(),
                    },
                )
                result = await session.execute(stmt)
                if result.rowcount:
                    inserted += 1

            await session.commit()

        updated = max(0, inserted - len(data))  # 粗略估算
        logger.info(f"✅ 股票資訊同步完成: {len(data)} 筆處理")
        return {"processed": len(data)}

    # ========================
    # 2. 同步日線價格
    # ========================
    async def sync_daily_prices(self, stock_id: str, start_date: str | None = None) -> dict[str, Any]:
        """
        同步個股日線價格 (TaiwanStockPrice)
        增量同步: 只取最後同步日期之後的資料
        """
        if not start_date:
            start_date = await self._get_last_sync_date("daily_price", stock_id, default_years=10)

        logger.info(f"📊 同步日線價格: {stock_id} ({start_date} ~ today)")
        data = await finmind_service.get_stock_price(stock_id, start_date)

        if not data:
            return {"stock_id": stock_id, "records": 0}

        async with async_session() as session:
            for row in data:
                stmt = sqlite_insert(DailyPrice).values(
                    stock_id=row["stock_id"],
                    date=self._safe_date(row.get("date")),
                    trading_volume=self._safe_int(row.get("Trading_Volume")),
                    trading_money=self._safe_int(row.get("Trading_money")),
                    open=self._safe_float(row.get("open")),
                    high=self._safe_float(row.get("max")),
                    low=self._safe_float(row.get("min")),
                    close=self._safe_float(row.get("close")),
                    spread=self._safe_float(row.get("spread")),
                    trading_turnover=self._safe_int(row.get("Trading_turnover")),
                ).on_conflict_do_update(
                    index_elements=["stock_id", "date"],
                    set_={
                        "trading_volume": self._safe_int(row.get("Trading_Volume")),
                        "trading_money": self._safe_int(row.get("Trading_money")),
                        "open": self._safe_float(row.get("open")),
                        "high": self._safe_float(row.get("max")),
                        "low": self._safe_float(row.get("min")),
                        "close": self._safe_float(row.get("close")),
                        "spread": self._safe_float(row.get("spread")),
                        "trading_turnover": self._safe_int(row.get("Trading_turnover")),
                    },
                )
                await session.execute(stmt)

            await session.commit()

        logger.info(f"✅ 日線價格同步完成: {stock_id} ({len(data)} 筆)")
        return {"stock_id": stock_id, "records": len(data)}

    # ========================
    # 3. 同步 PER/PBR/殖利率
    # ========================
    async def sync_stock_per(self, stock_id: str, start_date: str | None = None) -> dict[str, Any]:
        """
        同步個股 PER/PBR/殖利率 (TaiwanStockPER)
        """
        if not start_date:
            start_date = await self._get_last_sync_date("stock_per", stock_id, default_years=5)

        logger.info(f"📈 同步 PER 資料: {stock_id} ({start_date} ~ today)")
        data = await finmind_service.get_stock_per(stock_id, start_date)

        if not data:
            return {"stock_id": stock_id, "records": 0}

        async with async_session() as session:
            for row in data:
                stmt = sqlite_insert(StockPER).values(
                    stock_id=row["stock_id"],
                    date=self._safe_date(row.get("date")),
                    per=self._safe_float(row.get("PER")),
                    pbr=self._safe_float(row.get("PBR")),
                    dividend_yield=self._safe_float(row.get("dividend_yield")),
                ).on_conflict_do_update(
                    index_elements=["stock_id", "date"],
                    set_={
                        "per": self._safe_float(row.get("PER")),
                        "pbr": self._safe_float(row.get("PBR")),
                        "dividend_yield": self._safe_float(row.get("dividend_yield")),
                    },
                )
                await session.execute(stmt)

            await session.commit()

        logger.info(f"✅ PER 同步完成: {stock_id} ({len(data)} 筆)")
        return {"stock_id": stock_id, "records": len(data)}

    # ========================
    # 4. 同步財務報表（三表）
    # ========================
    async def sync_financial_statements(self, stock_id: str, start_date: str | None = None) -> dict[str, Any]:
        """
        同步財務三表 (損益表 + 現金流量表 + 資產負債表)
        FinMind 使用長表格式: {date, stock_id, type, value, origin_name}
        """
        if not start_date:
            start_date = await self._get_last_sync_date("financial_statement", stock_id, default_years=10)

        total_records = 0

        # 損益表
        source_map = [
            ("income_statement", finmind_service.get_financial_statements),
            ("cash_flow", finmind_service.get_cash_flow_statement),
            ("balance_sheet", finmind_service.get_balance_sheet),
        ]

        for source_name, fetch_func in source_map:
            logger.info(f"📄 同步 {source_name}: {stock_id}")

            try:
                data = await fetch_func(stock_id, start_date)
            except Exception as e:
                logger.error(f"❌ 同步 {source_name} 失敗: {stock_id} - {e}")
                await asyncio.sleep(self.REQUEST_DELAY)
                continue

            if not data:
                await asyncio.sleep(self.REQUEST_DELAY)
                continue

            async with async_session() as session:
                for row in data:
                    stmt = sqlite_insert(FinancialStatement).values(
                        stock_id=row["stock_id"],
                        date=self._safe_date(row.get("date")),
                        source=source_name,
                        type=row.get("type", ""),
                        value=self._safe_float(row.get("value")),
                        origin_name=row.get("origin_name"),
                    ).on_conflict_do_update(
                        index_elements=["stock_id", "date", "source", "type"],
                        set_={
                            "value": self._safe_float(row.get("value")),
                            "origin_name": row.get("origin_name"),
                        },
                    )
                    await session.execute(stmt)

                await session.commit()

            total_records += len(data)
            await asyncio.sleep(self.REQUEST_DELAY)  # 速率限制

        logger.info(f"✅ 財務三表同步完成: {stock_id} ({total_records} 筆)")
        return {"stock_id": stock_id, "records": total_records}

    # ========================
    # 5. 同步股利政策
    # ========================
    async def sync_dividends(self, stock_id: str, start_date: str | None = None) -> dict[str, Any]:
        """
        同步股利政策表 (TaiwanStockDividend)
        """
        if not start_date:
            start_date = await self._get_last_sync_date("dividend_history", stock_id, default_years=10)

        logger.info(f"💰 同步股利資料: {stock_id}")
        data = await finmind_service.get_dividend(stock_id, start_date)

        if not data:
            return {"stock_id": stock_id, "records": 0}

        async with async_session() as session:
            for row in data:
                stmt = sqlite_insert(DividendHistory).values(
                    stock_id=row["stock_id"],
                    date=self._safe_date(row.get("date")),
                    year=row.get("year"),
                    cash_earnings_distribution=self._safe_float(row.get("CashEarningsDistribution")),
                    cash_statutory_surplus=self._safe_float(row.get("CashStatutorySurplus")),
                    stock_earnings_distribution=self._safe_float(row.get("StockEarningsDistribution")),
                    stock_statutory_surplus=self._safe_float(row.get("StockStatutorySurplus")),
                    cash_ex_dividend_date=self._safe_date(row.get("CashExDividendTradingDate")),
                    stock_ex_dividend_date=self._safe_date(row.get("StockExDividendTradingDate")),
                    cash_dividend_payment_date=self._safe_date(row.get("CashDividendPaymentDate")),
                    announcement_date=self._safe_date(row.get("AnnouncementDate")),
                ).on_conflict_do_update(
                    index_elements=["stock_id", "date"],
                    set_={
                        "cash_earnings_distribution": self._safe_float(row.get("CashEarningsDistribution")),
                        "cash_statutory_surplus": self._safe_float(row.get("CashStatutorySurplus")),
                        "stock_earnings_distribution": self._safe_float(row.get("StockEarningsDistribution")),
                        "stock_statutory_surplus": self._safe_float(row.get("StockStatutorySurplus")),
                        "cash_ex_dividend_date": self._safe_date(row.get("CashExDividendTradingDate")),
                        "stock_ex_dividend_date": self._safe_date(row.get("StockExDividendTradingDate")),
                        "cash_dividend_payment_date": self._safe_date(row.get("CashDividendPaymentDate")),
                        "announcement_date": self._safe_date(row.get("AnnouncementDate")),
                    },
                )
                await session.execute(stmt)

            await session.commit()

        logger.info(f"✅ 股利同步完成: {stock_id} ({len(data)} 筆)")
        return {"stock_id": stock_id, "records": len(data)}

    # ========================
    # 6. 同步月營收
    # ========================
    async def sync_monthly_revenue(self, stock_id: str, start_date: str | None = None) -> dict[str, Any]:
        """
        同步月營收 (TaiwanStockMonthRevenue)
        """
        if not start_date:
            start_date = await self._get_last_sync_date("monthly_revenue", stock_id, default_years=3)

        logger.info(f"📊 同步月營收: {stock_id}")
        data = await finmind_service.get_monthly_revenue(stock_id, start_date)

        if not data:
            return {"stock_id": stock_id, "records": 0}

        async with async_session() as session:
            for row in data:
                stmt = sqlite_insert(MonthlyRevenue).values(
                    stock_id=row["stock_id"],
                    date=self._safe_date(row.get("date")),
                    country=row.get("country", "TW"),
                    revenue=self._safe_int(row.get("revenue")),
                    revenue_month=self._safe_int(row.get("revenue_month")),
                    revenue_year=self._safe_int(row.get("revenue_year")),
                ).on_conflict_do_update(
                    index_elements=["stock_id", "date"],
                    set_={
                        "revenue": self._safe_int(row.get("revenue")),
                        "revenue_month": self._safe_int(row.get("revenue_month")),
                        "revenue_year": self._safe_int(row.get("revenue_year")),
                    },
                )
                await session.execute(stmt)

            await session.commit()

        logger.info(f"✅ 月營收同步完成: {stock_id} ({len(data)} 筆)")
        return {"stock_id": stock_id, "records": len(data)}

    # ========================
    # 7. 完整同步（單檔個股）
    # ========================
    async def full_sync_stock(self, stock_id: str) -> dict[str, Any]:
        """
        完整同步單檔個股的所有資料
        包含：日線、PER、財報三表、股利、月營收
        """
        logger.info(f"🔄 開始完整同步: {stock_id}")
        results = {}

        sync_tasks = [
            ("daily_prices", self.sync_daily_prices),
            ("stock_per", self.sync_stock_per),
            ("financial_statements", self.sync_financial_statements),
            ("dividends", self.sync_dividends),
            ("monthly_revenue", self.sync_monthly_revenue),
        ]

        for task_name, sync_func in sync_tasks:
            try:
                result = await sync_func(stock_id)
                results[task_name] = result
            except Exception as e:
                logger.error(f"❌ 同步 {task_name} 失敗: {stock_id} - {e}")
                results[task_name] = {"error": str(e)}

            await asyncio.sleep(self.REQUEST_DELAY)

        logger.info(f"🎉 完整同步結束: {stock_id}")
        return {"stock_id": stock_id, "results": results}

    # ========================
    # 8. 批次同步（多檔個股）
    # ========================
    async def batch_sync(
        self,
        stock_ids: list[str],
        sync_types: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        批次同步多檔個股
        sync_types: 指定要同步的類型，預設全部
        """
        if sync_types is None:
            sync_types = ["daily_prices", "stock_per"]

        logger.info(f"🔄 批次同步開始: {len(stock_ids)} 檔，類型: {sync_types}")
        results = {}
        total = len(stock_ids)

        type_func_map = {
            "daily_prices": self.sync_daily_prices,
            "stock_per": self.sync_stock_per,
            "financial_statements": self.sync_financial_statements,
            "dividends": self.sync_dividends,
            "monthly_revenue": self.sync_monthly_revenue,
        }

        for idx, stock_id in enumerate(stock_ids, 1):
            logger.info(f"📦 [{idx}/{total}] 同步 {stock_id}...")
            stock_results = {}

            for sync_type in sync_types:
                func = type_func_map.get(sync_type)
                if not func:
                    continue
                try:
                    result = await func(stock_id)
                    stock_results[sync_type] = result
                except Exception as e:
                    logger.error(f"❌ {sync_type} 失敗: {stock_id} - {e}")
                    stock_results[sync_type] = {"error": str(e)}

                await asyncio.sleep(self.REQUEST_DELAY)

            results[stock_id] = stock_results

        logger.info(f"🎉 批次同步完成: {len(stock_ids)} 檔")
        return {"total_stocks": total, "results": results}

    # ========================
    # 工具方法
    # ========================

    async def _get_last_sync_date(self, table_name: str, stock_id: str, default_years: int = 10) -> str:
        """
        查詢該股票在指定表中最後一筆資料的日期
        用於增量同步：只取新資料
        """
        default_date = (date.today() - timedelta(days=365 * default_years)).isoformat()

        try:
            async with async_session() as session:
                result = await session.execute(
                    text(f"SELECT MAX(date) FROM {table_name} WHERE stock_id = :sid"),
                    {"sid": stock_id},
                )
                last_date = result.scalar()

                if last_date:
                    # 從最後日期的前一天開始，確保不遺漏
                    return (last_date - timedelta(days=1)).isoformat()
        except Exception:
            pass

        return default_date

    @staticmethod
    def _map_market_type(raw_type: str) -> str:
        """對應 FinMind 市場類型"""
        type_map = {
            "twse": "twse",        # 上市
            "tpex": "tpex",        # 上櫃
            "上市": "twse",
            "上櫃": "tpex",
            "興櫃": "emerging",
        }
        return type_map.get(raw_type, raw_type.lower() if raw_type else "twse")

    @staticmethod
    def _safe_float(value: Any) -> float | None:
        """安全轉換為 float"""
        if value is None or value == "" or value == "None":
            return None
        try:
            v = float(value)
            return v if v == v else None  # NaN 檢查
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _safe_int(value: Any) -> int | None:
        """安全轉換為 int"""
        if value is None or value == "" or value == "None":
            return None
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _safe_date(value: Any) -> date | None:
        """安全轉換為 date"""
        if not value or value == "" or value == "None" or value == "0":
            return None
        try:
            return date.fromisoformat(str(value)[:10])
        except (ValueError, TypeError):
            return None


# 全域單例
sync_service = SyncService()
