"""
V1 API 통합 라우터
모든 v1 엔드포인트를 /v1/ 프리픽스로 통합
"""
from fastapi import APIRouter

from app.api.v1 import auth, dna, leaderboard, crash, share, sync

# V1 통합 라우터
v1_router = APIRouter(prefix="/v1")

v1_router.include_router(auth.router, prefix="/auth", tags=["인증"])
v1_router.include_router(dna.router, prefix="/dna", tags=["DNA 분석"])
v1_router.include_router(leaderboard.router, prefix="/leaderboard", tags=["리더보드"])
v1_router.include_router(crash.router, prefix="/crash", tags=["크래시 리포트"])
v1_router.include_router(share.router, prefix="/share", tags=["공유"])
v1_router.include_router(sync.router, prefix="/sync", tags=["동기화"])
