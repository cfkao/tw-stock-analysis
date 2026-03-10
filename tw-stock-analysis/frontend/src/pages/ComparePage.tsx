/**
 * 股票對比分析頁面 — 2-3 檔股票並排比較
 */
import { useState, useMemo } from 'react';
import { MOCK_STOCKS } from '../services/mockData';

// Mock 對比數據
const COMPARE_DATA: Record<string, {
    price: number; pe: number; pb: number; roe: number; dy: number;
    netMargin: number; debtRatio: number; fcfGrowth: number;
    eps: number; bvps: number; beta: number;
}> = {
    '2330': { price: 1050, pe: 28.5, pb: 7.8, roe: 30.2, dy: 1.1, netMargin: 42.5, debtRatio: 28, fcfGrowth: 15.3, eps: 39.2, bvps: 125, beta: 1.05 },
    '2317': { price: 185, pe: 17.6, pb: 2.0, roe: 11.4, dy: 5.9, netMargin: 3.2, debtRatio: 55, fcfGrowth: 5.1, eps: 10.5, bvps: 92, beta: 0.95 },
    '2454': { price: 1380, pe: 22.1, pb: 6.2, roe: 28.3, dy: 2.8, netMargin: 28.6, debtRatio: 18, fcfGrowth: 22.5, eps: 62.4, bvps: 222, beta: 1.18 },
    '2308': { price: 380, pe: 24.3, pb: 5.5, roe: 22.8, dy: 2.5, netMargin: 12.1, debtRatio: 32, fcfGrowth: 18.2, eps: 15.6, bvps: 69, beta: 0.88 },
    '2881': { price: 82, pe: 10.2, pb: 1.3, roe: 12.8, dy: 5.5, netMargin: 35.2, debtRatio: 92, fcfGrowth: 3.2, eps: 8.0, bvps: 63, beta: 0.92 },
    '2882': { price: 65, pe: 9.8, pb: 1.2, roe: 12.2, dy: 6.1, netMargin: 32.1, debtRatio: 91, fcfGrowth: 2.8, eps: 6.6, bvps: 54, beta: 0.89 },
    '2412': { price: 125, pe: 25.0, pb: 3.8, roe: 15.2, dy: 4.0, netMargin: 18.5, debtRatio: 42, fcfGrowth: 1.5, eps: 5.0, bvps: 33, beta: 0.45 },
    '2002': { price: 28, pe: 18.7, pb: 1.2, roe: 6.4, dy: 3.6, netMargin: 4.5, debtRatio: 48, fcfGrowth: -2.1, eps: 1.5, bvps: 23, beta: 1.12 },
    '0050': { price: 180, pe: 22.0, pb: 4.5, roe: 20.5, dy: 2.5, netMargin: 0, debtRatio: 0, fcfGrowth: 8.5, eps: 8.2, bvps: 40, beta: 1.0 },
    '0056': { price: 37, pe: 18.5, pb: 2.0, roe: 10.8, dy: 5.5, netMargin: 0, debtRatio: 0, fcfGrowth: 4.0, eps: 2.0, bvps: 18.5, beta: 0.75 },
};

function getCompareData(stockId: string) {
    if (COMPARE_DATA[stockId]) return COMPARE_DATA[stockId];
    const seed = stockId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const r = (min: number, max: number) => +(min + ((seed * 7 + min * 13) % 100) / 100 * (max - min)).toFixed(1);
    return { price: r(30, 500), pe: r(8, 35), pb: r(0.8, 8), roe: r(5, 30), dy: r(1, 7), netMargin: r(3, 30), debtRatio: r(20, 60), fcfGrowth: r(-5, 25), eps: r(2, 20), bvps: r(15, 100), beta: r(0.5, 1.5) };
}

// 指標越高越好 / 越低越好的規則
const METRICS: { key: string; label: string; unit: string; better: 'high' | 'low' | 'mid'; format?: (v: number) => string }[] = [
    { key: 'price', label: '股價', unit: '$', better: 'mid' },
    { key: 'pe', label: 'PER', unit: '倍', better: 'low' },
    { key: 'pb', label: 'PBR', unit: '倍', better: 'low' },
    { key: 'eps', label: 'EPS', unit: '$', better: 'high' },
    { key: 'roe', label: 'ROE', unit: '%', better: 'high' },
    { key: 'dy', label: '殖利率', unit: '%', better: 'high' },
    { key: 'netMargin', label: '淨利率', unit: '%', better: 'high' },
    { key: 'debtRatio', label: '負債比', unit: '%', better: 'low' },
    { key: 'fcfGrowth', label: 'FCF 成長', unit: '%', better: 'high' },
    { key: 'beta', label: 'Beta', unit: '', better: 'low' },
    { key: 'bvps', label: '每股淨值', unit: '$', better: 'high' },
];

