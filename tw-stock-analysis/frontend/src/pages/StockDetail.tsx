/**
 * 個股詳情頁 — 整合 K 線圖、P/E Band、財務健診、估值分析、筆記
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import KLineChart from '../components/KLineChart';
import PEBandChart from '../components/PEBandChart';
import HealthPanel from '../components/HealthPanel';
import {
    GrahamValuation,
    ValuationSummary,
    DuPontAnalysis,
    DividendChart,
    DebtCashFlow,
    StockNotes,
} from '../components/AdvancedAnalysis';
import StockNews from '../components/StockNews';
import {
    getStockInfo,
    getStockPrices,
    getStockPER,
    getROETrend,
    getFCFTrend,
} from '../services/api';
import { isInWatchlist, addToWatchlist, removeFromWatchlist } from '../services/watchlist';
import type { StockInfo, DailyPrice, StockPER as StockPERType, TrendData } from '../types';

export default function StockDetail() {
    const { stockId } = useParams<{ stockId: string }>();
    const [info, setInfo] = useState<StockInfo | null>(null);
    const [prices, setPrices] = useState<DailyPrice[]>([]);
    const [per, setPer] = useState<StockPERType[]>([]);
    const [roe, setRoe] = useState<TrendData[]>([]);
    const [fcf, setFcf] = useState<TrendData[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'chart' | 'valuation' | 'health' | 'analysis' | 'news'>('chart');
    const [watched, setWatched] = useState(false);

    useEffect(() => {
        if (!stockId) return;
        setLoading(true);
        setWatched(isInWatchlist(stockId));

        Promise.all([
            getStockInfo(stockId),
            getStockPrices(stockId),
            getStockPER(stockId),
            getROETrend(stockId),
            getFCFTrend(stockId),
        ]).then(([infoData, priceData, perData, roeData, fcfData]) => {
            setInfo(infoData);
            setPrices(priceData);
            setPer(perData);
            setRoe(roeData);
            setFcf(fcfData);
            setLoading(false);
        });
    }, [stockId]);

    const toggleWatch = () => {
        if (!stockId) return;
        if (watched) {
            removeFromWatchlist(stockId);
            setWatched(false);
        } else {
            addToWatchlist(stockId);
            setWatched(true);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin text-4xl mb-3">⏳</div>
                    <p className="text-surface-500">載入 {stockId} 資料中...</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { key: 'chart' as const, label: '📈 K 線圖' },
        { key: 'valuation' as const, label: '📊 估值分析' },
        { key: 'health' as const, label: '🏥 財務健診' },
        { key: 'analysis' as const, label: '🔬 深度分析' },
        { key: 'news' as const, label: '📰 相關新聞' },
    ];

    return (
        <div className="animate-fade-in">
            {/* 導航列 + 自選按鈕 */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-sm text-surface-500">
                    <Link to="/" className="hover:text-primary-500 transition-colors">首頁</Link>
                    <span>/</span>
                    <span className="text-surface-900 dark:text-white font-medium">
                        {stockId} {info?.stock_name}
                    </span>
                    {info?.industry_category && (
                        <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                            {info.industry_category}
                        </span>
                    )}
                </div>
                <button
                    onClick={toggleWatch}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${watched
                        ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 hover:bg-yellow-500/30'
                        : 'bg-surface-100 dark:bg-surface-850 text-surface-500 hover:text-yellow-500 hover:bg-yellow-500/10'
                        }`}
                >
                    {watched ? '⭐ 已加入自選' : '☆ 加入自選'}
                </button>
            </div>

            {/* Tab 切換 */}
            <div className="flex gap-2 mb-6 border-b border-surface-200 dark:border-surface-800 pb-1 overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${activeTab === tab.key
                            ? 'bg-primary-600 text-white'
                            : 'text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-850'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 內容 */}
            <div className="space-y-6">
                {activeTab === 'chart' && prices.length > 0 && (
                    <KLineChart
                        data={prices}
                        stockId={stockId!}
                        stockName={info?.stock_name ?? ''}
                    />
                )}

                {activeTab === 'valuation' && (
                    <>
                        <ValuationSummary stockId={stockId!} />
                        <GrahamValuation stockId={stockId!} />

                        {per.length > 0 && <PEBandChart data={per} stockId={stockId!} />}

                        {/* 最新殖利率資訊 */}
                        {per.length > 0 && (
                            <div className="card p-6">
                                <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-4">
                                    💰 殖利率 & 估值概況
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: '當前 PER', value: per[per.length - 1]?.per?.toFixed(1) ?? 'N/A', unit: '倍' },
                                        { label: '當前 PBR', value: per[per.length - 1]?.pbr?.toFixed(2) ?? 'N/A', unit: '倍' },
                                        { label: '殖利率', value: per[per.length - 1]?.dividend_yield?.toFixed(2) ?? 'N/A', unit: '%' },
                                        { label: '資料天數', value: per.length.toString(), unit: '天' },
                                    ].map((item) => (
                                        <div key={item.label} className="p-4 rounded-xl bg-surface-100 dark:bg-surface-850 text-center">
                                            <div className="text-xs text-surface-500 mb-1">{item.label}</div>
                                            <div className="text-xl font-bold text-surface-900 dark:text-white">
                                                {item.value}
                                                <span className="text-sm font-normal text-surface-500 ml-1">{item.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'health' && (
                    <>
                        <HealthPanel roe={roe} fcf={fcf} />
                        <DebtCashFlow stockId={stockId!} />
                    </>
                )}

                {activeTab === 'analysis' && (
                    <>
                        <DuPontAnalysis stockId={stockId!} />
                        <DividendChart stockId={stockId!} />
                        <StockNotes stockId={stockId!} />
                    </>
                )}

                {activeTab === 'news' && (
                    <StockNews stockId={stockId!} />
                )}
            </div>
        </div>
    );
}
