"""
回測引擎核心
支援多種內建策略、自訂參數、績效指標計算、與大盤比較
"""
import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

logger = logging.getLogger(__name__)


# ==============================
# 資料結構
# ==============================

@dataclass
class BacktestConfig:
    """回測設定"""
    stock_id: str
    strategy: str                      # 策略名稱
    start_date: str                    # 回測起始日 YYYY-MM-DD
    end_date: str | None = None        # 回測結束日
    initial_capital: float = 1_000_000  # 初始資金
    params: dict[str, Any] = field(default_factory=dict)  # 策略參數


@dataclass
class Trade:
    """單筆交易紀錄"""
    date: str
    action: str         # "buy" | "sell"
    price: float
    shares: int | float
    cost: float         # 含手續費
    reason: str = ""


@dataclass
class BacktestResult:
    """回測結果"""
    config: dict[str, Any]
    # 績效指標
    total_return: float         # 總報酬率 (%)
    annualized_return: float    # 年化報酬率 (%)
    max_drawdown: float         # 最大回撤 (%)
    win_rate: float             # 勝率 (%)
    total_trades: int           # 總交易次數
    sharpe_ratio: float         # Sharpe Ratio (近似)
    final_value: float          # 最終資產
    # 序列資料
    equity_curve: list[dict]    # 資產曲線 [{date, value}]
    trades: list[dict]          # 交易紀錄
    # 基準比較
    benchmark_return: float     # 大盤報酬率
    benchmark_curve: list[dict] # 大盤曲線


# ==============================
# 回測引擎
# ==============================

