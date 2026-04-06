//! Aim DNA 전체 프로파일 산출 엔진
//! 배터리 완료 후 시나리오별 메트릭을 종합하여 26개 피처 추출
//! type_label 자동 분류 포함

pub mod commands;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 배터리 실행 후 프론트엔드에서 전달하는 시나리오별 메트릭
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryMetricsInput {
    pub profile_id: i64,
    pub session_id: i64,
    /// 시나리오별 raw 메트릭 (JSON 문자열)
    pub flick_metrics: Option<String>,
    pub tracking_metrics: Option<String>,
    pub circular_metrics: Option<String>,
    pub stochastic_metrics: Option<String>,
    pub counter_strafe_metrics: Option<String>,
    pub micro_flick_metrics: Option<String>,
    /// 향후 줌 시나리오 구현 시 사용 예정
    #[allow(dead_code)]
    pub zoom_metrics: Option<String>,
    /// 시나리오별 점수 (가중 합산용)
    pub scenario_scores: ScenarioScores,
}

/// 시나리오별 종합 점수
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioScores {
    pub flick: Option<f64>,
    pub tracking: Option<f64>,
    pub circular_tracking: Option<f64>,
    pub stochastic_tracking: Option<f64>,
    pub counter_strafe_flick: Option<f64>,
    pub micro_flick: Option<f64>,
    pub zoom_composite: Option<f64>,
}

/// Flick 시나리오 개별 타겟 메트릭
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlickTargetMetric {
    pub ttt: f64,
    pub overshoot: f64,
    #[serde(default)]
    pub correction_count: i32,
    #[serde(default)]
    pub settle_time: f64,
    pub path_efficiency: f64,
    pub hit: bool,
    pub angle_bucket: i32,
    pub direction: String,
    pub motor_region: String,
    pub click_type: String,
}

/// Tracking 시나리오 메트릭
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackingMetric {
    pub mad: f64,
    pub deviation_variance: f64,
    pub phase_lag: f64,
    pub velocity_match_ratio: f64,
}

/// MicroFlick 하이브리드 메트릭
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MicroFlickMetric {
    /// 향후 MicroFlick 분석 확장 시 사용 예정 (serde 역직렬화 대상)
    #[allow(dead_code)]
    pub tracking_mad: f64,
    pub tracking_velocity_match: f64,
    pub flick_hit_rate: f64,
    /// 향후 MicroFlick 분석 확장 시 사용 예정
    #[allow(dead_code)]
    pub flick_avg_ttt: f64,
    /// 향후 MicroFlick 분석 확장 시 사용 예정
    #[allow(dead_code)]
    pub avg_reacquire_time_ms: f64,
    /// 향후 MicroFlick 분석 확장 시 사용 예정
    #[allow(dead_code)]
    pub composite_score: f64,
}

/// Zoom 복합 메트릭 — 향후 줌 시나리오 활성화 시 사용 예정
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoomMetric {
    pub steady_score: f64,
    pub correction_score: f64,
    pub reacquisition_score: f64,
    pub composite_score: f64,
    pub over_correction_ratio: f64,
    pub under_correction_ratio: f64,
}

// ── 피처별 최소 데이터 요구량 상수 ──
const MIN_DIRECTION_BIAS_SHOTS: usize = 50;
const MIN_PHASE_LAG_SAMPLES: usize = 3;
const MIN_FITTS_HITS: usize = 40;
const MIN_MOTOR_TRANSITION_SHOTS: usize = 100;
const MIN_VH_RATIO_SHOTS: usize = 50;
const MIN_OVERSHOOT_SHOTS: usize = 20;
const MIN_TRACKING_SAMPLES: usize = 3;

/// 피처별 데이터 충족 상태
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureSufficiency {
    pub sufficient: bool,
    pub current_count: usize,
    pub required_count: usize,
}

/// 완성된 Aim DNA 프로파일 (26개 피처 + type_label)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AimDnaProfile {
    pub profile_id: i64,
    pub session_id: i64,
    pub flick_peak_velocity: Option<f64>,
    pub overshoot_avg: Option<f64>,
    pub direction_bias: Option<f64>,
    pub effective_range: Option<f64>,
    pub tracking_mad: Option<f64>,
    pub phase_lag: Option<f64>,
    pub smoothness: Option<f64>,
    pub velocity_match: Option<f64>,
    pub micro_freq: Option<f64>,
    pub wrist_arm_ratio: Option<f64>,
    pub fitts_a: Option<f64>,
    pub fitts_b: Option<f64>,
    pub fatigue_decay: Option<f64>,
    pub pre_aim_ratio: Option<f64>,
    pub pre_fire_ratio: Option<f64>,
    pub sens_attributed_overshoot: Option<f64>,
    pub v_h_ratio: Option<f64>,
    pub finger_accuracy: Option<f64>,
    pub wrist_accuracy: Option<f64>,
    pub arm_accuracy: Option<f64>,
    pub motor_transition_angle: Option<f64>,
    pub type_label: Option<String>,
    /// 피처별 데이터 충족 상태 (DB에는 저장하지 않음, 계산 시점에만 사용)
    #[serde(default)]
    pub data_sufficiency: HashMap<String, FeatureSufficiency>,
}

