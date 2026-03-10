/**
 * P/E Band 圖表 — 本益比河流圖
 * 顯示歷史 PER 分布、當前位置（便宜/合理/昂貴）
 */
import { useEffect, useRef } from 'react';
import { createChart, LineSeries } from 'lightweight-charts';
import type { StockPER } from '../types';

interface PEBandChartProps {
    data: StockPER[];
    stockId: string;
}

export default function PEBandChart({ data }: PEBandChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);

    // 計算 PER 統計值
    const perValues = data.filter((d) => d.per && d.per > 0).map((d) => d.per!);
    perValues.sort((a, b) => a - b);

    const pe10 = perValues[Math.floor(perValues.length * 0.1)] ?? 0;
    const pe25 = perValues[Math.floor(perValues.length * 0.25)] ?? 0;
    const peMean = perValues.length ? perValues.reduce((a, b) => a + b, 0) / perValues.length : 0;
    const pe75 = perValues[Math.floor(perValues.length * 0.75)] ?? 0;
    const pe90 = perValues[Math.floor(perValues.length * 0.9)] ?? 0;
    const currentPER = data.length ? data[data.length - 1]?.per ?? 0 : 0;

    // 判斷區間
    let zone: { label: string; color: string; emoji: string };
    if (currentPER <= pe25) {
        zone = { label: '便宜區', color: 'text-green-500', emoji: '🟢' };
    } else if (currentPER <= pe75) {
        zone = { label: '合理區', color: 'text-yellow-500', emoji: '🟡' };
    } else {
        zone = { label: '昂貴區', color: 'text-red-500', emoji: '🔴' };
    }

    useEffect(() => {
        if (!chartRef.current || data.length === 0) return;

        const chart = createChart(chartRef.current, {
            width: chartRef.current.clientWidth,
            height: 300,
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

        // PER 線
        const perSeries = chart.addSeries(LineSeries, {
            color: '#3498ff',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
        });

        perSeries.setData(
            data
                .filter((d) => d.per && d.per > 0)
                .map((d) => ({ time: d.date as string, value: d.per! }))
        );

        // P/E 帶 — 便宜線
        const lowSeries = chart.addSeries(LineSeries, {
            color: 'rgba(34,197,94,0.5)',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
        });
        lowSeries.setData(
            data.filter((d) => d.per).map((d) => ({ time: d.date as string, value: pe25 }))
        );

        // P/E 帶 — 昂貴線
        const highSeries = chart.addSeries(LineSeries, {
            color: 'rgba(239,68,68,0.5)',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
        });
        highSeries.setData(
            data.filter((d) => d.per).map((d) => ({ time: d.date as string, value: pe75 }))
        );

        // 平均線
        const meanSeries = chart.addSeries(LineSeries, {
            color: 'rgba(251,191,36,0.6)',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
        });
        meanSeries.setData(
            data.filter((d) => d.per).map((d) => ({ time: d.date as string, value: peMean }))
        );

        chart.timeScale().fitContent();

        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                chart.applyOptions({ width: entry.contentRect.width });
            }
        });
        ro.observe(chartRef.current);

        return () => {
            ro.disconnect();
            chart.remove();
        };
    }, [data]);

    return (
        <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                    📊 P/E Band 河流圖
                </h3>
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${zone.color}`}>
                        {zone.emoji} {zone.label}
                    </span>
                    <span className="text-sm text-surface-500">
                        PER {currentPER.toFixed(1)}
                    </span>
                </div>
            </div>

            {/* PER 統計卡片 */}
            <div className="grid grid-cols-5 gap-3 mb-4">
                {[
                    { label: 'P10(低)', value: pe10, color: 'text-green-500' },
                    { label: 'P25', value: pe25, color: 'text-green-400' },
                    { label: '平均', value: peMean, color: 'text-yellow-500' },
                    { label: 'P75', value: pe75, color: 'text-orange-400' },
                    { label: 'P90(高)', value: pe90, color: 'text-red-500' },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className="text-center p-2 rounded-lg bg-surface-100 dark:bg-surface-850"
                    >
                        <div className="text-xs text-surface-500 mb-1">{stat.label}</div>
                        <div className={`text-sm font-bold ${stat.color}`}>
                            {stat.value.toFixed(1)}
                        </div>
                    </div>
                ))}
            </div>

            {/* 圖例 */}
            <div className="flex gap-4 mb-3 text-xs text-surface-500">
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-blue-500 inline-block"></span> PER
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-green-500 opacity-50 inline-block"></span> P25 便宜線
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-yellow-500 opacity-60 inline-block"></span> 平均線
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-red-500 opacity-50 inline-block"></span> P75 昂貴線
                </span>
            </div>

            {/* 圖表 */}
            <div ref={chartRef} className="w-full" />
        </div>
    );
}
