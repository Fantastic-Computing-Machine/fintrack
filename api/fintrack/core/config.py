from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict, TomlConfigSettingsSource

CONFIG_PATH = Path(__file__).parents[2] / "config.toml"


class AppConfig(BaseModel):
    environment: str = "development"
    api_url: HttpUrl = HttpUrl("http://localhost:8000")
    frontend_url: HttpUrl = HttpUrl("http://localhost:3000")
    log_level: str = "INFO"
    session_hours: int = Field(12, ge=1, le=168)
    timezone: str = "America/New_York"
    trusted_hosts: list[str] = ["localhost", "127.0.0.1", "testserver"]
    webhook_url: str = ""
    max_webhook_bytes: int = Field(65_536, ge=1_024, le=1_048_576)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("timezone must be an IANA timezone") from exc
        return value


class DatabaseConfig(BaseModel):
    echo: bool = False
    pool_size: int = Field(5, ge=1, le=50)
    max_overflow: int = Field(10, ge=0, le=100)


class SyncConfig(BaseModel):
    fallback_hours: int = Field(8, ge=1)
    queue_seconds: int = Field(5, ge=1)
    max_attempts: int = Field(5, ge=1, le=10)
    history_days: int = Field(730, ge=30, le=730)
    stale_hours: int = Field(12, ge=1)


class PlaidConfig(BaseModel):
    environment: str = "sandbox"
    country_codes: list[str] = ["US"]
    products: list[str] = ["transactions", "liabilities"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_nested_delimiter="__", toml_file=CONFIG_PATH, extra="ignore")

    app: AppConfig = AppConfig()
    database: DatabaseConfig = DatabaseConfig()
    sync: SyncConfig = SyncConfig()
    plaid: PlaidConfig = PlaidConfig()
    database_url: str = "sqlite+aiosqlite:///./fin_track.db"
    plaid_client_id: str = ""
    plaid_secret: str = ""
    plaid_token_master_key: str = ""
    session_signing_key: str = ""
    owner_password_hash: str = ""
    mcp_enable: bool = False
    docs_enable: bool = False
    mcp_auth_token: str = ""

    @classmethod
    def settings_customise_sources(cls, settings_cls, init_settings, env_settings, dotenv_settings, file_secret_settings) -> tuple[PydanticBaseSettingsSource, ...]:
        return init_settings, env_settings, dotenv_settings, TomlConfigSettingsSource(settings_cls), file_secret_settings

    @model_validator(mode="after")
    def production_secrets(self):
        if self.app.environment != "test":
            missing = [name for name in ("plaid_client_id", "plaid_secret", "plaid_token_master_key", "session_signing_key", "owner_password_hash") if not getattr(self, name)]
            if missing:
                raise ValueError(f"Missing required secrets: {', '.join(missing)}")
        if self.mcp_enable and not self.mcp_auth_token:
            raise ValueError("MCP_AUTH_TOKEN is required when MCP_ENABLE is true")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
