"""
크래시 리포트 스키마
"""
from pydantic import BaseModel


class CrashReportRequest(BaseModel):
    """크래시 리포트 전송 요청"""
    error_type: str
    error_message: str
    stack_trace: str | None = None
    context: dict | None = None
    app_version: str = "0.1.0"


class CrashReportResponse(BaseModel):
    """크래시 리포트 응답"""
    id: str
    status: str = "received"
