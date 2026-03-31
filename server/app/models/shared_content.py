"""
공유 콘텐츠 모델 — 크로스헤어, 루틴 커뮤니티 공유
"""
import uuid
import secrets
import string
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, ForeignKey, func, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _generate_share_code() -> str:
    """8자리 공유 코드 생성 (대문자 + 숫자)"""
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(8))


class SharedContent(Base):
    """크로스헤어·루틴 공유 아이템"""
    __tablename__ = "shared_contents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    content_type: Mapped[str] = mapped_column(
        String(32), nullable=False  # 'crosshair' | 'routine'
    )
    share_code: Mapped[str] = mapped_column(
        String(16), unique=True, index=True, nullable=False, default=_generate_share_code
    )
    title: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)  # type: ignore[assignment]
    likes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    downloads: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("idx_shared_type_likes", "content_type", "likes"),
    )
