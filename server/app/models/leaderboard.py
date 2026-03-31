"""
리더보드 엔트리 모델
스테이지별 최고 스코어 관리, Redis sorted set과 동기화
"""
import uuid
from datetime import datetime

from sqlalchemy import String, Float, DateTime, ForeignKey, func, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LeaderboardEntry(Base):
    """스테이지별 리더보드 스코어"""
    __tablename__ = "leaderboard_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    stage_type: Mapped[str] = mapped_column(String(64), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    # 추가 메타데이터 (DPI, 감도, 정확도 등)
    metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # type: ignore[assignment]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("idx_leaderboard_stage_score", "stage_type", "score"),
        Index("idx_leaderboard_user_stage", "user_id", "stage_type"),
    )
