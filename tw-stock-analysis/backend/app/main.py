"""
台股價值投資分析系統 — FastAPI 應用入口
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
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

    # 啟動排程器 (Phase 2)
    from app.services.scheduler import scheduler_service
    scheduler_service.start()
    logger.info("⏰ 排程器已啟動")
    logger.info(f"🌐 允許的 CORS 來源: {settings.cors_origins}")

    yield

    # 關閉時
    scheduler_service.stop()
    logger.info("👋 系統關閉中...")


app = FastAPI(
    title="台股價值投資分析系統",
    description="長期價值投資者的專業股票分析工具 — 聚焦企業體質與合理估值",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/health", tags=["系統"])
async def health_check():
    return {"status": "healthy"}
