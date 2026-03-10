/**
 * 財務健診面板
 * 顯示 ROE 趨勢、FCF、毛利率、營益率等指標的簡潔卡片
 */
import type { TrendData } from '../types';

interface HealthPanelProps {
    roe: TrendData[];
    fcf: TrendData[];
}

export default function HealthPanel({ roe, fcf }: HealthPanelProps) {
    return (
        <div className="card p-6">
            <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-5">
                🏥 財務健診
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ROE 趨勢 */}
                <MetricCard
                    title="ROE（股東權益報酬率）"
                    subtitle="目標 > 15%"
                    data={roe}
                    format={(v) => `${v.toFixed(1)}%`}
                    threshold={15}
                    colorMode="above-good"
                />

                {/* FCF 趨勢 */}
                <MetricCard
                    title="自由現金流 (FCF)"
                    subtitle="正值為佳"
                    data={fcf}
                    format={(v) => `${v.toFixed(0)}`}
                    threshold={0}
                    colorMode="above-good"
                />
            </div>
        </div>
    );
}

// === 指標卡片元件 ===
interface MetricCardProps {
    title: string;
    subtitle: string;
    data: TrendData[];
    format: (v: number) => string;
    threshold: number;
    colorMode: 'above-good' | 'below-good';
}

function MetricCard({ title, subtitle, data, format, threshold, colorMode }: MetricCardProps) {
    const latestValue = data.length > 0 ? data[data.length - 1]?.value : null;
    const isGood =
        latestValue !== null &&
        (colorMode === 'above-good' ? latestValue >= threshold : latestValue <= threshold);

    // 計算趨勢方向
    const trend =
        data.length >= 2 && data[data.length - 1]?.value !== null && data[data.length - 2]?.value !== null
            ? (data[data.length - 1]!.value! - data[data.length - 2]!.value!)
            : 0;

    // 找最大值用來計算柱狀圖比例
    const maxVal = Math.max(...data.map((d) => Math.abs(d.value ?? 0)), 1);

    return (
        <div className="p-4 rounded-xl bg-surface-100 dark:bg-surface-850">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h4 className="font-semibold text-surface-900 dark:text-white text-sm">
                        {title}
                    </h4>
                    <p className="text-xs text-surface-500">{subtitle}</p>
                </div>
                <div className="text-right">
                    {latestValue !== null && (
                        <>
                            <div className={`text-xl font-bold ${isGood ? 'text-green-500' : 'text-red-500'}`}>
                                {format(latestValue)}
                            </div>
                            <div className={`text-xs ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {trend >= 0 ? '↑' : '↓'} {trend >= 0 ? '上升' : '下降'}趨勢
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 簡易柱狀圖 */}
            <div className="flex items-end gap-1 h-16">
                {data.map((d, i) => {
                    const height = Math.max(((Math.abs(d.value ?? 0) / maxVal) * 100), 4);
                    const isAbove =
                        d.value !== null &&
                        (colorMode === 'above-good' ? d.value >= threshold : d.value <= threshold);

                    return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                                className={`w-full rounded-t transition-all ${isAbove ? 'bg-green-500/60' : 'bg-red-500/60'
                                    }`}
                                style={{ height: `${height}%` }}
                                title={`${d.date}: ${d.value !== null ? format(d.value) : 'N/A'}`}
                            />
                        </div>
                    );
                })}
            </div>

            {/* X 軸標籤 */}
            <div className="flex gap-1 mt-1">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 text-center text-[10px] text-surface-500 truncate">
                        {d.date.replace('20', '').replace('Q', 'Q')}
                    </div>
                ))}
            </div>
        </div>
    );
}
