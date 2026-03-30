/// WinAPI Raw Input 구현
/// RegisterRawInputDevices로 마우스 raw delta를 캡처하고
/// QueryPerformanceCounter로 sub-μs 정밀도 타임스탬프 제공

#[cfg(target_os = "windows")]
use windows::Win32::System::Performance::{QueryPerformanceCounter, QueryPerformanceFrequency};

/// QueryPerformanceCounter를 사용해 현재 시각을 마이크로초로 반환
#[cfg(target_os = "windows")]
pub fn get_timestamp_us() -> u64 {
    let mut counter = 0i64;
    let mut frequency = 0i64;
    unsafe {
        let _ = QueryPerformanceCounter(&mut counter);
        let _ = QueryPerformanceFrequency(&mut frequency);
    }
    if frequency == 0 {
        return 0;
    }
    // counter * 1_000_000 / frequency → 마이크로초 변환
    ((counter as u128 * 1_000_000) / frequency as u128) as u64
}

/// Windows가 아닌 환경에서의 폴백 (개발/테스트용)
#[cfg(not(target_os = "windows"))]
pub fn get_timestamp_us() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros() as u64
}

/// Windows 레지스트리에서 마우스 가속(enhance pointer precision) 상태 확인
/// HKCU\Control Panel\Mouse\MouseSpeed 값을 읽음
#[cfg(target_os = "windows")]
pub fn check_mouse_acceleration() -> super::MouseAccelStatus {
    use windows::Win32::System::Registry::*;
    use windows::core::*;

    let mut mouse_speed: u32 = 0;
    let mut enabled = false;
    let mut message = String::new();

    unsafe {
        let subkey = w!("Control Panel\\Mouse");
        let mut hkey = HKEY::default();
        let result = RegOpenKeyExW(HKEY_CURRENT_USER, subkey, 0, KEY_READ, &mut hkey);

        if result.is_ok() {
            // MouseSpeed 값 읽기 (문자열로 저장됨)
            let value_name = w!("MouseSpeed");
            let mut data_type = REG_VALUE_TYPE::default();
            let mut data = [0u8; 256];
            let mut data_size = data.len() as u32;

            let read_result = RegQueryValueExW(
                hkey,
                value_name,
                None,
                Some(&mut data_type),
                Some(data.as_mut_ptr()),
                Some(&mut data_size),
            );

            if read_result.is_ok() {
                // REG_SZ → 문자열 → 숫자 파싱
                let s = String::from_utf16_lossy(
                    &data[..data_size as usize / 2]
                        .chunks(2)
                        .map(|c| u16::from_le_bytes([c[0], c.get(1).copied().unwrap_or(0)]))
                        .collect::<Vec<u16>>(),
                );
                mouse_speed = s.trim_end_matches('\0').parse().unwrap_or(0);
                enabled = mouse_speed > 0;
            }

            let _ = RegCloseKey(hkey);
        }
    }

    if enabled {
        message = format!(
            "마우스 가속이 켜져 있습니다 (MouseSpeed={}). \
             정확한 측정을 위해 비활성화를 권장합니다.\n\
             설정 → 마우스 → 추가 마우스 옵션 → 포인터 옵션 → \
             '포인터 정확도 향상' 체크 해제",
            mouse_speed
        );
    } else {
        message = "마우스 가속이 꺼져 있습니다.".to_string();
    }

    super::MouseAccelStatus {
        enabled,
        mouse_speed,
        message,
    }
}

/// Windows가 아닌 환경 폴백
#[cfg(not(target_os = "windows"))]
pub fn check_mouse_acceleration() -> super::MouseAccelStatus {
    super::MouseAccelStatus {
        enabled: false,
        mouse_speed: 0,
        message: "Windows가 아닌 환경에서는 마우스 가속 감지를 지원하지 않습니다.".to_string(),
    }
}
