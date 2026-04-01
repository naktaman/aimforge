//! 훈련 처방 엔진 — Aim DNA 약점 기반 시나리오 자동 추천
//! Day 16~17: Training Prescription + Stage 시스템

pub mod commands;
pub mod readiness;
pub mod style_transition;

use serde::{Deserialize, Serialize};

/// 훈련 처방 항목 — 약점 분석 후 추천되는 시나리오 + 파라미터
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingPrescription {
    pub weakness: String,
    pub scenario_type: String,
    pub scenario_params: serde_json::Value,
    pub priority: f64,
    pub estimated_min: f64,
    pub source_type: String,
    pub description: String,
}

/// 훈련 스테이지 카테고리
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum StageCategory {
    FlickShot,
    Tracking,
    TargetSwitching,
    CloseRange,
    LongRange,
    Assessment,
}

/// 벤치마크 난이도 프리셋 (고정 파라미터, 비교용)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkPreset {
    pub name: String,
    pub target_size_deg: f64,
    pub target_speed_deg_per_sec: f64,
    pub reaction_window_ms: f64,
    pub target_count: i32,
}

/// 난이도 조절 파라미터 — 3층 구조 (벤치마크/수동/자동적응)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DifficultyConfig {
    /// 난이도 모드: "benchmark", "manual", "adaptive"
    pub mode: String,
    /// 타겟 크기 (도)
    pub target_size_deg: f64,
    /// 타겟 속도 (도/초)
    pub target_speed_deg_per_sec: f64,
    /// 반응 시간 윈도우 (ms)
    pub reaction_window_ms: f64,
    /// 타겟 수
    pub target_count: i32,
    /// 적응형 난이도 성공률 목표 (0.0~1.0)
    pub adaptive_target_success_rate: f64,
}

impl Default for DifficultyConfig {
    fn default() -> Self {
        Self {
            mode: "benchmark".to_string(),
            target_size_deg: 3.0,
            target_speed_deg_per_sec: 30.0,
            reaction_window_ms: 3000.0,
            target_count: 20,
            adaptive_target_success_rate: 0.75,
        }
    }
}

/// 스테이지 결과 — 프론트엔드에서 전달
#[derive(Debug, Clone, Deserialize)]
pub struct StageResult {
    pub profile_id: i64,
    pub stage_type: String,
    pub category: String,
    pub difficulty: DifficultyConfig,
    /// 명중률 (0.0~1.0)
    pub accuracy: f64,
    /// 평균 TTK (ms)
    pub avg_ttk_ms: f64,
    /// 평균 반응시간 (ms)
    pub avg_reaction_ms: f64,
    /// 평균 오버슈팅 (도)
    pub avg_overshoot_deg: f64,
    /// 평균 언더슈팅 (도)
    pub avg_undershoot_deg: f64,
    /// 트래킹 정확도 — MAD (도)
    pub tracking_mad: Option<f64>,
    /// 총 점수 (0~100)
    pub score: f64,
    /// 상세 메트릭 JSON
    pub raw_metrics: String,
}

/// DNA 기반 추천 결과
#[derive(Debug, Clone, Serialize)]
pub struct StageRecommendation {
    pub stage_type: String,
    pub category: String,
    pub reason: String,
    pub priority: f64,
    pub suggested_difficulty: DifficultyConfig,
}