impl AimDnaProfile {
    /// 빈 프로파일 생성 (테스트 및 외부 모듈용)
    pub fn empty(profile_id: i64, session_id: i64) -> Self {
        Self {
            profile_id,
            session_id,
            flick_peak_velocity: None,
            overshoot_avg: None,
            direction_bias: None,
            effective_range: None,
            tracking_mad: None,
            phase_lag: None,
            smoothness: None,
            velocity_match: None,
            micro_freq: None,
            wrist_arm_ratio: None,
            fitts_a: None,
            fitts_b: None,
            fatigue_decay: None,
            pre_aim_ratio: None,
            pre_fire_ratio: None,
            sens_attributed_overshoot: None,
            v_h_ratio: None,
            finger_accuracy: None,
            wrist_accuracy: None,
            arm_accuracy: None,
            motor_transition_angle: None,
            type_label: None,
            data_sufficiency: HashMap::new(),
        }
    }

    /// (feature_name, value) 쌍 목록 반환 — aim_dna_history 저장용
    pub fn to_feature_pairs(&self) -> Vec<(String, f64)> {
        let mut pairs = Vec::new();
        macro_rules! push_opt {
            ($name:expr, $val:expr) => {
                if let Some(v) = $val {
                    pairs.push(($name.to_string(), v));
                }
            };
        }
        push_opt!("flick_peak_velocity", self.flick_peak_velocity);
        push_opt!("overshoot_avg", self.overshoot_avg);
        push_opt!("direction_bias", self.direction_bias);
        push_opt!("effective_range", self.effective_range);
        push_opt!("tracking_mad", self.tracking_mad);
        push_opt!("phase_lag", self.phase_lag);
        push_opt!("smoothness", self.smoothness);
        push_opt!("velocity_match", self.velocity_match);
        push_opt!("micro_freq", self.micro_freq);
        push_opt!("wrist_arm_ratio", self.wrist_arm_ratio);
        push_opt!("fitts_a", self.fitts_a);
        push_opt!("fitts_b", self.fitts_b);
        push_opt!("fatigue_decay", self.fatigue_decay);
        push_opt!("pre_aim_ratio", self.pre_aim_ratio);
        push_opt!("pre_fire_ratio", self.pre_fire_ratio);
        push_opt!("sens_attributed_overshoot", self.sens_attributed_overshoot);
        push_opt!("v_h_ratio", self.v_h_ratio);
        push_opt!("finger_accuracy", self.finger_accuracy);
        push_opt!("wrist_accuracy", self.wrist_accuracy);
        push_opt!("arm_accuracy", self.arm_accuracy);
        push_opt!("motor_transition_angle", self.motor_transition_angle);
        pairs
    }
}

/// 데이터 충족 상태 기록 헬퍼
fn record_sufficiency(
    map: &mut HashMap<String, FeatureSufficiency>,
    name: &str,
    current: usize,
    required: usize,
) {
    map.insert(name.to_string(), FeatureSufficiency {
        sufficient: current >= required,
        current_count: current,
        required_count: required,
    });
}

/// 배터리 메트릭으로부터 전체 Aim DNA 프로파일 계산
pub fn compute_aim_dna(input: &BatteryMetricsInput) -> AimDnaProfile {
    let mut dna = AimDnaProfile::empty(input.profile_id, input.session_id);

    // ── Flick 계열 피처 추출 (데이터 충족 검사 포함) ──
    let flick_targets = parse_flick_metrics(input);
    let flick_count = flick_targets.len();

    if !flick_targets.is_empty() {
        // 기본 피처 (항상 계산)
        compute_basic_flick_features(&flick_targets, &mut dna);

        // direction_bias — 최소 50샷 필요
        record_sufficiency(&mut dna.data_sufficiency, "direction_bias", flick_count, MIN_DIRECTION_BIAS_SHOTS);
        if flick_count >= MIN_DIRECTION_BIAS_SHOTS {
            compute_direction_bias(&flick_targets, &mut dna);
        }

        // v_h_ratio — 최소 50샷 필요
        record_sufficiency(&mut dna.data_sufficiency, "v_h_ratio", flick_count, MIN_VH_RATIO_SHOTS);
        if flick_count >= MIN_VH_RATIO_SHOTS {
            compute_vh_ratio(&flick_targets, &mut dna);
        }

        // motor_transition_angle — 최소 100샷 필요
        record_sufficiency(&mut dna.data_sufficiency, "motor_transition_angle", flick_count, MIN_MOTOR_TRANSITION_SHOTS);

        // fitts — 최소 40샷 필요
        record_sufficiency(&mut dna.data_sufficiency, "fitts", flick_count, MIN_FITTS_HITS);
        if flick_count >= MIN_FITTS_HITS {
            compute_fitts_law(&flick_targets, &mut dna);
        }

        // effective_range, motor_features, sens_overshoot (기존 임계값 사용)
        compute_effective_range(&flick_targets, &mut dna);
        compute_motor_features(&flick_targets, &mut dna);
        compute_sens_overshoot(&flick_targets, &mut dna);

        // overshoot 충족 기록
        record_sufficiency(&mut dna.data_sufficiency, "overshoot_avg", flick_count, MIN_OVERSHOOT_SHOTS);
    }

    // ── Tracking 계열 피처 추출 ──
    let tracking_data = parse_tracking_metrics(input);
    let tracking_count = tracking_data.len();
    record_sufficiency(&mut dna.data_sufficiency, "tracking", tracking_count, MIN_TRACKING_SAMPLES);
    record_sufficiency(&mut dna.data_sufficiency, "phase_lag", tracking_count, MIN_PHASE_LAG_SAMPLES);

    if !tracking_data.is_empty() {
        compute_tracking_features(&tracking_data, &mut dna);
    }

    // ── MicroFlick 피처 ──
    if let Some(mf) = parse_micro_flick_metrics(input) {
        dna.micro_freq = Some(mf.flick_hit_rate * mf.tracking_velocity_match);
    }

    // ── 피로 감소율 계산 (전체 점수 추세) ──
    compute_fatigue_and_adaptation(input, &mut dna);

    // ── type_label 자동 분류 ──
    dna.type_label = Some(classify_type(&dna, &input.scenario_scores));

    dna
}

