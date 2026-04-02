/// Raw Mouse Input 모듈
/// WinAPI를 통해 마우스 raw delta를 sub-μs 타임스탬프로 캡처
/// DPI 검증 및 마우스 가속 감지 기능 포함

pub mod commands;
pub mod raw_input;

use serde::{Deserialize, Serialize};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

/// 마우스 이벤트 — raw input에서 캡처된 단일 마우스 움직임/클릭
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}

/// 마우스 가속 상태
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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

/// 마우스 입력 캡처 상태 — AppState에서 관리
pub struct MouseInputState {
    /// 이벤트 수신 채널
    pub receiver: crossbeam::channel::Receiver<MouseEvent>,
    /// 캡처 활성화 플래그 (스레드 종료 신호)
    pub is_capturing: Arc<AtomicBool>,
    /// 캡처 스레드 핸들
    pub thread_handle: Option<std::thread::JoinHandle<()>>,
}

/// 프레임당 드레인된 마우스 이벤트 배치
/// total_dx/dy는 프레임 내 모든 delta 합산 (빠른 카메라 회전용)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MouseBatch {
    /// 개별 이벤트 목록 (타임스탬프 포함, 궤적 기록용)
    pub events: Vec<MouseEvent>,
    /// 프레임 내 X축 delta 합계
    pub total_dx: i32,
    /// 프레임 내 Y축 delta 합계
    pub total_dy: i32,
    /// 프레임 내 버튼 이벤트 (클릭만 필터링)
    pub button_events: Vec<MouseEvent>,
    /// 최신 이벤트의 QPC 타임스탬프 (µs) — 입력 레이턴시 측정용
    pub latest_timestamp_us: u64,
}
