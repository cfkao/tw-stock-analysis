"""
投資組合 API 路由
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def get_portfolio():
    """取得投資組合 — Phase 5 實作"""
    return {"message": "投資組合功能開發中", "status": "coming_soon"}
