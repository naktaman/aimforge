"""
공유 콘텐츠 스키마 — 크로스헤어, 루틴
"""
from pydantic import BaseModel


class ShareContentRequest(BaseModel):
    """콘텐츠 공유 요청"""
    content_type: str  # 'crosshair' | 'routine'
    title: str
    data: dict


class ShareContentResponse(BaseModel):
    """공유 콘텐츠 응답"""
    id: str
    share_code: str
    title: str
    content_type: str
    data: dict
    likes: int
    downloads: int
    author_name: str
    created_at: str


class PopularContentResponse(BaseModel):
    """인기 콘텐츠 목록 응답"""
    items: list[ShareContentResponse]
    total_count: int
