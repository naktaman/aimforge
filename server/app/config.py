"""
앱 설정 — 환경변수 기반 (pydantic-settings)
Railway 배포 시 환경변수로 주입
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """전역 설정 — .env 또는 환경변수에서 로드"""

    # PostgreSQL
    database_url: str = "postgresql+asyncpg://aimforge:aimforge_dev@localhost:5432/aimforge"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT 인증
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 168  # 7일

    # Steam API
    steam_api_key: str = ""

    # S3 호환 스토리지
    s3_endpoint_url: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket_name: str = "aimforge"

    # 앱
    app_env: str = "development"
    app_version: str = "0.1.0"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
