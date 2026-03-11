"""
台股價值投資分析系統 — FastAPI 應用入口
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import stocks, financials, portfolio, backtest, sync, news

# 設定 logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期管理"""
    # 啟動時
    logger.info("🚀 台股價值投資分析系統啟動中...")

    # 1. 自動初始化資料庫表 (如果是新資料庫，例如 Render 上的 PostgreSQL)
    from app.database import engine, Base
    import app.models  # 確保所有 Model 都被載入以生成 Metadata
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ 資料庫表已同步/建立完成")
    except Exception as e:
        logger.error(f"❌ 資料庫初始化失敗: {e}")

    # 2. 啟動排程器 (Phase 2)
    from app.services.scheduler import scheduler_service
    scheduler_service.start()
    logger.info("⏰ 排程器已啟動")
    logger.info(f"🌐 允許的 CORS 來源: {settings.cors_origins}")
    logger.info(f"🗄️ 使用的資料庫網址: {settings.async_database_url.split('@')[-1] if '@' in settings.async_database_url else 'SECRET'}")

    yield

    # 關閉時
    scheduler_service.stop()
    logger.info("👋 系統關閉中...")


app = FastAPI(
    title="台股價值投資分析系統",
    description="長期價值投資者的專業股票分析工具 — 聚焦企業體質與合理估值",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 設定
# 為了穩定性與安全，生產環境建議在環境變數 BACKEND_CORS_ORIGINS 指定具體來源
# 目前使用通配符以確保通訊順暢，但關閉 allow_credentials 以符合瀏覽器規範
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊路由
app.include_router(stocks.router, prefix="/api/v1/stocks", tags=["股票"])
app.include_router(financials.router, prefix="/api/v1/financials", tags=["財務"])
app.include_router(portfolio.router, prefix="/api/v1/portfolio", tags=["投資組合"])
app.include_router(backtest.router, prefix="/api/v1/backtest", tags=["回測"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["資料同步"])
app.include_router(news.router, prefix="/api/v1/stocks", tags=["股票新聞"])


@app.api_route("/", methods=["GET", "HEAD"], tags=["系統"])
async def root():
    return {
        "name": "台股價值投資分析系統",
        "version": app.version,
        "status": "running",
    }


@app.get("/health", tags=["系統"])
async def health_check():
    return {"status": "healthy"}
