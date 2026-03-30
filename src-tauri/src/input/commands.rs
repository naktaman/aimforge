/// Tauri IPC 커맨드 — 프론트엔드에서 호출 가능한 마우스 입력 관련 명령
use super::raw_input;
use super::{DpiVerification, MouseAccelStatus};

/// 마우스 가속 상태 확인 커맨드
/// 프론트엔드 온보딩에서 마우스 가속 감지 후 안내에 사용
#[tauri::command]
pub fn get_mouse_acceleration_status() -> MouseAccelStatus {
    raw_input::check_mouse_acceleration()
}

/// DPI 검증 커맨드
/// 유저가 10cm 드래그 → 누적 raw count로 실제 DPI 계산
/// claimed_dpi: 유저 입력 DPI, total_counts: 드래그 중 누적 raw delta 합
/// distance_cm: 실제 드래그 거리 (기본 10cm)
#[tauri::command]
pub fn check_dpi(claimed_dpi: u32, total_counts: i64, distance_cm: f64) -> DpiVerification {
    // DPI = counts / inches, 1 inch = 2.54 cm
    let distance_inches = distance_cm / 2.54;
    let measured_dpi = total_counts.unsigned_abs() as f64 / distance_inches;

    let error_pct = ((measured_dpi - claimed_dpi as f64) / claimed_dpi as f64 * 100.0).abs();

    // 오차 기준: <5% 통과, 5~15% 경고, >15% 실패
    let status = if error_pct < 5.0 {
        "pass".to_string()
    } else if error_pct < 15.0 {
        "warning".to_string()
    } else {
        "fail".to_string()
    };

    DpiVerification {
        claimed_dpi,
        measured_dpi,
        error_pct,
        status,
    }
}
