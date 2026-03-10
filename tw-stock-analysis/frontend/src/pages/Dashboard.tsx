/**
 * 首頁 Dashboard — 大盤概覽 + 熱門股 + 產業板塊 + 快速入口
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MOCK_STOCKS } from '../services/mockData';

// === Mock 大盤指數 ===
const MARKET_INDICES = [
    { name: '加權指數', value: '23,142', change: '+186.5', pct: '+0.81%', up: true },
    { name: '櫃買指數', value: '265.32', change: '+2.18', pct: '+0.83%', up: true },
    { name: '台積電', value: '1,050', change: '-5.0', pct: '-0.47%', up: false },
    { name: '美元/台幣', value: '32.15', change: '-0.08', pct: '-0.25%', up: false },
];

// === Mock 熱門排行 ===
const HOT_STOCKS = [
    { id: '2330', name: '台積電', price: 1050, change: -0.47 },
    { id: '2454', name: '聯發科', price: 1380, change: +2.15 },
    { id: '2317', name: '鴻海', price: 185, change: +1.83 },
    { id: '2382', name: '廣達', price: 380, change: +3.45 },
    { id: '2881', name: '富邦金', price: 82, change: +0.62 },
    { id: '2303', name: '聯電', price: 55, change: -1.27 },
];

// === 產業板塊 ===
const SECTORS = [
    { name: '半導體', emoji: '🔬', stocks: ['2330', '2454', '2303'], change: +1.2 },
    { name: '金融保險', emoji: '🏦', stocks: ['2881', '2882', '2886', '2884'], change: +0.8 },
    { name: '電子組裝', emoji: '⚡', stocks: ['2317', '2382', '2357'], change: +2.1 },
    { name: '傳產穩定', emoji: '🏭', stocks: ['2412', '2002'], change: -0.3 },
    { name: 'ETF', emoji: '📦', stocks: ['0050', '0056', '00878'], change: +0.5 },
    { name: '電子零組件', emoji: '🔧', stocks: ['2308', '2345', '2449'], change: +1.5 },
];

export default function Dashboard() {
    const navigate = useNavigate();
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    return (
        <div className="animate-fade-in space-y-6">
            {/* 大盤指數條 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {MARKET_INDICES.map((idx) => (
                    <div key={idx.name} className="card p-4">
                        <div className="text-xs text-surface-500 mb-1">{idx.name}</div>
                        <div className="text-xl font-bold text-surface-900 dark:text-white">{idx.value}</div>
                        <div className={`text-sm font-medium ${idx.up ? 'text-red-500' : 'text-green-500'}`}>
                            {idx.change} ({idx.pct})
                        </div>
                    </div>
                ))}
            </div>

            {/* Hero + 快速入口 */}
            <div className="card p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white mb-2">
                            🇹🇼 台股價值投資分析系統
                        </h2>
                        <p className="text-surface-500 text-sm">
                            聚焦企業體質與合理估值，用數據做投資決策
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Link to="/watchlist" className="btn-primary text-sm flex items-center gap-1">⭐ 自選股</Link>
                        <Link to="/backtest" className="btn-primary text-sm flex items-center gap-1 !bg-purple-600 hover:!bg-purple-700">🔬 回測</Link>
                        <Link to="/compare" className="btn-primary text-sm flex items-center gap-1 !bg-teal-600 hover:!bg-teal-700">⚖️ 對比</Link>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 左側：熱門排行 */}
                <div className="lg:col-span-1">
                    <div className="card p-5">
                        <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-4">
                            🔥 今日熱門
                        </h3>
                        <div className="space-y-2">
                            {HOT_STOCKS.map((s, i) => (
                                <button
                                    key={s.id}
                                    onClick={() => navigate(`/stock/${s.id}`)}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-850 transition-colors text-left"
                                >
                                    <span className="text-sm font-bold text-surface-400 w-5">{i + 1}</span>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm font-bold text-primary-600 dark:text-primary-400">{s.id}</span>
                                            <span className="text-sm text-surface-900 dark:text-white">{s.name}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-mono font-bold text-surface-900 dark:text-white">${s.price}</div>
                                        <div className={`text-xs font-medium ${s.change > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                            {s.change > 0 ? '+' : ''}{s.change}%
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 右側：產業板塊 */}
                <div className="lg:col-span-2">
                    <div className="card p-5">
                        <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-4">
                            📊 產業板塊
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {SECTORS.map((sector) => (
                                <div
                                    key={sector.name}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer ${sector.change > 0
                                        ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                                        : 'bg-green-500/5 border-green-500/20 hover:border-green-500/40'
                                        }`}
                                    onClick={() => navigate(`/stock/${sector.stocks[0]}`)}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-lg">{sector.emoji}</span>
                                        <span className={`text-sm font-bold ${sector.change > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                            {sector.change > 0 ? '+' : ''}{sector.change}%
                                        </span>
                                    </div>
                                    <div className="font-medium text-sm text-surface-900 dark:text-white">{sector.name}</div>
                                    <div className="text-[10px] text-surface-500 mt-1">
                                        {sector.stocks.slice(0, 3).map(id => {
                                            const s = MOCK_STOCKS.find(ms => ms.stock_id === id);
                                            return s ? s.stock_name : id;
                                        }).join('・')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 全部股票快速選取 */}
            <div className="card p-5">
                <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-4">
                    📋 全部股票
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {MOCK_STOCKS.map((stock) => (
                        <button
                            key={stock.stock_id}
                            onClick={() => navigate(`/stock/${stock.stock_id}`)}
                            onMouseEnter={() => setHoveredId(stock.stock_id)}
                            onMouseLeave={() => setHoveredId(null)}
                            className={`p-3 rounded-xl text-left transition-all border ${hoveredId === stock.stock_id
                                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-400 dark:border-primary-600 scale-[1.02]'
                                : 'bg-surface-50 dark:bg-surface-850 border-transparent hover:border-surface-300 dark:hover:border-surface-700'
                                }`}
                        >
                            <span className="font-mono text-sm font-bold text-primary-600 dark:text-primary-400">
                                {stock.stock_id}
                            </span>
                            <div className="text-sm font-medium text-surface-900 dark:text-white mt-0.5">
                                {stock.stock_name}
                            </div>
                            <div className="text-[10px] text-surface-500">{stock.industry_category}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* 功能一覽 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { icon: '📊', title: '個股診斷', desc: 'K 線 + MA + P/E Band', to: '/stock/2330' },
                    { icon: '💎', title: '估值分析', desc: 'Graham + 安全邊際', to: '/stock/2330' },
                    { icon: '🔬', title: '回測引擎', desc: '5 策略 + 停損停利', to: '/backtest' },
                    { icon: '⚖️', title: '股票對比', desc: '多檔並排分析', to: '/compare' },
                ].map((f) => (
                    <Link
                        key={f.title}
                        to={f.to}
                        className="card p-5 hover:scale-[1.02] transition-transform"
                    >
                        <div className="text-3xl mb-2">{f.icon}</div>
                        <h4 className="font-semibold text-surface-900 dark:text-white text-sm mb-1">{f.title}</h4>
                        <p className="text-xs text-surface-500">{f.desc}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
