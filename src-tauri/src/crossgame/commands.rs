//! Cross-Game DNA Tauri IPC 커맨드

use crate::AppState;
use serde::Deserialize;
use tauri::State;

use super::{compare_games, predict_timeline, CrossGameComparison, TimelinePrediction};

/// 크로스게임 비교 요청 파라미터
#[derive(Deserialize)]
pub struct CompareGamesParams {
    pub ref_profile_id: i64,
    pub target_profile_id: i64,
    pub ref_game_movement_ratio: Option<f64>,
    pub target_game_movement_ratio: Option<f64>,
}

/// 두 게임 프로파일의 Aim DNA 비교
#[tauri::command]
pub fn compare_game_dna(
    state: State<AppState>,
    params: CompareGamesParams,
) -> Result<CrossGameComparison, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // 두 프로파일의 최신 DNA 조회
    let ref_dna = db
        .get_latest_aim_dna(params.ref_profile_id)
        .map_err(|e| e.to_string())?
        .ok_or("Reference 게임의 Aim DNA가 없습니다.")?;

    let target_dna = db
        .get_latest_aim_dna(params.target_profile_id)
        .map_err(|e| e.to_string())?
        .ok_or("Target 게임의 Aim DNA가 없습니다.")?;

    let ref_movement = params.ref_game_movement_ratio.unwrap_or(0.3);
    let target_movement = params.target_game_movement_ratio.unwrap_or(0.3);

    let comparison = compare_games(&ref_dna, &target_dna, ref_movement, target_movement);

    // DB 저장
    db.insert_crossgame_comparison(
        params.ref_profile_id,
        params.target_profile_id,
        0, // reference_game_id — 프론트엔드에서 별도 지정
        &serde_json::to_string(&comparison.deltas).unwrap_or_default(),
        &serde_json::to_string(&comparison.causes).unwrap_or_default(),
        &serde_json::to_string(&comparison.improvement_plan).unwrap_or_default(),
        comparison.predicted_days,
    )
    .map_err(|e| e.to_string())?;

    Ok(comparison)
}

/// 타임라인 예측 요청 파라미터
#[derive(Deserialize)]
pub struct PredictTimelineParams {
    pub ref_profile_id: i64,
    pub target_profile_id: i64,
    pub adaptation_rate: Option<f64>,
    pub weekly_training_hours: Option<f64>,
}

/// 크로스게임 적응 타임라인 예측
#[tauri::command]
pub fn predict_crossgame_timeline(
    state: State<AppState>,
    params: PredictTimelineParams,
) -> Result<TimelinePrediction, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let ref_dna = db
        .get_latest_aim_dna(params.ref_profile_id)
        .map_err(|e| e.to_string())?
        .ok_or("Reference DNA 없음")?;

    let target_dna = db
        .get_latest_aim_dna(params.target_profile_id)
        .map_err(|e| e.to_string())?
        .ok_or("Target DNA 없음")?;

    // 피처 비교를 위해 compare_games 호출
    let comparison = compare_games(&ref_dna, &target_dna, 0.3, 0.3);

    let timeline = predict_timeline(
        &comparison.deltas,
        params.adaptation_rate.unwrap_or(1.0),
        params.weekly_training_hours.unwrap_or(5.0),
    );

    Ok(timeline)
}

/// 크로스게임 진행 기록 요청
#[derive(Deserialize)]
pub struct RecordProgressParams {
    pub comparison_id: i64,
    pub week_number: i64,
    pub metrics: String,
    pub gap_reduction_pct: f64,
}

/// 크로스게임 주간 진행 기록
#[tauri::command]
pub fn record_crossgame_progress(
    state: State<AppState>,
    params: RecordProgressParams,
) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_crossgame_progress(
        params.comparison_id,
        params.week_number,
        &params.metrics,
        params.gap_reduction_pct,
    )
    .map_err(|e| e.to_string())
}
