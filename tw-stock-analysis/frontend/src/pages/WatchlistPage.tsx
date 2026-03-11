/**
 * 自選股清單頁面 — localStorage 驅動
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getWatchlist, removeFromWatchlist } from '../services/watchlist';
import { getStockInfo } from '../services/api';

export default function WatchlistPage() {

    interface WatchedStock {
        stock_id: string;
        stock_name: string;
        industry: string;
    }
    const [stocks, setStocks] = useState<WatchedStock[]>([]);

    useEffect(() => {
        const ids = getWatchlist();

        // Fetch real info for each watched stock
        const fetchInfos = async () => {
            const results: WatchedStock[] = [];
            for (const id of ids) {
                try {
                    const info = await getStockInfo(id);
                    results.push({
                        stock_id: id,
                        stock_name: info?.stock_name || id,
                        industry: info?.industry_category || '—',
                    });
                } catch (e) {
                    results.push({ stock_id: id, stock_name: id, industry: '—' });
                }
            }
            setStocks(results);
        };
        fetchInfos();
    }, []);

    const handleRemove = (stockId: string) => {
        removeFromWatchlist(stockId);
        setStocks(prev => prev.filter(s => s.stock_id !== stockId));
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="card p-6">
                <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-1">
                    ⭐ 自選股清單
                </h2>
                <p className="text-surface-500 text-sm">
                    追蹤你關注的股票，資料儲存於瀏覽器本地端
                </p>
            </div>

            {stocks.length === 0 ? (
                <div className="card p-12 text-center">
                    <div className="text-5xl mb-4">📋</div>
                    <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-2">
                        尚無自選股
                    </h3>
                    <p className="text-surface-500 text-sm mb-4">
                        到個股頁面點擊「⭐ 加入自選」即可開始追蹤
                    </p>
                    <Link
                        to="/"
                        className="inline-block px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        👉 去搜尋股票
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stocks.map((s) => (
                        <div
                            key={s.stock_id}
                            className="card p-5 hover:shadow-lg transition-all group"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <span className="font-mono font-bold text-primary-600 dark:text-primary-400 text-lg">
                                        {s.stock_id}
                                    </span>
                                    <span className="font-medium text-surface-900 dark:text-white ml-2">
                                        {s.stock_name}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleRemove(s.stock_id)}
                                    className="text-surface-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    title="移除"
                                >
                                    ✕
                                </button>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-850 text-surface-500">
                                {s.industry}
                            </span>
                            <Link
                                to={`/stock/${s.stock_id}`}
                                className="block mt-3 text-center text-sm text-primary-500 hover:text-primary-400 font-medium"
                            >
                                查看詳情 →
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
