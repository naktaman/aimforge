"""
AimForge API 서버 — FastAPI 메인 앱
Railway 배포: uvicorn app.main:app --host 0.0.0.0 --port $PORT
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.api.v1.router import v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[no-untyped-def]
    """앱 시작/종료 라이프사이클"""
    # 시작: 테이블 자동 생성 (개발 환경에서만, 프로덕션은 Alembic)
    if settings.app_env == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    yield
    # 종료: 엔진 정리
    await engine.dispose()


app = FastAPI(
    title="AimForge API",
    description="FPS 에임 교정/훈련 서버 — DNA 분석, 리더보드, 커뮤니티 공유",
    version=settings.app_version,
    lifespan=lifespan,
)

# CORS — Tauri 클라이언트 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tauri: tauri://localhost
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API v1 라우터 마운트
app.include_router(v1_router)


@app.get("/health")
async def health_check():
    """헬스 체크 — Railway/로드밸런서용"""
    return {"status": "ok", "version": settings.app_version}
