import { useState, useMemo, useEffect } from 'react';
import { getStockPrices } from '../services/api';

// 定義持股紀錄
interface PortfolioRecord {
    id: string; // uuid
    stockId: string;
    buyDate: string;
    shares: number;   // 股數 (1張 = 1000股)
    buyPrice: number; // 買入單價
}

export default function PortfolioPage() {
    const [records, setRecords] = useState<PortfolioRecord[]>([]);
    const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formStockId, setFormStockId] = useState('');
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
    const [formShares, setFormShares] = useState(1000);
    const [formPrice, setFormPrice] = useState<number | ''>('');

    // 從 localStorage 讀取
    useEffect(() => {
        const saved = localStorage.getItem('tw_stock_portfolio');
        if (saved) {
            try { setRecords(JSON.parse(saved)); } catch (e) { console.error(e); }
        }
    }, []);

    // 儲存到 localStorage
    useEffect(() => {
        localStorage.setItem('tw_stock_portfolio', JSON.stringify(records));

        // 取得最新價格
        const fetchPrices = async () => {
            if (records.length === 0) return;
            const uniqueIds = [...new Set(records.map(r => r.stockId))];
            const newPrices: Record<string, number> = {};
            for (const id of uniqueIds) {
                try {
                    const data = await getStockPrices(id);
                    // 取得最後一筆有效收盤價
                    const latest = data.filter((d: any) => d.close !== null).pop();
                    if (latest && latest.close) {
                        newPrices[id] = latest.close;
                    }
                } catch (e) {
                    console.error(`Failed to fetch price for ${id}`, e);
                }
            }
            setCurrentPrices({ ...currentPrices, ...newPrices });
        };
        fetchPrices();
    }, [records]);

    // 計算整合數據 (目前的成本、市值、損益)
    const summary = useMemo(() => {
        let totalCost = 0;
        let totalMarketValue = 0;

        // 依股票代號分組計算
        const grouped = records.reduce((acc, current) => {
            if (!acc[current.stockId]) {
                acc[current.stockId] = { stockId: current.stockId, totalShares: 0, totalCost: 0, currentPrice: 0 };
            }
            acc[current.stockId].totalShares += current.shares;
            acc[current.stockId].totalCost += current.shares * current.buyPrice;
            return acc;
        }, {} as Record<string, { stockId: string, totalShares: number, totalCost: number, currentPrice: number }>);

        // 綁定最新價格並計算市值
        const positions = Object.values(grouped).map(pos => {
            const currentPrice = currentPrices[pos.stockId] || 0;
            pos.currentPrice = currentPrice;

            const marketValue = pos.totalShares * currentPrice;
            const avgCost = pos.totalCost / pos.totalShares;
            const unrealizedPL = marketValue - pos.totalCost;
            const unrealizedPLPct = (unrealizedPL / pos.totalCost) * 100;

            totalCost += pos.totalCost;
            totalMarketValue += marketValue;

            return { ...pos, avgCost, marketValue, unrealizedPL, unrealizedPLPct };
        }).sort((a, b) => b.marketValue - a.marketValue); // 依市值排序

        const totalPL = totalMarketValue - totalCost;
        const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

        return { totalCost, totalMarketValue, totalPL, totalPLPct, positions };
    }, [records]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formStockId || !formPrice) return;

        const newRecord: PortfolioRecord = {
            id: editingId || crypto.randomUUID(),
            stockId: formStockId,
            buyDate: formDate,
            shares: Number(formShares),
            buyPrice: Number(formPrice),
        };

        if (editingId) {
            setRecords(prev => prev.map(r => r.id === editingId ? newRecord : r));
        } else {
            setRecords(prev => [...prev, newRecord]);
        }

        closeForm();
    };

    const handleDelete = (id: string) => {
        if (confirm('確定要刪除這筆交易紀錄嗎？')) {
            setRecords(prev => prev.filter(r => r.id !== id));
        }
    };

    const editRecord = (r: PortfolioRecord) => {
        setEditingId(r.id);
        setFormStockId(r.stockId);
        setFormDate(r.buyDate);
        setFormShares(r.shares);
        setFormPrice(r.buyPrice);
        setIsFormOpen(true);
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setEditingId(null);
        setFormStockId('');
        setFormPrice('');
        setFormShares(1000);
        setFormDate(new Date().toISOString().split('T')[0]);
    };

    // 格式化輔助函數
    const formatMoney = (n: number) => Math.round(n).toLocaleString('zh-TW');
    const plColor = (n: number) => n >= 0 ? 'text-up' : 'text-down';

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-surface-900 dark:text-white">投資組合</h1>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition"
                >
                    + 新增紀錄
                </button>
            </div>

            {/* 總覽卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card p-5">
                    <p className="text-sm text-surface-500 mb-1">總投入成本</p>
                    <p className="text-2xl font-bold dark:text-white">${formatMoney(summary.totalCost)}</p>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-surface-500 mb-1">目前總市值</p>
                    <p className="text-2xl font-bold dark:text-white">${formatMoney(summary.totalMarketValue)}</p>
                </div>
                <div className="card p-5 md:col-span-2 border-l-4 border-l-primary-500">
                    <p className="text-sm text-surface-500 mb-1">總未實現損益</p>
                    <div className="flex items-baseline gap-3">
                        <p className={`text-3xl font-bold ${plColor(summary.totalPL)}`}>
                            {summary.totalPL >= 0 ? '+' : ''}{formatMoney(summary.totalPL)}
                        </p>
                        <p className={`text-lg font-medium ${plColor(summary.totalPLPct)}`}>
                            ({summary.totalPLPct > 0 ? '+' : ''}{summary.totalPLPct.toFixed(2)}%)
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 左側：持股明細 (合併計算) */}
                <div className="lg:col-span-2 card p-6">
                    <h2 className="text-lg font-bold mb-4 dark:text-white">持股部位</h2>
                    {summary.positions.length === 0 ? (
                        <div className="text-center py-10 text-surface-500">尚無持股紀錄</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-surface-500 border-b border-surface-200 dark:border-surface-800">
                                    <tr>
                                        <th className="pb-3 font-medium">股票</th>
                                        <th className="pb-3 font-medium text-right">持有股數</th>
                                        <th className="pb-3 font-medium text-right">均價 / 現價</th>
                                        <th className="pb-3 font-medium text-right">成本 / 市值</th>
                                        <th className="pb-3 font-medium text-right">未實現損益</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                                    {summary.positions.map(pos => (
                                        <tr key={pos.stockId} className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition">
                                            <td className="py-4 font-bold dark:text-white">{pos.stockId}</td>
                                            <td className="py-4 text-right dark:text-surface-300">{pos.totalShares.toLocaleString()}</td>
                                            <td className="py-4 text-right">
                                                <div className="dark:text-surface-400">{pos.avgCost.toFixed(2)}</div>
                                                <div className="font-bold dark:text-white">{pos.currentPrice.toFixed(2)}</div>
                                            </td>
                                            <td className="py-4 text-right">
                                                <div className="dark:text-surface-400">${formatMoney(pos.totalCost)}</div>
                                                <div className="dark:text-white">${formatMoney(pos.marketValue)}</div>
                                            </td>
                                            <td className={`py-4 text-right font-bold ${plColor(pos.unrealizedPL)}`}>
                                                <div>{pos.unrealizedPL > 0 ? '+' : ''}{formatMoney(pos.unrealizedPL)}</div>
                                                <div className="text-xs">{pos.unrealizedPLPct > 0 ? '+' : ''}{pos.unrealizedPLPct.toFixed(2)}%</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 右側：資產配置 + 交易紀錄 */}
                <div className="space-y-6">
                    {/* 資產配置簡單長條圖 */}
                    <div className="card p-6">
                        <h2 className="text-lg font-bold mb-4 dark:text-white">資產配置 (依市值)</h2>
                        {summary.positions.length > 0 ? (
                            <div className="space-y-3">
                                {summary.positions.map(pos => {
                                    const pct = (pos.marketValue / summary.totalMarketValue) * 100;
                                    return (
                                        <div key={pos.stockId}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-medium dark:text-white">{pos.stockId}</span>
                                                <span className="dark:text-surface-400">{pct.toFixed(1)}%</span>
                                            </div>
                                            <div className="h-2 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-surface-500 text-center py-4">無資料</p>
                        )}
                    </div>

                    {/* 交易紀錄清單 (可編輯) */}
                    <div className="card p-6">
                        <h2 className="text-lg font-bold mb-4 dark:text-white">交易紀錄</h2>
                        {records.length === 0 ? (
                            <p className="text-sm text-surface-500 text-center py-4">無紀錄</p>
                        ) : (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {[...records].sort((a, b) => new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime()).map(r => (
                                    <div key={r.id} className="p-3 bg-surface-50 dark:bg-surface-800/50 rounded-lg flex justify-between items-center group">
                                        <div>
                                            <p className="font-bold text-sm dark:text-white">{r.stockId}</p>
                                            <p className="text-xs text-surface-500">{r.buyDate} · {r.shares}股 @ {r.buyPrice}</p>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                            <button onClick={() => editRecord(r)} className="text-xs text-primary-600 hover:text-primary-700">編輯</button>
                                            <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:text-red-600">刪除</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 新增/編輯 Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-surface-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
                        <div className="p-6">
                            <h2 className="text-xl font-bold mb-4 dark:text-white">{editingId ? '編輯紀錄' : '新增買入紀錄'}</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-surface-300">股票代號</label>
                                    <input required type="text" value={formStockId} onChange={e => setFormStockId(e.target.value.toUpperCase())} className="input-field uppercase" placeholder="例如: 2330" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-surface-300">買入單價</label>
                                        <input required type="number" step="0.01" min="0" value={formPrice} onChange={e => setFormPrice(Number(e.target.value))} className="input-field" placeholder="買入價格" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-surface-300">股數 (單位：股)</label>
                                        <input required type="number" step="1" min="1" value={formShares} onChange={e => setFormShares(Number(e.target.value))} className="input-field" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-surface-300">買入日期</label>
                                    <input required type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="input-field" />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={closeForm} className="flex-1 py-2 rounded-xl text-surface-600 dark:text-surface-300 bg-surface-100 dark:bg-surface-800 hover:opacity-80 transition font-medium">取消</button>
                                    <button type="submit" className="flex-1 py-2 rounded-xl text-white bg-primary-600 hover:bg-primary-700 transition font-medium">儲存</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
