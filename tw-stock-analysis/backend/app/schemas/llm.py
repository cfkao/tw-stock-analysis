from pydantic import BaseModel, Field

class NewsAnalysisResponse(BaseModel):
    sentiment_score: int = Field(description="-100 to 100, representing extreme pessimism to extreme optimism")
    themes: list[str] = Field(description="List of recent hot investment theme tags to represent what this stock is being traded on")
    pros: list[str] = Field(description="List of potential bullish factors")
    cons: list[str] = Field(description="List of potential bearish factors")
    summary: str = Field(description="A brief summary of the news analysis in under 50 words")
