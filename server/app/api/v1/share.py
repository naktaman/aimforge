"""
공유 API — 크로스헤어·루틴 커뮤니티 공유
POST /v1/share/crosshair      — 크로스헤어 공유
POST /v1/share/routine         — 루틴 공유
GET  /v1/share/{content_type}/{code} — 공유 코드로 가져오기
GET  /v1/share/popular         — 인기 콘텐츠
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID

from app.deps import get_db, get_current_user_id
from app.models.shared_content import SharedContent
from app.models.user import User
from app.schemas.shared_content import (
    ShareContentRequest,
    ShareContentResponse,
    PopularContentResponse,
)

router = APIRouter()


async def _to_response(item: SharedContent, db: AsyncSession) -> ShareContentResponse:
    """SharedContent → 응답 변환 (작성자 이름 포함)"""
    result = await db.execute(select(User.display_name).where(User.id == item.user_id))
    row = result.first()
    author_name = row[0] if row else "Unknown"

    return ShareContentResponse(
        id=str(item.id),
        share_code=item.share_code,
        title=item.title,
        content_type=item.content_type,
        data=item.data,
        likes=item.likes,
        downloads=item.downloads,
        author_name=author_name,
        created_at=item.created_at.isoformat(),
    )


@router.post("/crosshair", response_model=ShareContentResponse)
async def share_crosshair(
    req: ShareContentRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """크로스헤어 공유"""
    item = SharedContent(
        user_id=UUID(user_id),
        content_type="crosshair",
        title=req.title,
        data=req.data,
    )
    db.add(item)
    await db.flush()
    return await _to_response(item, db)


@router.post("/routine", response_model=ShareContentResponse)
async def share_routine(
    req: ShareContentRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """루틴 공유"""
    item = SharedContent(
        user_id=UUID(user_id),
        content_type="routine",
        title=req.title,
        data=req.data,
    )
    db.add(item)
    await db.flush()
    return await _to_response(item, db)


@router.get("/{content_type}/{code}", response_model=ShareContentResponse)
async def get_shared_content(
    content_type: str,
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """공유 코드로 콘텐츠 가져오기"""
    result = await db.execute(
        select(SharedContent).where(
            SharedContent.share_code == code,
            SharedContent.content_type == content_type,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="공유 콘텐츠를 찾을 수 없음")

    # 다운로드 카운트 증가
    item.downloads += 1
    return await _to_response(item, db)


@router.get("/popular", response_model=PopularContentResponse)
async def get_popular_content(
    content_type: str = Query("crosshair"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """인기 공유 콘텐츠 조회 (좋아요 순)"""
    result = await db.execute(
        select(SharedContent)
        .where(SharedContent.content_type == content_type)
        .order_by(SharedContent.likes.desc())
        .offset(offset)
        .limit(limit)
    )
    items = result.scalars().all()

    # 총 개수
    count_result = await db.execute(
        select(func.count()).where(SharedContent.content_type == content_type)
    )
    total = count_result.scalar() or 0

    responses = [await _to_response(item, db) for item in items]
    return PopularContentResponse(items=responses, total_count=total)
