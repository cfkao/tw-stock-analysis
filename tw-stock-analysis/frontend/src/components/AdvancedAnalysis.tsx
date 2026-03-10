/**
 * Graham 安全邊際估值 + 殖利率分析 + 杜邦分析 + 估值結論
 * 整合在一個檔案以減少元件碎片化
 */
import { useMemo } from 'react';

// === Mock 財務數據 ===
interface FinData {
    eps: number;      // 每股盈餘
    bvps: number;     // 每股淨值
    price: number;    // 目前股價
    pe: number;       // 本益比
    pb: number;       // 股價淨值比
    dividendYield: number; // 殖利率 (%)
    roe: number;      // ROE (%)
    netMargin: number;    // 淨利率 (%)
    assetTurnover: number; // 資產周轉率
    equityMultiplier: number; // 權益乘數
    currentRatio: number; // 流動比率
    quickRatio: number;   // 速動比率
    interestCoverage: number; // 利息保障倍數
    ocfToNetIncome: number;   // 營運現金流/淨利
    dividends: { year: string; amount: number; yield: number }[];
    consecutiveDividendYears: number;
}

const MOCK_FINANCIALS: Record<string, FinData> = {
    '2330': {
        eps: 39.2, bvps: 125, price: 1550, pe: 39.5, pb: 12.4,
        dividendYield: 1.1, roe: 30.2, netMargin: 42.5, assetTurnover: 0.48,
        equityMultiplier: 1.48, currentRatio: 2.15, quickRatio: 1.92,
        interestCoverage: 98, ocfToNetIncome: 1.35,
        consecutiveDividendYears: 27,
        dividends: [
            { year: '2020', amount: 10.0, yield: 2.1 },
            { year: '2021', amount: 10.5, yield: 1.8 },
            { year: '2022', amount: 11.0, yield: 2.5 },
            { year: '2023', amount: 13.0, yield: 2.3 },
            { year: '2024', amount: 14.5, yield: 1.5 },
            { year: '2025', amount: 17.0, yield: 1.1 },
        ],
    },
    '2317': {
        eps: 10.5, bvps: 92, price: 185, pe: 17.6, pb: 2.01,
        dividendYield: 5.9, roe: 11.4, netMargin: 3.2, assetTurnover: 1.85,
        equityMultiplier: 1.93, currentRatio: 1.42, quickRatio: 1.15,
        interestCoverage: 15, ocfToNetIncome: 1.12,
        consecutiveDividendYears: 22,
        dividends: [
            { year: '2020', amount: 4.2, yield: 4.9 },
            { year: '2021', amount: 5.2, yield: 5.0 },
            { year: '2022', amount: 5.3, yield: 5.2 },
            { year: '2023', amount: 5.3, yield: 5.5 },
            { year: '2024', amount: 5.4, yield: 5.8 },
            { year: '2025', amount: 10.9, yield: 5.9 },
        ],
    },
};

function getFinData(stockId: string): FinData {
    if (MOCK_FINANCIALS[stockId]) return MOCK_FINANCIALS[stockId];
    // 未知股票生成合理預設
    const seed = stockId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const r = (min: number, max: number) => min + ((seed * 7 + min * 13) % 100) / 100 * (max - min);
    const eps = +(r(2, 15)).toFixed(1);
    const bvps = +(r(20, 100)).toFixed(0);
    const price = +(r(30, 500)).toFixed(0);
    return {
        eps, bvps, price, pe: +(price / eps).toFixed(1), pb: +(price / bvps).toFixed(2),
        dividendYield: +(r(1, 7)).toFixed(1), roe: +(r(5, 25)).toFixed(1),
        netMargin: +(r(3, 30)).toFixed(1), assetTurnover: +(r(0.3, 2)).toFixed(2),
        equityMultiplier: +(r(1.1, 2.5)).toFixed(2),
        currentRatio: +(r(1, 3)).toFixed(2), quickRatio: +(r(0.8, 2.5)).toFixed(2),
        interestCoverage: +(r(3, 50)).toFixed(0),
        ocfToNetIncome: +(r(0.6, 1.8)).toFixed(2),
        consecutiveDividendYears: Math.floor(r(3, 25)),
        dividends: Array.from({ length: 6 }, (_, i) => ({
            year: `${2020 + i}`, amount: +(r(1, 8)).toFixed(1), yield: +(r(2, 6)).toFixed(1),
        })),
    };
}

