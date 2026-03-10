/**
 * 回測頁面 — 策略選擇 + 參數設定 + 結果展示
 */
import { useState, useEffect, useRef } from 'react';
import { createChart, LineSeries, AreaSeries } from 'lightweight-charts';

// === 策略清單 (前端內建, 無需 API) ===
const STRATEGIES = [
    {
        id: 'ma_cross', name: '均線交叉策略', icon: '📊',
        description: '短均線上穿長均線時買入，下穿時賣出',
        params: [
            { key: 'fast_period', label: '短均線', type: 'number', default: 20 },
            { key: 'slow_period', label: '長均線', type: 'number', default: 60 },
        ],
    },
    {
        id: 'pe_value', name: '本益比估值策略', icon: '💎',
        description: '股價處於近一年低位 20% 時買入，高位 80% 時賣出',
        params: [],
    },
    {
        id: 'dividend_yield', name: '殖利率策略', icon: '💰',
        description: '股價低於 MA200 的 85% 時買入，高於 115% 時賣出',
        params: [],
    },
    {
        id: 'buy_and_hold', name: '買入持有', icon: '🏦',
        description: '第一天全額買入並持有到結束',
        params: [],
    },
    {
        id: 'monthly_dca', name: '每月定期定額', icon: '📅',
        description: '每月第一個交易日投入固定金額買入零股',
        params: [
            { key: 'monthly_amount', label: '每月投入金額 (NT$)', type: 'number', default: 30000 },
        ],
    },
];

// === Mock 回測引擎 (前端獨立版) ===
// ⚠️ 注意：目前使用近似真實歷史走勢的模擬數據，非精確歷史價格

// 2021/01 近似起始價 → 2025/12 近似收盤價
const STOCK_HISTORY: Record<string, { start: number; end: number }> = {
    '2330': { start: 590, end: 1550 },   // 台積電
    '2317': { start: 105, end: 185 },    // 鴻海
    '2454': { start: 680, end: 1100 },   // 聯發科
    '2308': { start: 290, end: 480 },    // 台達電
    '2881': { start: 53, end: 78 },      // 富邦金
    '2882': { start: 43, end: 72 },      // 國泰金
    '2412': { start: 108, end: 125 },    // 中華電
    '2002': { start: 25, end: 28 },      // 中鋼
    '2891': { start: 27, end: 38 },      // 中信金
    '2303': { start: 410, end: 530 },    // 聯電
    '3711': { start: 230, end: 420 },    // 日月光
    '2886': { start: 37, end: 55 },      // 兆豐金
    '2884': { start: 25, end: 40 },      // 玉山金
    '2357': { start: 78, end: 135 },     // 華碩
    '2382': { start: 320, end: 550 },    // 廣達
    '2345': { start: 52, end: 88 },      // 智邦
    '2449': { start: 58, end: 95 },      // 京元電
    '0050': { start: 130, end: 195 },    // 元大台灣50
    '0056': { start: 33, end: 37 },      // 元大高股息
    '00878': { start: 17, end: 22 },     // 國泰永續高息
};

