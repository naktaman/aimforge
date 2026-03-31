"""
SQLAlchemy 비동기 엔진 + 세션 팩토리
PostgreSQL asyncpg 드라이버 사용
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# 비동기 엔진 — 커넥션 풀 설정
engine = create_async_engine(
    settings.database_url,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    echo=(settings.app_env == "development"),
)

# 세션 팩토리
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """모든 모델의 베이스 클래스"""
    pass


async def get_db() -> AsyncSession:  # type: ignore[misc]
    """FastAPI Depends용 DB 세션 제너레이터"""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
