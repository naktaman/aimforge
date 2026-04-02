//! Aim DNA IPC 커맨드 — 배터리 결과 → DNA 산출, 조회, 히스토리, 스냅샷, 변경점

use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

use super::{
    compute_aim_dna, analyze_dna_trend, detect_reference_game,
    compute_radar_axes,
    AimDnaProfile, BatteryMetricsInput, DnaTrendResult, ReferenceGameResult,
};

// ──────────────────────────────────────────────────────────────────────────────
// DNA 스냅샷 타입
// ──────────────────────────────────────────────────────────────────────────────

/// DNA 시계열 스냅샷 — 5축 레이더 점수 + 측정 컨텍스트
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DnaSnapshot {
    pub id: i64,
    pub profile_id: i64,
    pub aim_dna_id: i64,
    pub flick_power: f64,
    pub tracking_precision: f64,
    pub motor_control: f64,
    pub speed: f64,
    pub consistency: f64,
    pub type_label: Option<String>,
    pub cm360_sensitivity: Option<f64>,
    pub measured_at: String,
}

/// 변경점 이벤트 — 기어/감도/그립/자세 변경 마킹
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnaChangeEvent {
    pub id: i64,
    pub profile_id: i64,
    pub change_type: String,
    pub before_value: Option<String>,
    pub after_value: String,
    pub description: String,
    pub occurred_at: String,
}

/// 두 스냅샷 비교 결과
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotComparison {
    pub before: DnaSnapshot,
    pub after: DnaSnapshot,
    /// 각 축별 변화 (after - before, 절대값 및 %)
    pub deltas: Vec<AxisDelta>,
    /// 총평 텍스트 목록 ("Tracking이 15% 향상되었습니다" 등)
    pub insights: Vec<String>,
}

/// 단일 축 변화
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AxisDelta {
    pub axis: String,
    pub before_val: f64,
    pub after_val: f64,
    pub delta_abs: f64,
    pub delta_pct: f64,
    pub direction: String, // "improved" | "degraded" | "stable"
}

/// 정체기 감지 결과
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StagnationResult {
    pub profile_id: i64,
    /// 정체 중인 축 이름 목록
    pub stagnant_axes: Vec<String>,
    pub is_stagnant: bool,
    /// 정체기 탈출 제안 메시지
    pub suggestions: Vec<String>,
}

/// Aim DNA 산출 요청 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeAimDnaParams {
    pub input: BatteryMetricsInput,
}

/// Aim DNA 산출 — 배터리 메트릭을 받아 26개 피처 계산 후 DB 저장
/// 자동으로 DNA 스냅샷(5축 점수)도 함께 저장
#[tauri::command]
pub fn compute_aim_dna_cmd(
    state: State<AppState>,
    params: ComputeAimDnaParams,
) -> Result<AimDnaProfile, String> {
    let dna = compute_aim_dna(&params.input);

    // DB 저장
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let dna_id = db.insert_aim_dna(&dna).map_err(|e| e.to_string())?;

    // 히스토리 저장
    let pairs = dna.to_feature_pairs();
    db.insert_aim_dna_history_batch(dna.profile_id, &pairs)
        .map_err(|e| e.to_string())?;

    // 5축 레이더 점수 계산 → 스냅샷 저장
    let axes = compute_radar_axes(&dna);
    let _ = db.insert_dna_snapshot(
        dna.profile_id,
        dna_id,
        axes.flick_power,
        axes.tracking_precision,
        axes.motor_control,
        axes.speed,
        axes.consistency,
        dna.type_label.as_deref(),
        None, // cm360는 프론트에서 전달 불가, 추후 확장
    );

    // 레퍼런스 게임 자동 재감지 (배터리 완료마다 실행)
    if let Ok(all_dnas) = db.get_all_profiles_latest_dna() {
        if all_dnas.len() >= 2 {
            let result = detect_reference_game(&all_dnas);
            if let Some(ref_id) = result.reference_profile_id {
                let _ = db.set_reference_game(ref_id);
            }
        }
    }

    Ok(dna)
}

/// Aim DNA 조회 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetAimDnaParams {
    pub profile_id: i64,
}

/// 최신 Aim DNA 프로파일 조회
#[tauri::command]
pub fn get_aim_dna(
    state: State<AppState>,
    params: GetAimDnaParams,
) -> Result<Option<AimDnaProfile>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_latest_aim_dna(params.profile_id).map_err(|e| e.to_string())
}

/// Aim DNA 히스토리 조회 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetAimDnaHistoryParams {
    pub profile_id: i64,
    pub feature_name: Option<String>,
}

/// Aim DNA 히스토리 항목
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AimDnaHistoryEntry {
    pub feature_name: String,
    pub value: f64,
    pub measured_at: String,
}

/// Aim DNA 변화 히스토리 조회
#[tauri::command]
pub fn get_aim_dna_history(
    state: State<AppState>,
    params: GetAimDnaHistoryParams,
) -> Result<Vec<AimDnaHistoryEntry>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_aim_dna_history(params.profile_id, params.feature_name.as_deref())
        .map_err(|e| e.to_string())
}

