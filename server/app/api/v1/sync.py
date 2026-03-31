"""
동기화 API — 클라이언트 ↔ 서버 데이터 동기화
POST /v1/sync/upload   — 세션 데이터 업로드
GET  /v1/sync/download — 최근 데이터 다운로드
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.deps import get_db, get_current_user_id
from app.models.session_data import SessionUpload
from app.schemas.session_data import (
    SessionUploadRequest,
    SessionUploadResponse,
    SessionDownloadResponse,
)

router = APIRouter()


@router.post("/upload", response_model=SessionUploadResponse)
async def upload_session(
    req: SessionUploadRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """클라이언트 세션 데이터를 서버에 업로드"""
    upload = SessionUpload(
        user_id=UUID(user_id),
        local_session_id=req.local_session_id,
        session_data=req.session_data,
    )
    db.add(upload)
    await db.flush()

    return SessionUploadResponse(id=str(upload.id))


@router.get("/download", response_model=SessionDownloadResponse)
async def download_sessions(
    user_id: str = Depends(get_current_user_id),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """서버에 저장된 세션 데이터 다운로드"""
    result = await db.execute(
        select(SessionUpload)
        .where(SessionUpload.user_id == UUID(user_id))
        .order_by(SessionUpload.uploaded_at.desc())
        .offset(offset)
        .limit(limit)
    )
    items = result.scalars().all()

    return SessionDownloadResponse(
        sessions=[
            {
                "id": str(item.id),
                "local_session_id": item.local_session_id,
                "session_data": item.session_data,
                "uploaded_at": item.uploaded_at.isoformat(),
            }
            for item in items
        ],
        total_count=len(items),
    )