/// 벤치마크 프리셋 목록 — 카테고리별 고정 난이도
pub fn get_benchmark_presets() -> Vec<(String, BenchmarkPreset)> {
    vec![
        ("static_flick".into(), BenchmarkPreset {
            name: "Static Flick Benchmark".into(),
            target_size_deg: 2.5, target_speed_deg_per_sec: 0.0,
            reaction_window_ms: 3000.0, target_count: 30,
        }),
        ("reaction_flick".into(), BenchmarkPreset {
            name: "Reaction Flick Benchmark".into(),
            target_size_deg: 3.0, target_speed_deg_per_sec: 0.0,
            reaction_window_ms: 1500.0, target_count: 20,
        }),
        ("scoped_flick".into(), BenchmarkPreset {
            name: "Scoped Flick Benchmark".into(),
            target_size_deg: 1.5, target_speed_deg_per_sec: 0.0,
            reaction_window_ms: 3000.0, target_count: 20,
        }),
        ("horizontal_tracking".into(), BenchmarkPreset {
            name: "Horizontal Tracking Benchmark".into(),
            target_size_deg: 3.0, target_speed_deg_per_sec: 40.0,
            reaction_window_ms: 15000.0, target_count: 1,
        }),
        ("aerial_tracking".into(), BenchmarkPreset {
            name: "Aerial Tracking Benchmark".into(),
            target_size_deg: 3.5, target_speed_deg_per_sec: 50.0,
            reaction_window_ms: 12000.0, target_count: 1,
        }),
        ("multi_flick".into(), BenchmarkPreset {
            name: "Multi-Flick Benchmark".into(),
            target_size_deg: 3.0, target_speed_deg_per_sec: 0.0,
            reaction_window_ms: 2000.0, target_count: 5,
        }),
        ("close_range_180".into(), BenchmarkPreset {
            name: "Close Range 180° Benchmark".into(),
            target_size_deg: 6.0, target_speed_deg_per_sec: 80.0,
            reaction_window_ms: 1500.0, target_count: 15,
        }),
        ("jump_tracking".into(), BenchmarkPreset {
            name: "Jump Tracking Benchmark".into(),
            target_size_deg: 4.0, target_speed_deg_per_sec: 60.0,
            reaction_window_ms: 10000.0, target_count: 1,
        }),
        ("strafe_tracking".into(), BenchmarkPreset {
            name: "Strafe Tracking Benchmark".into(),
            target_size_deg: 4.5, target_speed_deg_per_sec: 70.0,
            reaction_window_ms: 12000.0, target_count: 1,
        }),
        ("long_range_precision".into(), BenchmarkPreset {
            name: "Long Range Precision Benchmark".into(),
            target_size_deg: 1.0, target_speed_deg_per_sec: 0.0,
            reaction_window_ms: 5000.0, target_count: 15,
        }),
        ("bulletdrop_sniping".into(), BenchmarkPreset {
            name: "Bulletdrop Sniping Benchmark".into(),
            target_size_deg: 1.2, target_speed_deg_per_sec: 15.0,
            reaction_window_ms: 6000.0, target_count: 10,
        }),
    ]
}

