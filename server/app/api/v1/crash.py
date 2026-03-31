"""
크래시 리포트 API — 유저 동의 하에 에러 로그 수집
POST /v1/crash/report — 크래시 리포트 전송
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.deps import get_db, get_optional_user_id
from app.models.crash_report import CrashReport
from app.schemas.crash_report import CrashReportRequest, CrashReportResponse

router = APIRouter()


@router.post("/report", response_model=CrashReportResponse)
async def submit_crash_report(
    req: CrashReportRequest,
    user_id: str | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """크래시 리포트 수신 — 인증 선택적 (비로그인도 전송 가능)"""
    report = CrashReport(
        user_id=UUID(user_id) if user_id else None,
        error_type=req.error_type,
        error_message=req.error_message,
        stack_trace=req.stack_trace,
        context=req.context,
        app_version=req.app_version,
    )
    db.add(report)
    await db.flush()

    return CrashReportResponse(id=str(report.id))
