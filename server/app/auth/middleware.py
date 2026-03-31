"""
인증 미들웨어 — JWT 토큰 검증, 현재 유저 주입
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.steam import decode_jwt

security = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    """JWT에서 유저 ID 추출 — 인증 필수 엔드포인트용"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 토큰 필요",
        )

    payload = decode_jwt(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰",
        )

    return payload["sub"]


async def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str | None:
    """JWT에서 유저 ID 추출 — 인증 선택적 엔드포인트용"""
    if not credentials:
        return None

    payload = decode_jwt(credentials.credentials)
    if not payload or "sub" not in payload:
        return None

    return payload["sub"]
