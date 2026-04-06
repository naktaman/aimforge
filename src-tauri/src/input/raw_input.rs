//! WinAPI Raw Input 구현
//! RegisterRawInputDevices로 마우스 raw delta를 캡처하고
//! QueryPerformanceCounter로 sub-μs 정밀도 타임스탬프 제공
//! RawInputThread로 백그라운드 스레드에서 WM_INPUT 메시지 루프 실행

use super::{MouseButton, MouseEvent};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[cfg(target_os = "windows")]
use windows::Win32::System::Performance::{QueryPerformanceCounter, QueryPerformanceFrequency};

/// QPC 주파수 캐시 — 프로세스 수명 동안 불변이므로 한 번만 조회
#[cfg(target_os = "windows")]
static QPC_FREQUENCY: std::sync::OnceLock<i64> = std::sync::OnceLock::new();

/// 캐시된 QPC 주파수 반환 (첫 호출 시 초기화)
#[cfg(target_os = "windows")]
fn get_qpc_frequency() -> i64 {
    *QPC_FREQUENCY.get_or_init(|| {
        let mut freq = 0i64;
        unsafe { let _ = QueryPerformanceFrequency(&mut freq); }
        freq
    })
}

/// QueryPerformanceCounter를 사용해 현재 시각을 마이크로초로 반환
/// QPC 주파수는 OnceLock으로 캐시하여 매 호출마다 syscall 회피
#[cfg(target_os = "windows")]
pub fn get_timestamp_us() -> u64 {
    let frequency = get_qpc_frequency();
    if frequency == 0 {
        return 0;
    }
    let mut counter = 0i64;
    unsafe {
        let _ = QueryPerformanceCounter(&mut counter);
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

    let message = if enabled {
        format!(
            "마우스 가속이 켜져 있습니다 (MouseSpeed={}). \
             정확한 측정을 위해 비활성화를 권장합니다.\n\
             설정 → 마우스 → 추가 마우스 옵션 → 포인터 옵션 → \
             '포인터 정확도 향상' 체크 해제",
            mouse_speed
        )
    } else {
        "마우스 가속이 꺼져 있습니다.".to_string()
    };

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

// =============================================================================
// Raw Input 캡처 스레드 (Windows 전용)
// =============================================================================

/// Raw Input 캡처 스레드 시작
/// 백그라운드 스레드에서 RegisterRawInputDevices + WM_INPUT 메시지 루프 실행
/// 캡처된 MouseEvent를 crossbeam channel로 전송
#[cfg(target_os = "windows")]
pub fn start_raw_input_thread(
    sender: crossbeam::channel::Sender<MouseEvent>,
    is_capturing: Arc<AtomicBool>,
) -> std::thread::JoinHandle<()> {
    use windows::Win32::Devices::HumanInterfaceDevice::*;
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::Input::*;
    use windows::Win32::UI::WindowsAndMessaging::*;

    std::thread::spawn(move || {
        log::info!("Raw input 캡처 스레드 시작");

        unsafe {
            // 숨겨진 메시지 전용 윈도우 생성 (WM_INPUT 수신용)
            let class_name = windows::core::w!("AimForgeRawInput");
            let hinstance = GetModuleHandleW(None).unwrap_or_default();
            let wc = WNDCLASSEXW {
                cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                lpfnWndProc: Some(raw_input_wnd_proc),
                lpszClassName: class_name,
                hInstance: hinstance.into(),
                ..Default::default()
            };
            RegisterClassExW(&wc);

            let hwnd = CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                class_name,
                windows::core::w!("AimForgeRawInputWindow"),
                WINDOW_STYLE::default(),
                0,
                0,
                0,
                0,
                HWND_MESSAGE, // 메시지 전용 윈도우 (보이지 않음)
                None,
                hinstance,
                None,
            );

            let hwnd = match hwnd {
                Ok(h) => h,
                Err(e) => {
                    log::error!("Raw input 윈도우 생성 실패: {:?}", e);
                    is_capturing.store(false, Ordering::SeqCst);
                    return;
                }
            };

            // Raw Input 장치 등록 — 마우스 (RIDEV_INPUTSINK: 백그라운드에서도 수신)
            let rid = RAWINPUTDEVICE {
                usUsagePage: HID_USAGE_PAGE_GENERIC,
                usUsage: HID_USAGE_GENERIC_MOUSE,
                dwFlags: RIDEV_INPUTSINK,
                hwndTarget: hwnd,
            };

            if let Err(e) = RegisterRawInputDevices(
                &[rid],
                std::mem::size_of::<RAWINPUTDEVICE>() as u32,
            ) {
                log::error!("RegisterRawInputDevices 실패: {:?}", e);
                is_capturing.store(false, Ordering::SeqCst);
                return;
            }

            log::info!("Raw input 장치 등록 완료");

            // sender를 윈도우 user data에 저장 (WndProc에서 접근용)
            let sender_box = Box::new(sender);
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, Box::into_raw(sender_box) as isize);

            // 메시지 루프 — is_capturing이 false가 될 때까지 실행
            // PeekMessage + 내부 drain 루프로 대기 중인 메시지 일괄 처리
            let mut msg = MSG::default();
            while is_capturing.load(Ordering::Relaxed) {
                // 대기 중인 모든 메시지 일괄 처리 (한 번에 drain)
                let mut processed = false;
                while PeekMessageW(&mut msg, hwnd, 0, 0, PM_REMOVE).as_bool() {
                    if msg.message == WM_QUIT {
                        is_capturing.store(false, Ordering::Relaxed);
                        break;
                    }
                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                    processed = true;
                }

                if !processed {
                    // 메시지 없으면 100µs 대기 (CPU 절감, 기존 500µs → 100µs로 지연 80% 감소)
                    std::thread::sleep(std::time::Duration::from_micros(100));
                }
            }

            // 정리: sender 포인터 해제
            let ptr = GetWindowLongPtrW(hwnd, GWLP_USERDATA)
                as *mut crossbeam::channel::Sender<MouseEvent>;
            if !ptr.is_null() {
                let _ = Box::from_raw(ptr);
            }
            let _ = DestroyWindow(hwnd);

            log::info!("Raw input 캡처 스레드 종료");
        }
    })
}

