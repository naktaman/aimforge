/// Raw Mouse Input 모듈
/// WinAPI를 통해 마우스 raw delta를 sub-μs 타임스탬프로 캡처
/// DPI 검증 및 마우스 가속 감지 기능 포함

pub mod commands;
mod raw_input;

use serde::{Deserialize, Serialize};

/// 마우스 이벤트 — raw input에서 캡처된 단일 마우스 움직임/클릭
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MouseEvent {
    /// X축 raw delta (DPI 단위)
    pub delta_x: i32,
    /// Y축 raw delta (DPI 단위)
    pub delta_y: i32,
    /// QueryPerformanceCounter 기반 마이크로초 타임스탬프
    pub timestamp_us: u64,
    /// 버튼 이벤트 (None = 이동만)
    pub button: Option<MouseButton>,
}

/// 마우스 버튼 종류
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}

/// 마우스 가속 상태
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MouseAccelStatus {
    /// 마우스 가속 활성화 여부
    pub enabled: bool,
    /// 레지스트리 MouseSpeed 값 (0=off, 1=on, 2=on+강화)
    pub mouse_speed: u32,
    /// 사용자에게 보여줄 메시지
    pub message: String,
}

/// DPI 검증 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DpiVerification {
    /// 유저가 입력한 DPI
    pub claimed_dpi: u32,
    /// 실측으로 계산된 DPI
    pub measured_dpi: f64,
    /// 오차율 (%)
    pub error_pct: f64,
    /// 검증 상태: "pass", "warning", "fail"
    pub status: String,
}
