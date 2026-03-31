"""
Redis 클라이언트 — 리더보드, 세션 캐시, rate limiting
"""
import redis.asyncio as redis

from app.config import settings

# 비동기 Redis 클라이언트
redis_client = redis.from_url(
    settings.redis_url,
    decode_responses=True,
    max_connections=20,
)


async def get_redis() -> redis.Redis:  # type: ignore[type-arg]
    """FastAPI Depends용 Redis 클라이언트"""
    return redis_client