/// WM_INPUT 메시지 처리 콜백
/// RAWINPUT에서 마우스 delta와 버튼 상태를 추출하여 채널로 전송
#[cfg(target_os = "windows")]
unsafe extern "system" fn raw_input_wnd_proc(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::UI::Input::*;
    use windows::Win32::UI::WindowsAndMessaging::*;

    if msg == WM_INPUT {
        // RAWINPUT 데이터 크기 확인
        let mut size: u32 = 0;
        GetRawInputData(
            HRAWINPUT(lparam.0 as _),
            RID_INPUT,
            None,
            &mut size,
            std::mem::size_of::<RAWINPUTHEADER>() as u32,
        );

        if size > 0 {
            let mut buffer = vec![0u8; size as usize];
            let copied = GetRawInputData(
                HRAWINPUT(lparam.0 as _),
                RID_INPUT,
                Some(buffer.as_mut_ptr() as *mut _),
                &mut size,
                std::mem::size_of::<RAWINPUTHEADER>() as u32,
            );

            if copied == size {
                let raw = &*(buffer.as_ptr() as *const RAWINPUT);

                // 마우스 입력인지 확인 (RIM_TYPEMOUSE = 0)
                if raw.header.dwType == RIM_TYPEMOUSE.0 {
                    let mouse = &raw.data.mouse;
                    let timestamp = get_timestamp_us();

                    // 버튼 상태 확인 (RI_MOUSE_*_BUTTON_DOWN은 u32 상수)
                    let button_flags = mouse.Anonymous.Anonymous.usButtonFlags as u32;
                    let button = if button_flags & RI_MOUSE_LEFT_BUTTON_DOWN != 0 {
                        Some(MouseButton::Left)
                    } else if button_flags & RI_MOUSE_RIGHT_BUTTON_DOWN != 0 {
                        Some(MouseButton::Right)
                    } else if button_flags & RI_MOUSE_MIDDLE_BUTTON_DOWN != 0 {
                        Some(MouseButton::Middle)
                    } else {
                        None
                    };

                    let event = MouseEvent {
                        delta_x: mouse.lLastX,
                        delta_y: mouse.lLastY,
                        timestamp_us: timestamp,
                        button,
                    };

                    // delta가 있거나 버튼 이벤트가 있을 때만 전송
                    if event.delta_x != 0 || event.delta_y != 0 || event.button.is_some() {
                        // 윈도우 user data에서 sender 포인터 가져오기
                        let ptr = GetWindowLongPtrW(hwnd, GWLP_USERDATA)
                            as *const crossbeam::channel::Sender<MouseEvent>;
                        if !ptr.is_null() {
                            let _ = (*ptr).try_send(event);
                        }
                    }
                }
            }
        }

        return windows::Win32::Foundation::LRESULT(0);
    }

    DefWindowProcW(hwnd, msg, wparam, lparam)
}

/// Windows가 아닌 환경 폴백 — 캡처 스레드 미지원
#[cfg(not(target_os = "windows"))]
pub fn start_raw_input_thread(
    _sender: crossbeam::channel::Sender<MouseEvent>,
    is_capturing: Arc<AtomicBool>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        log::warn!("Raw input 캡처는 Windows에서만 지원됩니다.");
        is_capturing.store(false, Ordering::SeqCst);
    })
}
