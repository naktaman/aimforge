"""
세션 데이터 동기화 스키마
"""
from pydantic import BaseModel


class SessionUploadRequest(BaseModel):
    """세션 데이터 업로드 요청"""
    local_session_id: int
    session_data: dict


class SessionUploadResponse(BaseModel):
    """업로드 응답"""
    id: str
    status: str = "uploaded"


class SessionDownloadResponse(BaseModel):
    """다운로드 응답 — 최근 세션 데이터"""
    sessions: list[dict]
    total_count: int