export default function ComparePage() {
    const [selected, setSelected] = useState<string[]>(['2330', '2454', '2317']);
    const [inputId, setInputId] = useState('');

    const addStock = (id: string) => {
        const trimmed = id.trim();
        if (trimmed && selected.length < 4 && !selected.includes(trimmed)) {
            setSelected([...selected, trimmed]);
            setInputId('');
        }
    };

    const removeStock = (id: string) => {
        setSelected(selected.filter(s => s !== id));
    };

    const datasets = useMemo(() =>
        selected.map(id => ({
            id,
            name: MOCK_STOCKS.find(s => s.stock_id === id)?.stock_name || id,
            data: getCompareData(id),
        })), [selected]);

    // 判斷誰最優
    const getBest = (key: string, better: 'high' | 'low' | 'mid') => {
        if (better === 'mid') return -1;
        const values = datasets.map((d, i) => ({ i, v: (d.data as any)[key] as number }));
        if (better === 'high') return values.reduce((a, b) => b.v > a.v ? b : a).i;
        return values.reduce((a, b) => b.v < a.v ? b : a).i;
    };

    // 雷達圖 SVG
    const radarMetrics = ['roe', 'dy', 'netMargin', 'fcfGrowth', 'eps'];
    const radarLabels = ['ROE', '殖利率', '淨利率', 'FCF成長', 'EPS'];
    const maxVals = radarMetrics.map(key => Math.max(...datasets.map(d => Math.abs((d.data as any)[key] as number)), 1));
    const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'];

    const svgSize = 240;
    const center = svgSize / 2;
    const radius = 90;

    const getPoint = (index: number, value: number, max: number) => {
        const angle = (Math.PI * 2 * index) / radarMetrics.length - Math.PI / 2;
        const r = (Math.min(value, max) / max) * radius;
        return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="card p-6">
                <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-1">
                    ⚖️ 股票對比分析
                </h2>
                <p className="text-surface-500 text-sm">
                    並排比較 2-4 檔股票的估值與財務指標
                </p>
            </div>

            {/* 選股區 */}
            <div className="card p-5">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    {selected.map((id) => {
                        const name = MOCK_STOCKS.find(s => s.stock_id === id)?.stock_name || id;
                        return (
                            <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-sm font-medium">
                                {id} {name}
                                <button onClick={() => removeStock(id)} className="text-primary-500 hover:text-red-500 ml-1">✕</button>
                            </span>
                        );
                    })}
                    {selected.length < 4 && (
                        <form onSubmit={(e) => { e.preventDefault(); addStock(inputId); }} className="flex items-center gap-1">
                            <input
                                type="text"
                                value={inputId}
                                onChange={(e) => setInputId(e.target.value)}
                                placeholder="新增代碼..."
                                className="px-3 py-1.5 text-sm rounded-lg bg-surface-100 dark:bg-surface-850 border border-surface-200 dark:border-surface-800 text-surface-900 dark:text-white outline-none w-28"
                            />
                            <button type="submit" className="px-2 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">+</button>
                        </form>
                    )}
                </div>
                {/* 常用快選 */}
                <div className="flex flex-wrap gap-1.5">
                    {MOCK_STOCKS.filter(s => !selected.includes(s.stock_id)).slice(0, 8).map(s => (
                        <button
                            key={s.stock_id}
                            onClick={() => addStock(s.stock_id)}
                            className="text-xs px-2.5 py-1 rounded-md bg-surface-100 dark:bg-surface-850 text-surface-600 dark:text-surface-400 hover:bg-primary-100 dark:hover:bg-primary-900/20 hover:text-primary-600 transition-colors"
                        >
                            + {s.stock_id} {s.stock_name}
                        </button>
                    ))}
                </div>
            </div>

            {datasets.length >= 2 && (
                <>
                    {/* 雷達圖 */}
                    <div className="card p-6">
                        <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-4">📡 五維雷達圖</h3>
                        <div className="flex justify-center">
                            <svg width={svgSize} height={svgSize} className="overflow-visible">
                                {/* 背景網格 */}
                                {[0.25, 0.5, 0.75, 1].map((scale) => (
                                    <polygon
                                        key={scale}
                                        points={radarMetrics.map((_, i) => {
                                            const pt = getPoint(i, scale, 1);
                                            return `${pt.x},${pt.y}`;
                                        }).join(' ')}
                                        fill="none"
                                        stroke="rgba(156,163,175,0.2)"
                                        strokeWidth={1}
                                    />
                                ))}
                                {/* 軸線 */}
                                {radarMetrics.map((_, i) => {
                                    const pt = getPoint(i, 1, 1);
                                    return <line key={i} x1={center} y1={center} x2={pt.x} y2={pt.y} stroke="rgba(156,163,175,0.15)" />;
                                })}
                                {/* 數據 */}
                                {datasets.map((ds, di) => (
                                    <polygon
                                        key={ds.id}
                                        points={radarMetrics.map((key, i) => {
                                            const val = Math.abs((ds.data as any)[key] as number);
                                            const pt = getPoint(i, val, maxVals[i]);
                                            return `${pt.x},${pt.y}`;
                                        }).join(' ')}
                                        fill={colors[di] + '20'}
                                        stroke={colors[di]}
                                        strokeWidth={2}
                                    />
                                ))}
                                {/* Labels */}
                                {radarLabels.map((label, i) => {
                                    const pt = getPoint(i, 1.2, 1);
                                    return (
                                        <text key={i} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="middle"
                                            className="text-[10px] fill-surface-500">
                                            {label}
                                        </text>
                                    );
                                })}
                            </svg>
                        </div>
                        <div className="flex justify-center gap-4 mt-3">
                            {datasets.map((ds, i) => (
                                <span key={ds.id} className="flex items-center gap-1.5 text-xs">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }} />
                                    {ds.id} {ds.name}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* 對比表格 */}
                    <div className="card p-6">
                        <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-4">📊 指標對比</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-surface-500 border-b border-surface-200 dark:border-surface-800">
                                        <th className="py-3 px-3">指標</th>
                                        {datasets.map((ds, i) => (
                                            <th key={ds.id} className="py-3 px-3">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i] }} />
                                                    {ds.id} {ds.name}
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {METRICS.map((metric) => {
                                        const bestIdx = getBest(metric.key, metric.better);
                                        return (
                                            <tr key={metric.key} className="border-b border-surface-100 dark:border-surface-900">
                                                <td className="py-3 px-3 text-surface-500 font-medium">{metric.label}</td>
                                                {datasets.map((ds, i) => {
                                                    const val = (ds.data as any)[metric.key] as number;
                                                    return (
                                                        <td key={ds.id} className={`py-3 px-3 font-mono font-bold ${bestIdx === i ? 'text-green-500' : 'text-surface-900 dark:text-white'
                                                            }`}>
                                                            {metric.key === 'price' ? `$${val}` : `${val}${metric.unit}`}
                                                            {bestIdx === i && <span className="ml-1 text-[10px]">👑</span>}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 結論 */}
                    <div className="card p-6">
                        <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-3">🎯 速覽結論</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {datasets.map((ds, i) => {
                                const d = ds.data;
                                const score = (d.roe > 15 ? 1 : 0) + (d.pe < 20 ? 1 : 0) + (d.dy > 3 ? 1 : 0) + (d.fcfGrowth > 5 ? 1 : 0) + (d.debtRatio < 50 ? 1 : 0);
                                const verdict = score >= 4 ? '⭐ 強力推薦' : score >= 3 ? '✅ 值得研究' : score >= 2 ? '🟡 觀察追蹤' : '⚠️ 需謹慎';
                                return (
                                    <div key={ds.id} className="p-4 rounded-xl border border-surface-200 dark:border-surface-800">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }} />
                                            <span className="font-bold text-surface-900 dark:text-white">{ds.id} {ds.name}</span>
                                        </div>
                                        <div className="text-lg font-bold mb-1">{verdict}</div>
                                        <div className="text-xs text-surface-500">
                                            價值分 {score}/5（ROE{d.roe > 15 ? '✓' : '✗'} PE{d.pe < 20 ? '✓' : '✗'} 殖利率{d.dy > 3 ? '✓' : '✗'} FCF{d.fcfGrowth > 5 ? '✓' : '✗'} 負債{d.debtRatio < 50 ? '✓' : '✗'}）
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
