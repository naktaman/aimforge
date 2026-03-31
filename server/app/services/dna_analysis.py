"""
DNA 심층 분석 서비스 — GP Bayesian Optimization 서버사이드
클라이언트에서 수집한 원시 데이터를 기반으로 26-feature DNA 프로파일 계산
"""
import numpy as np
from typing import Any


def compute_dna_features(session_data: dict[str, Any]) -> dict[str, float]:
    """
    세션 원시 데이터에서 26개 DNA 피처 추출
    클라이언트의 aim_dna/mod.rs 로직을 Python으로 재구현 (서버에서 심층 분석)
    """
    features: dict[str, float] = {}
    trials = session_data.get("trials", [])
    if not trials:
        return _empty_features()

    # 플릭 관련 피처 계산
    flick_trials = [t for t in trials if "flick" in t.get("scenario_type", "")]
    if flick_trials:
        velocities = [t.get("peak_velocity", 0) for t in flick_trials]
        features["flick_peak_velocity"] = float(np.mean(velocities)) if velocities else 0.0
        overshoots = [t.get("overshoot", 0) for t in flick_trials]
        features["overshoot_avg"] = float(np.mean(overshoots)) if overshoots else 0.0
    else:
        features["flick_peak_velocity"] = 0.0
        features["overshoot_avg"] = 0.0

    # 트래킹 관련 피처
    tracking_trials = [t for t in trials if "tracking" in t.get("scenario_type", "")]
    if tracking_trials:
        mads = [t.get("mad", 0) for t in tracking_trials]
        features["tracking_mad"] = float(np.mean(mads))
        phase_lags = [t.get("phase_lag", 0) for t in tracking_trials]
        features["phase_lag"] = float(np.mean(phase_lags))
        # 속도 매칭 (타겟 속도 대비 추적 속도 비율)
        vel_matches = [t.get("velocity_match", 0) for t in tracking_trials]
        features["velocity_match"] = float(np.mean(vel_matches)) if vel_matches else 0.0
    else:
        features["tracking_mad"] = 0.0
        features["phase_lag"] = 0.0
        features["velocity_match"] = 0.0

    # 공통 피처
    all_scores = [t.get("composite_score", 0) for t in trials]
    features["smoothness"] = _compute_smoothness(trials)
    features["direction_bias"] = _compute_direction_bias(trials)
    features["effective_range"] = _compute_effective_range(trials)
    features["micro_freq"] = _compute_micro_freq(trials)
    features["wrist_arm_ratio"] = _compute_wrist_arm_ratio(trials)

    # Fitts' Law 파라미터
    a, b = _fit_fitts_law(flick_trials)
    features["fitts_a"] = a
    features["fitts_b"] = b

    # 피로 감쇠율
    features["fatigue_decay"] = _compute_fatigue_decay(all_scores)

    # 사전 조준 / 사전 사격 비율
    features["pre_aim_ratio"] = _compute_pre_aim_ratio(trials)
    features["pre_fire_ratio"] = _compute_pre_fire_ratio(trials)

    # 감도 귀인 오버슈트
    features["sens_attributed_overshoot"] = features["overshoot_avg"] * 0.7

    # 수직/수평 비율
    features["v_h_ratio"] = _compute_vh_ratio(trials)

    # 모터 컨트롤 정확도
    features["finger_accuracy"] = _compute_motor_accuracy(trials, "finger")
    features["wrist_accuracy"] = _compute_motor_accuracy(trials, "wrist")
    features["arm_accuracy"] = _compute_motor_accuracy(trials, "arm")

    # 모터 전환 각도
    features["motor_transition_angle"] = _compute_transition_angle(trials)

    # 적응률
    features["adaptation_rate"] = _compute_adaptation_rate(all_scores)

    return features


def classify_type(features: dict[str, float]) -> str:
    """DNA 피처 기반 플레이어 유형 분류"""
    wrist_arm = features.get("wrist_arm_ratio", 0.5)
    if wrist_arm > 0.7:
        return "wrist_dominant"
    elif wrist_arm < 0.3:
        return "arm_dominant"
    return "hybrid"


def _empty_features() -> dict[str, float]:
    """빈 피처셋"""
    keys = [
        "flick_peak_velocity", "overshoot_avg", "direction_bias", "effective_range",
        "tracking_mad", "phase_lag", "smoothness", "velocity_match", "micro_freq",
        "wrist_arm_ratio", "fitts_a", "fitts_b", "fatigue_decay", "pre_aim_ratio",
        "pre_fire_ratio", "sens_attributed_overshoot", "v_h_ratio",
        "finger_accuracy", "wrist_accuracy", "arm_accuracy",
        "motor_transition_angle", "adaptation_rate",
    ]
    return {k: 0.0 for k in keys}


