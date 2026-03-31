"""
인증 관련 Pydantic 스키마
"""
from pydantic import BaseModel


class SteamAuthRequest(BaseModel):
    """Steam OpenID 콜백 파라미터"""
    ticket_params: dict[str, str]


class TokenResponse(BaseModel):
    """JWT 토큰 응답"""
    access_token: str
    token_type: str = "bearer"
    user_id: str
    display_name: str


class UserInfo(BaseModel):
    """유저 정보 응답"""
    id: str
    steam_id: str
    display_name: str
    avatar_url: str | None
