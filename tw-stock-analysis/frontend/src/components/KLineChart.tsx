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
    const [showBB, setShowBB] = useState(false);
    const [showMACD, setShowMACD] = useState(false);
    const [showRSI, setShowRSI] = useState(false);

    // ★ 計算所有指標 (用全部歷史數據)
    const allMAs = useMemo(() => {
        return MA_CONFIG.map((ma) => ({
            ...ma,
            data: calculateMA(data, ma.period),
        }));
    }, [data]);

    const allBBands = useMemo(() => calculateBB(data, 20, 2), [data]);
    const allMACD = useMemo(() => calculateMACD(data), [data]);
    const allRSI = useMemo(() => calculateRSI(data, 14), [data]);

    const filteredData = useMemo(() => filterByRange(data, timeRange), [data, timeRange]);
    const cutoffDate = useMemo(() => {
        if (filteredData.length === 0) return '';
        return filteredData[0].date;
    }, [filteredData]);

    // 裁切指標到顯示範圍
    const filteredMAs = useMemo(() => {
        return allMAs.map((ma) => ({
            ...ma,
            data: ma.data.filter((d) => d.time >= cutoffDate),
        }));
    }, [allMAs, cutoffDate]);

    const filteredBBands = useMemo(() => {
        return {
            upper: allBBands.upper.filter((d) => d.time >= cutoffDate),
            middle: allBBands.middle.filter((d) => d.time >= cutoffDate),
            lower: allBBands.lower.filter((d) => d.time >= cutoffDate),
        };
    }, [allBBands, cutoffDate]);

    const filteredMACD = useMemo(() => {
        return {
            dif: allMACD.dif.filter((d) => d.time >= cutoffDate),
            dem: allMACD.dem.filter((d) => d.time >= cutoffDate),
            osc: allMACD.osc.filter((d) => d.time >= cutoffDate),
        };
    }, [allMACD, cutoffDate]);

    const filteredRSI = useMemo(() => allRSI.filter((d) => d.time >= cutoffDate), [allRSI, cutoffDate]);

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

        // MA 均線
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

        // 布林通道 (Bollinger Bands)
        if (showBB && filteredBBands.middle.length > 0) {
            const upSeries = chart.addSeries(LineSeries, { color: 'rgba(59, 130, 246, 0.4)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
            const midSeries = chart.addSeries(LineSeries, { color: 'rgba(245, 158, 11, 0.6)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
            const lowSeries = chart.addSeries(LineSeries, { color: 'rgba(59, 130, 246, 0.4)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
            upSeries.setData(filteredBBands.upper);
            midSeries.setData(filteredBBands.middle);
            lowSeries.setData(filteredBBands.lower);
        }

        // MACD
        if (showMACD && filteredMACD.dif.length > 0) {
            // 在圖表下方建立新副圖
            // 由於 LWCharts 原生不支援多 pane，我們用 priceScale 來模擬
            chart.applyOptions({ rightPriceScale: { autoScale: true } });

            const macdScale = 'macd';
            const difSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, priceScaleId: macdScale, priceLineVisible: false, lastValueVisible: false });
            const demSeries = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, priceScaleId: macdScale, priceLineVisible: false, lastValueVisible: false });
            const oscSeries = chart.addSeries(HistogramSeries, { priceScaleId: macdScale, priceLineVisible: false, lastValueVisible: false });

            difSeries.setData(filteredMACD.dif);
            demSeries.setData(filteredMACD.dem);
            oscSeries.setData(filteredMACD.osc.map(d => ({
                time: d.time,
                value: d.value,
                color: d.value >= 0 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)'
            })));

            // 調整 Scale 高度比例，把 MACD 擠到下方 20%
            chart.priceScale(macdScale).applyOptions({
                scaleMargins: { top: 0.8, bottom: 0 },
            });
            chart.priceScale('right').applyOptions({
                scaleMargins: { top: 0.1, bottom: 0.25 },
            });
            chart.priceScale('volume').applyOptions({
                scaleMargins: { top: 0.7, bottom: 0.25 },
            });
        }

        // RSI
        if (showRSI && filteredRSI.length > 0) {
            const rsiScale = 'rsi';
            const rsiSeries = chart.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1, priceScaleId: rsiScale, priceLineVisible: false, lastValueVisible: false });

            // 畫 30, 70 的橫線 (透過加假的資料線)
            const line70 = chart.addSeries(LineSeries, { color: 'rgba(255,255,255,0.2)', lineWidth: 1, lineStyle: 2, priceScaleId: rsiScale, priceLineVisible: false, lastValueVisible: false });
            const line30 = chart.addSeries(LineSeries, { color: 'rgba(255,255,255,0.2)', lineWidth: 1, lineStyle: 2, priceScaleId: rsiScale, priceLineVisible: false, lastValueVisible: false });

            rsiSeries.setData(filteredRSI);
            line70.setData(filteredRSI.map(d => ({ time: d.time, value: 70 })));
            line30.setData(filteredRSI.map(d => ({ time: d.time, value: 30 })));

            // RSI 放最下方
            chart.priceScale(rsiScale).applyOptions({
                scaleMargins: { top: showMACD ? 0.6 : 0.8, bottom: showMACD ? 0.25 : 0 },
            });
            if (!showMACD) {
                chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.25 } });
                chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.7, bottom: 0.25 } });
            }
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

                    {/* 指標開關 */}
                    <div className="flex gap-1 ml-4 border-l border-surface-200 dark:border-surface-800 pl-4">
                        <button onClick={() => setShowMA(!showMA)} className={`px-2 py-1.5 text-xs rounded-lg font-medium transition-all ${showMA ? 'bg-primary-600 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-500'}`}>MA</button>
                        <button onClick={() => setShowBB(!showBB)} className={`px-2 py-1.5 text-xs rounded-lg font-medium transition-all ${showBB ? 'bg-primary-600 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-500'}`}>BBands</button>
                        <button onClick={() => setShowMACD(!showMACD)} className={`px-2 py-1.5 text-xs rounded-lg font-medium transition-all ${showMACD ? 'bg-primary-600 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-500'}`}>MACD</button>
                        <button onClick={() => setShowRSI(!showRSI)} className={`px-2 py-1.5 text-xs rounded-lg font-medium transition-all ${showRSI ? 'bg-primary-600 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-500'}`}>RSI</button>
                    </div>
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

