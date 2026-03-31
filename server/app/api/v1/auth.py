"""
인증 API — Steam OpenID 로그인, JWT 발급
POST /v1/auth/steam — Steam 인증
GET  /v1/auth/me    — 현재 유저 정보
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.deps import get_db, get_current_user_id
from app.auth.steam import verify_steam_ticket, get_steam_profile, create_jwt
from app.models.user import User
from app.schemas.auth import SteamAuthRequest, TokenResponse, UserInfo

router = APIRouter()


@router.post("/steam", response_model=TokenResponse)
async def steam_login(
    req: SteamAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    """Steam OpenID 인증 → JWT 토큰 발급"""
    # Steam 티켓 검증
    steam_id = await verify_steam_ticket(req.ticket_params)
    if not steam_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Steam 인증 실패",
        )

    # 기존 유저 조회 또는 새로 생성
    result = await db.execute(select(User).where(User.steam_id == steam_id))
    user = result.scalar_one_or_none()

    if not user:
        # Steam 프로필 정보 가져오기
        profile = await get_steam_profile(steam_id)
        user = User(
            steam_id=steam_id,
            display_name=profile["display_name"],
            avatar_url=profile["avatar_url"],
        )
        db.add(user)
        await db.flush()
    else:
        # 마지막 로그인 갱신 (onupdate=func.now()가 처리)
        user.display_name = user.display_name  # trigger update

    # JWT 발급
    token = create_jwt(str(user.id), steam_id)

    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        display_name=user.display_name,
    )


@router.get("/me", response_model=UserInfo)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """현재 인증된 유저 정보 조회"""
    from uuid import UUID
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없음")

    return UserInfo(
        id=str(user.id),
        steam_id=user.steam_id,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
    )