/// Flick + CounterStrafe 메트릭 파싱 (합산)
fn parse_flick_metrics(input: &BatteryMetricsInput) -> Vec<FlickTargetMetric> {
    let mut all = Vec::new();
    for s in [&input.flick_metrics, &input.counter_strafe_metrics].into_iter().flatten() {
        if let Ok(parsed) = serde_json::from_str::<Vec<FlickTargetMetric>>(s) {
            all.extend(parsed);
        }
    }
    all
}

/// Tracking 계열 메트릭 파싱 (tracking + circular + stochastic)
fn parse_tracking_metrics(input: &BatteryMetricsInput) -> Vec<TrackingMetric> {
    let mut all = Vec::new();
    for s in [&input.tracking_metrics, &input.circular_metrics, &input.stochastic_metrics].into_iter().flatten() {
        if let Ok(parsed) = serde_json::from_str::<TrackingMetric>(s) {
            all.push(parsed);
        }
    }
    all
}

/// MicroFlick 메트릭 파싱
fn parse_micro_flick_metrics(input: &BatteryMetricsInput) -> Option<MicroFlickMetric> {
    input.micro_flick_metrics.as_ref()
        .and_then(|s| match serde_json::from_str::<MicroFlickMetric>(s) {
            Ok(v) => Some(v),
            Err(e) => {
                log::warn!("MicroFlick 메트릭 JSON 파싱 실패: {}", e);
                None
            }
        })
}

/// Flick 기본 피처 계산 (threshold 불필요 — 데이터만 있으면 계산)
fn compute_basic_flick_features(targets: &[FlickTargetMetric], dna: &mut AimDnaProfile) {
    let n = targets.len() as f64;
    if n == 0.0 { return; }

    // 평균 오버슈트
    dna.overshoot_avg = Some(targets.iter().map(|t| t.overshoot).sum::<f64>() / n);

    // 피크 속도 추정 — TTT가 짧고 angle이 클수록 높은 속도
    let peak_vel: f64 = targets.iter()
        .filter(|t| t.ttt > 0.0)
        .map(|t| (t.angle_bucket as f64).to_radians() / (t.ttt / 1000.0))
        .fold(0.0_f64, |a, b| a.max(b));
    if peak_vel > 0.0 {
        dna.flick_peak_velocity = Some(peak_vel.to_degrees());
    }

    // Pre-aim / Pre-fire 비율
    let pre_aim_count = targets.iter().filter(|t| t.click_type == "PreAim").count() as f64;
    let pre_fire_count = targets.iter().filter(|t| t.click_type == "PreFire").count() as f64;
    dna.pre_aim_ratio = Some(pre_aim_count / n);
    dna.pre_fire_ratio = Some(pre_fire_count / n);
}

/// 방향 편향 계산 — 8방향 히트율의 균일도
fn compute_direction_bias(targets: &[FlickTargetMetric], dna: &mut AimDnaProfile) {
    let directions = ["right", "upper_right", "up", "upper_left",
                       "left", "lower_left", "down", "lower_right"];
    let mut dir_hits: Vec<f64> = Vec::new();

    for dir in &directions {
        let dir_targets: Vec<_> = targets.iter().filter(|t| t.direction == *dir).collect();
        if dir_targets.is_empty() { continue; }
        let hit_rate = dir_targets.iter().filter(|t| t.hit).count() as f64 / dir_targets.len() as f64;
        dir_hits.push(hit_rate);
    }

    if dir_hits.len() >= 2 {
        let mean = dir_hits.iter().sum::<f64>() / dir_hits.len() as f64;
        let variance = dir_hits.iter().map(|h| (h - mean).powi(2)).sum::<f64>() / dir_hits.len() as f64;
        // 정규화: 최대 분산 0.25 (히트율 0~1) → 0~1 범위
        dna.direction_bias = Some((variance / 0.25).min(1.0));
    }
}

/// 유효 사거리 — hit rate > 0.6인 최대 각도 구간
fn compute_effective_range(targets: &[FlickTargetMetric], dna: &mut AimDnaProfile) {
    let buckets = [10, 30, 60, 90, 120, 150, 180];
    let mut max_effective = 0;

    for &bucket in &buckets {
        let bucket_targets: Vec<_> = targets.iter().filter(|t| t.angle_bucket == bucket).collect();
        if bucket_targets.len() < 2 { continue; }
        let hit_rate = bucket_targets.iter().filter(|t| t.hit).count() as f64 / bucket_targets.len() as f64;
        if hit_rate >= 0.6 {
            max_effective = bucket;
        }
    }

    if max_effective > 0 {
        dna.effective_range = Some(max_effective as f64);
    }
}

