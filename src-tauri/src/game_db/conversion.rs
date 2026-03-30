/// 물리 변환 함수
/// raw mouse delta → cm → degrees, 게임 감도 ↔ cm/360, FOV 변환
/// 모든 에임 분석의 기반이 되는 핵심 변환 로직

/// raw delta를 센티미터로 변환
/// DPI = dots per inch, 1 inch = 2.54 cm
/// cm = counts / dpi * 2.54
pub fn raw_to_cm(dx: i32, dy: i32, dpi: u32) -> (f64, f64) {
    let factor = 2.54 / dpi as f64;
    (dx as f64 * factor, dy as f64 * factor)
}

/// 센티미터 이동량을 회전 각도로 변환
/// cm_per_360: 360도 회전에 필요한 마우스 이동 거리 (cm)
/// degrees = cm / cm_per_360 * 360
pub fn cm_to_degrees(cm: f64, cm_per_360: f64) -> f64 {
    if cm_per_360 == 0.0 {
        return 0.0;
    }
    cm / cm_per_360 * 360.0
}

/// 게임 감도 + DPI → cm/360 변환
/// 공식: cm/360 = (360 / (sens * yaw * dpi)) * 2.54
/// yaw: 게임별 yaw 상수 (degrees per count at sens=1, dpi=1)
pub fn game_sens_to_cm360(sens: f64, dpi: u32, yaw: f64) -> f64 {
    if sens == 0.0 || yaw == 0.0 || dpi == 0 {
        return 0.0;
    }
    // 360도 회전에 필요한 counts = 360 / (sens * yaw)
    // counts를 inches로: counts / dpi
    // inches를 cm로: * 2.54
    (360.0 / (sens * yaw * dpi as f64)) * 2.54
}

/// cm/360 → 게임 감도 역변환
/// sens = (360 * 2.54) / (cm360 * yaw * dpi)
pub fn cm360_to_sens(cm360: f64, dpi: u32, yaw: f64) -> f64 {
    if cm360 == 0.0 || yaw == 0.0 || dpi == 0 {
        return 0.0;
    }
    (360.0 * 2.54) / (cm360 * yaw * dpi as f64)
}

/// 게임 FOV를 수평 FOV(hFOV)로 변환
/// fov_type: "horizontal" → 그대로, "vertical" → 화면비로 변환
/// vertical → horizontal: hFOV = 2 * atan(tan(vFOV/2) * aspect_ratio)
pub fn game_fov_to_hfov(game_fov: f64, fov_type: &str, aspect_ratio: f64) -> f64 {
    match fov_type {
        "horizontal" => game_fov,
        "vertical" => {
            let vfov_rad = game_fov.to_radians();
            let hfov_rad = 2.0 * (vfov_rad / 2.0).tan() * aspect_ratio;
            hfov_rad.atan() * 2.0_f64.to_degrees()
        }
        // diagonal이나 기타 → 근사치로 horizontal 취급
        _ => game_fov,
    }
}

/// 줌 배율 계산 (k-parameter 모델)
/// mult = (tan(fov_h/2) / tan(fov_s/2))^k
/// fov_h: 힙파이어 hFOV, fov_s: 스코프 hFOV, k: 줌 파라미터
pub fn zoom_multiplier(fov_hipfire: f64, fov_scope: f64, k: f64) -> f64 {
    let hip_rad = fov_hipfire.to_radians() / 2.0;
    let scope_rad = fov_scope.to_radians() / 2.0;

    if scope_rad.tan() == 0.0 {
        return 1.0;
    }

    (hip_rad.tan() / scope_rad.tan()).powf(k)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// CS2 sens 2.0 @ 400 DPI → ~46.4 cm/360
    #[test]
    fn test_cs2_cm360() {
        let cm360 = game_sens_to_cm360(2.0, 400, 0.022);
        // 예상값: (360 / (2.0 * 0.022 * 400)) * 2.54 = (360 / 17.6) * 2.54 ≈ 51.95
        // 실제 CS2 커뮤니티 기준 ~52cm/360 (yaw=0.022)
        assert!(
            (cm360 - 51.95).abs() < 0.5,
            "CS2 2.0@400 expected ~52 cm/360, got {:.2}",
            cm360
        );
    }

    /// Valorant sens 0.39 @ 800 DPI → ~31.7 cm/360
    #[test]
    fn test_valorant_cm360() {
        let cm360 = game_sens_to_cm360(0.39, 800, 0.07);
        // 예상값: (360 / (0.39 * 0.07 * 800)) * 2.54 = (360 / 21.84) * 2.54 ≈ 41.87
        // Valorant yaw=0.07 기준
        assert!(
            (cm360 - 41.87).abs() < 0.5,
            "Valorant 0.39@800 expected ~41.87 cm/360, got {:.2}",
            cm360
        );
    }

    /// cm360 → sens 역변환 정확성 검증
    #[test]
    fn test_roundtrip_conversion() {
        let original_sens = 2.0;
        let dpi = 400;
        let yaw = 0.022;

        let cm360 = game_sens_to_cm360(original_sens, dpi, yaw);
        let recovered_sens = cm360_to_sens(cm360, dpi, yaw);

        assert!(
            (original_sens - recovered_sens).abs() < 0.001,
            "Roundtrip failed: {} → cm360 {} → {}",
            original_sens,
            cm360,
            recovered_sens
        );
    }

    /// raw_to_cm 기본 변환 테스트
    #[test]
    fn test_raw_to_cm() {
        // 400 DPI에서 400 counts = 1 inch = 2.54 cm
        let (cx, _cy) = raw_to_cm(400, 0, 400);
        assert!(
            (cx - 2.54).abs() < 0.01,
            "400 counts @ 400 DPI should be 2.54 cm, got {:.4}",
            cx
        );
    }

    /// cm_to_degrees 변환 테스트
    #[test]
    fn test_cm_to_degrees() {
        // cm_per_360이 36cm일 때, 18cm 이동 = 180도
        let deg = cm_to_degrees(18.0, 36.0);
        assert!(
            (deg - 180.0).abs() < 0.01,
            "18cm with 36cm/360 should be 180 degrees, got {:.2}",
            deg
        );
    }

    /// 제로 입력 안전성 테스트
    #[test]
    fn test_zero_safety() {
        assert_eq!(game_sens_to_cm360(0.0, 400, 0.022), 0.0);
        assert_eq!(cm360_to_sens(0.0, 400, 0.022), 0.0);
        assert_eq!(cm_to_degrees(10.0, 0.0), 0.0);
    }

    /// 줌 배율 테스트: k=1일 때 기본 배율
    #[test]
    fn test_zoom_multiplier() {
        // hFOV 103 → scope 50, k=1
        let mult = zoom_multiplier(103.0, 50.0, 1.0);
        // tan(51.5°) / tan(25°) ≈ 1.258 / 0.466 ≈ 2.70
        assert!(
            mult > 2.0 && mult < 3.5,
            "Zoom multiplier 103→50 k=1 should be ~2.7, got {:.2}",
            mult
        );
    }
}
