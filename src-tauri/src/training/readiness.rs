//! Game Readiness Score — 매일 2분 마이크로 테스트 기반 컨디션 측정
//!
//! 미니 Flick(60초) + 미니 Tracking(60초) 결과를 baseline DNA와 비교하여
//! 0~100 점수 + 한국어 어드바이스를 생성한다.

use serde::{Deserialize, Serialize};

/// Readiness 측정 입력 — 마이크로 테스트 결과
#[derive(Debug, Clone, Deserialize)]
pub struct ReadinessInput {
    pub profile_id: i64,
    /// 미니 Flick 명중률 (0~1)
    pub flick_accuracy: f64,
    /// 미니 Flick 평균 TTT (ms)
    pub flick_avg_ttt_ms: f64,
    /// 미니 Flick 평균 오버슈팅 (도)
    pub flick_avg_overshoot: f64,
    /// 미니 Tracking MAD (도)
    pub tracking_mad: f64,
    /// 미니 Tracking 속도 매칭 비율 (0~1)
    pub tracking_velocity_match: f64,
}

/// Readiness 결과
#[derive(Debug, Clone, Serialize)]
pub struct ReadinessResult {
    /// 종합 점수 (0~100)
    pub score: f64,
    /// 각 메트릭별 baseline 대비 델타 (%)
    pub baseline_delta: BaselineDelta,
    /// 한국어 어드바이스
    pub daily_advice: String,
    /// 카테고리: peak / ready / moderate / rest
    pub category: String,
}

/// baseline DNA 대비 각 메트릭의 변화율
#[derive(Debug, Clone, Serialize)]
pub struct BaselineDelta {
    pub flick_accuracy_pct: f64,
    pub ttt_pct: f64,
    pub overshoot_pct: f64,
    pub tracking_mad_pct: f64,
    pub velocity_match_pct: f64,
}

/// baseline DNA 값 — readiness 비교 기준
#[derive(Debug, Clone)]
pub struct BaselineValues {
    /// 기준 flick 명중률 (wrist_accuracy 또는 finger_accuracy 평균)
    pub flick_accuracy: f64,
    /// 기준 평균 TTT (fitts_b 기반 추정, ms)
    pub avg_ttt_ms: f64,
    /// 기준 오버슈팅 (도)
    pub avg_overshoot: f64,
    /// 기준 Tracking MAD (도)
    pub tracking_mad: f64,
    /// 기준 속도 매칭 비율
    pub velocity_match: f64,
}

/// AimDnaProfile에서 baseline 값 추출
pub fn extract_baseline(dna: &crate::aim_dna::AimDnaProfile) -> BaselineValues {
    // flick_accuracy: wrist_accuracy와 finger_accuracy 평균
    let flick_acc = match (dna.wrist_accuracy, dna.finger_accuracy) {
        (Some(w), Some(f)) => (w + f) / 2.0,
        (Some(w), None) => w,
        (None, Some(f)) => f,
        _ => 0.7, // 기본값
    };

    BaselineValues {
        flick_accuracy: flick_acc,
        avg_ttt_ms: dna.fitts_b.unwrap_or(300.0) * 1000.0, // fitts_b를 ms로 근사
        avg_overshoot: dna.overshoot_avg.unwrap_or(0.05),
        tracking_mad: dna.tracking_mad.unwrap_or(2.0),
        velocity_match: dna.velocity_match.unwrap_or(0.7),
    }
}

