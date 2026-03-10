/**
 * Mock 資料 — 用於前端獨立開發與展示
 * 當後端 API 不可用時自動使用
 */
import type { StockInfo, DailyPrice, StockPER, TrendData } from '../types';

// === 熱門台股 Mock 清單 ===
export const MOCK_STOCKS: StockInfo[] = [
    { stock_id: '2330', stock_name: '台積電', industry_category: '半導體業', market_type: 'twse', is_active: true },
    { stock_id: '2317', stock_name: '鴻海', industry_category: '其他電子業', market_type: 'twse', is_active: true },
    { stock_id: '2454', stock_name: '聯發科', industry_category: '半導體業', market_type: 'twse', is_active: true },
    { stock_id: '2308', stock_name: '台達電', industry_category: '電子零組件業', market_type: 'twse', is_active: true },
    { stock_id: '2881', stock_name: '富邦金', industry_category: '金融保險業', market_type: 'twse', is_active: true },
    { stock_id: '2882', stock_name: '國泰金', industry_category: '金融保險業', market_type: 'twse', is_active: true },
    { stock_id: '2412', stock_name: '中華電', industry_category: '通信網路業', market_type: 'twse', is_active: true },
    { stock_id: '2002', stock_name: '中鋼', industry_category: '鋼鐵工業', market_type: 'twse', is_active: true },
    { stock_id: '0050', stock_name: '元大台灣50', industry_category: 'ETF', market_type: 'twse', is_active: true },
    { stock_id: '0056', stock_name: '元大高股息', industry_category: 'ETF', market_type: 'twse', is_active: true },
];

// === 基礎價格 (用於生成擬真波動) ===
const BASE_PRICES: Record<string, number> = {
    '2330': 890, '2317': 178, '2454': 1280, '2308': 380,
    '2881': 82, '2882': 65, '2412': 125, '2002': 28,
    '0050': 155, '0056': 38,
};

// === 生成日線價格 Mock ===
export function generateMockPrices(stockId: string, days = 365): DailyPrice[] {
    const basePrice = BASE_PRICES[stockId] || 100;
    const prices: DailyPrice[] = [];
    let price = basePrice * 0.85;

    for (let i = days; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);

        // 跳過週末
        if (d.getDay() === 0 || d.getDay() === 6) continue;

        const change = (Math.random() - 0.48) * basePrice * 0.03;
        price = Math.max(price + change, basePrice * 0.5);
        const high = price + Math.random() * basePrice * 0.02;
        const low = price - Math.random() * basePrice * 0.02;
        const open = low + Math.random() * (high - low);

        prices.push({
            date: d.toISOString().split('T')[0],
            open: +open.toFixed(2),
            high: +high.toFixed(2),
            low: +low.toFixed(2),
            close: +price.toFixed(2),
            trading_volume: Math.floor(Math.random() * 50000000) + 5000000,
            spread: +change.toFixed(2),
        });
    }
    return prices;
}

// === 生成 PER Mock ===
export function generateMockPER(stockId: string, days = 365 * 5): StockPER[] {
    const data: StockPER[] = [];
    const basePER = stockId === '2330' ? 22 : stockId === '2454' ? 18 : 15;

    for (let i = days; i >= 0; i -= 1) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (d.getDay() === 0 || d.getDay() === 6) continue;

        const per = basePER + (Math.random() - 0.5) * 10;
        data.push({
            date: d.toISOString().split('T')[0],
            per: +per.toFixed(2),
            pbr: +(per * 0.3 + Math.random() * 2).toFixed(2),
            dividend_yield: +(2 + Math.random() * 3).toFixed(2),
        });
    }
    return data;
}

// === 生成 ROE 趨勢 Mock ===
export function generateMockROE(): TrendData[] {
    const quarters = ['2024Q1', '2024Q2', '2024Q3', '2024Q4', '2025Q1', '2025Q2', '2025Q3', '2025Q4'];
    return quarters.map((q) => ({
        date: q,
        value: +(18 + Math.random() * 12).toFixed(1),
        label: 'ROE (%)',
    }));
}

// === 生成 FCF 趨勢 Mock ===
export function generateMockFCF(): TrendData[] {
    const quarters = ['2024Q1', '2024Q2', '2024Q3', '2024Q4', '2025Q1', '2025Q2', '2025Q3', '2025Q4'];
    return quarters.map((q) => ({
        date: q,
        value: +(50 + Math.random() * 100).toFixed(0),
        label: '自由現金流 (億)',
    }));
}
