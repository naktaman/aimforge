//! 훈련 시스템 Tauri IPC 커맨드

use crate::AppState;
use serde::Deserialize;
use tauri::State;

use super::{
    adapt_difficulty, generate_prescriptions, get_benchmark_presets, map_stage_to_dna_features,
    recommend_stages, DifficultyConfig, StageRecommendation, StageResult, TrainingPrescription,
};

/// 스테이지 결과 DB 행
#[derive(Debug, Clone, serde::Serialize)]
pub struct StageResultRow {
    pub id: i64,
    pub profile_id: i64,
    pub stage_type: String,
    pub category: String,
    pub score: f64,
    pub accuracy: f64,
    pub avg_ttk_ms: f64,
    pub avg_reaction_ms: f64,
    pub avg_overshoot_deg: f64,
    pub avg_undershoot_deg: f64,
    pub tracking_mad: Option<f64>,
    pub created_at: String,
}

/// 훈련 처방 생성 요청 파라미터
#[derive(Deserialize)]
pub struct GeneratePrescriptionsParams {
    pub profile_id: i64,
}

/// Aim DNA 기반 훈련 처방 생성
#[tauri::command]
pub fn generate_training_prescriptions(
    state: State<AppState>,
    params: GeneratePrescriptionsParams,
) -> Result<Vec<TrainingPrescription>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // 최신 Aim DNA 조회
    let dna = db
        .get_latest_aim_dna(params.profile_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Aim DNA 데이터가 없습니다. 먼저 배터리를 실행하세요.".to_string())?;

    let prescriptions = generate_prescriptions(&dna);

    // DB 저장 — aim_dna ID 조회 후 처방 저장
    let aim_dna_id = db
        .get_latest_aim_dna_id(params.profile_id)
        .map_err(|e| e.to_string())?
        .ok_or("aim_dna_id 조회 실패")?;

    for p in &prescriptions {
        db.insert_training_prescription(
            aim_dna_id,
            &p.source_type,
            &p.weakness,
            &p.scenario_type,
            &serde_json::to_string(&p.scenario_params).unwrap_or_default(),
            p.priority,
            Some(p.estimated_min),
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(prescriptions)
}

/// 스테이지 추천 목록 조회
#[tauri::command]
pub fn get_stage_recommendations(
    state: State<AppState>,
    params: GeneratePrescriptionsParams,
) -> Result<Vec<StageRecommendation>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let dna = db
        .get_latest_aim_dna(params.profile_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Aim DNA 데이터가 없습니다.".to_string())?;

    Ok(recommend_stages(&dna))
}

/// 벤치마크 프리셋 목록 조회
#[tauri::command]
pub fn get_benchmark_preset_list() -> Result<serde_json::Value, String> {
    let presets = get_benchmark_presets();
    let list: Vec<serde_json::Value> = presets
        .into_iter()
        .map(|(key, preset)| {
            serde_json::json!({
                "key": key,
                "name": preset.name,
                "target_size_deg": preset.target_size_deg,
                "target_speed_deg_per_sec": preset.target_speed_deg_per_sec,
                "reaction_window_ms": preset.reaction_window_ms,
                "target_count": preset.target_count,
            })
        })
        .collect();
    Ok(serde_json::json!(list))
}

/// 스테이지 결과 제출 파라미터
#[derive(Deserialize)]
pub struct SubmitStageResultParams {
    pub result: StageResult,
}

/// 스테이지 결과 제출 → DB 저장 + Aim DNA 피처 업데이트
#[tauri::command]
pub fn submit_stage_result(
    state: State<AppState>,
    params: SubmitStageResultParams,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let result = &params.result;

    // 스테이지 결과 DB 저장
    let stage_id = db
        .insert_stage_result(
            result.profile_id,
            &result.stage_type,
            &result.category,
            result.score,
            result.accuracy,
            result.avg_ttk_ms,
            result.avg_reaction_ms,
            result.avg_overshoot_deg,
            result.avg_undershoot_deg,
            result.tracking_mad,
            &result.raw_metrics,
            &serde_json::to_string(&result.difficulty).unwrap_or_default(),
        )
        .map_err(|e| e.to_string())?;

    // DNA 피처 매핑 → 히스토리 저장
    let features = map_stage_to_dna_features(result);
    if !features.is_empty() {
        db.insert_aim_dna_history_batch(result.profile_id, &features)
            .map_err(|e| e.to_string())?;
    }

    Ok(serde_json::json!({
        "stage_result_id": stage_id,
        "features_updated": features.len(),
    }))
}

/// 적응형 난이도 조절 요청
#[derive(Deserialize)]
pub struct AdaptDifficultyParams {
    pub current_difficulty: DifficultyConfig,
    pub recent_accuracy: f64,
}

/// 적응형 난이도 계산
#[tauri::command]
pub fn calculate_adaptive_difficulty(
    params: AdaptDifficultyParams,
) -> Result<DifficultyConfig, String> {
    Ok(adapt_difficulty(&params.current_difficulty, params.recent_accuracy))
}

/// 스테이지 결과 조회 파라미터
#[derive(Deserialize)]
pub struct GetStageResultsParams {
    pub profile_id: i64,
    pub limit: Option<i64>,
    pub stage_type: Option<String>,
}

/// 스테이지 결과 히스토리 조회
#[tauri::command]
pub fn get_stage_results(
    state: State<AppState>,
    params: GetStageResultsParams,
) -> Result<Vec<StageResultRow>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_stage_results(
        params.profile_id,
        params.limit.unwrap_or(50),
        params.stage_type.as_deref(),
    )
    .map_err(|e| e.to_string())
}
