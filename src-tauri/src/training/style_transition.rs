//! 에임 스타일 전환 모드 — from_type → to_type 전환 추적
//!
//! 전환 선언 → 목표 sens 범위 설정 → DNA 수렴 추적 → 4단계 Phase 전이
//! Phase: initial → adaptation → consolidation → mastery

use serde::Serialize;

/// 스타일 전환 Phase
#[derive(Debug, Clone, PartialEq)]
pub enum TransitionPhase {
    Initial,
    Adaptation,
    Consolidation,
    Mastery,
}

impl TransitionPhase {
    pub fn as_str(&self) -> &str {
        match self {
            TransitionPhase::Initial => "initial",
            TransitionPhase::Adaptation => "adaptation",
            TransitionPhase::Consolidation => "consolidation",
            TransitionPhase::Mastery => "mastery",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "adaptation" => TransitionPhase::Adaptation,
            "consolidation" => TransitionPhase::Consolidation,
            "mastery" => TransitionPhase::Mastery,
            _ => TransitionPhase::Initial,
        }
    }
}

/// 스타일 전환 진행 상태
#[derive(Debug, Clone, Serialize)]
pub struct TransitionProgress {
    /// 현재 페이즈
    pub phase: String,
    /// 전체 수렴도 (0~100)
    pub convergence_pct: f64,
    /// 핵심 피처별 수렴 상태
    pub key_features_status: Vec<FeatureConvergence>,
    /// 플래토 감지 여부
    pub plateau_detected: bool,
    /// 예상 잔여 일수
    pub estimated_days_remaining: f64,
}

/// 개별 피처 수렴 상태
#[derive(Debug, Clone, Serialize)]
pub struct FeatureConvergence {
    pub feature_name: String,
    /// 현재 수렴도 (0~100)
    pub convergence_pct: f64,
    /// 목표 방향 (up = 증가, down = 감소)
    pub target_direction: String,
}

/// 스타일별 핵심 피처 기대값 정의
/// (feature_name, 기대값, 높을수록 좋은지 여부)
pub fn get_style_target_features(style_type: &str) -> Vec<(&str, f64, bool)> {
    match style_type {
        "wrist-flicker" => vec![
            ("wrist_arm_ratio", 0.7, true),        // 손목 비율 높음
            ("flick_peak_velocity", 150.0, true),   // 빠른 플릭 속도
            ("overshoot_avg", 0.04, false),          // 낮은 오버슈팅
            ("pre_aim_ratio", 0.3, false),           // 낮은 프리에임 (반사적)
        ],
        "arm-tracker" => vec![
            ("wrist_arm_ratio", 0.3, false),        // 팔 비율 높음 (비율 낮음)
            ("tracking_mad", 1.5, false),            // 낮은 MAD
            ("smoothness", 15.0, true),              // 높은 스무드니스
            ("velocity_match", 0.85, true),          // 높은 속도 매칭
        ],
        "hybrid" => vec![
            ("wrist_arm_ratio", 0.5, true),         // 균형
            ("tracking_mad", 2.0, false),
            ("flick_peak_velocity", 120.0, true),
            ("effective_range", 120.0, true),
        ],
        "precision" => vec![
            ("finger_accuracy", 0.85, true),
            ("overshoot_avg", 0.03, false),
            ("pre_aim_ratio", 0.6, true),            // 높은 프리에임
            ("direction_bias", 0.05, false),          // 낮은 방향 편향
        ],
        // 기본값: hybrid와 동일
        _ => vec![
            ("wrist_arm_ratio", 0.5, true),
            ("tracking_mad", 2.0, false),
            ("flick_peak_velocity", 120.0, true),
            ("effective_range", 120.0, true),
        ],
    }
}

/// DNA 프로필에서 특정 피처 값 추출
fn get_feature_value(dna: &crate::aim_dna::AimDnaProfile, feature_name: &str) -> Option<f64> {
    match feature_name {
        "flick_peak_velocity" => dna.flick_peak_velocity,
        "overshoot_avg" => dna.overshoot_avg,
        "direction_bias" => dna.direction_bias,
        "effective_range" => dna.effective_range,
        "tracking_mad" => dna.tracking_mad,
        "phase_lag" => dna.phase_lag,
        "smoothness" => dna.smoothness,
        "velocity_match" => dna.velocity_match,
        "wrist_arm_ratio" => dna.wrist_arm_ratio,
        "finger_accuracy" => dna.finger_accuracy,
        "wrist_accuracy" => dna.wrist_accuracy,
        "arm_accuracy" => dna.arm_accuracy,
        "pre_aim_ratio" => dna.pre_aim_ratio,
        "pre_fire_ratio" => dna.pre_fire_ratio,
        "fatigue_decay" => dna.fatigue_decay,
        "v_h_ratio" => dna.v_h_ratio,
        "motor_transition_angle" => dna.motor_transition_angle,
        _ => None,
    }
}

