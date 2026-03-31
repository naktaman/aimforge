"""
크래시 리포트 모델 — 유저 동의 하에 수집
Three.js 에러, WebGL context loss, 런타임 예외 기록
"""
import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CrashReport(Base):
    """클라이언트에서 전송된 크래시 리포트"""
    __tablename__ = "crash_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    error_type: Mapped[str] = mapped_column(String(64), nullable=False)
    error_message: Mapped[str] = mapped_column(Text, nullable=False)
    stack_trace: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 추가 컨텍스트 (브라우저, GPU, 시나리오, 메모리 등)
    context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # type: ignore[assignment]
    app_version: Mapped[str] = mapped_column(String(16), nullable=False, default="0.1.0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
