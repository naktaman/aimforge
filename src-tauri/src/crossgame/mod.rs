//! Cross-Game DNA 비교 + 개선 플랜 생성 엔진
//! Day 16~17: 크로스게임 DNA 비교, 갭 분석, 개선 계획, 타임라인 예측

pub mod commands;

use serde::{Deserialize, Serialize};

/// 크로스게임 DNA 비교 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossGameComparison {
    pub ref_profile_id: i64,
    pub target_profile_id: i64,
    pub reference_game_id: i64,
    /// 피처별 델타 (target - ref) / ref × 100
    pub deltas: Vec<FeatureDelta>,
    /// 갭 원인 분류 결과
    pub causes: Vec<GapCause>,
    /// 전체 갭 크기 (가중 평균)
    pub overall_gap: f64,
    /// 개선 플랜
    pub improvement_plan: ImprovementPlan,
    /// 예상 적응 기간 (일)
    pub predicted_days: f64,
    /// 상세 타임라인 예측
    pub timeline: TimelinePrediction,
}

/// 피처별 델타
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureDelta {
    pub feature: String,
    pub ref_value: f64,
    pub target_value: f64,
    /// (target - ref) / ref × 100
    pub delta_pct: f64,
    pub severity: String,
}

/// 갭 원인 분류
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GapCause {
    pub cause_type: String,
    pub description: String,
    pub contributing_features: Vec<String>,
    pub severity: f64,
}

/// 개선 플랜 — 4단계 Phase
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImprovementPlan {
    pub phases: Vec<ImprovementPhase>,
}

/// 개선 Phase
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImprovementPhase {
    pub phase: i32,
    pub name: String,
    pub duration_weeks: String,
    pub actions: Vec<String>,
    pub target_metrics: Vec<String>,
    pub scenarios: Vec<String>,
}

/// 타임라인 예측 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelinePrediction {
    pub total_days: f64,
    pub bottleneck_feature: String,
    pub per_feature: Vec<FeatureTimeline>,
    pub disclaimer: String,
}

/// 피처별 예상 기간
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureTimeline {
    pub feature: String,
    pub gap_pct: f64,
    pub estimated_days: f64,
}

/// 두 게임의 DNA 비교 + 갭 분석
pub fn compare_games(
    ref_dna: &crate::aim_dna::AimDnaProfile,
    target_dna: &crate::aim_dna::AimDnaProfile,
    ref_game_movement_ratio: f64,
    target_game_movement_ratio: f64,
    reference_game_id: i64,
    sens_diff_cm360: f64,
) -> CrossGameComparison {
    let ref_pairs = ref_dna.to_feature_pairs();
    let target_pairs = target_dna.to_feature_pairs();

    // 피처별 델타 계산
    let mut deltas = Vec::new();
    for (ref_name, ref_val) in &ref_pairs {
        if let Some((_, target_val)) = target_pairs.iter().find(|(n, _)| n == ref_name) {
            if ref_val.abs() > 1e-6 {
                let delta_pct = (target_val - ref_val) / ref_val * 100.0;
                let severity = classify_severity(delta_pct.abs());
                deltas.push(FeatureDelta {
                    feature: ref_name.clone(),
                    ref_value: *ref_val,
                    target_value: *target_val,
                    delta_pct,
                    severity,
                });
            }
        }
    }

    // 원인 분류
    let causes = classify_gap_causes(
        &deltas,
        ref_game_movement_ratio,
        target_game_movement_ratio,
        sens_diff_cm360,
    );

    // 전체 갭 크기 (절대 델타의 가중 평균)
    let overall_gap = if deltas.is_empty() {
        0.0
    } else {
        deltas.iter().map(|d| d.delta_pct.abs()).sum::<f64>() / deltas.len() as f64
    };

    // 개선 플랜 생성
    let plan = generate_improvement_plan(&causes, &deltas);

    // 타임라인 예측
    let timeline = predict_timeline(&deltas, 1.0, 5.0);

    CrossGameComparison {
        ref_profile_id: ref_dna.profile_id,
        target_profile_id: target_dna.profile_id,
        reference_game_id,
        deltas,
        causes,
        overall_gap,
        improvement_plan: plan,
        predicted_days: timeline.total_days,
        timeline,
    }
}

/// 델타 크기 → 심각도 분류
fn classify_severity(abs_delta: f64) -> String {
    if abs_delta > 100.0 {
        "critical".into()
    } else if abs_delta > 50.0 {
        "major".into()
    } else if abs_delta > 20.0 {
        "moderate".into()
    } else {
        "minor".into()
    }
}

