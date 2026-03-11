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
    def async_database_url(self) -> str:
        """處理雲端平台 (如 Render, Heroku) 預設提供的 postgres:// 連線字串"""
        url = self.database_url
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        if url.startswith("postgresql://") and "asyncpg" not in url:
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.backend_cors_origins.split(",")]
        # 自動加入常用變體 (避免漏掉有沒有斜線的狀況)
        base_origins = list(origins)
        for o in base_origins:
            if o.endswith("/"):
                alt = o[:-1]
            else:
                alt = o + "/"
            if alt not in origins:
                origins.append(alt)
        return origins

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
