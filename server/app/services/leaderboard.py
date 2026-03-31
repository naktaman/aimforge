"""
리더보드 서비스 — Redis sorted set 기반 실시간 랭킹
"""
import redis.asyncio as aioredis

LEADERBOARD_KEY = "leaderboard:{stage_type}"


async def update_leaderboard(
    redis_client: aioredis.Redis,  # type: ignore[type-arg]
    stage_type: str,
    user_id: str,
    score: float,
) -> int | None:
    """
    리더보드 업데이트 — 최고 스코어만 유지
    반환: 현재 순위 (1-based), 갱신 안 됐으면 None
    """
    key = LEADERBOARD_KEY.format(stage_type=stage_type)

    # 현재 스코어 확인
    current = await redis_client.zscore(key, user_id)
    if current is not None and score <= current:
        return None

    # 새 스코어 등록
    await redis_client.zadd(key, {user_id: score})

    # 순위 반환 (내림차순)
    rank = await redis_client.zrevrank(key, user_id)
    return (rank + 1) if rank is not None else None


async def get_user_rank(
    redis_client: aioredis.Redis,  # type: ignore[type-arg]
    stage_type: str,
    user_id: str,
) -> int | None:
    """유저의 현재 순위 조회"""
    key = LEADERBOARD_KEY.format(stage_type=stage_type)
    rank = await redis_client.zrevrank(key, user_id)
    return (rank + 1) if rank is not None else None