/// 갭 원인 분류 — 5가지 원인 룰 엔진
fn classify_gap_causes(
    deltas: &[FeatureDelta],
    _ref_movement: f64,
    target_movement: f64,
    sens_diff_cm360: f64,
) -> Vec<GapCause> {
    let mut causes = Vec::new();

    // 특정 피처의 델타를 가져오는 헬퍼
    let get_delta = |name: &str| -> Option<&FeatureDelta> {
        deltas.iter().find(|d| d.feature == name)
    };

    // 1. sens_mismatch — 오버슈트 차이 크고 cm/360 차이 > 3
    if let Some(overshoot) = get_delta("overshoot_avg") {
        if overshoot.delta_pct.abs() > 50.0 && sens_diff_cm360 > 3.0 {
            causes.push(GapCause {
                cause_type: "sens_mismatch".into(),
                description: "감도 변환값이 실제 최적과 다를 수 있습니다".into(),
                contributing_features: vec!["overshoot_avg".into(), "sens_attributed_overshoot".into()],
                severity: overshoot.delta_pct.abs(),
            });
        }
    }

    // 2. movement_unadapted — 트래킹 MAD 차이 크고 무빙 게임
    if let Some(mad) = get_delta("tracking_mad") {
        if mad.delta_pct.abs() > 80.0 && target_movement > 0.5 {
            causes.push(GapCause {
                cause_type: "movement_unadapted".into(),
                description: "무빙 게임에 트래킹이 적응되지 않았습니다".into(),
                contributing_features: vec!["tracking_mad".into(), "velocity_match".into()],
                severity: mad.delta_pct.abs(),
            });
        }
    }

    // 3. style_mismatch — pre_aim 비율 차이
    if let Some(pre_aim) = get_delta("pre_aim_ratio") {
        if pre_aim.delta_pct < -30.0 {
            causes.push(GapCause {
                cause_type: "style_mismatch".into(),
                description: "정지-사격에서 무빙-사격으로 전환이 필요합니다".into(),
                contributing_features: vec!["pre_aim_ratio".into(), "pre_fire_ratio".into()],
                severity: pre_aim.delta_pct.abs(),
            });
        }
    }

    // 4. transition_narrowed — 운동체계 전환 각도 감소
    if let Some(transition) = get_delta("motor_transition_angle") {
        if transition.delta_pct < -15.0 {
            causes.push(GapCause {
                cause_type: "transition_narrowed".into(),
                description: "무빙+넓은 FOV에서 arm 전환이 조기 발생합니다".into(),
                contributing_features: vec!["motor_transition_angle".into(), "wrist_arm_ratio".into()],
                severity: transition.delta_pct.abs(),
            });
        }
    }

    // 5. vertical_weakness_exposed — V/H 비율 악화
    if let Some(vh) = get_delta("v_h_ratio") {
        if vh.delta_pct > 20.0 {
            causes.push(GapCause {
                cause_type: "vertical_weakness_exposed".into(),
                description: "이 게임에서 수직 에이밍이 더 요구됩니다".into(),
                contributing_features: vec!["v_h_ratio".into()],
                severity: vh.delta_pct.abs(),
            });
        }
    }

    // 심각도 내림차순 정렬
    causes.sort_by(|a, b| b.severity.partial_cmp(&a.severity).unwrap_or(std::cmp::Ordering::Equal));
    causes
}

