"""
Celery 설정 — Redis를 브로커로 사용
DNA 분석 같은 무거운 작업을 비동기 처리
나중에 GPU worker 분리 가능한 구조
"""
from celery import Celery

from app.config import settings

# Celery 앱 생성
celery_app = Celery(
    "aimforge",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.dna_tasks"],
)

# 기본 설정
celery_app.conf.update(
    # 태스크 직렬화
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # 타임아웃
    task_soft_time_limit=300,   # 5분 소프트 리밋
    task_time_limit=600,        # 10분 하드 리밋

    # 워커 설정
    worker_prefetch_multiplier=1,  # 한 번에 하나씩 처리
    worker_max_tasks_per_child=100,  # 메모리 누수 방지

    # 결과 TTL (24시간)
    result_expires=86400,

    # GPU worker 라우팅 대비 큐 정의
    task_routes={
        "app.tasks.dna_tasks.*": {"queue": "dna_analysis"},
    },
    task_default_queue="default",
)