/// 세션 목록 조회 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSessionsParams {
    pub profile_id: i64,
    pub limit: Option<i64>,
}

/// 세션 요약 정보
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: i64,
    pub mode: String,
    pub session_type: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub total_trials: i64,
    pub avg_fps: Option<f64>,
}

/// 세션 히스토리 목록 조회
#[tauri::command]
pub fn get_sessions_history(
    state: State<AppState>,
    params: GetSessionsParams,
) -> Result<Vec<SessionSummary>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_sessions_list(params.profile_id, params.limit.unwrap_or(50))
        .map_err(|e| e.to_string())
}

/// 세션 상세 조회 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSessionDetailParams {
    pub session_id: i64,
}

/// 트라이얼 요약
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrialSummary {
    pub id: i64,
    pub scenario_type: String,
    pub cm360_tested: f64,
    pub composite_score: f64,
    pub created_at: String,
}

/// 세션 상세 (트라이얼 포함)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDetail {
    pub session: SessionSummary,
    pub trials: Vec<TrialSummary>,
}

/// 세션 상세 조회
#[tauri::command]
pub fn get_session_detail(
    state: State<AppState>,
    params: GetSessionDetailParams,
) -> Result<SessionDetail, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_session_detail(params.session_id).map_err(|e| e.to_string())
}

// ── DNA 추세 분석 ──

/// DNA 추세 분석 요청 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetDnaTrendParams {
    pub profile_id: i64,
}

/// DNA 시계열 추세 분석 — 재교정 필요 여부 판단
#[tauri::command]
pub fn get_dna_trend_cmd(
    state: State<AppState>,
    params: GetDnaTrendParams,
) -> Result<DnaTrendResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let history_entries = db
        .get_aim_dna_history(params.profile_id, None)
        .map_err(|e| e.to_string())?;

    // AimDnaHistoryEntry → (name, value, measured_at) 튜플 변환
    let tuples: Vec<(String, f64, String)> = history_entries
        .into_iter()
        .map(|e| (e.feature_name, e.value, e.measured_at))
        .collect();

    Ok(analyze_dna_trend(params.profile_id, &tuples))
}

// ── 레퍼런스 게임 감지 ──

/// 레퍼런스 게임 자동 감지 — 모든 프로파일 DNA 비교
#[tauri::command]
pub fn detect_reference_game_cmd(
    state: State<AppState>,
) -> Result<ReferenceGameResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let all_dnas = db.get_all_profiles_latest_dna().map_err(|e| e.to_string())?;
    let result = detect_reference_game(&all_dnas);

    // 결과 반영
    if let Some(ref_id) = result.reference_profile_id {
        db.set_reference_game(ref_id).map_err(|e| e.to_string())?;
    }

    Ok(result)
}

// ── DNA 스냅샷 + 변경점 이벤트 커맨드 ──────────────────────────────────────

/// DNA 스냅샷 목록 조회 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetDnaSnapshotsParams {
    pub profile_id: i64,
    pub limit: Option<i64>,
}

/// DNA 시계열 스냅샷 목록 조회 — 최근 N회 (기본 30회)
#[tauri::command]
pub fn get_dna_snapshots_cmd(
    state: State<AppState>,
    params: GetDnaSnapshotsParams,
) -> Result<Vec<DnaSnapshot>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_dna_snapshots(params.profile_id, params.limit.unwrap_or(30))
        .map_err(|e| e.to_string())
}

/// 변경점 이벤트 저장 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveChangeEventParams {
    pub profile_id: i64,
    pub change_type: String,
    pub before_value: Option<String>,
    pub after_value: String,
    pub description: String,
}

/// 변경점 이벤트 저장 — 기어/감도/그립/자세 변경 시 호출
#[tauri::command]
pub fn save_change_event_cmd(
    state: State<AppState>,
    params: SaveChangeEventParams,
) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_change_event(
        params.profile_id,
        &params.change_type,
        params.before_value.as_deref(),
        &params.after_value,
        &params.description,
    )
    .map_err(|e| e.to_string())
}

/// 변경점 이벤트 목록 조회 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetChangeEventsParams {
    pub profile_id: i64,
    pub limit: Option<i64>,
}

/// 변경점 이벤트 목록 조회
#[tauri::command]
pub fn get_change_events_cmd(
    state: State<AppState>,
    params: GetChangeEventsParams,
) -> Result<Vec<DnaChangeEvent>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_change_events(params.profile_id, params.limit.unwrap_or(50))
        .map_err(|e| e.to_string())
}

/// 두 스냅샷 비교 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareSnapshotsParams {
    pub before_id: i64,
    pub after_id: i64,
    pub profile_id: i64,
}

