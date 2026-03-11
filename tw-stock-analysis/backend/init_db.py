import asyncio
import logging
from app.database import engine, Base
from app.models import (
    StockInfo, DailyPrice, StockPER,
    FinancialStatement, MonthlyRevenue,
    DividendHistory, AppUser, UserPortfolio, PriceAlert, SyncLog
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db():
    logger.info("Dropping and recreating all tables...")
    async with engine.begin() as conn:
        # await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database initialization completed.")

if __name__ == "__main__":
    asyncio.run(init_db())
