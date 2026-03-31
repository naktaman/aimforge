"""
Aim DNA 분석 결과 모델
서버에서 GP Bayesian Optimization 기반 심층 분석 수행 후 저장
"""
import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AimDnaResult(Base):
    """26-feature Aim DNA 프로파일 분석 결과"""
    __tablename__ = "aim_dna_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False
    )
    # 26개 DNA 피처 (JSONB로 유연하게)
    features: Mapped[dict] = mapped_column(JSONB, nullable=False)  # type: ignore[assignment]
    type_label: Mapped[str] = mapped_column(String(64), nullable=False, default="unknown")
    analysis_version: Mapped[str] = mapped_column(String(16), nullable=False, default="1.0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