/// Motor 관련 피처 (wrist_arm_ratio, 영역별 정확도, 전환 각도)
fn compute_motor_features(targets: &[FlickTargetMetric], dna: &mut AimDnaProfile) {
    let mut finger_total = 0usize;
    let mut finger_hits = 0usize;
    let mut wrist_total = 0usize;
    let mut wrist_hits = 0usize;
    let mut arm_total = 0usize;
    let mut arm_hits = 0usize;

    for t in targets {
        match t.motor_region.as_str() {
            "finger" => { finger_total += 1; if t.hit { finger_hits += 1; } }
            "wrist" => { wrist_total += 1; if t.hit { wrist_hits += 1; } }
            "arm" => { arm_total += 1; if t.hit { arm_hits += 1; } }
            _ => {}
        }
    }

    // wrist_arm_ratio
    let wrist_arm_sum = wrist_total + arm_total;
    if wrist_arm_sum > 0 {
        dna.wrist_arm_ratio = Some(wrist_total as f64 / wrist_arm_sum as f64);
    }

    // 영역별 정확도
    if finger_total > 0 { dna.finger_accuracy = Some(finger_hits as f64 / finger_total as f64); }
    if wrist_total > 0 { dna.wrist_accuracy = Some(wrist_hits as f64 / wrist_total as f64); }
    if arm_total > 0 { dna.arm_accuracy = Some(arm_hits as f64 / arm_total as f64); }

    // Motor transition angle — wrist 정확도 > arm 정확도인 최대 angle bucket
    let buckets = [10, 30, 60, 90, 120, 150, 180];
    let mut transition_angle = None;
    for &bucket in &buckets {
        let wrist_in_bucket: Vec<_> = targets.iter()
            .filter(|t| t.angle_bucket == bucket && t.motor_region == "wrist")
            .collect();
        let arm_in_bucket: Vec<_> = targets.iter()
            .filter(|t| t.angle_bucket == bucket && t.motor_region == "arm")
            .collect();

        if wrist_in_bucket.len() >= 2 && arm_in_bucket.len() >= 2 {
            let w_hit = wrist_in_bucket.iter().filter(|t| t.hit).count() as f64 / wrist_in_bucket.len() as f64;
            let a_hit = arm_in_bucket.iter().filter(|t| t.hit).count() as f64 / arm_in_bucket.len() as f64;
            if w_hit >= a_hit {
                transition_angle = Some(bucket as f64);
            }
        }
    }
    dna.motor_transition_angle = transition_angle;
}

/// V/H 비율 — 수직 방향 히트율 / 수평 방향 히트율
fn compute_vh_ratio(targets: &[FlickTargetMetric], dna: &mut AimDnaProfile) {
    let vertical = ["up", "down"];
    let horizontal = ["left", "right"];

    let v_targets: Vec<_> = targets.iter().filter(|t| vertical.contains(&t.direction.as_str())).collect();
    let h_targets: Vec<_> = targets.iter().filter(|t| horizontal.contains(&t.direction.as_str())).collect();

    if v_targets.len() >= 2 && h_targets.len() >= 2 {
        let v_rate = v_targets.iter().filter(|t| t.hit).count() as f64 / v_targets.len() as f64;
        let h_rate = h_targets.iter().filter(|t| t.hit).count() as f64 / h_targets.len() as f64;
        if h_rate > 0.0 {
            dna.v_h_ratio = Some(v_rate / h_rate);
        }
    }
}

/// Fitts' Law 피팅 — TTT = a + b * log2(2 * angle / target_size)
/// 타겟 크기 3도 가정
fn compute_fitts_law(targets: &[FlickTargetMetric], dna: &mut AimDnaProfile) {
    let target_size_deg = 3.0;
    let mut x_vals = Vec::new(); // log2(2 * angle / size)
    let mut y_vals = Vec::new(); // TTT

    let buckets = [10, 30, 60, 90, 120, 150, 180];
    for &bucket in &buckets {
        let bucket_hits: Vec<_> = targets.iter()
            .filter(|t| t.angle_bucket == bucket && t.hit && t.ttt > 0.0)
            .collect();
        if bucket_hits.is_empty() { continue; }
        let avg_ttt = bucket_hits.iter().map(|t| t.ttt).sum::<f64>() / bucket_hits.len() as f64;
        let id = (2.0 * bucket as f64 / target_size_deg).log2();
        x_vals.push(id);
        y_vals.push(avg_ttt);
    }

    // 최소 3점 필요
    if x_vals.len() < 3 { return; }

    // 단순 선형 회귀: y = a + b*x
    let n = x_vals.len() as f64;
    let sum_x: f64 = x_vals.iter().sum();
    let sum_y: f64 = y_vals.iter().sum();
    let sum_xy: f64 = x_vals.iter().zip(y_vals.iter()).map(|(x, y)| x * y).sum();
    let sum_x2: f64 = x_vals.iter().map(|x| x * x).sum();

    let denom = n * sum_x2 - sum_x * sum_x;
    if denom.abs() < 1e-12 { return; }

    let b = (n * sum_xy - sum_x * sum_y) / denom;
    let a = (sum_y - b * sum_x) / n;

    dna.fitts_a = Some(a);
    dna.fitts_b = Some(b);
}

