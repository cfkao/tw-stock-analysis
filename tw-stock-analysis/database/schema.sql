-- =============================================
-- 台股價值投資分析系統 — 資料庫 Schema
-- Database: PostgreSQL 16
-- =============================================

-- 啟用必要擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. 股票基本資訊表 stock_info
--    資料來源: FinMind TaiwanStockInfo
-- =============================================
CREATE TABLE stock_info (
    stock_id        VARCHAR(10)     PRIMARY KEY,            -- 股票代碼 (e.g. '2330')
    stock_name      VARCHAR(100)    NOT NULL,               -- 股票名稱 (e.g. '台積電')
    industry_category VARCHAR(100),                          -- 產業別 (e.g. '半導體業')
    market_type     VARCHAR(20)     NOT NULL DEFAULT 'twse', -- 市場別: twse(上市), tpex(上櫃), emerging(興櫃)
    listed_date     DATE,                                    -- 上市/上櫃日期
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,   -- 是否仍在交易
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE stock_info IS '股票基本資訊表 — 來源: FinMind TaiwanStockInfo';
COMMENT ON COLUMN stock_info.market_type IS '市場別: twse=上市, tpex=上櫃, emerging=興櫃';

-- =============================================
-- 2. 日線價格表 daily_price
--    資料來源: FinMind TaiwanStockPrice
--    設計目標: 儲存 10 年日線資料
-- =============================================
CREATE TABLE daily_price (
    id              BIGSERIAL       PRIMARY KEY,
    stock_id        VARCHAR(10)     NOT NULL,
    date            DATE            NOT NULL,
    trading_volume  BIGINT,                                  -- 成交股數
    trading_money   BIGINT,                                  -- 成交金額
    open            DECIMAL(12, 2),                          -- 開盤價
    high            DECIMAL(12, 2),                          -- 最高價
    low             DECIMAL(12, 2),                          -- 最低價
    close           DECIMAL(12, 2),                          -- 收盤價
    spread          DECIMAL(12, 2),                          -- 漲跌價差
    trading_turnover BIGINT,                                 -- 成交筆數
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_daily_price_stock_date UNIQUE (stock_id, date),
    CONSTRAINT fk_daily_price_stock FOREIGN KEY (stock_id)
        REFERENCES stock_info (stock_id) ON DELETE CASCADE
);

-- 加速個股歷史查詢（K 線圖、技術指標計算）
CREATE INDEX idx_daily_price_stock_date ON daily_price (stock_id, date DESC);
-- 加速全市場某日查詢
CREATE INDEX idx_daily_price_date ON daily_price (date);

COMMENT ON TABLE daily_price IS '日線價格表 — 來源: FinMind TaiwanStockPrice，儲存 10 年歷史日線';

-- =============================================
-- 3. 本益比 / 股價淨值比表 stock_per
--    資料來源: FinMind TaiwanStockPER
--    用途: P/E Band 估值圖、河流圖
-- =============================================
CREATE TABLE stock_per (
    id              BIGSERIAL       PRIMARY KEY,
    stock_id        VARCHAR(10)     NOT NULL,
    date            DATE            NOT NULL,
    per             DECIMAL(12, 4),                          -- 本益比 (P/E Ratio)
    pbr             DECIMAL(12, 4),                          -- 股價淨值比 (P/B Ratio)
    dividend_yield  DECIMAL(8, 4),                           -- 殖利率 (%)
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_stock_per_stock_date UNIQUE (stock_id, date),
    CONSTRAINT fk_stock_per_stock FOREIGN KEY (stock_id)
        REFERENCES stock_info (stock_id) ON DELETE CASCADE
);

CREATE INDEX idx_stock_per_stock_date ON stock_per (stock_id, date DESC);

COMMENT ON TABLE stock_per IS '本益比/股價淨值比表 — 來源: FinMind TaiwanStockPER，用於 P/E Band 估值分析';

-- =============================================
-- 4. 財務報表表 financial_statement
--    資料來源: FinMind TaiwanStockFinancialStatements,
--             TaiwanStockCashFlowsStatement,
--             TaiwanStockBalanceSheet
--    設計: 採用長表格式 (type + value)，與 FinMind API 一致
--    儲存目標: 40 季 (10 年)
-- =============================================
CREATE TABLE financial_statement (
    id              BIGSERIAL       PRIMARY KEY,
    stock_id        VARCHAR(10)     NOT NULL,
    date            DATE            NOT NULL,                -- 報表日期 (季末日期，如 2024-03-31)
    source          VARCHAR(50)     NOT NULL,                -- 資料來源: income_statement, cash_flow, balance_sheet
    type            VARCHAR(200)    NOT NULL,                -- 科目類別 (e.g. 'Revenue', 'GrossProfit')
    value           DECIMAL(20, 4),                          -- 數值
    origin_name     VARCHAR(200),                            -- 原始中文名稱 (e.g. '營業收入合計')
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_financial_stock_date_source_type UNIQUE (stock_id, date, source, type),
    CONSTRAINT fk_financial_stock FOREIGN KEY (stock_id)
        REFERENCES stock_info (stock_id) ON DELETE CASCADE
);

-- 加速單檔個股所有財報查詢
CREATE INDEX idx_financial_stock_date ON financial_statement (stock_id, date DESC);
-- 加速特定科目跨公司比較
CREATE INDEX idx_financial_type ON financial_statement (type, stock_id);
-- 加速依來源篩選
CREATE INDEX idx_financial_source ON financial_statement (source);

COMMENT ON TABLE financial_statement IS '財務報表表 — 長表格式，整合損益表/現金流量表/資產負債表，儲存 40 季';
COMMENT ON COLUMN financial_statement.source IS '報表來源: income_statement=綜合損益表, cash_flow=現金流量表, balance_sheet=資產負債表';

-- =============================================
-- 5. 股利政策表 dividend_history
--    資料來源: FinMind TaiwanStockDividend
-- =============================================
CREATE TABLE dividend_history (
    id              BIGSERIAL       PRIMARY KEY,
    stock_id        VARCHAR(10)     NOT NULL,
    date            DATE            NOT NULL,                -- 權利分派基準日
    year            VARCHAR(10),                             -- 股利所屬年度
    cash_earnings_distribution   DECIMAL(12, 4) DEFAULT 0,  -- 現金股利(盈餘)
    cash_statutory_surplus       DECIMAL(12, 4) DEFAULT 0,  -- 現金股利(公積)
    stock_earnings_distribution  DECIMAL(12, 4) DEFAULT 0,  -- 股票股利(盈餘)
    stock_statutory_surplus      DECIMAL(12, 4) DEFAULT 0,  -- 股票股利(公積)
    cash_ex_dividend_date        DATE,                       -- 除息交易日
    stock_ex_dividend_date       DATE,                       -- 除權交易日
    cash_dividend_payment_date   DATE,                       -- 現金股利發放日
    announcement_date            DATE,                       -- 公告日期
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_dividend_stock_date UNIQUE (stock_id, date, year),
    CONSTRAINT fk_dividend_stock FOREIGN KEY (stock_id)
        REFERENCES stock_info (stock_id) ON DELETE CASCADE
);

CREATE INDEX idx_dividend_stock ON dividend_history (stock_id, date DESC);

COMMENT ON TABLE dividend_history IS '股利政策表 — 來源: FinMind TaiwanStockDividend';

-- =============================================
-- 6. 月營收表 monthly_revenue
--    資料來源: FinMind TaiwanStockMonthRevenue
-- =============================================
CREATE TABLE monthly_revenue (
    id              BIGSERIAL       PRIMARY KEY,
    stock_id        VARCHAR(10)     NOT NULL,
    date            DATE            NOT NULL,                -- 營收月份 (e.g. 2024-01-01)
    country         VARCHAR(10)     DEFAULT 'TW',            -- 國別
    revenue         BIGINT,                                  -- 當月營收 (千元)
    revenue_month   INTEGER,                                 -- 當月月增率月份
    revenue_year    INTEGER,                                 -- 當月年增率年度
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_monthly_revenue_stock_date UNIQUE (stock_id, date),
    CONSTRAINT fk_monthly_revenue_stock FOREIGN KEY (stock_id)
        REFERENCES stock_info (stock_id) ON DELETE CASCADE
);

CREATE INDEX idx_monthly_revenue_stock_date ON monthly_revenue (stock_id, date DESC);

COMMENT ON TABLE monthly_revenue IS '月營收表 — 來源: FinMind TaiwanStockMonthRevenue';

-- =============================================
-- 7. 使用者投資組合表 user_portfolio
--    用途: 投資組合管理、損益計算
-- =============================================
CREATE TABLE app_user (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255)    UNIQUE,
    display_name    VARCHAR(100),
    line_user_id    VARCHAR(100),                            -- Line Bot 整合用
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE user_portfolio (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         UUID            NOT NULL,
    stock_id        VARCHAR(10)     NOT NULL,
    trade_type      VARCHAR(10)     NOT NULL DEFAULT 'buy',  -- buy / sell
    trade_date      DATE            NOT NULL,
    price           DECIMAL(12, 2)  NOT NULL,                -- 成交價
    quantity        INTEGER         NOT NULL,                 -- 股數
    fee             DECIMAL(12, 2)  DEFAULT 0,               -- 手續費
    tax             DECIMAL(12, 2)  DEFAULT 0,               -- 證交稅
    notes           TEXT,                                     -- 備註
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_portfolio_user FOREIGN KEY (user_id)
        REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT fk_portfolio_stock FOREIGN KEY (stock_id)
        REFERENCES stock_info (stock_id) ON DELETE CASCADE
);

CREATE INDEX idx_portfolio_user ON user_portfolio (user_id);
CREATE INDEX idx_portfolio_stock ON user_portfolio (stock_id);

-- =============================================
-- 8. 價格警報表 price_alert
--    用途: Line Bot 價格通知
-- =============================================
CREATE TABLE price_alert (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         UUID            NOT NULL,
    stock_id        VARCHAR(10)     NOT NULL,
    alert_type      VARCHAR(20)     NOT NULL,                -- above / below / pe_above / pe_below
    target_value    DECIMAL(12, 4)  NOT NULL,                -- 目標值
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    triggered_at    TIMESTAMPTZ,                             -- 最近觸發時間
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_alert_user FOREIGN KEY (user_id)
        REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT fk_alert_stock FOREIGN KEY (stock_id)
        REFERENCES stock_info (stock_id) ON DELETE CASCADE
);

CREATE INDEX idx_alert_active ON price_alert (is_active, stock_id) WHERE is_active = TRUE;

COMMENT ON TABLE price_alert IS '價格警報表 — 用於 Line Bot 通知';

-- =============================================
-- 9. 資料同步紀錄表 sync_log
--    用途: 追蹤 FinMind 資料同步狀態
-- =============================================
CREATE TABLE sync_log (
    id              BIGSERIAL       PRIMARY KEY,
    dataset         VARCHAR(100)    NOT NULL,                -- FinMind dataset 名稱
    stock_id        VARCHAR(10),                             -- 同步的股票代碼 (NULL = 全市場)
    sync_start      TIMESTAMPTZ     NOT NULL,
    sync_end        TIMESTAMPTZ,
    status          VARCHAR(20)     NOT NULL DEFAULT 'running', -- running / success / failed
    records_synced  INTEGER         DEFAULT 0,
    error_message   TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_log_dataset ON sync_log (dataset, status);

COMMENT ON TABLE sync_log IS '資料同步紀錄表 — 追蹤 FinMind API 同步狀態與歷史';

-- =============================================
-- 自動更新 updated_at 觸發器
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_info_updated_at
    BEFORE UPDATE ON stock_info
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_app_user_updated_at
    BEFORE UPDATE ON app_user
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
