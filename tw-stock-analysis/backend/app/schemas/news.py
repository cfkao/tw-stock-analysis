"""
Pydantic Schemas — 新聞與重大訊息
"""
from pydantic import BaseModel
from typing import Optional

class StockNewsResponse(BaseModel):
    title: str
    link: str
    pub_date: str
    source: str
    description: Optional[str] = None
    related_news: list["StockNewsResponse"] = []

    class Config:
        from_attributes = True

StockNewsResponse.model_rebuild()
