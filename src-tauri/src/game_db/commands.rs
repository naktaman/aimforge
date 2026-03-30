/// Tauri IPC 커맨드 — 게임 DB 및 감도 변환 관련
use super::conversion;
use super::{GamePreset, SensitivityConversion};

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
