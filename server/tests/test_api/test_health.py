"""
헬스 체크 API 테스트
"""
import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    """GET /health 가 정상 응답하는지"""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data
