/**
 * API Service — 與後端 FastAPI 通訊
 * 當後端未啟動時，自動使用 Mock 資料
 */
import axios, { type AxiosResponse, type AxiosError } from 'axios';
import type { StockInfo, DailyPrice, StockPER, TrendData } from '../types';
import { generateMockPrices, generateMockPER, generateMockROE, generateMockFCF, MOCK_STOCKS } from './mockData';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
});

// === 是否使用 Mock 模式 ===
let useMock = false;

api.interceptors.response.use(
    (res: AxiosResponse) => res,
    (err: AxiosError) => {
        if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED') {
            useMock = true;
        }
        return Promise.reject(err);
    }
);

// === 股票 API ===

export async function searchStocks(keyword: string): Promise<StockInfo[]> {
    if (useMock || !keyword) {
        return MOCK_STOCKS.filter(
            (s) => s.stock_id.includes(keyword) || s.stock_name.includes(keyword)
        );
    }
    try {
        const { data } = await api.get(`/stocks/search`, { params: { keyword } });
        return data;
    } catch {
        useMock = true;
        return MOCK_STOCKS.filter(
            (s) => s.stock_id.includes(keyword) || s.stock_name.includes(keyword)
        );
    }
}

export async function getStockInfo(stockId: string): Promise<StockInfo | null> {
    if (useMock) {
        return MOCK_STOCKS.find((s: StockInfo) => s.stock_id === stockId) || null;
    }
    try {
        const { data } = await api.get(`/stocks/${stockId}`);
        return data;
    } catch {
        useMock = true;
        return MOCK_STOCKS.find((s: StockInfo) => s.stock_id === stockId) || null;
    }
}

export async function getStockPrices(
    stockId: string,
    startDate?: string,
    endDate?: string
): Promise<DailyPrice[]> {
    if (useMock) {
        return generateMockPrices(stockId);
    }
    try {
        const { data } = await api.get(`/stocks/${stockId}/prices`, {
            params: { start_date: startDate, end_date: endDate },
        });
        return data;
    } catch {
        useMock = true;
        return generateMockPrices(stockId);
    }
}

// === 財務 API ===

export async function getStockPER(
    stockId: string,
    startDate?: string
): Promise<StockPER[]> {
    if (useMock) {
        return generateMockPER(stockId);
    }
    try {
        const { data } = await api.get(`/financials/${stockId}/per`, {
            params: { start_date: startDate },
        });
        return data;
    } catch {
        useMock = true;
        return generateMockPER(stockId);
    }
}

export async function getROETrend(stockId: string): Promise<TrendData[]> {
    if (useMock) return generateMockROE();
    try {
        // 從財務報表中篩選 ROE 相關資料
        const { data } = await api.get(`/financials/${stockId}/statements`, {
            params: { source: 'income_statement' },
        });
        // 後續處理
        return data.filter((d: any) => d.type?.includes('ROE')).map((d: any) => ({
            date: d.date,
            value: d.value,
            label: d.origin_name || 'ROE',
        }));
    } catch {
        useMock = true;
        return generateMockROE();
    }
}

export async function getFCFTrend(stockId: string): Promise<TrendData[]> {
    if (useMock) return generateMockFCF();
    try {
        const { data } = await api.get(`/financials/${stockId}/statements`, {
            params: { source: 'cash_flow' },
        });
        return data;
    } catch {
        useMock = true;
        return generateMockFCF();
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
