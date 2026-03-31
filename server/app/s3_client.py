"""
S3 호환 스토리지 클라이언트 — 히트맵 이미지, 크래시 로그 저장
"""
import boto3
from botocore.config import Config

from app.config import settings


def get_s3_client():
    """S3 클라이언트 생성 — Cloudflare R2, MinIO 등 호환"""
    if not settings.s3_endpoint_url:
        return None

    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4"),
    )


def upload_file(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """파일 업로드 → 접근 URL 반환"""
    client = get_s3_client()
    if not client:
        raise RuntimeError("S3 스토리지 미설정")

    client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return f"{settings.s3_endpoint_url}/{settings.s3_bucket_name}/{key}"
