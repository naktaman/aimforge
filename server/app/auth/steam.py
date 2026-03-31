"""
Steam OpenID 인증 — Steam 로그인 후 JWT 발급
클라이언트에서 Steam 로그인 URL로 리다이렉트 → 콜백으로 steam_id 획득
"""
import httpx
import jwt
from datetime import datetime, timedelta, timezone

from app.config import settings

# Steam OpenID 검증 URL
STEAM_OPENID_URL = "https://steamcommunity.com/openid/login"
STEAM_API_PLAYER_URL = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/"


async def verify_steam_ticket(ticket_params: dict[str, str]) -> str | None:
    """
    Steam OpenID 응답 검증 → steam_id 반환
    실패 시 None 반환
    """
    # OpenID 검증 파라미터 구성
    verify_params = dict(ticket_params)
    verify_params["openid.mode"] = "check_authentication"

    async with httpx.AsyncClient() as client:
        resp = await client.post(STEAM_OPENID_URL, data=verify_params)
        if "is_valid:true" not in resp.text:
            return None

    # claimed_id에서 steam_id 추출
    claimed_id = ticket_params.get("openid.claimed_id", "")
    # 형식: https://steamcommunity.com/openid/id/76561198012345678
    steam_id = claimed_id.split("/")[-1]
    if not steam_id.isdigit():
        return None

    return steam_id


async def get_steam_profile(steam_id: str) -> dict[str, str]:
    """Steam Web API로 프로필 정보 조회"""
    if not settings.steam_api_key:
        return {"display_name": f"Steam_{steam_id[-4:]}", "avatar_url": ""}

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            STEAM_API_PLAYER_URL,
            params={"key": settings.steam_api_key, "steamids": steam_id},
        )
        data = resp.json()

    players = data.get("response", {}).get("players", [])
    if not players:
        return {"display_name": f"Steam_{steam_id[-4:]}", "avatar_url": ""}

    player = players[0]
    return {
        "display_name": player.get("personaname", ""),
        "avatar_url": player.get("avatarfull", ""),
    }


def create_jwt(user_id: str, steam_id: str) -> str:
    """JWT 토큰 생성"""
    payload = {
        "sub": user_id,
        "steam_id": steam_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_jwt(token: str) -> dict | None:
    """JWT 토큰 디코딩 — 실패 시 None"""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
