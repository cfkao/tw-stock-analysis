import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus, Loader2, Sparkles, AlertTriangle, Lightbulb } from 'lucide-react';
import { analyzeStockNews } from '../services/api';
import type { NewsAnalysis } from '../types';

interface NewsInsightPanelProps {
    stockId: string;
}

export const NewsInsightPanel: React.FC<NewsInsightPanelProps> = ({ stockId }) => {
    const [analysis, setAnalysis] = useState<NewsAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasFetched = useRef(false);

    const handleAnalyze = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await analyzeStockNews(stockId);
            setAnalysis(result);
        } catch (err: any) {
            setError(err.response?.data?.detail || '分析過程發生錯誤，請稍後再試。');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!hasFetched.current && stockId) {
            hasFetched.current = true;
            handleAnalyze();
        }
    }, [stockId]);

    // 計算溫度計顏色與寬度
    const getSentimentStyle = (score: number) => {
        // -100 到 100 映射到 0% 到 100%
        const percentage = ((score + 100) / 200) * 100;
        let color = 'bg-gray-400';
        let text = '中立觀望';
        let Icon = Minus;

        if (score > 60) {
            color = 'bg-red-500'; // 台灣股市紅漲
            text = '極度樂觀';
            Icon = TrendingUp;
        } else if (score > 20) {
            color = 'bg-red-400';
            text = '偏向樂觀';
            Icon = TrendingUp;
        } else if (score < -60) {
            color = 'bg-green-500'; // 台灣股市綠跌
            text = '極度悲觀';
            Icon = TrendingDown;
        } else if (score < -20) {
            color = 'bg-green-400';
            text = '偏向悲觀';
            Icon = TrendingDown;
        }
        
        return { percentage, color, text, Icon };
    };

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-medium">AI 分析產生失敗</h3>
                    <p className="text-sm mt-1">{error}</p>
                    <button 
                        onClick={handleAnalyze}
                        className="mt-3 text-sm font-medium underline hover:text-red-700 dark:hover:text-red-300"
                    >
                        重新嘗試
                    </button>
                </div>
            </div>
        );
    }

    if (!analysis && !isLoading) {
        return (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-6 mb-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 mb-4">
                    <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                    AI 新聞洞察 (近三個月)
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto mb-6">
                    由 AI 自動彙整近三個月的新聞報導，快速提煉出目前的市場熱點、情緒溫度以及潛在的利多利空因素。
                </p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center min-h-[300px]">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    AI 正在閱讀並分析新聞中...
                </h3>
                <p className="text-sm text-gray-500 mt-2">
                    這可能需要 5 ~ 15 秒的時間，請稍候。
                </p>
                {/* 骨架屏提示 */}
                <div className="w-full max-w-2xl mt-8 space-y-4 animate-pulse opacity-50">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full w-full mb-8"></div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                        </div>
                        <div className="space-y-3">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!analysis) return null;

    const sentiment = getSentimentStyle(analysis.sentiment_score);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-900/50 overflow-hidden mb-8">
            {/* Header / Summary */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 px-6 py-5 border-b border-indigo-100 dark:border-indigo-900/50">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        AI 近期洞察總結
                    </h3>
                </div>
                <p className="text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                    {analysis.summary}
                </p>
            </div>

            <div className="p-6">
                {/* 模塊 1 & 2: 溫度計 & 標籤 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Sentiment Gauge */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            市場情緒多空儀表板
                        </h4>
                        <div className="flex items-center gap-4 mb-2">
                            <sentiment.Icon className={`w-8 h-8 ${analysis.sentiment_score > 0 ? 'text-red-500' : analysis.sentiment_score < 0 ? 'text-green-500' : 'text-gray-400'}`} />
                            <div>
                                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                    {sentiment.text}
                                </div>
                                <div className="text-sm text-gray-500">
                                    情緒分數: {analysis.sentiment_score}
                                </div>
                            </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-3">
                            <div 
                                className={`absolute top-0 left-0 h-full ${sentiment.color} transition-all duration-1000 ease-out`}
                                style={{ width: `${sentiment.percentage}%` }}
                            ></div>
                            <div className="absolute top-0 left-1/2 w-0.5 h-full bg-white dark:bg-gray-800 -translate-x-1/2 opacity-50"></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1 font-medium">
                            <span>極度悲觀</span>
                            <span>中立</span>
                            <span>極度樂觀</span>
                        </div>
                    </div>

                    {/* Themes */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" />
                            熱門投資題材
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {analysis.themes.map((theme, idx) => (
                                <span 
                                    key={idx} 
                                    className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium border border-indigo-100 dark:border-indigo-800"
                                >
                                    #{theme}
                                </span>
                            ))}
                            {analysis.themes.length === 0 && (
                                <span className="text-sm text-gray-500 italic">近期無明顯特定題材</span>
                            )}
                        </div>
                    </div>
                </div>

                <hr className="border-gray-100 dark:border-gray-700 mb-8" />

                {/* 模塊 3: 利多與利空對照表 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pros (利多 - 台灣習慣用紅色代表上漲/好) */}
                    <div className="bg-red-50/50 dark:bg-red-900/10 rounded-xl p-5 border border-red-100 dark:border-red-900/30">
                        <div className="flex items-center gap-2 mb-4 text-red-700 dark:text-red-400">
                            <TrendingUp className="w-5 h-5" />
                            <h4 className="font-bold text-lg">潛在利多因素</h4>
                        </div>
                        <ul className="space-y-3">
                            {analysis.pros.map((pro, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                                    <span className="text-red-500 font-bold mt-0.5">•</span>
                                    <span>{pro}</span>
                                </li>
                            ))}
                            {analysis.pros.length === 0 && (
                                <li className="text-gray-500 text-sm italic">新聞中未提及明顯利多</li>
                            )}
                        </ul>
                    </div>

                    {/* Cons (利空 - 台灣習慣用綠色代表下跌/壞) */}
                    <div className="bg-green-50/50 dark:bg-green-900/10 rounded-xl p-5 border border-green-100 dark:border-green-900/30">
                        <div className="flex items-center gap-2 mb-4 text-green-700 dark:text-green-400">
                            <TrendingDown className="w-5 h-5" />
                            <h4 className="font-bold text-lg">潛在利空與風險</h4>
                        </div>
                        <ul className="space-y-3">
                            {analysis.cons.map((con, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                                    <span className="text-green-500 font-bold mt-0.5">•</span>
                                    <span>{con}</span>
                                </li>
                            ))}
                            {analysis.cons.length === 0 && (
                                <li className="text-gray-500 text-sm italic">新聞中未提及明顯風險</li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
