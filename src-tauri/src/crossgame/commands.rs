//! Cross-Game DNA Tauri IPC 커맨드

use crate::error::{AppError, PublicError, lock_state};
use crate::validate;
use crate::AppState;
use serde::Deserialize;
use tauri::State;

use serde::Serialize;
use super::{compare_games, generate_crossgame_prescriptions, predict_timeline, CrossGameComparison, TimelinePrediction};

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
) -> Result<CrossGameComparison, PublicError> {
    validate::id(params.ref_profile_id, "ref_profile_id")?;
    validate::id(params.target_profile_id, "target_profile_id")?;

    let db = lock_state(&state.db)?;

    // 두 프로파일의 최신 DNA 조회
    let ref_dna = db
        .get_latest_aim_dna(params.ref_profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Reference 게임의 Aim DNA가 없습니다.".to_string()))?;

    let target_dna = db
        .get_latest_aim_dna(params.target_profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Target 게임의 Aim DNA가 없습니다.".to_string()))?;

    let ref_movement = params.ref_game_movement_ratio.unwrap_or(0.3);
    let target_movement = params.target_game_movement_ratio.unwrap_or(0.3);

    // 레퍼런스 게임 ID + cm/360 차이 조회
    let reference_game_id = db.get_reference_game_profile_id()
        .map_err(|e| AppError::Database(e.to_string()))?
        .unwrap_or(params.ref_profile_id);
    let ref_cm360 = db.get_profile_cm360(params.ref_profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .unwrap_or(0.0);
    let target_cm360 = db.get_profile_cm360(params.target_profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .unwrap_or(0.0);
    let sens_diff = (target_cm360 - ref_cm360).abs();

    let comparison = compare_games(
        &ref_dna, &target_dna,
        ref_movement, target_movement,
        reference_game_id, sens_diff,
    );

    // DB 저장
    let deltas_json = serde_json::to_string(&comparison.deltas)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let causes_json = serde_json::to_string(&comparison.causes)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let plan_json = serde_json::to_string(&comparison.improvement_plan)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    db.insert_crossgame_comparison(
        params.ref_profile_id,
        params.target_profile_id,
        reference_game_id,
        &deltas_json,
        &causes_json,
        &plan_json,
        comparison.predicted_days,
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

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
) -> Result<TimelinePrediction, PublicError> {
    validate::id(params.ref_profile_id, "ref_profile_id")?;
    validate::id(params.target_profile_id, "target_profile_id")?;

    let db = lock_state(&state.db)?;

    let ref_dna = db
        .get_latest_aim_dna(params.ref_profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Reference DNA 없음".to_string()))?;

    let target_dna = db
        .get_latest_aim_dna(params.target_profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Target DNA 없음".to_string()))?;

    // 피처 비교를 위해 compare_games 호출
    let comparison = compare_games(&ref_dna, &target_dna, 0.3, 0.3, 0, 0.0);

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
) -> Result<i64, PublicError> {
    validate::id(params.comparison_id, "comparison_id")?;
    validate::non_empty_str(&params.metrics, "metrics")?;

    let db = lock_state(&state.db)?;
    db.insert_crossgame_progress(
        params.comparison_id,
        params.week_number,
        &params.metrics,
        params.gap_reduction_pct,
    )
    .map_err(|e| AppError::Database(e.to_string()).into())
}

// ── 크로스게임 비교 조회 ──

/// 크로스게임 비교 요약 (리스트용)
#[derive(Debug, Clone, Serialize)]
pub struct CrossGameComparisonSummary {
    pub id: i64,
    pub profile_a_id: i64,
    pub profile_b_id: i64,
    pub overall_gap: f64,
    pub predicted_days: f64,
    pub created_at: String,
}

/// 크로스게임 비교 히스토리 조회 파라미터
#[derive(Deserialize)]
pub struct GetComparisonHistoryParams {
    pub profile_id: i64,
    pub limit: Option<i64>,
}

/// 프로파일별 크로스게임 비교 히스토리
#[tauri::command]
pub fn get_cross_game_history_cmd(
    state: State<AppState>,
    params: GetComparisonHistoryParams,
) -> Result<Vec<CrossGameComparisonSummary>, PublicError> {
    validate::id(params.profile_id, "profile_id")?;
    let db = lock_state(&state.db)?;
    db.get_crossgame_history(params.profile_id, params.limit.unwrap_or(20))
        .map_err(|e| AppError::Database(e.to_string()).into())
}

/// 크로스게임 갭 기반 훈련 처방 생성
#[tauri::command]
pub fn generate_crossgame_prescriptions_cmd(
    state: State<AppState>,
    params: CompareGamesParams,
) -> Result<Vec<crate::training::TrainingPrescription>, PublicError> {
    validate::id(params.ref_profile_id, "ref_profile_id")?;
    validate::id(params.target_profile_id, "target_profile_id")?;

    let db = lock_state(&state.db)?;

    let ref_dna = db
        .get_latest_aim_dna(params.ref_profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Reference DNA 없음".to_string()))?;
    let target_dna = db
        .get_latest_aim_dna(params.target_profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Target DNA 없음".to_string()))?;

    let ref_movement = params.ref_game_movement_ratio.unwrap_or(0.3);
    let target_movement = params.target_game_movement_ratio.unwrap_or(0.3);
    let ref_cm360 = db.get_profile_cm360(params.ref_profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?.unwrap_or(0.0);
    let target_cm360 = db.get_profile_cm360(params.target_profile_id)
        .map_err(|e| AppError::Database(e.to_string()))?.unwrap_or(0.0);
    let sens_diff = (target_cm360 - ref_cm360).abs();
    let ref_game_id = db.get_reference_game_profile_id()
        .map_err(|e| AppError::Database(e.to_string()))?.unwrap_or(params.ref_profile_id);

    let comparison = compare_games(&ref_dna, &target_dna, ref_movement, target_movement, ref_game_id, sens_diff);
    let prescriptions = generate_crossgame_prescriptions(&comparison);

    // DB에 처방 캐싱 — 보조 저장이므로 경고만 출력
    if let Ok(Some(dna_id)) = db.get_latest_aim_dna_id(params.target_profile_id) {
        for p in &prescriptions {
            let params_json = serde_json::to_string(&p.scenario_params)
                .unwrap_or_else(|e| {
                    log::warn!("크로스게임 처방 파라미터 직렬화 실패: {}", e);
                    "{}".to_string()
                });
            if let Err(e) = db.insert_training_prescription(
                dna_id,
                &p.source_type,
                &p.weakness,
                &p.scenario_type,
                &params_json,
                p.priority,
                Some(p.estimated_min),
            ) {
                log::warn!("크로스게임 처방 DB 저장 실패: {}", e);
            }
        }
    }

    Ok(prescriptions)
}

// ── 크로스게임 줌 감도 변환 (P1) ──

/// 크로스게임 줌 감도 변환 파라미터
#[derive(Deserialize)]
pub struct ConvertCrossgameZoomParams {
    /// 소스 게임 ID (예: "cs2")
    pub source_game: String,
    /// 타겟 게임 ID (예: "apex")
    pub target_game: String,
    /// 소스 게임 감도 값
    pub source_sens: f64,
    /// 옵틱/스코프 이름 (예: "3x")
    pub optic: String,
    /// 소스 줌 배율 (예: 4.0)
    pub zoom_ratio: f64,
    /// 개인 k 값 (None이면 MDM 0% 기본값)
    pub k_value: Option<f64>,
    /// piecewise k 프로파일 (None이면 글로벌 k 사용)
    pub piecewise_k: Option<Vec<crate::zoom_calibration::k_fitting::PiecewiseK>>,
    /// 에이밍 타입별 k (tracking/flicking 분리)
    pub aim_type_k: Option<crate::zoom_calibration::k_fitting::AimTypeKResult>,
    /// 게임 줌 프로파일 (tracking/flicking 비율)
    pub game_zoom_profile: Option<crate::zoom_calibration::k_fitting::GameZoomProfile>,
}

/// 크로스게임 줌 감도 변환 결과
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrossgameZoomResult {
    /// 소스 게임 cm/360
    pub source_cm360: f64,
    /// 소스 줌 cm/360 (k 적용)
    pub source_zoom_cm360: f64,
    /// 타겟 게임 감도
    pub target_sens: f64,
    /// 타겟 줌 cm/360
    pub target_zoom_cm360: f64,
    /// 사용된 k 값
    pub k_used: f64,
    /// 소스 줌 배율
    pub source_multiplier: f64,
    /// 타겟 줌 배율
    pub target_multiplier: f64,
    /// 배율 차이
    pub multiplier_diff: f64,
}

/// 크로스게임 줌 감도 변환
/// 소스 게임의 줌 감도를 타겟 게임의 동일 배율 줌으로 변환
#[tauri::command]
pub fn convert_crossgame_zoom_sensitivity(
    state: State<AppState>,
    params: ConvertCrossgameZoomParams,
) -> Result<CrossgameZoomResult, PublicError> {
    // 입력 검증
    validate::non_empty_str(&params.source_game, "source_game")?;
    validate::non_empty_str(&params.target_game, "target_game")?;
    validate::sensitivity(params.source_sens)?;
    validate::zoom_ratio(params.zoom_ratio)?;

    // 게임 프리셋 로드
    let presets = crate::game_db::get_default_presets();
    let src_preset = presets.iter().find(|g| g.id == params.source_game)
        .ok_or_else(|| AppError::NotFound(format!("소스 게임 없음: {}", params.source_game)))?;
    let dst_preset = presets.iter().find(|g| g.id == params.target_game)
        .ok_or_else(|| AppError::NotFound(format!("타겟 게임 없음: {}", params.target_game)))?;

    // 소스 cm/360 계산
    let src_cm360 = crate::game_db::conversion::game_sens_to_cm360(
        params.source_sens, 800, src_preset.yaw,
    );

    // k 값 결정 (우선순위: aim_type_k > piecewise_k > k_value > 기본값 1.0)
    let k = if let (Some(aim_k), Some(profile)) = (&params.aim_type_k, &params.game_zoom_profile) {
        crate::zoom_calibration::k_fitting::get_effective_k(aim_k, profile)
    } else if let Some(pieces) = &params.piecewise_k {
        // piecewise에서 해당 구간 k 찾기
        pieces.iter()
            .find(|p| params.zoom_ratio >= p.ratio_start && params.zoom_ratio <= p.ratio_end)
            .map(|p| p.k)
            .unwrap_or(params.k_value.unwrap_or(1.0))
    } else {
        params.k_value.unwrap_or(1.0)
    };

    // 소스 FOV 계산
    let src_fov = crate::game_db::conversion::game_fov_to_hfov(
        src_preset.default_fov, &src_preset.fov_type, src_preset.default_aspect_ratio,
    );
    let dst_fov = crate::game_db::conversion::game_fov_to_hfov(
        dst_preset.default_fov, &dst_preset.fov_type, dst_preset.default_aspect_ratio,
    );

    // 줌 스코프 FOV 근사: scope_fov ≈ 2 × atan(tan(hipfire/2) / zoom_ratio)
    let src_scope_fov = scope_fov_from_ratio(src_fov, params.zoom_ratio);
    let dst_scope_fov = scope_fov_from_ratio(dst_fov, params.zoom_ratio);

    // 줌 배율 (k-parameter 모델)
    let src_mult = crate::game_db::conversion::zoom_multiplier(src_fov, src_scope_fov, k);
    let dst_mult = crate::game_db::conversion::zoom_multiplier(dst_fov, dst_scope_fov, k);

    // 소스 줌 cm/360 = 힙파이어 cm/360 / 배율
    let src_zoom_cm360 = src_cm360 / src_mult;

    // 타겟 줌 cm/360은 동일한 체감을 유지
    let dst_zoom_cm360 = src_zoom_cm360;
    // 타겟 힙파이어 cm/360 = 줌 cm/360 × 배율
    let dst_cm360 = dst_zoom_cm360 * dst_mult;
    // 타겟 감도 역산
    let dst_sens = crate::game_db::conversion::cm360_to_sens(dst_cm360, 800, dst_preset.yaw);

    Ok(CrossgameZoomResult {
        source_cm360: src_cm360,
        source_zoom_cm360: src_zoom_cm360,
        target_sens: dst_sens,
        target_zoom_cm360: dst_zoom_cm360,
        k_used: k,
        source_multiplier: src_mult,
        target_multiplier: dst_mult,
        multiplier_diff: (dst_mult - src_mult).abs(),
    })
}

/// 줌 비율로 스코프 FOV 근사 계산
/// scope_fov = 2 × atan(tan(hipfire_fov/2) / zoom_ratio)
fn scope_fov_from_ratio(hipfire_fov: f64, zoom_ratio: f64) -> f64 {
    let hip_half_rad = (hipfire_fov.to_radians() / 2.0).tan();
    let scope_half_rad = (hip_half_rad / zoom_ratio).atan();
    (scope_half_rad * 2.0).to_degrees()
}