/// 감도 귀인 오버슈트 — 이동 거리(angle)와 오버슈트 상관계수
fn compute_sens_overshoot(targets: &[FlickTargetMetric], dna: &mut AimDnaProfile) {
    let valid: Vec<_> = targets.iter()
        .filter(|t| t.overshoot > 0.0)
        .collect();
    if valid.len() < 5 { return; }

    let n = valid.len() as f64;
    let angles: Vec<f64> = valid.iter().map(|t| t.angle_bucket as f64).collect();
    let overshoots: Vec<f64> = valid.iter().map(|t| t.overshoot).collect();

    let mean_a = angles.iter().sum::<f64>() / n;
    let mean_o = overshoots.iter().sum::<f64>() / n;

    let cov: f64 = angles.iter().zip(overshoots.iter())
        .map(|(a, o)| (a - mean_a) * (o - mean_o))
        .sum::<f64>() / n;
    let var_a: f64 = angles.iter().map(|a| (a - mean_a).powi(2)).sum::<f64>() / n;
    let var_o: f64 = overshoots.iter().map(|o| (o - mean_o).powi(2)).sum::<f64>() / n;

    let denom = (var_a * var_o).sqrt();
    if denom > 1e-12 {
        dna.sens_attributed_overshoot = Some(cov / denom);
    }
}

/// Tracking 계열 피처 계산
fn compute_tracking_features(data: &[TrackingMetric], dna: &mut AimDnaProfile) {
    let n = data.len() as f64;
    if n == 0.0 { return; }

    dna.tracking_mad = Some(data.iter().map(|t| t.mad).sum::<f64>() / n);
    dna.phase_lag = Some(data.iter().map(|t| t.phase_lag).sum::<f64>() / n);
    dna.velocity_match = Some(data.iter().map(|t| t.velocity_match_ratio).sum::<f64>() / n);

    // smoothness = 편차 분산의 역수 (높을수록 부드러움)
    let avg_var = data.iter().map(|t| t.deviation_variance).sum::<f64>() / n;
    if avg_var > 1e-12 {
        dna.smoothness = Some((1.0 / avg_var).min(100.0));
    }
}

/// 피로 감소율 + 적응 속도 계산
fn compute_fatigue_and_adaptation(input: &BatteryMetricsInput, dna: &mut AimDnaProfile) {
    let scores = &input.scenario_scores;
    let all_scores: Vec<f64> = [
        scores.flick, scores.tracking, scores.circular_tracking,
        scores.stochastic_tracking, scores.counter_strafe_flick,
        scores.micro_flick, scores.zoom_composite,
    ].iter().filter_map(|s| *s).collect();

    if all_scores.len() < 4 { return; }

    // 피로 감소율: (전반부 평균 - 후반부 평균) / 전반부 평균
    let mid = all_scores.len() / 2;
    let first_half = all_scores[..mid].iter().sum::<f64>() / mid as f64;
    let second_half = all_scores[mid..].iter().sum::<f64>() / (all_scores.len() - mid) as f64;

    if first_half > 0.0 {
        dna.fatigue_decay = Some((first_half - second_half) / first_half);
    }
}

/// type_label 자동 분류
fn classify_type(dna: &AimDnaProfile, scores: &ScenarioScores) -> String {
    let war = dna.wrist_arm_ratio.unwrap_or(0.5);
    let pre_aim = dna.pre_aim_ratio.unwrap_or(0.0);
    let pre_fire = dna.pre_fire_ratio.unwrap_or(0.0);
    let overshoot = dna.overshoot_avg.unwrap_or(0.0);

    // 플릭 vs 트래킹 점수 비교
    let flick_score = [scores.flick, scores.counter_strafe_flick]
        .iter().filter_map(|s| *s).sum::<f64>();
    let tracking_score = [scores.tracking, scores.circular_tracking, scores.stochastic_tracking]
        .iter().filter_map(|s| *s).sum::<f64>();

    // 손목 주도 플릭커
    if war > 0.65 && flick_score > tracking_score * 1.2 {
        return "wrist-flicker".to_string();
    }

    // 팔 주도 트래커
    if war < 0.4 && tracking_score > flick_score * 1.2 {
        return "arm-tracker".to_string();
    }

    // 정밀형 — pre_aim 높고 오버슈트 낮음
    if pre_aim > 0.5 && overshoot < 0.05 {
        return "precision".to_string();
    }

    // 반응형 — pre_fire 높고 빠른 TTT
    if pre_fire > 0.4 {
        return "reactive".to_string();
    }

    // 나머지 = 하이브리드
    "hybrid".to_string()
}

// ── DNA 시계열 추세 분석 ──

/// DNA 추세 분석 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnaTrendResult {
    pub profile_id: i64,
    /// 재교정 추천 여부 (10% 이상 변화 피처 존재 시 true)
    pub recalibration_recommended: bool,
    /// 변화 감지된 피처 목록
    pub changed_features: Vec<FeatureTrendChange>,
    /// 안정 피처 수
    pub stable_feature_count: usize,
    /// 분석에 사용된 세션 수
    pub sessions_analyzed: usize,
}

/// 피처별 추세 변화
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureTrendChange {
    pub feature: String,
    pub prior_avg: f64,
    pub recent_avg: f64,
    pub change_pct: f64,
    /// "improved" | "degraded" | "stable"
    pub direction: String,
}

/// "낮을수록 좋은" 피처 목록 (감소 = 개선)
const LOWER_IS_BETTER: &[&str] = &[
    "overshoot_avg", "tracking_mad", "phase_lag", "fatigue_decay", "direction_bias",
];