// ========================================
// Graham 安全邊際
// ========================================
export function GrahamValuation({ stockId }: { stockId: string }) {
    const fin = useMemo(() => getFinData(stockId), [stockId]);

    const grahamValue = Math.sqrt(22.5 * Math.max(fin.eps, 0) * Math.max(fin.bvps, 0));
    const mos = grahamValue > 0 ? ((grahamValue - fin.price) / grahamValue) * 100 : 0;
    const zone = mos > 30 ? 'cheap' : mos > 0 ? 'fair' : 'expensive';

    const zoneConfig = {
        cheap: { label: '📗 便宜', color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/30', desc: '目前股價低於 Graham 合理價，具備安全邊際' },
        fair: { label: '📙 合理', color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/30', desc: '目前股價接近合理價，安全邊際不足' },
        expensive: { label: '📕 昂貴', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30', desc: '目前股價超過合理價' },
    };
    const z = zoneConfig[zone];

    return (
        <div className="card p-6">
            <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-4">
                💎 Graham 安全邊際估值
            </h3>

            {/* 估值結論 */}
            <div className={`p-4 rounded-xl border ${z.bg} mb-5`}>
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xl font-bold ${z.color}`}>{z.label}</span>
                    <span className={`text-sm ${z.color}`}>安全邊際 {mos.toFixed(1)}%</span>
                </div>
                <p className="text-sm text-surface-600 dark:text-surface-400">{z.desc}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniCard label="Graham 合理價" value={`$${grahamValue.toFixed(0)}`} />
                <MiniCard label="目前股價" value={`$${fin.price}`} />
                <MiniCard label="EPS" value={`$${fin.eps}`} sub="每股盈餘" />
                <MiniCard label="每股淨值" value={`$${fin.bvps}`} sub="BVPS" />
            </div>

            <p className="text-[11px] text-surface-500 mt-3">
                公式：合理價 = √(22.5 × EPS × BVPS)｜安全邊際 = (合理價 - 現價) / 合理價
            </p>
        </div>
    );
}

// ========================================
// 估值總結：目前便宜嗎？
// ========================================
export function ValuationSummary({ stockId }: { stockId: string }) {
    const fin = useMemo(() => getFinData(stockId), [stockId]);
    const grahamValue = Math.sqrt(22.5 * Math.max(fin.eps, 0) * Math.max(fin.bvps, 0));
    const mos = grahamValue > 0 ? ((grahamValue - fin.price) / grahamValue) * 100 : 0;

    const peZone = fin.pe < 15 ? 'cheap' : fin.pe < 25 ? 'fair' : 'expensive';
    const pbZone = fin.pb < 1.5 ? 'cheap' : fin.pb < 3 ? 'fair' : 'expensive';
    const dyZone = fin.dividendYield > 5 ? 'cheap' : fin.dividendYield > 3 ? 'fair' : 'expensive';
    const mosZone = mos > 30 ? 'cheap' : mos > 0 ? 'fair' : 'expensive';

    const scores = [peZone, pbZone, dyZone, mosZone];
    const cheapCount = scores.filter((s) => s === 'cheap').length;
    const expCount = scores.filter((s) => s === 'expensive').length;
    const overall = cheapCount >= 3 ? 'cheap' : expCount >= 3 ? 'expensive' : 'fair';

    const icons: Record<string, string> = { cheap: '🟢', fair: '🟡', expensive: '🔴' };

    return (
        <div className="card p-6">
            <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-4">
                🎯 估值總結 — 現在值得買嗎？
            </h3>
            <div className={`p-4 rounded-xl border mb-4 ${overall === 'cheap' ? 'bg-green-500/10 border-green-500/30' :
                    overall === 'expensive' ? 'bg-red-500/10 border-red-500/30' :
                        'bg-yellow-500/10 border-yellow-500/30'
                }`}>
                <span className="text-2xl font-bold">
                    {overall === 'cheap' ? '✅ 偏低估' : overall === 'expensive' ? '⚠️ 偏高估' : '📊 合理區間'}
                </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniCard label="PER" value={`${fin.pe}倍`} sub={`${icons[peZone]} ${peZone === 'cheap' ? '<15' : peZone === 'expensive' ? '>25' : '15~25'}`} />
                <MiniCard label="PBR" value={`${fin.pb}倍`} sub={`${icons[pbZone]} ${pbZone === 'cheap' ? '<1.5' : pbZone === 'expensive' ? '>3' : '1.5~3'}`} />
                <MiniCard label="殖利率" value={`${fin.dividendYield}%`} sub={`${icons[dyZone]} ${dyZone === 'cheap' ? '>5%' : dyZone === 'expensive' ? '<3%' : '3~5%'}`} />
                <MiniCard label="安全邊際" value={`${mos.toFixed(0)}%`} sub={`${icons[mosZone]} ${mosZone === 'cheap' ? '>30%' : mosZone === 'expensive' ? '<0%' : '0~30%'}`} />
            </div>
        </div>
    );
}

// ========================================
// 杜邦分析
// ========================================
export function DuPontAnalysis({ stockId }: { stockId: string }) {
    const fin = useMemo(() => getFinData(stockId), [stockId]);
    const computedROE = (fin.netMargin / 100) * fin.assetTurnover * fin.equityMultiplier * 100;

    const factors = [
        { label: '淨利率', value: `${fin.netMargin}%`, desc: '獲利能力', color: fin.netMargin > 10 ? 'text-green-500' : 'text-yellow-500' },
        { label: '×', value: '', desc: '', color: 'text-surface-500' },
        { label: '資產周轉率', value: `${fin.assetTurnover}`, desc: '營運效率', color: fin.assetTurnover > 0.5 ? 'text-green-500' : 'text-yellow-500' },
        { label: '×', value: '', desc: '', color: 'text-surface-500' },
        { label: '權益乘數', value: `${fin.equityMultiplier}`, desc: '財務槓桿', color: fin.equityMultiplier < 2 ? 'text-green-500' : 'text-red-500' },
        { label: '=', value: '', desc: '', color: 'text-surface-500' },
        { label: 'ROE', value: `${computedROE.toFixed(1)}%`, desc: '股東權益報酬', color: computedROE > 15 ? 'text-green-500' : computedROE > 8 ? 'text-yellow-500' : 'text-red-500' },
    ];

    return (
        <div className="card p-6">
            <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-4">
                🔬 杜邦分析 (DuPont)
            </h3>
            <div className="flex items-center justify-center gap-2 flex-wrap py-4">
                {factors.map((f, i) => (
                    f.value ? (
                        <div key={i} className="p-3 rounded-xl bg-surface-100 dark:bg-surface-850 text-center min-w-[85px]">
                            <div className="text-xs text-surface-500 mb-1">{f.label}</div>
                            <div className={`text-lg font-bold ${f.color}`}>{f.value}</div>
                            <div className="text-[10px] text-surface-500 mt-0.5">{f.desc}</div>
                        </div>
                    ) : (
                        <span key={i} className="text-2xl font-bold text-surface-400">{f.label}</span>
                    )
                ))}
            </div>
            <p className="text-[11px] text-surface-500 mt-2 text-center">
                ROE = 淨利率 × 資產周轉率 × 權益乘數
            </p>
        </div>
    );
}

// ========================================
// 殖利率歷年圖表
// ========================================
export function DividendChart({ stockId }: { stockId: string }) {
    const fin = useMemo(() => getFinData(stockId), [stockId]);
    const maxAmount = Math.max(...fin.dividends.map((d) => d.amount), 1);

    return (
        <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                    💰 歷年股利
                </h3>
                <span className="text-sm text-green-500 font-medium">
                    連續配息 {fin.consecutiveDividendYears} 年
                </span>
            </div>
            <div className="flex items-end gap-3 h-40">
                {fin.dividends.map((d) => (
                    <div key={d.year} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-surface-500">${d.amount}</span>
                        <div
                            className="w-full bg-primary-500/80 rounded-t-md transition-all hover:bg-primary-400"
                            style={{ height: `${(d.amount / maxAmount) * 100}%`, minHeight: 4 }}
                        />
                        <span className="text-[10px] text-surface-500">{d.year}</span>
                        <span className="text-[10px] text-green-500">{d.yield}%</span>
                    </div>
                ))}
            </div>
            <p className="text-[11px] text-surface-500 mt-3 text-center">
                下方百分比為當年殖利率
            </p>
        </div>
    );
}

// ========================================
// 負債與現金流指標
// ========================================
export function DebtCashFlow({ stockId }: { stockId: string }) {
    const fin = useMemo(() => getFinData(stockId), [stockId]);

    const items = [
        { label: '流動比率', value: fin.currentRatio, unit: '倍', good: fin.currentRatio > 1.5, desc: '>1.5 佳' },
        { label: '速動比率', value: fin.quickRatio, unit: '倍', good: fin.quickRatio > 1, desc: '>1.0 佳' },
        { label: '利息保障倍數', value: fin.interestCoverage, unit: '倍', good: fin.interestCoverage > 5, desc: '>5 佳' },
        { label: '營運現金流/淨利', value: fin.ocfToNetIncome, unit: '', good: fin.ocfToNetIncome > 0.8, desc: '>0.8 佳' },
    ];

    return (
        <div className="card p-6">
            <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-4">
                🏦 負債與現金流
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {items.map((item) => (
                    <div key={item.label} className="p-4 rounded-xl bg-surface-100 dark:bg-surface-850 text-center">
                        <div className="text-xs text-surface-500 mb-1">{item.label}</div>
                        <div className={`text-xl font-bold ${item.good ? 'text-green-500' : 'text-red-500'}`}>
                            {item.value}{item.unit}
                        </div>
                        <div className="text-[10px] text-surface-500 mt-0.5">{item.desc}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ========================================
// 個股筆記
// ========================================
import { useState, useEffect } from 'react';
import { getNote, saveNote, deleteNote } from '../services/watchlist';

export function StockNotes({ stockId }: { stockId: string }) {
    const [content, setContent] = useState('');
    const [saved, setSaved] = useState(false);
    const [lastSaved, setLastSaved] = useState('');

    useEffect(() => {
        const note = getNote(stockId);
        if (note) {
            setContent(note.content);
            setLastSaved(new Date(note.updatedAt).toLocaleString('zh-TW'));
        } else {
            setContent('');
            setLastSaved('');
        }
    }, [stockId]);

    const handleSave = () => {
        if (content.trim()) {
            const note = saveNote(stockId, content.trim());
            setLastSaved(new Date(note.updatedAt).toLocaleString('zh-TW'));
        } else {
            deleteNote(stockId);
            setLastSaved('');
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="card p-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                    📝 投資筆記
                </h3>
                {lastSaved && <span className="text-[10px] text-surface-500">上次儲存：{lastSaved}</span>}
            </div>
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="記錄你對這檔股票的投資論點、觀察..."
                className="w-full h-28 p-3 rounded-xl bg-surface-100 dark:bg-surface-850 text-surface-900 dark:text-white text-sm resize-none border border-surface-200 dark:border-surface-800 focus:border-primary-500 outline-none transition-colors"
            />
            <div className="flex items-center justify-between mt-2">
                <button
                    onClick={handleSave}
                    className="px-4 py-1.5 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                    {saved ? '✅ 已儲存' : '💾 儲存'}
                </button>
                {content && (
                    <button
                        onClick={() => { deleteNote(stockId); setContent(''); setLastSaved(''); }}
                        className="text-xs text-red-500 hover:text-red-400"
                    >
                        刪除筆記
                    </button>
                )}
            </div>
        </div>
    );
}

// ========================================
// 共用小元件
// ========================================
function MiniCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="p-3 rounded-xl bg-surface-100 dark:bg-surface-850 text-center">
            <div className="text-[10px] text-surface-500 mb-0.5">{label}</div>
            <div className="text-lg font-bold text-surface-900 dark:text-white">{value}</div>
            {sub && <div className="text-[10px] text-surface-500">{sub}</div>}
        </div>
    );
}
