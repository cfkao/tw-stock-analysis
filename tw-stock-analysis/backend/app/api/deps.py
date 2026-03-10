"""
API 依賴注入
"""
from app.database import get_db

__all__ = ["get_db"]