/// DNA 시계열 추세 분석 — 최근 5세션 vs 이전 5세션 비교
/// 10% 이상 변화 감지 시 재교정 추천
pub fn analyze_dna_trend(
    profile_id: i64,
    history: &[(String, f64, String)],  // (feature_name, value, measured_at)
) -> DnaTrendResult {
    // 피처별로 그룹화
    let mut by_feature: HashMap<String, Vec<(f64, String)>> = HashMap::new();
    for (name, val, date) in history {
        by_feature.entry(name.clone()).or_default().push((*val, date.clone()));
    }

    let mut changed_features = Vec::new();
    let mut stable_count = 0usize;
    let mut total_sessions = 0usize;

    for (feature, mut entries) in by_feature {
        // measured_at 내림차순 정렬
        entries.sort_by(|a, b| b.1.cmp(&a.1));

        // 최소 6개 이상의 데이터 포인트 필요 (최근 3 + 이전 3)
        if entries.len() < 6 {
            continue;
        }

        total_sessions = total_sessions.max(entries.len());

        // 최근 5세션 평균
        let recent_count = entries.len().min(5);
        let recent_avg = entries[..recent_count].iter().map(|(v, _)| v).sum::<f64>() / recent_count as f64;

        // 이전 5세션 평균 (6~10번째)
        let prior_start = recent_count;
        let prior_end = (prior_start + 5).min(entries.len());
        if prior_end <= prior_start { continue; }
        let prior_count = prior_end - prior_start;
        let prior_avg = entries[prior_start..prior_end].iter().map(|(v, _)| v).sum::<f64>() / prior_count as f64;

        // 변화율 계산
        let change_pct = if prior_avg.abs() > 1e-6 {
            (recent_avg - prior_avg) / prior_avg.abs() * 100.0
        } else {
            0.0
        };

        // 방향 결정
        let is_lower_better = LOWER_IS_BETTER.contains(&feature.as_str());
        let direction = if change_pct.abs() < 10.0 {
            "stable"
        } else if (is_lower_better && change_pct < 0.0) || (!is_lower_better && change_pct > 0.0) {
            "improved"
        } else {
            "degraded"
        };

        if direction == "stable" {
            stable_count += 1;
        } else {
            changed_features.push(FeatureTrendChange {
                feature,
                prior_avg,
                recent_avg,
                change_pct,
                direction: direction.to_string(),
            });
        }
    }

    // 변화율 절대값 내림차순 정렬
    changed_features.sort_by(|a, b| b.change_pct.abs().partial_cmp(&a.change_pct.abs()).unwrap_or(std::cmp::Ordering::Equal));

    let recalibration_recommended = changed_features.iter().any(|f| f.change_pct.abs() >= 10.0);

    DnaTrendResult {
        profile_id,
        recalibration_recommended,
        changed_features,
        stable_feature_count: stable_count,
        sessions_analyzed: total_sessions,
    }
}

// ── Reference Game 자동 감지 ──

/// 레퍼런스 게임 감지 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceGameResult {
    pub reference_profile_id: Option<i64>,
    /// (profile_id, composite_score) 목록
    pub scores: Vec<(i64, f64)>,
}

/// 레퍼런스 게임 자동 감지 — 프로파일별 composite_score 기반
/// composite = accuracy×0.3 + consistency×0.25 + range×0.25 + smoothness×0.2
pub fn detect_reference_game(
    profile_dnas: &[(i64, AimDnaProfile)],
) -> ReferenceGameResult {
    if profile_dnas.is_empty() {
        return ReferenceGameResult { reference_profile_id: None, scores: Vec::new() };
    }

    let mut scores = Vec::new();

    for (pid, dna) in profile_dnas {
        // accuracy = 3영역 정확도 평균
        let accs: Vec<f64> = [dna.finger_accuracy, dna.wrist_accuracy, dna.arm_accuracy]
            .iter().filter_map(|a| *a).collect();
        let accuracy = if accs.is_empty() { 0.0 } else { accs.iter().sum::<f64>() / accs.len() as f64 };

        // consistency = 1 - direction_bias (bias 낮을수록 일관성 높음)
        let consistency = 1.0 - dna.direction_bias.unwrap_or(1.0);

        // range = effective_range / 180 (0~1 정규화)
        let range = dna.effective_range.unwrap_or(0.0) / 180.0;

        // smoothness 정규화 (0~100 → 0~1)
        let smoothness_norm = (dna.smoothness.unwrap_or(0.0) / 100.0).min(1.0);

        let composite = accuracy * 0.30 + consistency * 0.25 + range * 0.25 + smoothness_norm * 0.20;
        scores.push((*pid, composite));
    }

    // 최고 점수 프로파일
    let reference_profile_id = scores.iter()
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(pid, _)| *pid);

    ReferenceGameResult { reference_profile_id, scores }
}

// ── 레이더 5축 점수 계산 (스냅샷 저장용) ─────────────────────────────────────

/// 5축 레이더 점수 — TypeScript radarUtils.ts 와 동일한 공식
pub struct RadarAxes {
    pub flick_power: f64,
    pub tracking_precision: f64,
    pub motor_control: f64,
    pub speed: f64,
    pub consistency: f64,
}

