"""
應用程式設定 — 從環境變數載入
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 資料庫
    database_url: str = "sqlite+aiosqlite:///./tw_stock.db"

    # FinMind API
    finmind_api_token: str = ""
    finmind_api_url: str = "https://api.finmindtrade.com/api/v4/data"

    # 應用程式
    app_env: str = "development"
    secret_key: str = "dev-secret-key"

    # CORS
    backend_cors_origins: str = "http://localhost:5173"

    # OpenAI
    openai_api_key: str | None = None

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
