/**
 * API Service — 與後端 FastAPI 通訊
 */
import axios from 'axios';
import type { StockInfo, DailyPrice, StockPER, TrendData, StockNews } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
});

// === 股票 API ===

export async function searchStocks(keyword: string): Promise<StockInfo[]> {
    if (!keyword) return [];
    try {
        const { data } = await api.get(`/stocks/search`, { params: { keyword } });
        return data;
    } catch (e: any) {
        console.error('searchStocks failed:', e.message);
        return [];
    }
}

export async function getStockInfo(stockId: string): Promise<StockInfo | null> {
    try {
        const { data } = await api.get(`/stocks/${stockId}`);
        return data;
    } catch (e: any) {
        console.error(`getStockInfo failed for ${stockId}:`, e.message);
        return null;
    }
}

export async function getStockPrices(
    stockId: string,
    startDate?: string,
    endDate?: string
): Promise<DailyPrice[]> {
    try {
        const { data } = await api.get(`/stocks/${stockId}/prices`, {
            params: { start_date: startDate, end_date: endDate },
        });
        return data;
    } catch (e: any) {
        console.error(`getStockPrices failed for ${stockId}:`, e.message);
        return [];
    }
}

// === 財務 API ===

export async function getStockPER(
    stockId: string,
    startDate?: string
): Promise<StockPER[]> {
    try {
        const { data } = await api.get(`/financials/${stockId}/per`, {
            params: { start_date: startDate },
        });
        return data;
    } catch (e: any) {
        console.error(`getStockPER failed for ${stockId}:`, e.message);
        return [];
    }
}

export async function getROETrend(stockId: string): Promise<TrendData[]> {
    try {
        // 從財務報表中篩選 ROE 相關資料
        const { data } = await api.get(`/financials/${stockId}/statements`, {
            params: { source: 'income_statement' },
        });
        return data.filter((d: any) => d.type?.includes('ROE') || d.type?.includes('權益報酬率')).map((d: any) => ({
            date: d.date,
            value: d.value,
            label: d.origin_name || 'ROE',
        }));
    } catch (e: any) {
        console.error(`getROETrend failed for ${stockId}:`, e.message);
        return [];
    }
}

export async function getFCFTrend(stockId: string): Promise<TrendData[]> {
    try {
        const { data } = await api.get(`/financials/${stockId}/statements`, {
            params: { source: 'cash_flow' },
        });
        return data.filter((d: any) => d.type?.includes('自由現金') || d.type?.includes('現金及約當現金')).map((d: any) => ({
            date: d.date,
            value: d.value,
            label: d.origin_name || 'Free Cash Flow',
        }));
    } catch (e: any) {
        console.error(`getFCFTrend failed for ${stockId}:`, e.message);
        return [];
    }
}

// === 新聞 API ===
export async function getStockNews(stockId: string): Promise<StockNews[]> {
    try {
        const { data } = await api.get(`/stocks/${stockId}/news`);
        return data;
    } catch (e: any) {
        console.error(`getStockNews failed for ${stockId}:`, e.message);
        return [];
    }
}

export async function analyzeStockNews(stockId: string): Promise<any> {
    try {
        const { data } = await api.post(`/stocks/${stockId}/news/analysis`);
        return data;
    } catch (e: any) {
        console.error(`analyzeStockNews failed for ${stockId}:`, e.message);
        throw e; // We want the component to handle the specific error (e.g., 404 vs 500)
    }
}

// === 同步 API ===

export async function triggerSync(stockId: string): Promise<any> {
    const { data } = await api.post(`/sync/stock/${stockId}`);
    return data;
}

export async function getSyncStatus(): Promise<any> {
    const { data } = await api.get(`/sync/status`);
    return data;
}