/// Aim DNA 프로파일 기반 약점 분석 + 훈련 처방 생성
/// 룰 엔진: 각 DNA 피처 임계값 확인 → 약점에 맞는 시나리오 추천
pub fn generate_prescriptions(
    dna: &crate::aim_dna::AimDnaProfile,
) -> Vec<TrainingPrescription> {
    let mut prescriptions = Vec::new();

    // 1. 오버슈팅 높음 → PrecisionStopDrill / Static Flick
    if let Some(overshoot) = dna.overshoot_avg {
        if overshoot > 0.08 {
            prescriptions.push(TrainingPrescription {
                weakness: "overshoot".into(),
                scenario_type: "static_flick".into(),
                scenario_params: serde_json::json!({
                    "focus": "precision_stop",
                    "target_size_deg": 2.0,
                    "emphasis": "settle_time"
                }),
                priority: overshoot * 10.0,
                estimated_min: 5.0,
                source_type: "single_game".into(),
                description: "오버슈팅 교정 — 정밀 정지 플릭 훈련".into(),
            });
        }
    }

    // 2. 방향 편향 → DirectionalCorrection
    if let Some(bias) = dna.direction_bias {
        if bias > 0.12 {
            prescriptions.push(TrainingPrescription {
                weakness: "direction_bias".into(),
                scenario_type: "static_flick".into(),
                scenario_params: serde_json::json!({
                    "focus": "weak_direction",
                    "weak_direction_ratio": 0.7,
                    "bias_value": bias
                }),
                priority: bias * 8.0,
                estimated_min: 5.0,
                source_type: "single_game".into(),
                description: format!("방향 편향 교정 — 약방향 집중 (편향: {:.1}%)", bias * 100.0),
            });
        }
    }

    // 3. 트래킹 MAD 높음 → Horizontal Tracking / Smooth Tracking
    if let Some(mad) = dna.tracking_mad {
        if mad > 2.0 {
            prescriptions.push(TrainingPrescription {
                weakness: "tracking_accuracy".into(),
                scenario_type: "horizontal_tracking".into(),
                scenario_params: serde_json::json!({
                    "focus": "smooth_tracking",
                    "target_speed_deg_per_sec": 30.0,
                    "duration_ms": 15000
                }),
                priority: mad * 3.0,
                estimated_min: 8.0,
                source_type: "single_game".into(),
                description: format!("트래킹 정확도 향상 — MAD {:.1}° 감소 목표", mad),
            });
        }
    }

    // 4. Phase lag 높음 → PredictiveTracking
    if let Some(lag) = dna.phase_lag {
        if lag > 20.0 {
            prescriptions.push(TrainingPrescription {
                weakness: "phase_lag".into(),
                scenario_type: "aerial_tracking".into(),
                scenario_params: serde_json::json!({
                    "focus": "predictive",
                    "target_speed_deg_per_sec": 50.0,
                    "trajectory": "parabolic"
                }),
                priority: lag * 0.4,
                estimated_min: 6.0,
                source_type: "single_game".into(),
                description: format!("예측 트래킹 — 위상 지연 {:.0}ms 감소 목표", lag),
            });
        }
    }

    // 5. Smoothness 낮음 → Circular/Stochastic Tracking
    if let Some(smooth) = dna.smoothness {
        if smooth < 10.0 {
            prescriptions.push(TrainingPrescription {
                weakness: "smoothness".into(),
                scenario_type: "circular_tracking".into(),
                scenario_params: serde_json::json!({
                    "focus": "smooth_pursuit",
                    "orbit_speed_deg_per_sec": 25.0,
                    "duration_ms": 15000
                }),
                priority: (10.0 - smooth) * 0.8,
                estimated_min: 6.0,
                source_type: "single_game".into(),
                description: "부드러운 추적 훈련 — 원형 궤적 트래킹".into(),
            });
        }
    }

    // 6. 수직 약함 → VerticalFlick / Aerial
    if let Some(vh) = dna.v_h_ratio {
        if vh > 1.15 {
            prescriptions.push(TrainingPrescription {
                weakness: "vertical_weakness".into(),
                scenario_type: "aerial_tracking".into(),
                scenario_params: serde_json::json!({
                    "focus": "vertical",
                    "trajectory": "vertical_emphasis",
                    "v_h_ratio": vh
                }),
                priority: (vh - 1.0) * 10.0,
                estimated_min: 5.0,
                source_type: "single_game".into(),
                description: format!("수직 에이밍 강화 — V/H 비율 {:.2} 교정", vh),
            });
        }
    }

    // 7. 전환점 dip → TransitionZoneDrill / Multi-Flick
    if let Some(angle) = dna.motor_transition_angle {
        if angle < 90.0 {
            prescriptions.push(TrainingPrescription {
                weakness: "transition_zone".into(),
                scenario_type: "multi_flick".into(),
                scenario_params: serde_json::json!({
                    "focus": "transition_zone",
                    "angle_range": [angle - 20.0, angle + 20.0],
                    "transition_angle": angle
                }),
                priority: (90.0 - angle) * 0.1,
                estimated_min: 5.0,
                source_type: "single_game".into(),
                description: format!("운동체계 전환 구간 훈련 — {:.0}°±20° 집중", angle),
            });
        }
    }

    // 8. 유효 사거리 좁음 → Wide Flick
    if let Some(range) = dna.effective_range {
        if range < 90.0 {
            prescriptions.push(TrainingPrescription {
                weakness: "limited_range".into(),
                scenario_type: "static_flick".into(),
                scenario_params: serde_json::json!({
                    "focus": "wide_angle",
                    "angle_range": [90, 160],
                    "target_size_deg": 3.5
                }),
                priority: (90.0 - range) * 0.08,
                estimated_min: 5.0,
                source_type: "single_game".into(),
                description: format!("유효 사거리 확장 — 현재 {:.0}° → 90°+ 목표", range),
            });
        }
    }

    // 9. 근거리 약함 (finger_accuracy 낮음) → Close Range 180
    if let Some(finger) = dna.finger_accuracy {
        if finger < 0.6 {
            prescriptions.push(TrainingPrescription {
                weakness: "close_range".into(),
                scenario_type: "close_range_180".into(),
                scenario_params: serde_json::json!({
                    "focus": "close_combat",
                    "target_size_deg": 6.0,
                    "speed_deg_per_sec": 80.0
                }),
                priority: (0.6 - finger) * 12.0,
                estimated_min: 5.0,
                source_type: "single_game".into(),
                description: "근거리 교전 강화 — 180° 플릭 + 빠른 타겟 전환".into(),
            });
        }
    }

    // 10. 피로 감소율 높음 → 워밍업 + 컨디셔닝
    if let Some(decay) = dna.fatigue_decay {
        if decay > 0.1 {
            prescriptions.push(TrainingPrescription {
                weakness: "fatigue".into(),
                scenario_type: "aim_dna_scan".into(),
                scenario_params: serde_json::json!({
                    "focus": "endurance",
                    "extended_duration": true
                }),
                priority: decay * 5.0,
                estimated_min: 3.0,
                source_type: "single_game".into(),
                description: format!("지구력 훈련 — 피로 감소율 {:.1}% 개선 목표", decay * 100.0),
            });
        }
    }

    // 우선순위 내림차순 정렬
    prescriptions.sort_by(|a, b| b.priority.partial_cmp(&a.priority).unwrap_or(std::cmp::Ordering::Equal));
    prescriptions
}