/// 전환 진행 상태 평가
///
/// 현재 DNA를 목표 스타일의 기대값과 비교하여 수렴도 산출
pub fn evaluate_transition_progress(
    current_dna: &crate::aim_dna::AimDnaProfile,
    to_type: &str,
    current_phase: &str,
    _session_count: i64,
) -> TransitionProgress {
    let target_features = get_style_target_features(to_type);

    let mut feature_convergences = Vec::new();
    let mut total_convergence = 0.0;
    let mut valid_count = 0;

    for (name, target_val, higher_is_better) in &target_features {
        if let Some(current_val) = get_feature_value(current_dna, name) {
            // 수렴도 계산: 현재값이 목표값에 얼마나 가까운가 (0~100)
            let convergence = if *higher_is_better {
                // 목표보다 높으면 100%, 아래면 비율
                if *target_val <= 0.0 {
                    100.0
                } else {
                    ((current_val / target_val) * 100.0).clamp(0.0, 100.0)
                }
            } else {
                // 목표보다 낮으면 100%, 위면 비율 (역수)
                if current_val <= 0.0 {
                    100.0
                } else {
                    ((target_val / current_val) * 100.0).clamp(0.0, 100.0)
                }
            };

            let direction = if *higher_is_better { "up" } else { "down" };

            feature_convergences.push(FeatureConvergence {
                feature_name: name.to_string(),
                convergence_pct: (convergence * 10.0).round() / 10.0,
                target_direction: direction.to_string(),
            });

            total_convergence += convergence;
            valid_count += 1;
        }
    }

    let convergence_pct = if valid_count > 0 {
        total_convergence / valid_count as f64
    } else {
        0.0
    };

    // Phase 전환 판단
    let phase = TransitionPhase::from_str(current_phase);
    let next_phase = determine_next_phase(&phase, convergence_pct);

    // 예상 잔여 일수: (100 - convergence) / 주당 개선율 * 7
    let weekly_improvement = 5.0; // 주당 5% 수렴 가정
    let estimated_days = if convergence_pct < 100.0 {
        ((100.0 - convergence_pct) / weekly_improvement * 7.0).ceil()
    } else {
        0.0
    };

    TransitionProgress {
        phase: next_phase.as_str().to_string(),
        convergence_pct: (convergence_pct * 10.0).round() / 10.0,
        key_features_status: feature_convergences,
        plateau_detected: false, // 실제 플래토 감지는 히스토리 기반으로 별도 처리
        estimated_days_remaining: estimated_days,
    }
}

/// Phase 전환 규칙
/// - initial → adaptation: 수렴도 > 20%
/// - adaptation → consolidation: 수렴도 > 70%
/// - consolidation → mastery: 수렴도 > 90%
fn determine_next_phase(current: &TransitionPhase, convergence_pct: f64) -> TransitionPhase {
    match current {
        TransitionPhase::Initial => {
            if convergence_pct > 20.0 {
                TransitionPhase::Adaptation
            } else {
                TransitionPhase::Initial
            }
        }
        TransitionPhase::Adaptation => {
            if convergence_pct > 70.0 {
                TransitionPhase::Consolidation
            } else {
                TransitionPhase::Adaptation
            }
        }
        TransitionPhase::Consolidation => {
            if convergence_pct > 90.0 {
                TransitionPhase::Mastery
            } else {
                TransitionPhase::Consolidation
            }
        }
        TransitionPhase::Mastery => TransitionPhase::Mastery,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_style_target_features() {
        let wrist = get_style_target_features("wrist-flicker");
        assert_eq!(wrist.len(), 4);
        assert_eq!(wrist[0].0, "wrist_arm_ratio");

        let arm = get_style_target_features("arm-tracker");
        assert_eq!(arm.len(), 4);
    }

    #[test]
    fn test_phase_transition() {
        assert_eq!(
            determine_next_phase(&TransitionPhase::Initial, 25.0).as_str(),
            "adaptation"
        );
        assert_eq!(
            determine_next_phase(&TransitionPhase::Initial, 15.0).as_str(),
            "initial"
        );
        assert_eq!(
            determine_next_phase(&TransitionPhase::Adaptation, 75.0).as_str(),
            "consolidation"
        );
        assert_eq!(
            determine_next_phase(&TransitionPhase::Consolidation, 95.0).as_str(),
            "mastery"
        );
    }
}
