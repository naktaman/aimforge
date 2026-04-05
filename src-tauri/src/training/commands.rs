//! 훈련 시스템 Tauri IPC 커맨드

use crate::error::{AppError, PublicError, lock_state};
use crate::validate;
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
) -> Result<Vec<TrainingPrescription>, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;

    // 최신 Aim DNA 조회
    let dna = db
        .get_latest_aim_dna(params.profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Aim DNA 데이터가 없습니다. 먼저 배터리를 실행하세요.".to_string()))?;

    let prescriptions = generate_prescriptions(&dna);

    // DB 저장 — aim_dna ID 조회 후 처방 저장
    let aim_dna_id = db
        .get_latest_aim_dna_id(params.profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("aim_dna_id 조회 실패".to_string()))?;

    for p in &prescriptions {
        let params_json = serde_json::to_string(&p.scenario_params)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        db.insert_training_prescription(
            aim_dna_id,
            &p.source_type,
            &p.weakness,
            &p.scenario_type,
            &params_json,
            p.priority,
            Some(p.estimated_min),
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    Ok(prescriptions)
}

/// 스테이지 추천 목록 조회
#[tauri::command]
pub fn get_stage_recommendations(
    state: State<AppState>,
    params: GeneratePrescriptionsParams,
) -> Result<Vec<StageRecommendation>, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;

    let dna = db
        .get_latest_aim_dna(params.profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Aim DNA 데이터가 없습니다.".to_string()))?;

    Ok(recommend_stages(&dna))
}

/// 벤치마크 프리셋 목록 조회
#[tauri::command]
pub fn get_benchmark_preset_list() -> Result<serde_json::Value, PublicError> {
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
) -> Result<serde_json::Value, PublicError> {
    validate::id(params.result.profile_id, "profile_id")?;
    validate::non_empty_str(&params.result.stage_type, "stage_type")?;
    validate::non_empty_str(&params.result.category, "category")?;

    let db = lock_state(&state.db)?;
    let result = &params.result;

    // 난이도 직렬화
    let difficulty_json = serde_json::to_string(&result.difficulty)
        .map_err(|e| AppError::Internal(e.to_string()))?;

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
            &difficulty_json,
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    // DNA 피처 매핑 → 히스토리 저장
    let features = map_stage_to_dna_features(result);
    if !features.is_empty() {
        db.insert_aim_dna_history_batch(result.profile_id, &features)
            .map_err(|e| AppError::Database(e.to_string()))?;
    }

    // 일별 통계 + 스킬 진행도 자동 집계
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let time_ms: i64 = serde_json::from_str::<serde_json::Value>(&result.raw_metrics)
        .ok()
        .and_then(|v| v.get("total_time_ms").and_then(|t| t.as_i64()))
        .unwrap_or(0);
    // 보조 집계 — 메인 결과 저장 이후이므로 경고만 출력
    if let Err(e) = db.upsert_daily_stat(result.profile_id, &today, &result.stage_type, result.score, result.accuracy, time_ms) {
        log::warn!("일별 통계 업데이트 실패: {}", e);
    }
    if let Err(e) = db.upsert_skill_progress(result.profile_id, &result.stage_type, result.score, time_ms) {
        log::warn!("스킬 진행도 업데이트 실패: {}", e);
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
) -> Result<DifficultyConfig, PublicError> {
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
) -> Result<Vec<StageResultRow>, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;
    db.get_stage_results(
        params.profile_id,
        params.limit.unwrap_or(50),
        params.stage_type.as_deref(),
    )
    .map_err(|e| AppError::Database(e.to_string()).into())
}

// ═══════════════════════════════════════════════════
// Readiness Score 커맨드
// ═══════════════════════════════════════════════════

/// Readiness Score 계산 + DB 저장
#[tauri::command]
pub fn calculate_readiness_score(
    state: State<AppState>,
    params: super::readiness::ReadinessInput,
) -> Result<super::readiness::ReadinessResult, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;

    // baseline DNA 로드
    let dna = db
        .get_latest_aim_dna(params.profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Aim DNA 데이터가 없습니다. 먼저 배터리를 실행하세요.".to_string()))?;

    let baseline = super::readiness::extract_baseline(&dna);
    let result = super::readiness::calculate_readiness(&params, &baseline);

    // DB 저장
    let delta_json = serde_json::to_string(&result.baseline_delta)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db.insert_readiness_score(
        params.profile_id,
        result.score,
        &delta_json,
        Some(&result.daily_advice),
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(result)
}

/// Readiness 히스토리 조회 파라미터
#[derive(Deserialize)]
pub struct GetReadinessHistoryParams {
    pub profile_id: i64,
    pub limit: Option<i64>,
}

/// Readiness Score 히스토리 조회
#[tauri::command]
pub fn get_readiness_history(
    state: State<AppState>,
    params: GetReadinessHistoryParams,
) -> Result<Vec<crate::db::ReadinessScoreRow>, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;
    db.get_readiness_scores(params.profile_id, params.limit.unwrap_or(30))
        .map_err(|e| AppError::Database(e.to_string()).into())
}

// ═══════════════════════════════════════════════════
// Style Transition 커맨드
// ═══════════════════════════════════════════════════

/// 스타일 전환 시작 파라미터
#[derive(Deserialize)]
pub struct StartStyleTransitionParams {
    pub profile_id: i64,
    pub from_type: String,
    pub to_type: String,
    pub target_sens_range: String,
}

/// 스타일 전환 시작 — DB에 전환 레코드 생성
#[tauri::command]
pub fn start_style_transition(
    state: State<AppState>,
    params: StartStyleTransitionParams,
) -> Result<serde_json::Value, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    validate::non_empty_str(&params.from_type, "from_type")?;
    validate::non_empty_str(&params.to_type, "to_type")?;
    validate::non_empty_str(&params.target_sens_range, "target_sens_range")?;

    let db = lock_state(&state.db)?;

    // 기존 활성 전환이 있으면 완료 처리
    if let Ok(Some(existing)) = db.get_active_style_transition(params.profile_id) {
        db.complete_style_transition(existing.id)
            .map_err(|e| AppError::Database(format!("기존 스타일 전환 완료 처리 실패: {}", e)))?;
    }

    let id = db
        .insert_style_transition(
            params.profile_id,
            &params.from_type,
            &params.to_type,
            &params.target_sens_range,
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(serde_json::json!({ "transition_id": id }))
}

/// 스타일 전환 상태 조회 파라미터
#[derive(Deserialize)]
pub struct GetStyleTransitionParams {
    pub profile_id: i64,
}

/// 스타일 전환 상태 조회 + 현재 DNA 대비 수렴도 평가
#[tauri::command]
pub fn get_style_transition_status(
    state: State<AppState>,
    params: GetStyleTransitionParams,
) -> Result<serde_json::Value, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;

    let transition = db
        .get_active_style_transition(params.profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?;

    match transition {
        Some(t) => {
            // 현재 DNA 로드하여 수렴도 평가
            let progress = if let Ok(Some(dna)) = db.get_latest_aim_dna(params.profile_id) {
                Some(super::style_transition::evaluate_transition_progress(
                    &dna,
                    &t.to_type,
                    &t.current_phase,
                    0,
                ))
            } else {
                None
            };

            // Phase 갱신 (진행된 경우)
            if let Some(ref p) = progress {
                if p.phase != t.current_phase {
                    db.update_style_transition_phase(t.id, &p.phase).ok();
                }
            }

            Ok(serde_json::json!({
                "transition": t,
                "progress": progress,
            }))
        }
        None => Ok(serde_json::json!({
            "transition": null,
            "progress": null,
        })),
    }
}

/// 스타일 전환 업데이트 (수동 Phase 진행 또는 완료)
#[derive(Deserialize)]
pub struct UpdateStyleTransitionParams {
    pub profile_id: i64,
    pub action: String, // "complete" | "detect_plateau"
}

/// 스타일 전환 업데이트
#[tauri::command]
pub fn update_style_transition(
    state: State<AppState>,
    params: UpdateStyleTransitionParams,
) -> Result<serde_json::Value, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    validate::non_empty_str(&params.action, "action")?;

    let db = lock_state(&state.db)?;

    let transition = db
        .get_active_style_transition(params.profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("활성 스타일 전환이 없습니다.".to_string()))?;

    match params.action.as_str() {
        "complete" => {
            db.complete_style_transition(transition.id)
                .map_err(|e| AppError::Database(e.to_string()))?;
            Ok(serde_json::json!({ "status": "completed" }))
        }
        "detect_plateau" => {
            db.mark_plateau_detected(transition.id)
                .map_err(|e| AppError::Database(e.to_string()))?;
            Ok(serde_json::json!({ "status": "plateau_marked" }))
        }
        _ => Err(AppError::Validation("알 수 없는 액션입니다. 'complete' 또는 'detect_plateau'를 사용하세요.".to_string()).into()),
    }
}
