/**
 * TypeScript 型別定義 — 台股分析系統
 */

// === 股票基本資訊 ===
export interface StockInfo {
    stock_id: string;
    stock_name: string;
    industry_category: string | null;
    market_type: string;
    is_active: boolean;
}

// === 日線價格 ===
export interface DailyPrice {
    date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    trading_volume: number | null;
    spread: number | null;
}

// === PER/PBR ===
export interface StockPER {
    date: string;
    per: number | null;
    pbr: number | null;
    dividend_yield: number | null;
}

// === 財務報表 (長表格式) ===
export interface FinancialStatement {
    date: string;
    source: string;
    type: string;
    value: number | null;
    origin_name: string | null;
}

// === P/E Band 圖表資料 ===
export interface PEBandData {
    stock_id: string;
    dates: string[];
    per_values: (number | null)[];
    pe_high: number;
    pe_mean: number;
    pe_low: number;
    current_per: number;
    current_zone: 'cheap' | 'fair' | 'expensive';
    total_data_points: number;
}

// === 財務健診趨勢 ===
export interface TrendData {
    date: string;
    value: number | null;
    label: string;
}

// === 同步狀態 ===
export interface SyncLog {
    id: number;
    dataset: string;
    stock_id: string | null;
    status: 'running' | 'success' | 'failed';
    records_synced: number | null;
    sync_start: string | null;
    sync_end: string | null;
    error_message: string | null;
}

// === 新聞 ===
export interface StockNews {
    title: string;
    link: string;
    pub_date: string;
    source: string;
    description: string | null;
    related_news?: StockNews[];
}

// === 新聞 AI 分析 ===
export interface NewsAnalysis {
    sentiment_score: number;
    themes: string[];
    pros: string[];
    cons: string[];
    summary: string;
}

// === K 線圖設定 ===
export type ChartPeriod = 'daily' | 'weekly' | 'monthly';
export type ChartTimeRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | '10Y';