/// 적응형 난이도 조절 — 최근 결과 기반
/// 성공률 70~80% 유지하도록 파라미터 자동 조절
pub fn adapt_difficulty(
    current: &DifficultyConfig,
    recent_accuracy: f64,
) -> DifficultyConfig {
    let mut adapted = current.clone();
    adapted.mode = "adaptive".to_string();

    let target = current.adaptive_target_success_rate;

    if recent_accuracy > target + 0.05 {
        // 너무 쉬움 → 난이도 상승
        adapted.target_size_deg *= 0.9;
        adapted.target_speed_deg_per_sec *= 1.1;
        adapted.reaction_window_ms *= 0.9;
    } else if recent_accuracy < target - 0.05 {
        // 너무 어려움 → 난이도 하락
        adapted.target_size_deg *= 1.1;
        adapted.target_speed_deg_per_sec *= 0.9;
        adapted.reaction_window_ms *= 1.1;
    }

    // 범위 제한
    adapted.target_size_deg = adapted.target_size_deg.clamp(0.5, 10.0);
    adapted.target_speed_deg_per_sec = adapted.target_speed_deg_per_sec.clamp(5.0, 200.0);
    adapted.reaction_window_ms = adapted.reaction_window_ms.clamp(500.0, 10000.0);

    adapted
}

/// 스테이지 결과를 Aim DNA 피처 변화량으로 매핑
/// 각 스테이지 타입별로 관련 DNA 피처에 기여
pub fn map_stage_to_dna_features(result: &StageResult) -> Vec<(String, f64)> {
    let mut features = Vec::new();

    match result.stage_type.as_str() {
        "static_flick" | "reaction_flick" | "scoped_flick" => {
            features.push(("overshoot_avg".into(), result.avg_overshoot_deg));
            if result.avg_reaction_ms > 0.0 {
                // 피크 속도 추정: 타겟 각도 / 반응시간
                features.push(("flick_peak_velocity".into(), 45.0 / (result.avg_reaction_ms / 1000.0)));
            }
        }
        "horizontal_tracking" | "aerial_tracking" | "circular_tracking"
        | "stochastic_tracking" => {
            if let Some(mad) = result.tracking_mad {
                features.push(("tracking_mad".into(), mad));
            }
        }
        "multi_flick" | "zoom_multi_flick" => {
            features.push(("effective_range".into(), result.score));
        }
        "close_range_180" | "jump_tracking" | "strafe_tracking" => {
            features.push(("finger_accuracy".into(), result.accuracy));
        }
        "long_range_precision" | "bulletdrop_sniping" => {
            features.push(("overshoot_avg".into(), result.avg_overshoot_deg));
        }
        _ => {}
    }

    features
}

