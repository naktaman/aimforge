/// Tauri IPC 커맨드 — 프론트엔드에서 호출 가능한 마우스 입력 관련 명령
use super::raw_input;
use super::{DpiVerification, MouseAccelStatus, MouseBatch, MouseInputState};
use crate::AppState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::State;

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

/// 마우스 Raw Input 캡처 시작
/// 백그라운드 스레드에서 WM_INPUT 메시지 루프 실행, crossbeam 채널로 이벤트 전송
#[tauri::command]
pub fn start_mouse_capture(state: State<AppState>) -> Result<String, String> {
    let mut mouse_input = state.mouse_input.lock().map_err(|e| e.to_string())?;

    // 이미 캡처 중이면 에러
    if mouse_input.is_some() {
        return Err("마우스 캡처가 이미 실행 중입니다.".to_string());
    }

    // crossbeam bounded channel 생성 (1000Hz × 2초 = 2000 이벤트 버퍼)
    let (sender, receiver) = crossbeam::channel::bounded(2000);
    let is_capturing = Arc::new(AtomicBool::new(true));

    // Raw Input 캡처 스레드 시작
    let thread_handle = raw_input::start_raw_input_thread(sender, is_capturing.clone());

    *mouse_input = Some(MouseInputState {
        receiver,
        is_capturing,
        thread_handle: Some(thread_handle),
    });

    log::info!("마우스 캡처 시작됨");
    Ok("마우스 캡처가 시작되었습니다.".to_string())
}

/// 마우스 Raw Input 캡처 중지
#[tauri::command]
pub fn stop_mouse_capture(state: State<AppState>) -> Result<String, String> {
    let mut mouse_input = state.mouse_input.lock().map_err(|e| e.to_string())?;

    if let Some(mut input_state) = mouse_input.take() {
        // 캡처 플래그를 false로 설정 → 스레드 메시지 루프 종료
        input_state.is_capturing.store(false, Ordering::SeqCst);

        // 스레드 종료 대기 (최대 1초)
        if let Some(handle) = input_state.thread_handle.take() {
            let _ = handle.join();
        }

        log::info!("마우스 캡처 중지됨");
        Ok("마우스 캡처가 중지되었습니다.".to_string())
    } else {
        Err("마우스 캡처가 실행 중이 아닙니다.".to_string())
    }
}

/// 마우스 이벤트 배치 드레인
/// requestAnimationFrame당 한 번 호출하여 누적된 모든 이벤트를 가져감
/// total_dx/dy는 프레임 내 합산 delta (빠른 카메라 회전용)
#[tauri::command]
pub fn drain_mouse_batch(state: State<AppState>) -> Result<MouseBatch, String> {
    let mouse_input = state.mouse_input.lock().map_err(|e| e.to_string())?;

    let input_state = mouse_input
        .as_ref()
        .ok_or("마우스 캡처가 실행 중이 아닙니다.")?;

    // 채널 잔여량 기반 pre-alloc (정확하지 않을 수 있으나 힌트로 충분)
    let pending = input_state.receiver.len();
    let mut events = Vec::with_capacity(pending);
    let mut button_events = Vec::new();
    let mut total_dx: i32 = 0;
    let mut total_dy: i32 = 0;

    // 채널에서 모든 대기 중인 이벤트 드레인 (non-blocking)
    let mut latest_timestamp_us: u64 = 0;
    while let Ok(event) = input_state.receiver.try_recv() {
        total_dx += event.delta_x;
        total_dy += event.delta_y;

        // 최신 타임스탬프 추적 (입력 레이턴시 측정용)
        if event.timestamp_us > latest_timestamp_us {
            latest_timestamp_us = event.timestamp_us;
        }

        // 버튼 이벤트는 별도 분리 (클릭 타이밍 분석용)
        if event.button.is_some() {
            button_events.push(event.clone());
        }

        events.push(event);
    }

    Ok(MouseBatch {
        events,
        total_dx,
        total_dy,
        button_events,
        latest_timestamp_us,
    })
}