/// 개선 플랜 생성 — 4단계 Phase
fn generate_improvement_plan(causes: &[GapCause], deltas: &[FeatureDelta]) -> ImprovementPlan {
    let mut phases = Vec::new();

    // Phase 1: 즉시 — 감도 조정
    let has_sens = causes.iter().any(|c| c.cause_type == "sens_mismatch");
    phases.push(ImprovementPhase {
        phase: 1,
        name: "즉시 조정".into(),
        duration_weeks: "즉시".into(),
        actions: if has_sens {
            vec!["캘리브레이션 결과 기반 감도 재조정".into()]
        } else {
            vec!["감도 이슈 없음 — 스킵".into()]
        },
        target_metrics: vec!["overshoot_avg".into(), "sens_attributed_overshoot".into()],
        scenarios: vec!["static_flick".into()],
    });

    // Phase 2: 단기 (1~2주) — 무빙 적응
    let has_movement = causes.iter().any(|c| c.cause_type == "movement_unadapted");
    let has_style = causes.iter().any(|c| c.cause_type == "style_mismatch");
    let mut p2_actions = Vec::new();
    let mut p2_scenarios = Vec::new();
    if has_movement {
        p2_actions.push("트래킹 적응 훈련".into());
        p2_scenarios.push("horizontal_tracking".into());
        p2_scenarios.push("aerial_tracking".into());
    }
    if has_style {
        p2_actions.push("클릭 타이밍 전환 훈련".into());
        p2_scenarios.push("reaction_flick".into());
    }
    if p2_actions.is_empty() {
        p2_actions.push("무빙 적응 이슈 없음 — 스킵".into());
    }
    phases.push(ImprovementPhase {
        phase: 2,
        name: "단기 적응 (1~2주)".into(),
        duration_weeks: "1~2주".into(),
        actions: p2_actions,
        target_metrics: vec!["tracking_mad".into(), "pre_aim_ratio".into()],
        scenarios: p2_scenarios,
    });

    // Phase 3: 중기 (2~3주) — 전환점 확장
    let has_transition = causes.iter().any(|c| c.cause_type == "transition_narrowed");
    phases.push(ImprovementPhase {
        phase: 3,
        name: "전환점 확장 (2~3주)".into(),
        duration_weeks: "2~3주".into(),
        actions: if has_transition {
            vec!["전환 구간 플릭 훈련".into(), "목표: 전환점 90°+".into()]
        } else {
            vec!["전환점 이슈 없음 — 스킵".into()]
        },
        target_metrics: vec!["motor_transition_angle".into(), "wrist_arm_ratio".into()],
        scenarios: vec!["multi_flick".into()],
    });

    // Phase 4: 지속 — 배율 최적화 + 유지
    let mut p4_actions = vec!["줌 캘리브레이션 주기적 실행".into()];
    // 수직 약점이 있으면 수직 훈련 추가
    let has_vertical = causes.iter().any(|c| c.cause_type == "vertical_weakness_exposed");
    if has_vertical {
        p4_actions.push("수직 에이밍 강화 훈련".into());
    }
    // 큰 델타가 남아있으면 관련 시나리오 추가
    let critical_deltas: Vec<_> = deltas.iter().filter(|d| d.delta_pct.abs() > 50.0).collect();
    if !critical_deltas.is_empty() {
        p4_actions.push(format!(
            "잔여 갭 {} 피처 지속 훈련",
            critical_deltas.len()
        ));
    }

    phases.push(ImprovementPhase {
        phase: 4,
        name: "지속 최적화".into(),
        duration_weeks: "지속".into(),
        actions: p4_actions,
        target_metrics: vec!["overall_gap".into()],
        scenarios: vec!["scoped_flick".into(), "aim_dna_scan".into()],
    });

    ImprovementPlan { phases }
}

/// 타임라인 예측 — 피처별 갭 / 주간 개선률 = 예상 주수
pub fn predict_timeline(
    deltas: &[FeatureDelta],
    adaptation_rate: f64,
    weekly_training_hours: f64,
) -> TimelinePrediction {
    // 기본 주간 개선률 (population avg): 갭의 10~15% 감소/주
    let weekly_improvement_pct = 12.0 * adaptation_rate * (weekly_training_hours / 5.0).min(2.0);

    let mut per_feature = Vec::new();
    let mut max_days = 0.0_f64;
    let mut bottleneck = String::new();

    for delta in deltas {
        let gap = delta.delta_pct.abs();
        if gap < 10.0 {
            continue;
        }

        let weeks = gap / weekly_improvement_pct.max(1.0);
        let days = weeks * 7.0;

        if days > max_days {
            max_days = days;
            bottleneck = delta.feature.clone();
        }

        per_feature.push(FeatureTimeline {
            feature: delta.feature.clone(),
            gap_pct: gap,
            estimated_days: days,
        });
    }

    TimelinePrediction {
        total_days: max_days,
        bottleneck_feature: bottleneck,
        per_feature,
        disclaimer: "이 추정은 현재 개선 속도가 유지된다고 가정합니다".into(),
    }
}

