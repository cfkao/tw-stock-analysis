import { useState, useEffect } from 'react';
import { getStockNews } from '../services/api';
import type { StockNews as StockNewsType } from '../types';
import { NewsInsightPanel } from './NewsInsightPanel';

function NewsItemNode({ item, isSubNews = false }: { item: StockNewsType, isSubNews?: boolean }) {
    const getSentimentColor = (title: string) => {
        const positiveWords = ['看好', '成長', '創高', '利多', '大增', '飆升', '買超', '上調', '雙增'];
        const negativeWords = ['衰退', '看淡', '大減', '利空', '下修', '賣超', '跌破', '雙減'];
        
        const isPos = positiveWords.some(w => title.includes(w));
        const isNeg = negativeWords.some(w => title.includes(w));
        
        if (isPos && !isNeg) return 'border-l-4 border-l-green-500';
        if (isNeg && !isPos) return 'border-l-4 border-l-red-500';
        return 'border-l-4 border-l-surface-300 dark:border-l-surface-700';
    };

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className={`block p-4 rounded-xl transition-colors ${getSentimentColor(item.title)} ${
                isSubNews 
                    ? 'bg-surface-50/50 dark:bg-surface-850/30 hover:bg-surface-100 dark:hover:bg-surface-800 ml-4 border-t border-surface-200 dark:border-surface-800' 
                    : 'bg-surface-50 dark:bg-surface-850/50 hover:bg-surface-100 dark:hover:bg-surface-850'
            }`}
        >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                <h4 className={`font-bold text-surface-900 dark:text-white leading-snug group-hover:text-primary-600 transition-colors ${isSubNews ? 'text-sm' : 'text-base'}`}>
                    {item.title}
                </h4>
                <span className="text-[10px] text-surface-500 whitespace-nowrap bg-white dark:bg-surface-900 px-2 py-0.5 rounded border border-surface-200 dark:border-surface-800">
                    {item.pub_date}
                </span>
            </div>
            {item.description && !isSubNews && (
                <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-2">
                    {item.description}
                </p>
            )}
        </a>
    );
}

function NewsGroup({ item }: { item: StockNewsType }) {
    const [expanded, setExpanded] = useState(false);
    const hasRelated = item.related_news && item.related_news.length > 0;

    return (
        <div className="space-y-2">
            <NewsItemNode item={item} />
            
            {hasRelated && (
                <div className="pl-2">
                    <button 
                        onClick={() => setExpanded(!expanded)}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium py-1 px-2 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors ml-4"
                    >
                        {expanded ? '▲ 收起相似報導' : `▼ 展開 ${item.related_news!.length} 則相似報導`}
                    </button>
                    
                    {expanded && (
                        <div className="space-y-2 mt-2">
                            {item.related_news!.map((subItem, idx) => (
                                <NewsItemNode key={`${subItem.link}-${idx}`} item={subItem} isSubNews={true} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function StockNews({ stockId }: { stockId: string }) {
    const [news, setNews] = useState<StockNewsType[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            setLoading(true);
            const data = await getStockNews(stockId);
            setNews(data);
            setLoading(false);
        };
        fetchNews();
    }, [stockId]);

    if (loading) {
        return (
            <div className="card p-8 text-center text-surface-500 animate-pulse">
                載入新聞中...
            </div>
        );
    }

    if (news.length === 0) {
        return (
            <div className="card p-8 text-center text-surface-500">
                目前沒有 {stockId} 的相關新聞
            </div>
        );
    }

    return (
        <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                    📰 最新相關新聞
                </h3>
                <span className="text-xs text-surface-500 bg-surface-100 dark:bg-surface-850 px-2 py-1 rounded-md">
                    來源: Yahoo 財經
                </span>
            </div>

            <NewsInsightPanel stockId={stockId} />

            <div className="space-y-6">
                {news.map((item, index) => (
                    <NewsGroup key={`${item.link}-${index}`} item={item} />
                ))}
            </div>
        </div>
    );
}
