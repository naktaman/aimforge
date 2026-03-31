"""
DNA 분석 Celery 태스크 — 무거운 연산을 워커에서 비동기 처리
나중에 GPU 워커로 분리 가능 (task_routes 설정)
"""
import logging
from app.tasks.celery_app import celery_app
from app.services.dna_analysis import compute_dna_features, classify_type

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="app.tasks.dna_tasks.analyze_dna")
def analyze_dna_task(
    self,  # type: ignore[no-untyped-def]
    user_id: str,
    session_data: dict,
    features_override: dict | None = None,
) -> dict:
    """
    DNA 심층 분석 태스크
    1. 세션 데이터에서 26개 피처 추출
    2. 플레이어 유형 분류
    3. PostgreSQL에 결과 저장
    """
    logger.info(f"DNA 분석 시작: user={user_id}")

    try:
        # 피처 계산
        features = compute_dna_features(session_data)

        # 오버라이드 적용 (클라이언트에서 이미 계산한 피처가 있으면 우선)
        if features_override:
            features.update(features_override)

        # 유형 분류
        type_label = classify_type(features)

        # DB 저장 (동기 — Celery 워커는 sync context)
        _save_dna_result(user_id, features, type_label)

        logger.info(f"DNA 분석 완료: user={user_id}, type={type_label}")
        return {
            "user_id": user_id,
            "features": features,
            "type_label": type_label,
            "status": "completed",
        }

    except Exception as exc:
        logger.error(f"DNA 분석 실패: user={user_id}, error={exc}")
        raise self.retry(exc=exc, countdown=60, max_retries=3)


def _save_dna_result(user_id: str, features: dict, type_label: str) -> None:
    """DNA 결과를 PostgreSQL에 동기 저장 (Celery 워커용)"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.config import settings
    from app.models.aim_dna import AimDnaResult
    from uuid import UUID

    # asyncpg → psycopg2 동기 URL 변환
    sync_url = settings.database_url.replace("+asyncpg", "")
    engine = create_engine(sync_url)

    with Session(engine) as session:
        result = AimDnaResult(
            user_id=UUID(user_id),
            features=features,
            type_label=type_label,
            analysis_version="1.0",
        )
        session.add(result)
        session.commit()
