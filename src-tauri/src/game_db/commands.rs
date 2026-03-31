/// Tauri IPC 커맨드 — 게임 DB 및 감도 변환 관련
use super::conversion;
use super::{AllMethodsConversion, ConversionResult, GamePreset, SensitivityConversion, SnappedSensitivity};
use std::collections::HashMap;

/// 지원 게임 목록 반환 커맨드
/// 프론트엔드 게임 선택 UI에서 사용
#[tauri::command]
pub fn get_available_games() -> Vec<GamePreset> {
    super::get_default_presets()
}

/// 게임 간 감도 변환 커맨드
/// from_game → cm/360 → to_game 감도로 변환
/// dpi: 현재 마우스 DPI, sens: 원본 게임 감도
#[tauri::command]
pub fn convert_sensitivity(
    from_game_id: String,
    to_game_id: String,
    sens: f64,
    dpi: u32,
) -> Result<SensitivityConversion, String> {
    let presets = super::get_default_presets();

    // 원본/대상 게임 프리셋 찾기
    let from_game = presets
        .iter()
        .find(|g| g.id == from_game_id)
        .ok_or_else(|| format!("게임을 찾을 수 없습니다: {}", from_game_id))?;

    let to_game = presets
        .iter()
        .find(|g| g.id == to_game_id)
        .ok_or_else(|| format!("게임을 찾을 수 없습니다: {}", to_game_id))?;

    // 원본 감도 → cm/360 → 대상 감도
    let cm360 = conversion::game_sens_to_cm360(sens, dpi, from_game.yaw);
    let to_sens = conversion::cm360_to_sens(cm360, dpi, to_game.yaw);

    Ok(SensitivityConversion {
        from_game: from_game_id,
        to_game: to_game_id,
        from_sens: sens,
        to_sens,
        cm_per_360: cm360,
    })
}

/// 6가지 변환 방식 동시 계산 커맨드
/// MDM 0/56.25/75/100%, Viewspeed H/V 결과를 한 번에 반환
#[tauri::command]
pub fn convert_all_methods(
    from_game_id: String,
    to_game_id: String,
    sens: f64,
    dpi: u32,
    aspect_ratio: Option<f64>,
) -> Result<AllMethodsConversion, String> {
    let presets = super::get_default_presets();
    let from = presets
        .iter()
        .find(|g| g.id == from_game_id)
        .ok_or_else(|| format!("게임을 찾을 수 없습니다: {}", from_game_id))?;
    let to = presets
        .iter()
        .find(|g| g.id == to_game_id)
        .ok_or_else(|| format!("게임을 찾을 수 없습니다: {}", to_game_id))?;

    let ar = aspect_ratio.unwrap_or(16.0 / 9.0);
    let src_cm360 = conversion::game_sens_to_cm360(sens, dpi, from.yaw);
    let src_fov_h = conversion::game_fov_to_hfov(from.default_fov, &from.fov_type, ar);
    let dst_fov_h = conversion::game_fov_to_hfov(to.default_fov, &to.fov_type, ar);

    // 6가지 방식별 cm/360 계산
    let method_cm360s = conversion::convert_all_methods(src_fov_h, dst_fov_h, src_cm360, ar);

    // 각 방식별 대상 게임 감도 역산
    let mut results = HashMap::new();
    for (method, cm360) in method_cm360s {
        let target_sens = conversion::cm360_to_sens(cm360, dpi, to.yaw);
        let multiplier = if cm360 != 0.0 { src_cm360 / cm360 } else { 1.0 };
        results.insert(
            method,
            ConversionResult {
                cm360,
                sens: target_sens,
                multiplier,
            },
        );
    }

    Ok(AllMethodsConversion {
        src_game: from_game_id,
        dst_game: to_game_id,
        src_cm360,
        src_fov_h,
        dst_fov_h,
        results,
    })
}

/// sens_step 스냅 커맨드 — 최적 cm/360에 가장 가까운 게임 감도 후보 계산
#[tauri::command]
pub fn snap_sensitivity(
    game_id: String,
    target_cm360: f64,
    dpi: u32,
) -> Result<SnappedSensitivity, String> {
    let presets = super::get_default_presets();
    let game = presets
        .iter()
        .find(|g| g.id == game_id)
        .ok_or_else(|| format!("게임을 찾을 수 없습니다: {}", game_id))?;

    let step = game.sens_step.unwrap_or(0.01);
    let (floor_s, floor_c, ceil_s, ceil_c) =
        conversion::snap_sensitivity(target_cm360, dpi, game.yaw, step);

    // cm/360 기준으로 target에 더 가까운 쪽 추천
    let (rec_s, rec_c) = if (floor_c - target_cm360).abs() <= (ceil_c - target_cm360).abs() {
        (floor_s, floor_c)
    } else {
        (ceil_s, ceil_c)
    };

    Ok(SnappedSensitivity {
        floor_sens: floor_s,
        floor_cm360: floor_c,
        ceil_sens: ceil_s,
        ceil_cm360: ceil_c,
        recommended_sens: rec_s,
        recommended_cm360: rec_c,
    })
}
