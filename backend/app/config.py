from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "dev-secret-change-me"


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables (or a local .env)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Gig Worker Companion API"
    environment: str = "development"
    database_url: str | None = None
    cors_origins: str = "http://localhost:3000"
    secret_key: str = DEFAULT_SECRET_KEY
    token_ttl_seconds: int = 86400
    gemini_api_key: str | None = None
    sarvam_api_key: str | None = None
    gemini_model: str = "gemini-3.8-flash"
    google_client_id: str | None = None
    # Without a client id, lets the "demo" credential sign in a seeded Google-style user.
    google_demo_mode: bool = False
    trusted_hosts: str = "*"
    rate_limit_enabled: bool = True

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def trusted_host_list(self) -> list[str]:
        return [h.strip() for h in self.trusted_hosts.split(",") if h.strip()] or ["*"]

    @property
    def async_database_url(self) -> str | None:
        """Convert a plain postgresql:// URL into the asyncpg driver form."""
        if not self.database_url:
            return None
        return self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)


settings = Settings()
