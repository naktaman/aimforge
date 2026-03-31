"""
DNA 분석 API — Celery 비동기 태스크로 심층 분석 실행
POST /v1/dna/analyze         — 분석 요청 (비동기)
GET  /v1/dna/{user_id}       — 최신 DNA 결과
GET  /v1/dna/{user_id}/history — DNA 히스토리
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.deps import get_db, get_current_user_id
from app.models.aim_dna import AimDnaResult
from app.schemas.aim_dna import DnaAnalyzeRequest, DnaAnalyzeResponse, DnaResult, DnaHistoryEntry
from app.tasks.dna_tasks import analyze_dna_task

router = APIRouter()


@router.post("/analyze", response_model=DnaAnalyzeResponse)
async def request_dna_analysis(
    req: DnaAnalyzeRequest,
    user_id: str = Depends(get_current_user_id),
):
    """DNA 심층 분석 요청 — Celery 워커에서 비동기 처리"""
    task = analyze_dna_task.delay(user_id, req.session_data, req.features_override)
    return DnaAnalyzeResponse(task_id=task.id, status="queued")


@router.get("/{target_user_id}", response_model=DnaResult | None)
async def get_latest_dna(
    target_user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """유저의 최신 DNA 분석 결과 조회"""
    result = await db.execute(
        select(AimDnaResult)
        .where(AimDnaResult.user_id == UUID(target_user_id))
        .order_by(AimDnaResult.created_at.desc())
        .limit(1)
    )
    dna = result.scalar_one_or_none()
    if not dna:
        return None

    return DnaResult(
        id=str(dna.id),
        features=dna.features,
        type_label=dna.type_label,
        analysis_version=dna.analysis_version,
        created_at=dna.created_at.isoformat(),
    )


@router.get("/{target_user_id}/history", response_model=list[DnaHistoryEntry])
async def get_dna_history(
    target_user_id: str,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """유저의 DNA 히스토리 조회"""
    result = await db.execute(
        select(AimDnaResult)
        .where(AimDnaResult.user_id == UUID(target_user_id))
        .order_by(AimDnaResult.created_at.desc())
        .limit(limit)
    )
    items = result.scalars().all()

    return [
        DnaHistoryEntry(
            features=item.features,
            type_label=item.type_label,
            created_at=item.created_at.isoformat(),
        )
        for item in items
    ]