function runMockBacktest(stockId: string, strategy: string, startDate: string,
    endDate: string, capital: number, params: Record<string, number>) {

    const stockInfo = STOCK_HISTORY[stockId] || { start: 100, end: 130 };
    const benchInfo = STOCK_HISTORY['0050'];

    const totalDays = Math.min(
        Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000),
        365 * 5
    );

    // 計算每日成長率（對數插值）
    const tradingDaysEst = Math.floor(totalDays * 5 / 7);  // 估計交易日
    const dailyGrowth = tradingDaysEst > 0 ? Math.pow(stockInfo.end / stockInfo.start, 1 / tradingDaysEst) : 1;
    const benchDailyGrowth = tradingDaysEst > 0 ? Math.pow(benchInfo.end / benchInfo.start, 1 / tradingDaysEst) : 1;

    // 模擬價格（趨勢 + 隨機波動）
    let price = stockInfo.start;
    let benchPrice = benchInfo.start;
    const equity: { date: string; value: number }[] = [];
    const benchCurve: { date: string; value: number }[] = [];
    const trades: any[] = [];

    let cash = capital;
    let shares = 0;
    let benchShares = capital / benchPrice;
    let tradeCount = 0;
    let avgCost = 0; // 平均持有成本
    let totalInvested = 0;

    // 風控參數
    const stopLoss = params.stop_loss || 0;    // 停損 % (0=不啟用)
    const takeProfit = params.take_profit || 0; // 停利 % (0=不啟用)

    // 策略參數
    const fast = params.fast_period || 20;
    const slow = params.slow_period || 60;
    const closePrices: number[] = [];
    let lastMonth = '';

    const seed = stockId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    let rng = seed;
    const random = () => { rng = (rng * 16807 + 0) % 2147483647; return rng / 2147483647; };

    for (let d = 0; d <= totalDays; d++) {
        const current = new Date(startDate);
        current.setDate(current.getDate() + d);
        if (current.getDay() === 0 || current.getDay() === 6) continue;
        const dateStr = current.toISOString().split('T')[0];

        // 趨勢 + 隨機噪音（波動率 ~1.5%/日）
        price *= dailyGrowth * (1 + (random() - 0.5) * 0.03);
        price = Math.max(price, stockInfo.start * 0.3);
        benchPrice *= benchDailyGrowth * (1 + (random() - 0.5) * 0.02);
        benchPrice = Math.max(benchPrice, benchInfo.start * 0.4);
        closePrices.push(price);

        // 生成信號
        let signal = 0;
        const ci = closePrices.length - 1;

        if (strategy === 'buy_and_hold' && ci === 0) {
            signal = 1;
        } else if (strategy === 'monthly_dca') {
            const month = dateStr.slice(0, 7);
            if (month !== lastMonth) { signal = 1; lastMonth = month; }
        } else if (strategy === 'ma_cross' && ci >= slow) {
            const fastMA = closePrices.slice(ci - fast + 1, ci + 1).reduce((a, b) => a + b, 0) / fast;
            const slowMA = closePrices.slice(ci - slow + 1, ci + 1).reduce((a, b) => a + b, 0) / slow;
            const pFast = closePrices.slice(ci - fast, ci).reduce((a, b) => a + b, 0) / fast;
            const pSlow = closePrices.slice(ci - slow, ci).reduce((a, b) => a + b, 0) / slow;
            if (fastMA > slowMA && pFast <= pSlow) signal = 1;
            else if (fastMA < slowMA && pFast >= pSlow) signal = -1;
        } else if (strategy === 'pe_value' && ci >= 252) {
            const window = closePrices.slice(ci - 252, ci + 1);
            const pct = window.filter(w => w <= price).length / window.length;
            if (pct < 0.2) signal = 1;
            else if (pct > 0.8) signal = -1;
        } else if (strategy === 'dividend_yield' && ci >= 200) {
            const ma200 = closePrices.slice(ci - 199, ci + 1).reduce((a, b) => a + b, 0) / 200;
            if (price < ma200 * 0.85) signal = 1;
            else if (price > ma200 * 1.15) signal = -1;
        }

        // 停損停利檢查
        if (shares > 0 && avgCost > 0) {
            const unrealizedPct = ((price - avgCost) / avgCost) * 100;
            if (stopLoss > 0 && unrealizedPct <= -stopLoss) {
                signal = -1; // 觸發停損
            }
            if (takeProfit > 0 && unrealizedPct >= takeProfit) {
                signal = -1; // 觸發停利
            }
        }

        // 交易
        const monthlyAmount = params.monthly_amount || 30000;
        if (signal === 1) {
            if (strategy === 'monthly_dca') {
                const buyAmount = Math.min(monthlyAmount, cash);
                if (buyAmount > 100) {
                    const buyShares = Math.max(1, Math.floor(buyAmount / (price * 1.001425)));
                    const cost = price * buyShares * 1.001425;
                    if (cost <= cash) {
                        totalInvested = avgCost * shares + cost;
                        cash -= cost;
                        shares += buyShares;
                        avgCost = totalInvested / shares;
                        trades.push({ date: dateStr, action: 'buy', price: +price.toFixed(2), shares: buyShares, cost: +cost.toFixed(0), reason: `定期定額 $${Math.round(buyAmount)}` });
                        tradeCount++;
                    }
                }
            } else if (strategy === 'buy_and_hold') {
                const buyShares = Math.floor(cash / (price * 1.001425));
                if (buyShares > 0) {
                    const cost = price * buyShares * 1.001425;
                    if (cost <= cash) {
                        cash -= cost;
                        shares += buyShares;
                        avgCost = price;
                        trades.push({ date: dateStr, action: 'buy', price: +price.toFixed(2), shares: buyShares, cost: +cost.toFixed(0), reason: '全額買入' });
                        tradeCount++;
                    }
                }
            } else {
                if (cash > price * 1000) {
                    const cost = price * 1000 * 1.001425;
                    cash -= cost;
                    shares += 1000;
                    avgCost = price;
                    trades.push({ date: dateStr, action: 'buy', price: +price.toFixed(2), shares: 1000, cost: +cost.toFixed(0), reason: '買入訊號' });
                    tradeCount++;
                }
            }
        } else if (signal === -1 && shares > 0) {
            const pnlPct = avgCost > 0 ? ((price - avgCost) / avgCost * 100).toFixed(1) : '0';
            const reason = stopLoss > 0 && +pnlPct <= -stopLoss ? `停損 ${pnlPct}%`
                : takeProfit > 0 && +pnlPct >= takeProfit ? `停利 +${pnlPct}%`
                    : '賣出訊號';
            const revenue = price * shares * (1 - 0.001425 - 0.003);
            trades.push({ date: dateStr, action: 'sell', price: +price.toFixed(2), shares, cost: +(price * shares * 0.004425).toFixed(0), reason });
            cash += revenue;
            shares = 0;
            avgCost = 0;
            tradeCount++;
        }

        const totalValue = cash + shares * price;
        equity.push({ date: dateStr, value: Math.round(totalValue) });
        benchCurve.push({ date: dateStr, value: Math.round(benchShares * benchPrice) });
    }

    // 計算指標
    const finalValue = equity[equity.length - 1]?.value || capital;
    const totalReturn = ((finalValue - capital) / capital) * 100;
    const years = Math.max(totalDays / 365, 0.01);
    const annualized = ((finalValue / capital) ** (1 / years) - 1) * 100;

    let peak = equity[0]?.value || capital;
    let maxDD = 0;
    let ddStart = 0; let maxRecovery = 0; let inDD = false;
    for (let i = 0; i < equity.length; i++) {
        const e = equity[i];
        if (e.value > peak) { peak = e.value; if (inDD) { maxRecovery = Math.max(maxRecovery, i - ddStart); inDD = false; } }
        const dd = ((peak - e.value) / peak) * 100;
        if (dd > 0 && !inDD) { ddStart = i; inDD = true; }
        if (dd > maxDD) maxDD = dd;
    }

    const benchFinal = benchCurve[benchCurve.length - 1]?.value || capital;
    const benchReturn = ((benchFinal - capital) / capital) * 100;

    // 勝率
    let buyP = 0; let wins = 0; let losses = 0;
    for (const t of trades) {
        if (t.action === 'buy') buyP = t.price;
        else if (t.action === 'sell' && buyP > 0) {
            if (t.price > buyP) wins++; else losses++;
            buyP = 0;
        }
    }
    const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;

    // Beta & 波動率
    const dailyReturns: number[] = [];
    const benchDailyReturns: number[] = [];
    for (let i = 1; i < equity.length; i++) {
        dailyReturns.push((equity[i].value - equity[i - 1].value) / equity[i - 1].value);
        benchDailyReturns.push((benchCurve[i].value - benchCurve[i - 1].value) / benchCurve[i - 1].value);
    }
    const avgR = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
    const avgB = benchDailyReturns.reduce((a, b) => a + b, 0) / (benchDailyReturns.length || 1);
    let cov = 0; let varB = 0; let varR = 0;
    for (let i = 0; i < dailyReturns.length; i++) {
        cov += (dailyReturns[i] - avgR) * (benchDailyReturns[i] - avgB);
        varB += (benchDailyReturns[i] - avgB) ** 2;
        varR += (dailyReturns[i] - avgR) ** 2;
    }
    const beta = varB > 0 ? +(cov / varB).toFixed(2) : 1;
    const volatility = +(Math.sqrt(varR / (dailyReturns.length || 1)) * Math.sqrt(252) * 100).toFixed(1);

    return {
        total_return: +totalReturn.toFixed(2),
        annualized_return: +annualized.toFixed(2),
        max_drawdown: +maxDD.toFixed(2),
        win_rate: +winRate.toFixed(1),
        total_trades: tradeCount,
        sharpe_ratio: +(totalReturn / Math.max(maxDD, 1) * 0.8).toFixed(2),
        final_value: finalValue,
        equity_curve: equity,
        benchmark_return: +benchReturn.toFixed(2),
        benchmark_curve: benchCurve,
        trades,
        beta,
        volatility,
        max_recovery_days: maxRecovery,
    };
}