def _compute_smoothness(trials: list[dict]) -> float:
    """마우스 궤적 매끄러움 (가속도 변화량 역수)"""
    accels = []
    for t in trials:
        if "avg_acceleration" in t:
            accels.append(t["avg_acceleration"])
    if not accels:
        return 0.0
    avg_accel = float(np.mean(accels))
    return 1.0 / (1.0 + avg_accel) if avg_accel > 0 else 1.0


def _compute_direction_bias(trials: list[dict]) -> float:
    """좌/우 방향 편향도 (-1~1, 0이 균형)"""
    biases = [t.get("direction_bias", 0) for t in trials if "direction_bias" in t]
    return float(np.mean(biases)) if biases else 0.0


def _compute_effective_range(trials: list[dict]) -> float:
    """유효 사거리 (정확도 70% 이상인 최대 거리)"""
    ranges = [t.get("target_distance", 0) for t in trials if t.get("accuracy", 0) > 0.7]
    return float(max(ranges)) if ranges else 0.0


def _compute_micro_freq(trials: list[dict]) -> float:
    """미세 보정 빈도 (플릭 후 보정 횟수)"""
    corrections = [t.get("correction_count", 0) for t in trials]
    return float(np.mean(corrections)) if corrections else 0.0


def _compute_wrist_arm_ratio(trials: list[dict]) -> float:
    """손목/팔 사용 비율 (0=순수 팔, 1=순수 손목)"""
    ratios = [t.get("wrist_arm_ratio", 0.5) for t in trials if "wrist_arm_ratio" in t]
    return float(np.mean(ratios)) if ratios else 0.5


def _fit_fitts_law(flick_trials: list[dict]) -> tuple[float, float]:
    """Fitts' Law 파라미터 (a, b) 회귀"""
    if len(flick_trials) < 3:
        return (0.0, 0.0)

    ids = []
    mts = []
    for t in flick_trials:
        dist = t.get("target_distance_deg", 0)
        size = t.get("target_size_deg", 1)
        if dist > 0 and size > 0:
            idx_difficulty = np.log2(2 * dist / size)
            ids.append(idx_difficulty)
            mts.append(t.get("reaction_ms", 0))

    if len(ids) < 2:
        return (0.0, 0.0)

    # 선형 회귀: MT = a + b * ID
    coeffs = np.polyfit(ids, mts, 1)
    return (float(coeffs[1]), float(coeffs[0]))


def _compute_fatigue_decay(scores: list[float]) -> float:
    """피로 감쇠율 (세션 후반부 성능 저하 비율)"""
    if len(scores) < 4:
        return 0.0
    half = len(scores) // 2
    first_half = float(np.mean(scores[:half]))
    second_half = float(np.mean(scores[half:]))
    if first_half == 0:
        return 0.0
    return (first_half - second_half) / first_half


def _compute_pre_aim_ratio(trials: list[dict]) -> float:
    """사전 조준 비율"""
    ratios = [t.get("pre_aim_ratio", 0) for t in trials if "pre_aim_ratio" in t]
    return float(np.mean(ratios)) if ratios else 0.0


def _compute_pre_fire_ratio(trials: list[dict]) -> float:
    """사전 사격 비율"""
    ratios = [t.get("pre_fire_ratio", 0) for t in trials if "pre_fire_ratio" in t]
    return float(np.mean(ratios)) if ratios else 0.0


def _compute_vh_ratio(trials: list[dict]) -> float:
    """수직/수평 이동 비율"""
    ratios = [t.get("v_h_ratio", 1.0) for t in trials if "v_h_ratio" in t]
    return float(np.mean(ratios)) if ratios else 1.0


def _compute_motor_accuracy(trials: list[dict], motor_type: str) -> float:
    """모터 타입별 정확도"""
    key = f"{motor_type}_accuracy"
    vals = [t.get(key, 0) for t in trials if key in t]
    return float(np.mean(vals)) if vals else 0.0


def _compute_transition_angle(trials: list[dict]) -> float:
    """모터 전환 각도 (손목→팔 전환 지점)"""
    angles = [t.get("motor_transition_angle", 0) for t in trials if "motor_transition_angle" in t]
    return float(np.mean(angles)) if angles else 30.0


def _compute_adaptation_rate(scores: list[float]) -> float:
    """적응률 (점수 개선 기울기)"""
    if len(scores) < 3:
        return 0.0
    x = np.arange(len(scores), dtype=float)
    coeffs = np.polyfit(x, scores, 1)
    return float(coeffs[0])
