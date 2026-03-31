"""
세션 데이터 업로드 모델 — 클라이언트→서버 동기화
로컬 SQLite 세션을 서버에 백업/분석용으로 업로드
"""
import uuid
from datetime import datetime

from sqlalchemy import Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SessionUpload(Base):
    """클라이언트에서 업로드된 세션 데이터"""
    __tablename__ = "session_uploads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False
    )
    local_session_id: Mapped[int] = mapped_column(Integer, nullable=False)
    session_data: Mapped[dict] = mapped_column(JSONB, nullable=False)  # type: ignore[assignment]
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