// === 主元件 ===
export default function BacktestPage() {
    const [stockId, setStockId] = useState('2330');
    const [strategy, setStrategy] = useState('ma_cross');
    const [startDate, setStartDate] = useState('2021-01-01');
    const [endDate, setEndDate] = useState('2025-12-31');
    const [capital, setCapital] = useState(1000000);
    const [params, setParams] = useState<Record<string, number>>({ fast_period: 20, slow_period: 60 });
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);

    const selectedStrategy = STRATEGIES.find(s => s.id === strategy)!;

    const handleRun = () => {
        setLoading(true);
        // 模擬計算延遲
        setTimeout(() => {
            const r = runMockBacktest(stockId, strategy, startDate, endDate, capital, params);
            setResult(r);
            setLoading(false);
        }, 600);
    };

    // 渲染資產曲線
    useEffect(() => {
        if (!result || !chartRef.current) return;

        const chart = createChart(chartRef.current, {
            width: chartRef.current.clientWidth,
            height: 360,
            layout: {
                background: { color: 'transparent' },
                textColor: '#9ca3af',
                fontFamily: 'Inter, Noto Sans TC, sans-serif',
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.04)' },
                horzLines: { color: 'rgba(255,255,255,0.04)' },
            },
            rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
            timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: false },
        });

        // 策略資產曲線
        const equitySeries = chart.addSeries(AreaSeries, {
            lineColor: '#3498ff',
            topColor: 'rgba(52,152,255,0.3)',
            bottomColor: 'rgba(52,152,255,0.02)',
            lineWidth: 2,
            priceLineVisible: false,
        });
        equitySeries.setData(
            result.equity_curve.map((e: any) => ({ time: e.date, value: e.value }))
        );

        // 大盤基準
        const benchSeries = chart.addSeries(LineSeries, {
            color: 'rgba(156,163,175,0.5)',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
        });
        benchSeries.setData(
            result.benchmark_curve.map((e: any) => ({ time: e.date, value: e.value }))
        );

        chart.timeScale().fitContent();

        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                chart.applyOptions({ width: entry.contentRect.width });
            }
        });
        ro.observe(chartRef.current);

        return () => { ro.disconnect(); chart.remove(); };
    }, [result]);

    return (
        <div className="animate-fade-in space-y-6">
            {/* 標題 */}
            <div className="card p-6">
                <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-1">
                    🔬 回測引擎
                </h2>
                <p className="text-surface-500 text-sm">
                    選擇策略、設定參數，模擬過去的投資績效
                </p>
                <p className="text-xs text-yellow-500/80 mt-1 flex items-center gap-1">
                    ⚠️ 目前使用近似真實歷史走勢的模擬數據（非精確歷史價格），待接入資料庫後將使用真實日線資料
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 左側：參數設定 */}
                <div className="lg:col-span-1 space-y-4">
                    {/* 股票 */}
                    <div className="card p-5">
                        <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                            📈 股票代碼
                        </label>
                        <input
                            type="text"
                            value={stockId}
                            onChange={(e) => setStockId(e.target.value)}
                            className="search-input text-sm"
                            placeholder="例: 2330"
                        />
                    </div>

                    {/* 策略 */}
                    <div className="card p-5">
                        <label className="block text-sm font-medium text-surface-900 dark:text-white mb-3">
                            🎯 投資策略
                        </label>
                        <div className="space-y-2">
                            {STRATEGIES.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => {
                                        setStrategy(s.id);
                                        // 重設參數
                                        const newParams: Record<string, number> = {};
                                        s.params.forEach((p) => { newParams[p.key] = p.default; });
                                        setParams(newParams);
                                    }}
                                    className={`w-full text-left px-4 py-3 rounded-xl transition-all ${strategy === s.id
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-surface-100 dark:bg-surface-850 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-800'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{s.icon}</span>
                                        <span className="font-medium text-sm">{s.name}</span>
                                    </div>
                                    <p className={`text-xs mt-1 ${strategy === s.id ? 'text-white/70' : 'text-surface-500'
                                        }`}>
                                        {s.description}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 策略參數 */}
                    {selectedStrategy.params.length > 0 && (
                        <div className="card p-5">
                            <label className="block text-sm font-medium text-surface-900 dark:text-white mb-3">
                                ⚙️ 策略參數
                            </label>
                            {selectedStrategy.params.map((p) => (
                                <div key={p.key} className="mb-3">
                                    <label className="block text-xs text-surface-500 mb-1">{p.label}</label>
                                    <input
                                        type="number"
                                        value={params[p.key] ?? p.default}
                                        onChange={(e) => setParams({ ...params, [p.key]: +e.target.value })}
                                        className="search-input text-sm"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 時間與資金 */}
                    <div className="card p-5 space-y-3">
                        <div>
                            <label className="block text-xs text-surface-500 mb-1">回測起始日</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                className="search-input text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-surface-500 mb-1">回測結束日</label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                className="search-input text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-surface-500 mb-1">初始資金 (NT$)</label>
                            <input type="number" value={capital} onChange={(e) => setCapital(+e.target.value)}
                                className="search-input text-sm" step={100000} />
                        </div>
                    </div>

                    {/* 風控設定 */}
                    <div className="card p-5 space-y-3">
                        <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                            🛡️ 風控設定
                        </label>
                        <div>
                            <label className="block text-xs text-surface-500 mb-1">停損 % (0=不啟用)</label>
                            <input type="number" value={params.stop_loss || 0}
                                onChange={(e) => setParams({ ...params, stop_loss: +e.target.value })}
                                className="search-input text-sm" min={0} max={50} step={1} />
                        </div>
                        <div>
                            <label className="block text-xs text-surface-500 mb-1">停利 % (0=不啟用)</label>
                            <input type="number" value={params.take_profit || 0}
                                onChange={(e) => setParams({ ...params, take_profit: +e.target.value })}
                                className="search-input text-sm" min={0} max={200} step={5} />
                        </div>
                    </div>

                    {/* 執行按鈕 */}
                    <button
                        onClick={handleRun}
                        disabled={loading}
                        className={`w-full py-3 rounded-xl font-bold text-white transition-all ${loading
                            ? 'bg-surface-600 cursor-not-allowed'
                            : 'bg-primary-600 hover:bg-primary-700 active:scale-[0.98]'
                            }`}
                    >
                        {loading ? '⏳ 計算中...' : '🚀 開始回測'}
                    </button>
                </div>

                {/* 右側：結果 */}
                <div className="lg:col-span-2 space-y-4">
                    {!result && !loading && (
                        <div className="card p-12 text-center">
                            <div className="text-6xl mb-4">🔬</div>
                            <h3 className="text-xl font-bold text-surface-900 dark:text-white mb-2">
                                設定策略後開始回測
                            </h3>
                            <p className="text-surface-500">
                                選擇投資策略和參數，模擬過去的交易績效
                            </p>
                        </div>
                    )}

                    {loading && (
                        <div className="card p-12 text-center">
                            <div className="animate-spin text-5xl mb-4">⏳</div>
                            <p className="text-surface-500">正在計算回測結果...</p>
                        </div>
                    )}

                    {result && !loading && (
                        <>
                            {/* 績效指標 */}
                            <div className="card p-6">
                                <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-4">
                                    📋 績效摘要
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <MetricBox
                                        label="總報酬率"
                                        value={`${result.total_return > 0 ? '+' : ''}${result.total_return}%`}
                                        color={result.total_return >= 0 ? 'text-green-500' : 'text-red-500'}
                                        subtext={`vs 大盤 ${result.benchmark_return > 0 ? '+' : ''}${result.benchmark_return}%`}
                                        subColor={result.total_return > result.benchmark_return ? 'text-green-400' : 'text-red-400'}
                                    />
                                    <MetricBox
                                        label="年化報酬率"
                                        value={`${result.annualized_return > 0 ? '+' : ''}${result.annualized_return}%`}
                                        color={result.annualized_return >= 0 ? 'text-green-500' : 'text-red-500'}
                                    />
                                    <MetricBox
                                        label="最大回撤 (MDD)"
                                        value={`-${result.max_drawdown}%`}
                                        color={result.max_drawdown > 20 ? 'text-red-500' : result.max_drawdown > 10 ? 'text-yellow-500' : 'text-green-500'}
                                        subtext={`恢復 ${result.max_recovery_days} 天`}
                                    />
                                    <MetricBox
                                        label="勝率"
                                        value={`${result.win_rate}%`}
                                        color={result.win_rate >= 50 ? 'text-green-500' : 'text-yellow-500'}
                                        subtext={`${result.total_trades} 筆交易`}
                                    />
                                    <MetricBox
                                        label="Sharpe Ratio"
                                        value={result.sharpe_ratio.toString()}
                                        color={result.sharpe_ratio >= 1 ? 'text-green-500' : result.sharpe_ratio >= 0 ? 'text-yellow-500' : 'text-red-500'}
                                    />
                                    <MetricBox
                                        label="Beta"
                                        value={result.beta?.toString() || '1'}
                                        color={result.beta <= 1 ? 'text-green-500' : 'text-yellow-500'}
                                        subtext={result.beta > 1 ? '高於大盤' : '低於大盤'}
                                    />
                                    <MetricBox
                                        label="年化波動率"
                                        value={`${result.volatility}%`}
                                        color={result.volatility < 20 ? 'text-green-500' : result.volatility < 40 ? 'text-yellow-500' : 'text-red-500'}
                                    />
                                    <MetricBox
                                        label="超額報酬"
                                        value={`${(result.total_return - result.benchmark_return) > 0 ? '+' : ''}${(result.total_return - result.benchmark_return).toFixed(2)}%`}
                                        color={result.total_return > result.benchmark_return ? 'text-green-500' : 'text-red-500'}
                                        subtext="策略 vs 0050"
                                    />
                                    <MetricBox
                                        label="報酬/風險比"
                                        value={(result.total_return / Math.max(result.max_drawdown, 1)).toFixed(2)}
                                        color={result.total_return / Math.max(result.max_drawdown, 1) >= 1 ? 'text-green-500' : 'text-yellow-500'}
                                    />
                                </div>
                            </div>

                            {/* 資產曲線 */}
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                                        💹 資產曲線
                                    </h3>
                                    <div className="flex gap-3 text-xs text-surface-500">
                                        <span className="flex items-center gap-1">
                                            <span className="w-3 h-0.5 bg-blue-500 inline-block"></span> 策略
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-3 h-0.5 bg-gray-500 opacity-50 inline-block"></span> 大盤 (0050)
                                        </span>
                                    </div>
                                </div>
                                <div ref={chartRef} className="w-full" />
                            </div>

                            {/* 交易紀錄 */}
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                                        📝 交易紀錄（最近 20 筆）
                                    </h3>
                                    <button
                                        onClick={() => {
                                            const csv = '日期,操作,價格,股數,費用,原因\n' +
                                                result.trades.map((t: any) => `${t.date},${t.action},${t.price},${t.shares},${t.cost},${t.reason}`).join('\n');
                                            const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `backtest_${stockId}_${strategy}_${startDate}_${endDate}.csv`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-100 dark:bg-surface-850 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-800 transition-colors"
                                    >
                                        💾 匯出 CSV
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-surface-500 border-b border-surface-200 dark:border-surface-800">
                                                <th className="py-2 px-3">日期</th>
                                                <th className="py-2 px-3">操作</th>
                                                <th className="py-2 px-3">價格</th>
                                                <th className="py-2 px-3">股數</th>
                                                <th className="py-2 px-3">費用</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.trades.slice(-20).reverse().map((t: any, i: number) => (
                                                <tr key={i} className="border-b border-surface-100 dark:border-surface-900">
                                                    <td className="py-2 px-3 font-mono text-xs">{t.date}</td>
                                                    <td className={`py-2 px-3 font-medium ${t.action === 'buy' ? 'text-red-500' : 'text-green-500'}`}>
                                                        {t.action === 'buy' ? '買入' : '賣出'}
                                                    </td>
                                                    <td className="py-2 px-3">${t.price}</td>
                                                    <td className="py-2 px-3">{t.shares.toLocaleString()}</td>
                                                    <td className="py-2 px-3 text-surface-500">${t.cost.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// === 小元件 ===
function MetricBox({ label, value, color, subtext, subColor }: {
    label: string; value: string; color: string; subtext?: string; subColor?: string;
}) {
    return (
        <div className="p-4 rounded-xl bg-surface-100 dark:bg-surface-850 text-center">
            <div className="text-xs text-surface-500 mb-1">{label}</div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            {subtext && (
                <div className={`text-[10px] mt-1 ${subColor || 'text-surface-500'}`}>{subtext}</div>
            )}
        </div>
    );
}
