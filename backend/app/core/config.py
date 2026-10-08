import warnings
from typing import Annotated, Any, Literal, Self

from pydantic import (
    AnyHttpUrl,
    AnyUrl,
    BeforeValidator,
    PostgresDsn,
    SecretStr,
    computed_field,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict

API_V1_PREFIX = "/api/v1"
PROJECT_NAME = "FastAPI React Project"
NEWAPI_PROJECT_ID = "data-hub"
AUTH_PLATFORM = "data-hub"


def parse_cors(v: Any) -> list[str] | str:
    if isinstance(v, str) and not v.startswith("["):
        origins = [i.strip() for i in v.split(",") if i.strip()]

        return origins
    elif isinstance(v, list | str):
        return v
    raise ValueError(v)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # 使用上一级目录的 .env 文件（./backend/ 的上一层）
        env_file="../.env",
        env_ignore_empty=True,
        extra="ignore",
    )
    ENVIRONMENT: Literal["local", "production"] = "local"

    BACKEND_CORS_ORIGINS: Annotated[
        list[AnyUrl] | str, BeforeValidator(parse_cors)
    ] = []
    FRONTEND_URL: AnyHttpUrl = AnyHttpUrl("http://localhost:3001")
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: str

    @computed_field  # type: ignore[prop-decorator]
    @property
    def all_cors_origins(self) -> list[str]:
        origins = [str(origin).rstrip("/") for origin in self.BACKEND_CORS_ORIGINS]

        return origins

    POSTGRES_SERVER: str
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    REDIS_URL: str
    CELERY_BROKER_URL: str

    @computed_field  # type: ignore[prop-decorator]
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn:
        return PostgresDsn.build(
            scheme="postgresql+psycopg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def CHECKPOINT_DATABASE_URI(self) -> PostgresDsn:
        return PostgresDsn.build(
            scheme="postgresql",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )

    AUTH_SERVER_URL: AnyHttpUrl
    AUTH_SERVICE_TOKEN: SecretStr
    APP_ORIGIN: AnyHttpUrl

    COS_SECRET_ID: SecretStr
    COS_SECRET_KEY: SecretStr
    COS_REGION: str
    COS_BUCKET: str
    DOCLING_BASE_URL: AnyHttpUrl
    FIRECRAWL_API_KEY: SecretStr
    JUSTONEAPI_TOKEN: SecretStr | None = None

    def _check_default_secret(self, var_name: str, value: str | None) -> None:
        if value == "changethis":
            message = (
                f'{var_name} 的值为 "changethis"，'
                "出于安全考虑请修改它，至少在部署时务必修改。"
            )
            if self.ENVIRONMENT == "local":
                warnings.warn(message, stacklevel=1)
            else:
                raise ValueError(message)

    @model_validator(mode="after")
    def _validate_configuration(self) -> Self:
        self._check_default_secret("POSTGRES_PASSWORD", self.POSTGRES_PASSWORD)

        self._check_default_secret(
            "AUTH_SERVICE_TOKEN", self.AUTH_SERVICE_TOKEN.get_secret_value()
        )

        origin = self.APP_ORIGIN

        if origin.path not in (None, "/") or origin.query or origin.fragment:
            raise ValueError("APP_ORIGIN 必须只包含协议和域名端口")

        if self.ENVIRONMENT == "production" and any(
            url.scheme != "https"
            for url in (self.AUTH_SERVER_URL, self.APP_ORIGIN)
        ):
            raise ValueError("生产认证配置必须使用 HTTPS")

        return self


settings = Settings()  # type: ignore