function calculateBB(data: DailyPrice[], period: number = 20, multiplier: number = 2) {
    const upper = []; const middle = []; const lower = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += data[i - j].close ?? 0;
        const ma = sum / period;

        let varianceSum = 0;
        for (let j = 0; j < period; j++) varianceSum += Math.pow((data[i - j].close ?? 0) - ma, 2);
        const stdev = Math.sqrt(varianceSum / period);

        middle.push({ time: data[i].date, value: +ma.toFixed(2) });
        upper.push({ time: data[i].date, value: +(ma + multiplier * stdev).toFixed(2) });
        lower.push({ time: data[i].date, value: +(ma - multiplier * stdev).toFixed(2) });
    }
    return { upper, middle, lower };
}

function calculateMACD(data: DailyPrice[], fast = 12, slow = 26, signal = 9) {
    if (data.length <= slow) return { dif: [], dem: [], osc: [] };

    // 計算 EMA
    const getEMA = (d: DailyPrice[], p: number) => {
        const k = 2 / (p + 1);
        const emaData: number[] = [];
        let ema = d[0].close ?? 0;
        for (let i = 0; i < d.length; i++) {
            ema = (d[i].close ?? 0) * k + ema * (1 - k);
            emaData.push(ema);
        }
        return emaData;
    };

    const emaFast = getEMA(data, fast);
    const emaSlow = getEMA(data, slow);

    const dif = [];
    const difValues = [];
    for (let i = 0; i < data.length; i++) {
        const value = emaFast[i] - emaSlow[i];
        dif.push({ time: data[i].date, value: +value.toFixed(2) });
        difValues.push(value);
    }

    const demValues: number[] = [];
    let demEma = difValues[slow - 1] || 0; // initialize
    const kSig = 2 / (signal + 1);
    for (let i = 0; i < difValues.length; i++) {
        demEma = difValues[i] * kSig + demEma * (1 - kSig);
        demValues.push(demEma);
    }

    const dem = [];
    const osc = [];
    for (let i = slow - 1; i < data.length; i++) { // Skip early unreliable period
        dem.push({ time: data[i].date, value: +demValues[i].toFixed(2) });
        osc.push({ time: data[i].date, value: +(difValues[i] - demValues[i]).toFixed(2) });
    }

    return { dif: dif.slice(slow - 1), dem, osc };
}

function calculateRSI(data: DailyPrice[], period = 14) {
    if (data.length <= period) return [];

    const rsi = [];
    let sumGain = 0;
    let sumLoss = 0;

    // First averages
    for (let i = 1; i <= period; i++) {
        const change = (data[i].close ?? 0) - (data[i - 1].close ?? 0);
        if (change >= 0) sumGain += change;
        else sumLoss -= change;
    }

    let avgGain = sumGain / period;
    let avgLoss = sumLoss / period;

    const initRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const initRSI = avgLoss === 0 ? 100 : 100 - (100 / (1 + initRS));
    rsi.push({ time: data[period].date, value: +initRSI.toFixed(2) });

    // Smoothed
    for (let i = period + 1; i < data.length; i++) {
        const change = (data[i].close ?? 0) - (data[i - 1].close ?? 0);
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const resRSI = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

        rsi.push({ time: data[i].date, value: +resRSI.toFixed(2) });
    }

    return rsi;
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