/// AimDnaProfile → 5축 레이더 점수 (0~100 정규화)
/// TypeScript computeRadarAxes()와 동일 로직 — 두 환경에서 일관성 유지
pub fn compute_radar_axes(dna: &AimDnaProfile) -> RadarAxes {
    // Flick Power: peak_velocity(0~2000°/s) + effective_range(0~180°) 평균
    let vel_norm = (dna.flick_peak_velocity.unwrap_or(0.0) / 2000.0 * 100.0).min(100.0);
    let range_norm = (dna.effective_range.unwrap_or(0.0) / 180.0 * 100.0).min(100.0);
    let flick_power = (vel_norm + range_norm) / 2.0;

    // Tracking Precision: MAD 역수 + velocity_match
    let mad_norm = (100.0 - dna.tracking_mad.unwrap_or(0.3) * 333.0).max(0.0);
    let vm_norm = dna.velocity_match.unwrap_or(0.0) * 100.0;
    let tracking_precision = (mad_norm + vm_norm) / 2.0;

    // Motor Control: 3영역 정확도 평균 + wrist_arm_ratio 균형 보너스
    let f_acc = dna.finger_accuracy.unwrap_or(0.0) * 100.0;
    let w_acc = dna.wrist_accuracy.unwrap_or(0.0) * 100.0;
    let a_acc = dna.arm_accuracy.unwrap_or(0.0) * 100.0;
    let avg_acc = (f_acc + w_acc + a_acc) / 3.0;
    let balance_bonus = (1.0 - (dna.wrist_arm_ratio.unwrap_or(0.5) - 0.5).abs() * 2.0) * 20.0;
    let motor_control = (avg_acc + balance_bonus).min(100.0);

    // Speed: fitts_b 역수 (낮을수록 빠름)
    let fitts_b = dna.fitts_b.unwrap_or(200.0);
    let speed = ((300.0 - fitts_b) / 250.0 * 100.0).clamp(0.0, 100.0);

    // Consistency: direction_bias 역수 + v_h_ratio→1 근접도 + fatigue 역수
    let bias_norm = (1.0 - dna.direction_bias.unwrap_or(0.0)) * 100.0;
    let vh_norm = (100.0 - (dna.v_h_ratio.unwrap_or(1.0) - 1.0).abs() * 100.0).max(0.0);
    let fatigue_norm = (100.0 - dna.fatigue_decay.unwrap_or(0.0).abs() * 200.0).max(0.0);
    let consistency = (bias_norm + vh_norm + fatigue_norm) / 3.0;

    RadarAxes { flick_power, tracking_precision, motor_control, speed, consistency }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 빈 입력으로도 패닉 없이 프로파일 생성
    #[test]
    fn test_compute_empty_input() {
        let input = BatteryMetricsInput {
            profile_id: 1,
            session_id: 1,
            flick_metrics: None,
            tracking_metrics: None,
            circular_metrics: None,
            stochastic_metrics: None,
            counter_strafe_metrics: None,
            micro_flick_metrics: None,
            zoom_metrics: None,
            scenario_scores: ScenarioScores {
                flick: None, tracking: None, circular_tracking: None,
                stochastic_tracking: None, counter_strafe_flick: None,
                micro_flick: None, zoom_composite: None,
            },
        };
        let dna = compute_aim_dna(&input);
        assert_eq!(dna.profile_id, 1);
        assert_eq!(dna.type_label, Some("hybrid".to_string()));
    }

    /// Flick 메트릭에서 피처 추출 검증
    #[test]
    fn test_compute_flick_features() {
        let targets = vec![
            FlickTargetMetric {
                ttt: 300.0, overshoot: 0.1, correction_count: 1, settle_time: 50.0,
                path_efficiency: 0.8, hit: true, angle_bucket: 30,
                direction: "right".into(), motor_region: "wrist".into(), click_type: "PreAim".into(),
            },
            FlickTargetMetric {
                ttt: 400.0, overshoot: 0.2, correction_count: 2, settle_time: 80.0,
                path_efficiency: 0.6, hit: true, angle_bucket: 60,
                direction: "up".into(), motor_region: "arm".into(), click_type: "Flick".into(),
            },
            FlickTargetMetric {
                ttt: 250.0, overshoot: 0.05, correction_count: 0, settle_time: 30.0,
                path_efficiency: 0.9, hit: false, angle_bucket: 10,
                direction: "left".into(), motor_region: "finger".into(), click_type: "PreAim".into(),
            },
        ];

        let mut dna = AimDnaProfile::empty(1, 1);
        compute_basic_flick_features(&targets, &mut dna);
        compute_direction_bias(&targets, &mut dna);
        compute_effective_range(&targets, &mut dna);
        compute_motor_features(&targets, &mut dna);
        compute_vh_ratio(&targets, &mut dna);
        compute_fitts_law(&targets, &mut dna);
        compute_sens_overshoot(&targets, &mut dna);

        // 평균 오버슈트
        let expected_overshoot = (0.1 + 0.2 + 0.05) / 3.0;
        assert!((dna.overshoot_avg.unwrap() - expected_overshoot).abs() < 0.001);

        // pre_aim_ratio = 2/3
        assert!((dna.pre_aim_ratio.unwrap() - 2.0 / 3.0).abs() < 0.001);

        // wrist_arm_ratio = 1 / (1+1) = 0.5
        assert!((dna.wrist_arm_ratio.unwrap() - 0.5).abs() < 0.001);
    }

    /// Tracking 피처 추출 검증
    #[test]
    fn test_compute_tracking_features() {
        let data = vec![
            TrackingMetric { mad: 0.05, deviation_variance: 0.01, phase_lag: 80.0, velocity_match_ratio: 0.85 },
            TrackingMetric { mad: 0.03, deviation_variance: 0.005, phase_lag: 60.0, velocity_match_ratio: 0.92 },
        ];

        let mut dna = AimDnaProfile::empty(1, 1);
        compute_tracking_features(&data, &mut dna);

        assert!((dna.tracking_mad.unwrap() - 0.04).abs() < 0.001);
        assert!((dna.phase_lag.unwrap() - 70.0).abs() < 0.001);
        assert!((dna.velocity_match.unwrap() - 0.885).abs() < 0.001);
        assert!(dna.smoothness.unwrap() > 0.0);
    }

    /// Fitts' Law 피팅 — 양의 기울기 확인
    #[test]
    fn test_fitts_law() {
        let targets: Vec<FlickTargetMetric> = [10, 30, 60, 90, 120].iter().flat_map(|&angle| {
            let ttt = 200.0 + angle as f64 * 2.0; // 거리에 비례하는 TTT
            (0..5).map(move |_| FlickTargetMetric {
                ttt, overshoot: 0.05, correction_count: 0, settle_time: 30.0,
                path_efficiency: 0.8, hit: true, angle_bucket: angle,
                direction: "right".into(), motor_region: "wrist".into(), click_type: "Flick".into(),
            })
        }).collect();

        let mut dna = AimDnaProfile::empty(1, 1);
        compute_fitts_law(&targets, &mut dna);

        assert!(dna.fitts_a.is_some(), "fitts_a 계산 필요");
        assert!(dna.fitts_b.is_some(), "fitts_b 계산 필요");
        assert!(dna.fitts_b.unwrap() > 0.0, "TTT가 거리에 비례 → 양의 기울기");
    }

    /// type_label 분류 — wrist-flicker
    #[test]
    fn test_classify_wrist_flicker() {
        let dna = AimDnaProfile {
            wrist_arm_ratio: Some(0.75),
            pre_aim_ratio: Some(0.2),
            pre_fire_ratio: Some(0.1),
            overshoot_avg: Some(0.1),
            ..AimDnaProfile::empty(1, 1)
        };
        let scores = ScenarioScores {
            flick: Some(80.0), tracking: Some(50.0),
            circular_tracking: None, stochastic_tracking: None,
            counter_strafe_flick: Some(75.0), micro_flick: None, zoom_composite: None,
        };
        assert_eq!(classify_type(&dna, &scores), "wrist-flicker");
    }

    /// type_label 분류 — precision
    #[test]
    fn test_classify_precision() {
        let dna = AimDnaProfile {
            wrist_arm_ratio: Some(0.5),
            pre_aim_ratio: Some(0.6),
            pre_fire_ratio: Some(0.1),
            overshoot_avg: Some(0.02),
            ..AimDnaProfile::empty(1, 1)
        };
        let scores = ScenarioScores {
            flick: Some(70.0), tracking: Some(70.0),
            circular_tracking: None, stochastic_tracking: None,
            counter_strafe_flick: None, micro_flick: None, zoom_composite: None,
        };
        assert_eq!(classify_type(&dna, &scores), "precision");
    }

    /// to_feature_pairs — None 제외 확인
    #[test]
    fn test_feature_pairs() {
        let dna = AimDnaProfile {
            overshoot_avg: Some(0.1),
            wrist_arm_ratio: Some(0.6),
            ..AimDnaProfile::empty(1, 1)
        };
        let pairs = dna.to_feature_pairs();
        assert_eq!(pairs.len(), 2);
        assert!(pairs.iter().any(|(k, _)| k == "overshoot_avg"));
        assert!(pairs.iter().any(|(k, _)| k == "wrist_arm_ratio"));
    }

    /// 데이터 부족 시 threshold 미달 피처는 None + sufficiency false
    #[test]
    fn test_data_sufficiency_below_threshold() {
        // 10개 flick 타겟만 제공 (direction_bias 50, v_h_ratio 50, fitts 40 미달)
        let targets: Vec<FlickTargetMetric> = (0..10).map(|i| FlickTargetMetric {
            ttt: 300.0, overshoot: 0.1, correction_count: 1, settle_time: 50.0,
            path_efficiency: 0.8, hit: true, angle_bucket: 30,
            direction: "right".into(), motor_region: "wrist".into(),
            click_type: if i % 2 == 0 { "PreAim" } else { "Flick" }.into(),
        }).collect();
        let metrics_json = serde_json::to_string(&targets).unwrap();

        let input = BatteryMetricsInput {
            profile_id: 1, session_id: 1,
            flick_metrics: Some(metrics_json),
            tracking_metrics: None, circular_metrics: None, stochastic_metrics: None,
            counter_strafe_metrics: None, micro_flick_metrics: None, zoom_metrics: None,
            scenario_scores: ScenarioScores {
                flick: Some(70.0), tracking: None, circular_tracking: None,
                stochastic_tracking: None, counter_strafe_flick: None,
                micro_flick: None, zoom_composite: None,
            },
        };
        let dna = compute_aim_dna(&input);

        // direction_bias는 계산되지 않아야 함
        assert!(dna.direction_bias.is_none(), "10샷으로는 direction_bias 불가");
        assert!(!dna.data_sufficiency["direction_bias"].sufficient);
        assert_eq!(dna.data_sufficiency["direction_bias"].current_count, 10);
        assert_eq!(dna.data_sufficiency["direction_bias"].required_count, 50);

        // v_h_ratio도 계산되지 않아야 함
        assert!(dna.v_h_ratio.is_none(), "10샷으로는 v_h_ratio 불가");
        assert!(!dna.data_sufficiency["v_h_ratio"].sufficient);

        // 기본 피처(overshoot_avg 등)는 계산되어야 함
        assert!(dna.overshoot_avg.is_some(), "기본 피처는 항상 계산");
    }
}
