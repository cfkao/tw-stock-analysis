"""
FinMind API 整合服務
負責從 FinMind 取得台股資料並同步至本地資料庫
"""
from datetime import date
from typing import Any

import httpx
import pandas as pd

from app.config import settings


class FinMindService:
    """FinMind API 客戶端"""

    BASE_URL = "https://api.finmindtrade.com/api/v4/data"

    def __init__(self):
        self.token = settings.finmind_api_token
        self.headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}

    async def _fetch(self, dataset: str, data_id: str | None = None,
                     start_date: str | None = None, end_date: str | None = None) -> list[dict[str, Any]]:
        """通用 FinMind API 請求"""
        params: dict[str, str] = {"dataset": dataset}
        if data_id:
            params["data_id"] = data_id
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(self.BASE_URL, params=params, headers=self.headers)
            response.raise_for_status()
            data = response.json()

            if data.get("status") != 200:
                raise Exception(f"FinMind API 錯誤: {data.get('msg', 'Unknown error')}")

            return data.get("data", [])

    # ========== 技術面 ==========

    async def get_stock_info(self) -> list[dict]:
        """取得台股總覽"""
        return await self._fetch("TaiwanStockInfo")

    async def get_stock_price(self, stock_id: str, start_date: str, end_date: str | None = None) -> list[dict]:
        """取得個股日線價格"""
        return await self._fetch("TaiwanStockPrice", data_id=stock_id,
                                 start_date=start_date, end_date=end_date)

    async def get_stock_per(self, stock_id: str, start_date: str, end_date: str | None = None) -> list[dict]:
        """取得個股 PER/PBR/殖利率"""
        return await self._fetch("TaiwanStockPER", data_id=stock_id,
                                 start_date=start_date, end_date=end_date)

    # ========== 基本面 ==========

    async def get_financial_statements(self, stock_id: str, start_date: str) -> list[dict]:
        """取得綜合損益表"""
        return await self._fetch("TaiwanStockFinancialStatements",
                                 data_id=stock_id, start_date=start_date)

    async def get_cash_flow_statement(self, stock_id: str, start_date: str) -> list[dict]:
        """取得現金流量表"""
        return await self._fetch("TaiwanStockCashFlowsStatement",
                                 data_id=stock_id, start_date=start_date)

    async def get_balance_sheet(self, stock_id: str, start_date: str) -> list[dict]:
        """取得資產負債表"""
        return await self._fetch("TaiwanStockBalanceSheet",
                                 data_id=stock_id, start_date=start_date)

    async def get_dividend(self, stock_id: str, start_date: str) -> list[dict]:
        """取得股利政策表"""
        return await self._fetch("TaiwanStockDividend",
                                 data_id=stock_id, start_date=start_date)

    async def get_monthly_revenue(self, stock_id: str, start_date: str) -> list[dict]:
        """取得月營收"""
        return await self._fetch("TaiwanStockMonthRevenue",
                                 data_id=stock_id, start_date=start_date)


# 全域單例
finmind_service = FinMindService()
