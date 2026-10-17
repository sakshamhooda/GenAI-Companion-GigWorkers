from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables (or a local .env)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Gig Worker Companion API"
    environment: str = "development"
    database_url: str | None = None
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def async_database_url(self) -> str | None:
        """Convert a plain postgresql:// URL into the asyncpg driver form."""
        if not self.database_url:
            return None
        return self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)


settings = Settings()
