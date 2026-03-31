"""
리더보드 API — Redis sorted set 기반 실시간 랭킹
GET  /v1/leaderboard/{stage_type} — 스테이지별 리더보드
POST /v1/leaderboard/submit       — 스코어 제출
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.deps import get_db, get_redis, get_current_user_id
from app.models.leaderboard import LeaderboardEntry
from app.models.user import User
from app.schemas.leaderboard import (
    ScoreSubmitRequest,
    LeaderboardEntryResponse,
    LeaderboardResponse,
)

router = APIRouter()

# Redis sorted set 키 패턴
LEADERBOARD_KEY = "leaderboard:{stage_type}"


@router.get("/{stage_type}", response_model=LeaderboardResponse)
async def get_leaderboard(
    stage_type: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user_id: str | None = None,
    redis=Depends(get_redis),
    db: AsyncSession = Depends(get_db),
):
    """스테이지별 리더보드 조회 (Redis 캐시 우선)"""
    key = LEADERBOARD_KEY.format(stage_type=stage_type)

    # Redis sorted set에서 상위 N명 조회 (score 내림차순)
    entries_raw = await redis.zrevrange(key, offset, offset + limit - 1, withscores=True)
    total = await redis.zcard(key)

    entries: list[LeaderboardEntryResponse] = []
    for rank_idx, (uid, score) in enumerate(entries_raw):
        # 유저 이름 조회 (캐시 가능)
        cached_name = await redis.get(f"username:{uid}")
        if not cached_name:
            result = await db.execute(select(User.display_name).where(User.id == UUID(uid)))
            row = result.first()
            cached_name = row[0] if row else "Unknown"
            await redis.setex(f"username:{uid}", 3600, cached_name)

        entries.append(LeaderboardEntryResponse(
            rank=offset + rank_idx + 1,
            user_id=uid,
            display_name=cached_name,
            score=score,
            stage_type=stage_type,
        ))

    # 요청 유저의 순위 조회
    my_rank = None
    if user_id:
        rank = await redis.zrevrank(key, user_id)
        if rank is not None:
            my_rank = rank + 1

    return LeaderboardResponse(
        stage_type=stage_type,
        entries=entries,
        total_count=total,
        my_rank=my_rank,
    )


@router.post("/submit")
async def submit_score(
    req: ScoreSubmitRequest,
    user_id: str = Depends(get_current_user_id),
    redis=Depends(get_redis),
    db: AsyncSession = Depends(get_db),
):
    """스코어 제출 — Redis + PostgreSQL 동시 저장"""
    key = LEADERBOARD_KEY.format(stage_type=req.stage_type)

    # Redis sorted set에 최고 스코어만 유지 (ZADD NX + GT)
    current = await redis.zscore(key, user_id)
    if current is None or req.score > current:
        await redis.zadd(key, {user_id: req.score})

    # PostgreSQL에도 기록 (히스토리 보존)
    entry = LeaderboardEntry(
        user_id=UUID(user_id),
        stage_type=req.stage_type,
        score=req.score,
        metadata=req.metadata,
    )
    db.add(entry)

    return {"status": "submitted", "score": req.score}