/// Readiness Score 계산
///
/// 각 메트릭을 baseline 대비 정규화(0~100)한 후 가중 평균:
/// - flick_accuracy: 30%
/// - ttt: 20% (낮을수록 좋음 → 역수 비교)
/// - tracking_mad: 30% (낮을수록 좋음 → 역수 비교)
/// - velocity_match: 20%
pub fn calculate_readiness(
    input: &ReadinessInput,
    baseline: &BaselineValues,
) -> ReadinessResult {
    // 각 메트릭 정규화 (baseline 대비 비율, 0~120으로 클램프)
    let norm = |current: f64, base: f64, invert: bool| -> f64 {
        if base <= 0.0 {
            return 100.0;
        }
        let ratio = if invert {
            base / current.max(0.001) // 낮을수록 좋은 메트릭 (MAD, TTT, overshoot)
        } else {
            current / base // 높을수록 좋은 메트릭 (accuracy, velocity_match)
        };
        (ratio * 100.0).clamp(0.0, 120.0)
    };

    let flick_acc_norm = norm(input.flick_accuracy, baseline.flick_accuracy, false);
    let ttt_norm = norm(input.flick_avg_ttt_ms, baseline.avg_ttt_ms, true);
    let tracking_norm = norm(input.tracking_mad, baseline.tracking_mad, true);
    let vel_match_norm = norm(input.tracking_velocity_match, baseline.velocity_match, false);

    // 가중 평균
    let score = (0.30 * flick_acc_norm
        + 0.20 * ttt_norm
        + 0.30 * tracking_norm
        + 0.20 * vel_match_norm)
        .clamp(0.0, 100.0);

    // baseline 대비 변화율 (%) — 양수 = 개선, 음수 = 저하
    let delta_pct = |current: f64, base: f64, invert: bool| -> f64 {
        if base == 0.0 { return 0.0; }
        let ratio = if invert {
            (base - current) / base * 100.0  // MAD 감소 = 개선
        } else {
            (current - base) / base * 100.0  // accuracy 증가 = 개선
        };
        (ratio * 10.0).round() / 10.0
    };

    let baseline_delta = BaselineDelta {
        flick_accuracy_pct: delta_pct(input.flick_accuracy, baseline.flick_accuracy, false),
        ttt_pct: delta_pct(input.flick_avg_ttt_ms, baseline.avg_ttt_ms, true),
        overshoot_pct: delta_pct(input.flick_avg_overshoot, baseline.avg_overshoot, true),
        tracking_mad_pct: delta_pct(input.tracking_mad, baseline.tracking_mad, true),
        velocity_match_pct: delta_pct(input.tracking_velocity_match, baseline.velocity_match, false),
    };

    // 카테고리 + 한국어 어드바이스
    let (category, daily_advice) = if score >= 90.0 {
        ("peak", "최상 컨디션! 경쟁전 추천")
    } else if score >= 75.0 {
        ("ready", "양호한 컨디션. 일반 훈련 적합")
    } else if score >= 60.0 {
        ("moderate", "워밍업이 필요합니다. 트래킹 10분 권장")
    } else {
        ("rest", "컨디션 저하. 가벼운 연습 후 휴식 권장")
    };

    ReadinessResult {
        score,
        baseline_delta,
        daily_advice: daily_advice.to_string(),
        category: category.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_baseline() -> BaselineValues {
        BaselineValues {
            flick_accuracy: 0.75,
            avg_ttt_ms: 400.0,
            avg_overshoot: 0.06,
            tracking_mad: 2.0,
            velocity_match: 0.75,
        }
    }

    #[test]
    fn test_readiness_peak() {
        let input = ReadinessInput {
            profile_id: 1,
            flick_accuracy: 0.80,
            flick_avg_ttt_ms: 350.0,
            flick_avg_overshoot: 0.04,
            tracking_mad: 1.5,
            tracking_velocity_match: 0.80,
        };
        let result = calculate_readiness(&input, &make_baseline());
        assert!(result.score >= 90.0, "score={}", result.score);
        assert_eq!(result.category, "peak");
    }

    #[test]
    fn test_readiness_moderate() {
        let input = ReadinessInput {
            profile_id: 1,
            flick_accuracy: 0.55,
            flick_avg_ttt_ms: 550.0,
            flick_avg_overshoot: 0.10,
            tracking_mad: 3.0,
            tracking_velocity_match: 0.55,
        };
        let result = calculate_readiness(&input, &make_baseline());
        assert!(result.score < 80.0, "score={}", result.score);
        assert!(result.category == "moderate" || result.category == "rest");
    }

    #[test]
    fn test_readiness_baseline_delta() {
        let input = ReadinessInput {
            profile_id: 1,
            flick_accuracy: 0.75,
            flick_avg_ttt_ms: 400.0,
            flick_avg_overshoot: 0.06,
            tracking_mad: 2.0,
            tracking_velocity_match: 0.75,
        };
        let result = calculate_readiness(&input, &make_baseline());
        // baseline과 동일 → 각 delta ≈ 0
        assert!((result.baseline_delta.flick_accuracy_pct).abs() < 1.0);
        assert!((result.baseline_delta.tracking_mad_pct).abs() < 1.0);
    }
}