/// Aim DNA 기반 스테이지 추천 목록 생성
pub fn recommend_stages(
    dna: &crate::aim_dna::AimDnaProfile,
) -> Vec<StageRecommendation> {
    let prescriptions = generate_prescriptions(dna);

    prescriptions.into_iter().map(|p| {
        let category = match p.scenario_type.as_str() {
            "static_flick" | "reaction_flick" | "scoped_flick" => "flick_shot",
            "horizontal_tracking" | "aerial_tracking" | "circular_tracking"
            | "stochastic_tracking" => "tracking",
            "multi_flick" | "zoom_multi_flick" => "target_switching",
            "close_range_180" | "jump_tracking" | "strafe_tracking" => "close_range",
            "long_range_precision" | "bulletdrop_sniping" => "long_range",
            "aim_dna_scan" => "assessment",
            _ => "flick_shot",
        };

        StageRecommendation {
            stage_type: p.scenario_type,
            category: category.to_string(),
            reason: p.description,
            priority: p.priority,
            suggested_difficulty: DifficultyConfig::default(),
        }
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::aim_dna::AimDnaProfile;

    /// 오버슈팅 약점 → static_flick 처방 확인
    #[test]
    fn test_overshoot_prescription() {
        let dna = AimDnaProfile {
            overshoot_avg: Some(0.15),
            ..AimDnaProfile::empty(1, 1)
        };
        let prescriptions = generate_prescriptions(&dna);
        assert!(prescriptions.iter().any(|p| p.weakness == "overshoot"));
    }

    /// 트래킹 MAD 약점 → tracking 처방 확인
    #[test]
    fn test_tracking_prescription() {
        let dna = AimDnaProfile {
            tracking_mad: Some(3.5),
            ..AimDnaProfile::empty(1, 1)
        };
        let prescriptions = generate_prescriptions(&dna);
        assert!(prescriptions.iter().any(|p| p.weakness == "tracking_accuracy"));
    }

    /// 약점 없는 프로파일 → 빈 처방
    #[test]
    fn test_no_weakness() {
        let dna = AimDnaProfile::empty(1, 1);
        let prescriptions = generate_prescriptions(&dna);
        assert!(prescriptions.is_empty());
    }

    /// 적응형 난이도 — 성공률 높으면 난이도 상승
    #[test]
    fn test_adapt_difficulty_increase() {
        let config = DifficultyConfig::default();
        let adapted = adapt_difficulty(&config, 0.85);
        assert!(adapted.target_size_deg < config.target_size_deg);
        assert!(adapted.target_speed_deg_per_sec > config.target_speed_deg_per_sec);
    }

    /// 적응형 난이도 — 성공률 낮으면 난이도 하락
    #[test]
    fn test_adapt_difficulty_decrease() {
        let config = DifficultyConfig::default();
        let adapted = adapt_difficulty(&config, 0.50);
        assert!(adapted.target_size_deg > config.target_size_deg);
        assert!(adapted.target_speed_deg_per_sec < config.target_speed_deg_per_sec);
    }

    /// 우선순위 정렬 확인
    #[test]
    fn test_priority_ordering() {
        let dna = AimDnaProfile {
            overshoot_avg: Some(0.2),
            tracking_mad: Some(4.0),
            direction_bias: Some(0.3),
            ..AimDnaProfile::empty(1, 1)
        };
        let prescriptions = generate_prescriptions(&dna);
        assert!(prescriptions.len() >= 3);
        // 우선순위 내림차순
        for i in 1..prescriptions.len() {
            assert!(prescriptions[i - 1].priority >= prescriptions[i].priority);
        }
    }

    /// 벤치마크 프리셋 목록 확인
    #[test]
    fn test_benchmark_presets() {
        let presets = get_benchmark_presets();
        assert!(presets.len() >= 10);
        assert!(presets.iter().any(|(k, _)| k == "static_flick"));
    }
}
