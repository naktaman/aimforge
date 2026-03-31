"""
Aim DNA 분석 스키마
"""
from pydantic import BaseModel


class DnaAnalyzeRequest(BaseModel):
    """DNA 분석 요청 — 세션 데이터 포함"""
    session_data: dict
    features_override: dict | None = None


class DnaAnalyzeResponse(BaseModel):
    """DNA 분석 결과 (비동기 태스크 ID 반환)"""
    task_id: str
    status: str = "queued"


class DnaResult(BaseModel):
    """DNA 분석 결과"""
    id: str
    features: dict
    type_label: str
    analysis_version: str
    created_at: str


class DnaHistoryEntry(BaseModel):
    """DNA 히스토리 항목"""
    features: dict
    type_label: str
    created_at: str