/// 두 스냅샷 비교 — 축별 변화 + 자동 인사이트 생성
#[tauri::command]
pub fn compare_snapshots_cmd(
    state: State<AppState>,
    params: CompareSnapshotsParams,
) -> Result<SnapshotComparison, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // 두 스냅샷 중 before/after 찾기 (1~2개 범위에서 탐색)
    let all = db.get_dna_snapshots(params.profile_id, 100).map_err(|e| e.to_string())?;

    let before = all.iter().find(|s| s.id == params.before_id)
        .cloned()
        .ok_or_else(|| format!("스냅샷 not found: {}", params.before_id))?;
    let after = all.iter().find(|s| s.id == params.after_id)
        .cloned()
        .ok_or_else(|| format!("스냅샷 not found: {}", params.after_id))?;

    // 축별 델타 계산
    let axes = [
        ("Flick Power",        before.flick_power,        after.flick_power),
        ("Tracking",           before.tracking_precision, after.tracking_precision),
        ("Motor Control",      before.motor_control,      after.motor_control),
        ("Speed",              before.speed,               after.speed),
        ("Consistency",        before.consistency,         after.consistency),
    ];

    let mut deltas = Vec::new();
    let mut insights = Vec::new();

    for (axis_name, bv, av) in &axes {
        let delta_abs = av - bv;
        // before가 0인 경우 delta_pct 계산 방지
        let delta_pct = if *bv > 0.0 { delta_abs / bv * 100.0 } else { 0.0 };
        let direction = if delta_pct > 2.0 {
            "improved"
        } else if delta_pct < -2.0 {
            "degraded"
        } else {
            "stable"
        };

        // 의미 있는 변화에 대해 인사이트 생성
        if direction == "improved" {
            insights.push(format!(
                "{axis_name}이(가) {delta_pct:.1}% 향상되었습니다 ({bv:.1} → {av:.1})"
            ));
        } else if direction == "degraded" {
            insights.push(format!(
                "{axis_name}이(가) {delta_pct:.1}% 하락했습니다 ({bv:.1} → {av:.1})"
            ));
        }

        deltas.push(AxisDelta {
            axis: axis_name.to_string(),
            before_val: *bv,
            after_val: *av,
            delta_abs,
            delta_pct,
            direction: direction.to_string(),
        });
    }

    if insights.is_empty() {
        insights.push("두 측정 간 유의미한 변화가 없습니다.".to_string());
    }

    Ok(SnapshotComparison { before, after, deltas, insights })
}

/// 정체기 감지 파라미터
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectStagnationParams {
    pub profile_id: i64,
}

/// 정체기 감지 — 최근 5회 측정에서 변화 < 2% 인 축 탐지
#[tauri::command]
pub fn detect_stagnation_cmd(
    state: State<AppState>,
    params: DetectStagnationParams,
) -> Result<StagnationResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let snapshots = db.get_dna_snapshots(params.profile_id, 5).map_err(|e| e.to_string())?;

    // 5회 미만이면 정체기 판단 불가
    if snapshots.len() < 5 {
        return Ok(StagnationResult {
            profile_id: params.profile_id,
            stagnant_axes: vec![],
            is_stagnant: false,
            suggestions: vec![],
        });
    }

    // 각 축의 최솟값·최댓값 범위로 변화량 계산
    let axes = [
        ("Flick Power",   snapshots.iter().map(|s| s.flick_power).collect::<Vec<_>>()),
        ("Tracking",      snapshots.iter().map(|s| s.tracking_precision).collect()),
        ("Motor Control", snapshots.iter().map(|s| s.motor_control).collect()),
        ("Speed",         snapshots.iter().map(|s| s.speed).collect()),
        ("Consistency",   snapshots.iter().map(|s| s.consistency).collect()),
    ];

    let stagnation_threshold_pct = 2.0_f64;
    let mut stagnant_axes = Vec::new();

    for (name, vals) in &axes {
        let min = vals.iter().cloned().fold(f64::INFINITY, f64::min);
        let max = vals.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let base = if min > 0.0 { min } else { 1.0 };
        let range_pct = (max - min) / base * 100.0;
        if range_pct < stagnation_threshold_pct {
            stagnant_axes.push(name.to_string());
        }
    }

    let is_stagnant = !stagnant_axes.is_empty();
    let suggestions: Vec<String> = stagnant_axes.iter().map(|axis| {
        match axis.as_str() {
            "Flick Power"   => "더 넓은 거리의 Flick 시나리오로 유효 범위를 확장해 보세요.".to_string(),
            "Tracking"      => "Stochastic Tracking 또는 예측 불가능한 이동 패턴을 연습하세요.".to_string(),
            "Motor Control" => "다른 DPI나 감도로 짧게 전환해 모터 적응력을 자극해 보세요.".to_string(),
            "Speed"         => "반응 속도 훈련(GoNoGo Drill)을 추가해 Fitts 기울기를 낮춰보세요.".to_string(),
            "Consistency"   => "피로 상태에서 연습을 줄이고 집중도 높은 짧은 세션을 유지하세요.".to_string(),
            other           => format!("{other} 훈련 방식에 변화를 주어 정체기를 돌파하세요."),
        }
    }).collect();

    Ok(StagnationResult {
        profile_id: params.profile_id,
        stagnant_axes,
        is_stagnant,
        suggestions,
    })
}
