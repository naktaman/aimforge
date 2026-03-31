"""
공유 서비스 — 크로스헤어·루틴 공유 코드 생성/검증
"""
import secrets
import string


def generate_share_code(length: int = 8) -> str:
    """고유 공유 코드 생성 (대문자 + 숫자, 8자리)"""
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def validate_crosshair_data(data: dict) -> bool:
    """크로스헤어 데이터 유효성 검증"""
    required_keys = {"shape", "color", "innerLength", "thickness"}
    return required_keys.issubset(set(data.keys()))


def validate_routine_data(data: dict) -> bool:
    """루틴 데이터 유효성 검증"""
    if "steps" not in data or not isinstance(data["steps"], list):
        return False
    for step in data["steps"]:
        if "stage_type" not in step or "duration_ms" not in step:
            return False
    return True