class BacktestEngine:
    """回測計算引擎"""

    # 手續費率
    BUY_FEE_RATE = 0.001425     # 買入手續費 0.1425%
    SELL_FEE_RATE = 0.001425    # 賣出手續費 0.1425%
    SELL_TAX_RATE = 0.003       # 證交稅 0.3%

    def run(self, prices: list[dict], benchmark_prices: list[dict],
            config: BacktestConfig) -> BacktestResult:
        """
        執行回測

        Args:
            prices: 目標股票日線 [{date, open, high, low, close, ...}]
            benchmark_prices: 大盤 (0050) 日線
            config: 回測設定
        """
        logger.info(f"🔬 回測開始: {config.stock_id} ({config.strategy})")

        # 篩選日期範圍
        prices = self._filter_date_range(prices, config.start_date, config.end_date)
        benchmark_prices = self._filter_date_range(benchmark_prices, config.start_date, config.end_date)

        if len(prices) < 10:
            raise ValueError(f"價格資料不足: 僅 {len(prices)} 筆")

        # 根據策略生成買賣訊號
        signals = self._generate_signals(prices, config.strategy, config.params)

        # 模擬交易
        trades, equity_curve = self._simulate_trades(
            prices, signals, config.initial_capital, config.strategy, config.params
        )

        # 計算績效指標
        metrics = self._calculate_metrics(equity_curve, trades, config.initial_capital)

        # 計算大盤基準
        benchmark_curve, benchmark_return = self._calculate_benchmark(
            benchmark_prices, config.initial_capital
        )

        result = BacktestResult(
            config={
                "stock_id": config.stock_id,
                "strategy": config.strategy,
                "start_date": config.start_date,
                "end_date": config.end_date or prices[-1]["date"],
                "initial_capital": config.initial_capital,
                "params": config.params,
            },
            total_return=metrics["total_return"],
            annualized_return=metrics["annualized_return"],
            max_drawdown=metrics["max_drawdown"],
            win_rate=metrics["win_rate"],
            total_trades=len(trades),
            sharpe_ratio=metrics["sharpe_ratio"],
            final_value=metrics["final_value"],
            equity_curve=equity_curve,
            trades=[{
                "date": t.date, "action": t.action,
                "price": t.price, "shares": t.shares,
                "cost": t.cost, "reason": t.reason,
            } for t in trades],
            benchmark_return=benchmark_return,
            benchmark_curve=benchmark_curve,
        )

        logger.info(
            f"✅ 回測完成: 報酬 {metrics['total_return']:.1f}%, "
            f"MDD {metrics['max_drawdown']:.1f}%, "
            f"勝率 {metrics['win_rate']:.1f}%"
        )
        return result

    # ==============================
    # 策略信號生成
    # ==============================

    def _generate_signals(self, prices: list[dict], strategy: str,
                          params: dict) -> list[int]:
        """
        生成買賣信號序列
        1 = 買入, -1 = 賣出, 0 = 持有
        """
        strategy_map = {
            "ma_cross": self._strategy_ma_cross,
            "pe_value": self._strategy_pe_value,
            "dividend_yield": self._strategy_dividend_yield,
            "buy_and_hold": self._strategy_buy_and_hold,
            "monthly_dca": self._strategy_monthly_dca,
        }

        func = strategy_map.get(strategy)
        if not func:
            raise ValueError(f"不支援的策略: {strategy}. 可用: {list(strategy_map.keys())}")

        return func(prices, params)

    def _strategy_ma_cross(self, prices: list[dict], params: dict) -> list[int]:
        """
        均線交叉策略
        短均線上穿長均線 → 買入, 下穿 → 賣出
        params: fast_period (default 20), slow_period (default 60)
        """
        fast = params.get("fast_period", 20)
        slow = params.get("slow_period", 60)
        closes = [p["close"] for p in prices]
        signals = [0] * len(prices)

        for i in range(slow, len(prices)):
            fast_ma = sum(closes[i - fast + 1:i + 1]) / fast
            slow_ma = sum(closes[i - slow + 1:i + 1]) / slow
            prev_fast = sum(closes[i - fast:i]) / fast
            prev_slow = sum(closes[i - slow:i]) / slow

            if fast_ma > slow_ma and prev_fast <= prev_slow:
                signals[i] = 1   # 黃金交叉 → 買入
            elif fast_ma < slow_ma and prev_fast >= prev_slow:
                signals[i] = -1  # 死亡交叉 → 賣出

        return signals

    def _strategy_pe_value(self, prices: list[dict], params: dict) -> list[int]:
        """
        本益比估值策略
        PER < buy_pe → 買入, PER > sell_pe → 賣出
        (以價格模擬)
        params: buy_pe (default 15), sell_pe (default 25)
        """
        closes = [p["close"] for p in prices]
        signals = [0] * len(prices)

        # 用近 252 天的價格百分位模擬估值
        for i in range(252, len(prices)):
            window = closes[i - 252:i + 1]
            percentile = sum(1 for w in window if w <= closes[i]) / len(window)

            if percentile < 0.2:    # 便宜 20%
                signals[i] = 1
            elif percentile > 0.8:  # 昂貴 80%
                signals[i] = -1

        return signals

    def _strategy_dividend_yield(self, prices: list[dict], params: dict) -> list[int]:
        """
        殖利率策略
        利用價格反推: 價格低時殖利率高 → 買入
        params: buy_yield (default 5%), sell_yield (default 3%)
        """
        closes = [p["close"] for p in prices]
        signals = [0] * len(prices)

        # 用 MA200 做為基準
        for i in range(200, len(prices)):
            ma200 = sum(closes[i - 200 + 1:i + 1]) / 200
            ratio = closes[i] / ma200

            if ratio < 0.85:   # 低於 MA200 的 85%→ 便宜買入
                signals[i] = 1
            elif ratio > 1.15: # 高於 MA200 的 115% → 昂貴賣出
                signals[i] = -1

        return signals

    def _strategy_buy_and_hold(self, prices: list[dict], params: dict) -> list[int]:
        """買入持有策略（第一天全部買入）"""
        signals = [0] * len(prices)
        signals[0] = 1
        return signals

    def _strategy_monthly_dca(self, prices: list[dict], params: dict) -> list[int]:
        """
        每月定期定額策略
        每月第一個交易日買入固定金額
        params: monthly_amount (default 30000)
        """
        signals = [0] * len(prices)
        current_month = ""

        for i, p in enumerate(prices):
            month = p["date"][:7]  # YYYY-MM
            if month != current_month:
                signals[i] = 1  # 每月第一天買入
                current_month = month

        return signals

    # ==============================
    # 交易模擬
    # ==============================

    def _simulate_trades(self, prices: list[dict], signals: list[int],
                         initial_capital: float, strategy: str = "",
                         params: dict | None = None) -> tuple[list[Trade], list[dict]]:
        """模擬交易，計算資產曲線"""
        cash = initial_capital
        shares = 0.0
        trades: list[Trade] = []
        equity_curve: list[dict] = []
        monthly_amount = (params or {}).get("monthly_amount", 30000)

        for i, price_data in enumerate(prices):
            close = price_data["close"]
            signal = signals[i]

            if signal == 1:
                if strategy == "monthly_dca":
                    # 定期定額：每月買固定金額的零股
                    buy_amount = min(monthly_amount, cash)
                    if buy_amount > 100:  # 至少 100 元
                        buy_shares = int(buy_amount / (close * (1 + self.BUY_FEE_RATE)))  # 買入股數（含手續費）
                        if buy_shares < 1:
                            buy_shares = 1  # 至少買 1 股
                        actual_cost = close * buy_shares
                        fee = actual_cost * self.BUY_FEE_RATE
                        total_cost = actual_cost + fee
                        if total_cost <= cash:
                            cash -= total_cost
                            shares += buy_shares
                            trades.append(Trade(
                                date=price_data["date"],
                                action="buy",
                                price=close,
                                shares=buy_shares,
                                cost=round(total_cost, 0),
                                reason=f"定期定額 ${int(buy_amount)}",
                            ))

                elif strategy == "buy_and_hold":
                    # 買入持有：用全部資金買入（含手續費）
                    buy_shares = int(cash / (close * (1 + self.BUY_FEE_RATE)))
                    if buy_shares > 0:
                        actual_cost = close * buy_shares
                        fee = actual_cost * self.BUY_FEE_RATE
                        total_cost = actual_cost + fee
                        if total_cost <= cash:
                            cash -= total_cost
                            shares += buy_shares
                            trades.append(Trade(
                                date=price_data["date"],
                                action="buy",
                                price=close,
                                shares=buy_shares,
                                cost=round(total_cost, 0),
                                reason="全額買入",
                            ))

                else:
                    # 其他策略：買入一張 (1000 股)
                    buy_shares = 1000
                    actual_cost = close * buy_shares
                    fee = actual_cost * self.BUY_FEE_RATE
                    total_cost = actual_cost + fee
                    if total_cost <= cash:
                        cash -= total_cost
                        shares += buy_shares
                        trades.append(Trade(
                            date=price_data["date"],
                            action="buy",
                            price=close,
                            shares=buy_shares,
                            cost=round(total_cost, 0),
                            reason="買入訊號",
                        ))

            elif signal == -1 and shares > 0:
                # 全部賣出
                revenue = close * shares
                fee = revenue * self.SELL_FEE_RATE
                tax = revenue * self.SELL_TAX_RATE
                net_revenue = revenue - fee - tax

                trades.append(Trade(
                    date=price_data["date"],
                    action="sell",
                    price=close,
                    shares=int(shares),
                    cost=round(fee + tax, 0),
                    reason="賣出訊號",
                ))
                cash += net_revenue
                shares = 0

            # 記錄當日資產
            total_value = cash + shares * close
            equity_curve.append({
                "date": price_data["date"],
                "value": round(total_value, 0),
                "cash": round(cash, 0),
                "stock_value": round(shares * close, 0),
            })

        return trades, equity_curve

    # ==============================
    # 績效指標計算
    # ==============================

    def _calculate_metrics(self, equity_curve: list[dict], trades: list[Trade],
                           initial_capital: float) -> dict[str, float]:
        """計算各項績效指標"""
        if not equity_curve:
            return {"total_return": 0, "annualized_return": 0, "max_drawdown": 0,
                    "win_rate": 0, "sharpe_ratio": 0, "final_value": initial_capital}

        final_value = equity_curve[-1]["value"]
        total_return = ((final_value - initial_capital) / initial_capital) * 100

        # 年化報酬
        days = len(equity_curve)
        years = max(days / 252, 0.01)
        annualized = ((final_value / initial_capital) ** (1 / years) - 1) * 100

        # 最大回撤 (MDD)
        peak = equity_curve[0]["value"]
        max_dd = 0
        for point in equity_curve:
            if point["value"] > peak:
                peak = point["value"]
            dd = ((peak - point["value"]) / peak) * 100
            max_dd = max(max_dd, dd)

        # 勝率
        buy_price = 0.0
        wins = 0
        losses = 0
        for trade in trades:
            if trade.action == "buy":
                buy_price = trade.price
            elif trade.action == "sell" and buy_price > 0:
                if trade.price > buy_price:
                    wins += 1
                else:
                    losses += 1
                buy_price = 0

        total_closed = wins + losses
        win_rate = (wins / total_closed * 100) if total_closed > 0 else 0

        # Sharpe Ratio (簡化版: 用日報酬率)
        daily_returns = []
        for i in range(1, len(equity_curve)):
            prev = equity_curve[i - 1]["value"]
            curr = equity_curve[i]["value"]
            if prev > 0:
                daily_returns.append((curr - prev) / prev)

        if daily_returns:
            avg_return = sum(daily_returns) / len(daily_returns)
            variance = sum((r - avg_return) ** 2 for r in daily_returns) / len(daily_returns)
            std = variance ** 0.5
            sharpe = (avg_return / std * (252 ** 0.5)) if std > 0 else 0
        else:
            sharpe = 0

        return {
            "total_return": round(total_return, 2),
            "annualized_return": round(annualized, 2),
            "max_drawdown": round(max_dd, 2),
            "win_rate": round(win_rate, 1),
            "sharpe_ratio": round(sharpe, 2),
            "final_value": round(final_value, 0),
        }

    def _calculate_benchmark(self, benchmark_prices: list[dict],
                             initial_capital: float) -> tuple[list[dict], float]:
        """計算大盤基準績效"""
        if not benchmark_prices:
            return [], 0

        first_price = benchmark_prices[0]["close"]
        shares = initial_capital / first_price

        curve = [
            {"date": p["date"], "value": round(shares * p["close"], 0)}
            for p in benchmark_prices
        ]

        final = curve[-1]["value"]
        total_return = ((final - initial_capital) / initial_capital) * 100
        return curve, round(total_return, 2)

    # ==============================
    # 工具方法
    # ==============================

    @staticmethod
    def _filter_date_range(prices: list[dict], start: str,
                           end: str | None) -> list[dict]:
        """篩選日期範圍"""
        filtered = [p for p in prices if p["date"] >= start]
        if end:
            filtered = [p for p in filtered if p["date"] <= end]
        return filtered


# 全域引擎實例
backtest_engine = BacktestEngine()
