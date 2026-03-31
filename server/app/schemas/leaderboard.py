"""
리더보드 스키마
"""
from pydantic import BaseModel


class ScoreSubmitRequest(BaseModel):
    """스코어 제출 요청"""
    stage_type: str
    score: float
    metadata: dict | None = None


class LeaderboardEntryResponse(BaseModel):
    """리더보드 항목 응답"""
    rank: int
    user_id: str
    display_name: str
    score: float
    stage_type: str


class LeaderboardResponse(BaseModel):
    """리더보드 목록 응답"""
    stage_type: str
    entries: list[LeaderboardEntryResponse]
    total_count: int
    my_rank: int | None = None