/// Cross-game 갭 원인 → 훈련 처방 변환
/// 각 갭 원인별 적절한 시나리오와 파라미터를 매핑
pub fn generate_crossgame_prescriptions(
    comparison: &CrossGameComparison,
) -> Vec<crate::training::TrainingPrescription> {
    let mut prescriptions = Vec::new();

    for cause in &comparison.causes {
        let (scenario_type, params, description) = match cause.cause_type.as_str() {
            "sens_mismatch" => (
                "static_flick",
                serde_json::json!({
                    "focus": "precision_stop",
                    "angle_range": [10, 60],
                    "target_size_deg": 1.5,
                }),
                "감도 불일치 교정: 정밀 정지 플릭 훈련",
            ),
            "movement_unadapted" => (
                "horizontal_tracking",
                serde_json::json!({
                    "speed_range": [30, 120],
                    "direction_changes": 8,
                }),
                "무빙 적응: 수평 트래킹 + 에어리얼 트래킹",
            ),
            "style_mismatch" => (
                "counter_strafe_flick",
                serde_json::json!({
                    "strafe_speed": 60,
                    "angle_range": [15, 45],
                }),
                "스타일 전환: 무빙 사격 패턴 적응 훈련",
            ),
            "transition_narrowed" => (
                "multi_flick",
                serde_json::json!({
                    "angle_range": [60, 150],
                    "target_count": 20,
                }),
                "전환 영역 확장: 넓은 각도 멀티 플릭 훈련",
            ),
            "vertical_weakness_exposed" => (
                "aerial_tracking",
                serde_json::json!({
                    "vertical_emphasis": true,
                    "speed_range": [20, 80],
                }),
                "수직 약점 보완: 에어리얼 트래킹 집중 훈련",
            ),
            _ => continue,
        };

        prescriptions.push(crate::training::TrainingPrescription {
            weakness: cause.cause_type.clone(),
            scenario_type: scenario_type.to_string(),
            scenario_params: params,
            priority: cause.severity,
            estimated_min: 10.0,
            source_type: "cross_game".to_string(),
            description: description.to_string(),
        });
    }

    // 우선순위 내림차순 정렬
    prescriptions.sort_by(|a, b| b.priority.partial_cmp(&a.priority).unwrap_or(std::cmp::Ordering::Equal));
    prescriptions
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::aim_dna::AimDnaProfile;

    /// 동일한 DNA → 갭 0
    #[test]
    fn test_compare_identical_dna() {
        let dna = AimDnaProfile {
            overshoot_avg: Some(0.1),
            tracking_mad: Some(2.0),
            ..AimDnaProfile::empty(1, 1)
        };
        let comparison = compare_games(&dna, &dna, 0.3, 0.3, 1, 0.0);
        // 동일 값 → 델타 0
        for delta in &comparison.deltas {
            assert!(delta.delta_pct.abs() < 1e-6);
        }
    }

    /// 큰 오버슈트 차이 → sens_mismatch 원인 감지
    #[test]
    fn test_sens_mismatch_cause() {
        let ref_dna = AimDnaProfile {
            overshoot_avg: Some(0.05),
            tracking_mad: Some(1.5),
            ..AimDnaProfile::empty(1, 1)
        };
        let target_dna = AimDnaProfile {
            overshoot_avg: Some(0.15),
            tracking_mad: Some(1.8),
            ..AimDnaProfile::empty(2, 2)
        };
        let comparison = compare_games(&ref_dna, &target_dna, 0.3, 0.3, 1, 5.0);
        assert!(comparison.causes.iter().any(|c| c.cause_type == "sens_mismatch"));
    }

    /// 타임라인 예측 — 갭 클수록 오래 걸림
    #[test]
    fn test_timeline_prediction() {
        let deltas = vec![
            FeatureDelta {
                feature: "tracking_mad".into(),
                ref_value: 1.0,
                target_value: 3.0,
                delta_pct: 200.0,
                severity: "critical".into(),
            },
            FeatureDelta {
                feature: "overshoot_avg".into(),
                ref_value: 0.05,
                target_value: 0.08,
                delta_pct: 60.0,
                severity: "major".into(),
            },
        ];
        let timeline = predict_timeline(&deltas, 1.0, 5.0);
        assert!(timeline.total_days > 0.0);
        assert_eq!(timeline.bottleneck_feature, "tracking_mad");
    }

    /// 개선 플랜 — 항상 4 Phase
    #[test]
    fn test_improvement_plan_phases() {
        let causes = vec![GapCause {
            cause_type: "sens_mismatch".into(),
            description: "test".into(),
            contributing_features: vec![],
            severity: 50.0,
        }];
        let plan = generate_improvement_plan(&causes, &[]);
        assert_eq!(plan.phases.len(), 4);
        assert_eq!(plan.phases[0].phase, 1);
        assert_eq!(plan.phases[3].phase, 4);
    }
}
