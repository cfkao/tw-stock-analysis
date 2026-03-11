"""
新聞與重大訊息 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, timedelta
import json

from app.database import get_db
from app.services.news import news_service
from app.services.llm import llm_service
from app.schemas.news import StockNewsResponse
from app.schemas.llm import NewsAnalysisResponse
from app.models.stock import StockNewsAnalysis

router = APIRouter()

@router.get("/{stock_id}/news", response_model=list[StockNewsResponse])
async def get_stock_news(
    stock_id: str,
    limit: int = Query(15, ge=1, le=50, description="最多回傳筆數")
):
    """取得個股相關新聞 (來源: Yahoo 財經 RSS)"""
    try:
        news_data = await news_service.get_stock_news(stock_id, limit=limit)
        return news_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{stock_id}/news/analysis", response_model=NewsAnalysisResponse)
async def analyze_stock_news(
    stock_id: str,
    db: AsyncSession = Depends(get_db)
):
    """取得個股近三個月新聞的 AI 洞察分析 (具有單日快取機制)"""
    try:
        # 1. 檢查三日內是否已經分析過 (Cache)
        today = date.today()
        three_days_ago = today - timedelta(days=3)
        
        stmt = select(StockNewsAnalysis).where(
            StockNewsAnalysis.stock_id == stock_id,
            StockNewsAnalysis.analysis_date >= three_days_ago
        ).order_by(StockNewsAnalysis.analysis_date.desc()).limit(1)
        
        result = await db.execute(stmt)
        cached_analysis = result.scalar_one_or_none()

        if cached_analysis:
            # 從 DB 還原 JSON
            return NewsAnalysisResponse(
                sentiment_score=cached_analysis.sentiment_score,
                themes=json.loads(cached_analysis.themes),
                pros=json.loads(cached_analysis.pros),
                cons=json.loads(cached_analysis.cons),
                summary=cached_analysis.summary
            )

        # 2. 獲取最新新聞 (近三個月)
        news_data = await news_service.get_stock_news(stock_id, limit=20)
        if not news_data:
            raise HTTPException(status_code=404, detail="找不到足夠的新聞進行分析")

        # 3. 呼叫 LLM 進行分析
        analysis = await llm_service.analyze_stock_news(stock_id, news_data)
        if not analysis:
            raise HTTPException(status_code=500, detail="AI 分析失敗，請稍後再試")

        # 4. 寫入快取 (DB)
        new_cache = StockNewsAnalysis(
            stock_id=stock_id,
            analysis_date=today,
            sentiment_score=analysis.sentiment_score,
            themes=json.dumps(analysis.themes, ensure_ascii=False),
            pros=json.dumps(analysis.pros, ensure_ascii=False),
            cons=json.dumps(analysis.cons, ensure_ascii=False),
            summary=analysis.summary
        )
        db.add(new_cache)
        await db.commit()

        return analysis

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析過程發生錯誤: {str(e)}")
