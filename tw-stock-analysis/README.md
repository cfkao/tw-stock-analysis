# 🇹🇼 台股價值投資分析系統

一個專為台灣長期價值投資者打造的股票分析 Web 應用程式，聚焦企業體質與合理估值。

![Version](https://img.shields.io/badge/version-0.4.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 功能特色

### 📊 個股診斷
- **K 線圖** — TradingView Lightweight Charts，支援 MA5/20/60/200
- **P/E Band 估值** — 本益比河流圖，便宜/合理/昂貴區間
- **Graham 安全邊際** — 內在價值計算 + 安全邊際百分比
- **估值總結** — PE/PB/殖利率/MOS 四維度綜合判斷

### 🔬 深度分析
- **杜邦分析** — ROE = 淨利率 × 資產周轉率 × 權益乘數
- **殖利率歷年圖** — 連續配息年數追蹤
- **負債與現金流** — 流動比/速動比/利息保障倍數

### ⚖️ 股票對比
- 2-4 檔並排比較，SVG 五維雷達圖
- 11 項指標對比表（最優 👑 標記）
- 價值分結論（5 分制自動評分）

### 🔬 回測引擎
- 5 種策略：均線交叉、本益比估值、殖利率、買入持有、定期定額
- 停損/停利自動觸發
- Beta、年化波動率、回撤恢復天數
- CSV 一鍵匯出

### 📱 其他
- ⭐ 自選股清單（localStorage 持久化）
- 📝 個股投資筆記
- 🌙 深色模式
- 📱 RWD + 手機底部 Tab 導航

## 🛠 技術架構

```
tw-stock-analysis/
├── frontend/          # React + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/  # KLineChart, PEBandChart, HealthPanel, AdvancedAnalysis
│   │   ├── pages/       # Dashboard, StockDetail, BacktestPage, ComparePage, WatchlistPage
│   │   ├── services/    # API, MockData, Watchlist (localStorage)
│   │   └── types/       # TypeScript 型別定義
│   └── ...
├── backend/           # FastAPI + PostgreSQL (開發中)
│   ├── app/
│   │   ├── api/         # RESTful API 路由
│   │   ├── services/    # FinMind 同步、回測引擎
│   │   └── models/      # SQLAlchemy ORM
│   └── ...
└── docker-compose.yml
```

### 前端
- **React 19** + **TypeScript**
- **Vite 7** 快速建構
- **Tailwind CSS 4** 樣式系統
- **TradingView Lightweight Charts** K 線圖表
- **React Router** SPA 路由

### 後端 (開發中)
- **FastAPI** + **SQLAlchemy**
- **PostgreSQL** 資料快取
- **FinMind API** 台灣股市數據來源

## 🚀 快速開始

### 前端（可獨立運行，含 Mock 數據）

```bash
cd frontend
npm install
npm run dev
```

開啟 http://localhost:5173

### 後端 + 資料庫（需要 Docker）

```bash
docker-compose up -d    # 啟動 PostgreSQL
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 📸 截圖

> 截圖待補（建議在本地跑起來後截圖替換）

## 📄 License

MIT License

## 🙏 致謝

- [FinMind](https://finmind.github.io/) — 台灣股市開放資料 API
- [TradingView Lightweight Charts](https://github.com/nicfb/lightweight-charts) — 開源圖表庫
