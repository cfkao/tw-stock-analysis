/**
 * K 線圖元件 — 使用 TradingView Lightweight Charts
 * 支援日/週/月切換、MA 移動平均線、時間範圍選擇
 * MA 使用全部歷史數據計算，僅顯示選定區間內的部分
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, type IChartApi, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import type { DailyPrice, ChartTimeRange } from '../types';

interface KLineChartProps {
    data: DailyPrice[];
    stockId: string;
    stockName: string;
}

const TIME_RANGES: { label: string; value: ChartTimeRange }[] = [
    { label: '1月', value: '1M' },
    { label: '3月', value: '3M' },
    { label: '6月', value: '6M' },
    { label: '1年', value: '1Y' },
    { label: '3年', value: '3Y' },
    { label: '5年', value: '5Y' },
];

// MA 設定
const MA_CONFIG = [
    { period: 5, color: '#ef4444', label: 'MA5', width: 1 as const },
    { period: 20, color: '#f59e0b', label: 'MA20', width: 1 as const },
    { period: 60, color: '#3b82f6', label: 'MA60', width: 1 as const },
    { period: 200, color: '#a855f7', label: 'MA200', width: 2 as const },
];

export default function KLineChart({ data, stockId, stockName }: KLineChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<IChartApi | null>(null);
    const [timeRange, setTimeRange] = useState<ChartTimeRange>('1Y');
    const [showMA, setShowMA] = useState(true);

    // ★ 先用全部歷史數據計算 MA，再按時間範圍裁切顯示
    const allMAs = useMemo(() => {
        return MA_CONFIG.map((ma) => ({
            ...ma,
            data: calculateMA(data, ma.period),
        }));
    }, [data]);

    const filteredData = useMemo(() => filterByRange(data, timeRange), [data, timeRange]);
    const cutoffDate = useMemo(() => {
        if (filteredData.length === 0) return '';
        return filteredData[0].date;
    }, [filteredData]);

    // 裁切 MA 到顯示範圍
    const filteredMAs = useMemo(() => {
        return allMAs.map((ma) => ({
            ...ma,
            data: ma.data.filter((d) => d.time >= cutoffDate),
        }));
    }, [allMAs, cutoffDate]);

    useEffect(() => {
        if (!chartRef.current || filteredData.length === 0) return;

        // 清除舊圖表
        if (chartInstance.current) {
            chartInstance.current.remove();
        }

        const chart = createChart(chartRef.current, {
            width: chartRef.current.clientWidth,
            height: 420,
            layout: {
                background: { color: 'transparent' },
                textColor: '#9ca3af',
                fontFamily: 'Inter, Noto Sans TC, sans-serif',
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.04)' },
                horzLines: { color: 'rgba(255,255,255,0.04)' },
            },
            crosshair: {
                vertLine: { color: 'rgba(52,152,255,0.3)', width: 1, style: 2 },
                horzLine: { color: 'rgba(52,152,255,0.3)', width: 1, style: 2 },
            },
            rightPriceScale: {
                borderColor: 'rgba(255,255,255,0.08)',
            },
            timeScale: {
                borderColor: 'rgba(255,255,255,0.08)',
                timeVisible: false,
            },
        });

        chartInstance.current = chart;

        // K 線 (台股慣例: 紅漲綠跌)
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#ef4444',
            downColor: '#22c55e',
            borderUpColor: '#ef4444',
            borderDownColor: '#22c55e',
            wickUpColor: '#ef4444',
            wickDownColor: '#22c55e',
        });

        const candleData = filteredData.map((d) => ({
            time: d.date as string,
            open: d.open ?? 0,
            high: d.high ?? 0,
            low: d.low ?? 0,
            close: d.close ?? 0,
        }));
        candleSeries.setData(candleData);

        // 成交量
        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });

        volumeSeries.setData(
            filteredData.map((d) => ({
                time: d.date as string,
                value: d.trading_volume ?? 0,
                color: (d.spread ?? 0) >= 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)',
            }))
        );

        // MA 均線（已用全部歷史數據計算，裁切到顯示區間）
        if (showMA) {
            filteredMAs.forEach((ma) => {
                if (ma.data.length > 0) {
                    const series = chart.addSeries(LineSeries, {
                        color: ma.color,
                        lineWidth: ma.width,
                        priceLineVisible: false,
                        lastValueVisible: false,
                    });
                    series.setData(ma.data);
                }
            });
        }

        chart.timeScale().fitContent();

        // Resize observer
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                chart.applyOptions({ width: entry.contentRect.width });
            }
        });
        ro.observe(chartRef.current);

        return () => {
            ro.disconnect();
            chart.remove();
            chartInstance.current = null;
        };
    }, [filteredData, filteredMAs, showMA]);

    // 最新價格資訊
    const latest = filteredData[filteredData.length - 1];
    const prev = filteredData[filteredData.length - 2];
    const priceChange = latest && prev ? (latest.close ?? 0) - (prev.close ?? 0) : 0;
    const changePercent = prev?.close ? (priceChange / prev.close) * 100 : 0;

    return (
        <div className="card p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                            {stockId} {stockName}
                        </h3>
                        {latest && (
                            <span className={`text-2xl font-bold ${priceChange >= 0 ? 'text-up' : 'text-down'}`}>
                                {latest.close?.toFixed(2)}
                            </span>
                        )}
                        {latest && (
                            <span className={`text-sm font-medium ${priceChange >= 0 ? 'text-up' : 'text-down'}`}>
                                {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)} ({changePercent.toFixed(2)}%)
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                    {/* 時間範圍 */}
                    {TIME_RANGES.map((r) => (
                        <button
                            key={r.value}
                            onClick={() => setTimeRange(r.value)}
                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${timeRange === r.value
                                ? 'bg-primary-600 text-white'
                                : 'bg-surface-100 dark:bg-surface-800 text-surface-500 hover:text-surface-900 dark:hover:text-white'
                                }`}
                        >
                            {r.label}
                        </button>
                    ))}

                    {/* MA 開關 */}
                    <button
                        onClick={() => setShowMA(!showMA)}
                        className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${showMA
                            ? 'bg-purple-600 text-white'
                            : 'bg-surface-100 dark:bg-surface-800 text-surface-500'
                            }`}
                    >
                        MA
                    </button>
                </div>
            </div>

            {/* MA 圖例 */}
            {showMA && (
                <div className="flex gap-4 mb-3 text-xs flex-wrap">
                    {MA_CONFIG.map((ma) => (
                        <span key={ma.label} className="flex items-center gap-1">
                            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: ma.color }} /> {ma.label}
                        </span>
                    ))}
                </div>
            )}

            {/* 圖表 */}
            <div ref={chartRef} className="w-full" />
        </div>
    );
}

// === 工具函式 ===

function calculateMA(
    data: DailyPrice[],
    period: number
): { time: string; value: number }[] {
    const result: { time: string; value: number }[] = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close ?? 0;
        }
        result.push({
            time: data[i].date,
            value: +(sum / period).toFixed(2),
        });
    }
    return result;
}

function filterByRange(data: DailyPrice[], range: ChartTimeRange): DailyPrice[] {
    const now = new Date();
    const map: Record<ChartTimeRange, number> = {
        '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '3Y': 1095, '5Y': 1825, '10Y': 3650,
    };
    const days = map[range];
    const cutoff = new Date(now.getTime() - days * 86400000);
    return data.filter((d) => new Date(d.date) >= cutoff);
}
