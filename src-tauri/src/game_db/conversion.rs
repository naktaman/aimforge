/// 물리 변환 함수
/// raw mouse delta → cm → degrees, 게임 감도 ↔ cm/360, FOV 변환
/// 6가지 변환 방식 (MDM 0/56.25/75/100%, Viewspeed H/V)
/// 모든 에임 분석의 기반이 되는 핵심 변환 로직

use std::collections::HashMap;

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
            // vertical → horizontal: hFOV = 2 × atan(tan(vFOV/2) × aspect_ratio)
            let vfov_rad = game_fov.to_radians();
            let half_hfov = ((vfov_rad / 2.0).tan() * aspect_ratio).atan();
            (half_hfov * 2.0).to_degrees()
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

/// 수평 FOV → 수직 FOV 역변환
/// vFOV = 2 × atan(tan(hFOV/2) / aspect_ratio)
pub fn hfov_to_vfov(hfov_deg: f64, aspect_ratio: f64) -> f64 {
    let hfov_rad = hfov_deg.to_radians();
    let vfov_rad = 2.0 * ((hfov_rad / 2.0).tan() / aspect_ratio).atan();
    vfov_rad.to_degrees()
}

/// MDM(Monitor Distance Match) p% 배율 계산
/// mult = (tan(dst/2) / tan(src/2))^(1 - p/100)
/// MDM 0%: 순수 FOV 탄젠트 비율, MDM 100%: 배율 1.0 (감도 동일)
pub fn mdm_multiplier(src_fov_h: f64, dst_fov_h: f64, mdm_pct: f64) -> f64 {
    let src_rad = src_fov_h.to_radians() / 2.0;
    let dst_rad = dst_fov_h.to_radians() / 2.0;
    let fov_ratio = dst_rad.tan() / src_rad.tan();
    fov_ratio.powf(1.0 - mdm_pct / 100.0)
}

/// Viewspeed H(수평) 배율 — FOV 각도 직접 비율
pub fn viewspeed_h_multiplier(src_fov_h: f64, dst_fov_h: f64) -> f64 {
    if src_fov_h == 0.0 {
        return 1.0;
    }
    dst_fov_h / src_fov_h
}

/// Viewspeed V(수직) 배율 — vFOV 비율
pub fn viewspeed_v_multiplier(src_fov_h: f64, dst_fov_h: f64, aspect_ratio: f64) -> f64 {
    let src_vfov = hfov_to_vfov(src_fov_h, aspect_ratio);
    let dst_vfov = hfov_to_vfov(dst_fov_h, aspect_ratio);
    if src_vfov == 0.0 {
        return 1.0;
    }
    dst_vfov / src_vfov
}

/// 6가지 변환 방식 동시 계산
/// 각 방식별 배율을 cm/360에 적용: dst_cm360 = src_cm360 / mult
/// 반환: method name → 변환된 cm/360
pub fn convert_all_methods(
    src_fov_h: f64,
    dst_fov_h: f64,
    src_cm360: f64,
    aspect_ratio: f64,
) -> HashMap<String, f64> {
    let mut results = HashMap::new();

    // MDM 0%, 56.25%, 75%, 100%
    for (label, pct) in &[
        ("MDM_0", 0.0),
        ("MDM_56.25", 56.25),
        ("MDM_75", 75.0),
        ("MDM_100", 100.0),
    ] {
        let mult = mdm_multiplier(src_fov_h, dst_fov_h, *pct);
        results.insert(label.to_string(), src_cm360 / mult);
    }

    // Viewspeed H
    let vs_h = viewspeed_h_multiplier(src_fov_h, dst_fov_h);
    results.insert("Viewspeed_H".to_string(), src_cm360 / vs_h);

    // Viewspeed V
    let vs_v = viewspeed_v_multiplier(src_fov_h, dst_fov_h, aspect_ratio);
    results.insert("Viewspeed_V".to_string(), src_cm360 / vs_v);

    results
}

/// sens_step 스냅 — 최적 cm/360에 가장 가까운 게임 감도 후보 2개 계산
/// 반환: (floor_sens, floor_cm360, ceil_sens, ceil_cm360)
pub fn snap_sensitivity(
    target_cm360: f64,
    dpi: u32,
    yaw: f64,
    sens_step: f64,
) -> (f64, f64, f64, f64) {
    let ideal_sens = cm360_to_sens(target_cm360, dpi, yaw);

    // floor/ceil 스냅 (sens_step 단위로 반올림)
    let floor_sens = (ideal_sens / sens_step).floor() * sens_step;
    let ceil_sens = (ideal_sens / sens_step).ceil() * sens_step;

    // 각 후보의 실제 cm/360 역산
    let floor_cm360 = if floor_sens > 0.0 {
        game_sens_to_cm360(floor_sens, dpi, yaw)
    } else {
        // floor가 0이면 ceil만 유효
        f64::INFINITY
    };
    let ceil_cm360 = game_sens_to_cm360(ceil_sens, dpi, yaw);

    (floor_sens, floor_cm360, ceil_sens, ceil_cm360)
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

    /// game_fov_to_hfov vertical 변환 검증 (버그 수정 확인)
    /// 60 vFOV @ 16:9 → hFOV ≈ 91.5° (2*atan(tan(30°)*16/9))
    #[test]
    fn test_vertical_fov_conversion() {
        let hfov = game_fov_to_hfov(60.0, "vertical", 16.0 / 9.0);
        // 정확한 값: 2*atan(tan(30°)*16/9) = 2*atan(0.5774*1.7778) ≈ 91.49°
        assert!(
            (hfov - 91.49).abs() < 0.1,
            "60 vFOV @ 16:9 → hFOV should be ~91.49, got {:.2}",
            hfov
        );
        // TS physics.ts와 동일한 결과인지 교차 검증
        // gameFovToHfov(60, 'vertical', 16/9) → 91.49
    }

    /// hfov_to_vfov 왕복 검증 — game_fov_to_hfov와 정확히 역함수
    #[test]
    fn test_hfov_vfov_roundtrip() {
        let original_vfov = 60.0;
        let ar = 16.0 / 9.0;
        let hfov = game_fov_to_hfov(original_vfov, "vertical", ar);
        let recovered_vfov = hfov_to_vfov(hfov, ar);
        assert!(
            (original_vfov - recovered_vfov).abs() < 0.001,
            "Roundtrip failed: {} → {} → {}",
            original_vfov, hfov, recovered_vfov
        );
    }

    /// MDM 0%: 같은 FOV → 배율 1.0
    #[test]
    fn test_mdm_0_same_fov() {
        let mult = mdm_multiplier(103.0, 103.0, 0.0);
        assert!(
            (mult - 1.0).abs() < 0.001,
            "MDM 0% same FOV should give mult=1.0, got {:.4}",
            mult
        );
    }

    /// MDM 100%: 항상 배율 1.0 (FOV 무관)
    #[test]
    fn test_mdm_100_always_1() {
        let mult = mdm_multiplier(103.0, 50.0, 100.0);
        assert!(
            (mult - 1.0).abs() < 0.001,
            "MDM 100% should always be 1.0, got {:.4}",
            mult
        );
    }

    /// Viewspeed H: 같은 FOV → 배율 1.0
    #[test]
    fn test_viewspeed_h_same_fov() {
        let mult = viewspeed_h_multiplier(103.0, 103.0);
        assert!(
            (mult - 1.0).abs() < 0.001,
            "Viewspeed H same FOV should be 1.0, got {:.4}",
            mult
        );
    }

    /// convert_all_methods: 결과 6개, 같은 FOV → 모든 방식 cm360 동일
    #[test]
    fn test_convert_all_methods_same_fov() {
        let results = convert_all_methods(103.0, 103.0, 30.0, 16.0 / 9.0);
        assert_eq!(results.len(), 6, "6가지 방식 결과가 있어야 함");
        for (method, cm360) in &results {
            assert!(
                (cm360 - 30.0).abs() < 0.01,
                "{}: 같은 FOV에서 cm360=30 유지해야 함, got {:.4}",
                method, cm360
            );
        }
    }

    /// convert_all_methods: 다른 FOV → MDM 0%와 100%가 다른 값
    #[test]
    fn test_convert_all_methods_different_fov() {
        let results = convert_all_methods(103.0, 50.0, 30.0, 16.0 / 9.0);
        let mdm0 = results["MDM_0"];
        let mdm100 = results["MDM_100"];
        // MDM 100%는 cm360 그대로 (mult=1.0), MDM 0%는 FOV 비율만큼 변함
        assert!(
            (mdm100 - 30.0).abs() < 0.01,
            "MDM 100%는 cm360 유지해야 함: {:.4}",
            mdm100
        );
        assert!(
            (mdm0 - 30.0).abs() > 1.0,
            "MDM 0%는 cm360이 달라져야 함: {:.4}",
            mdm0
        );
    }

    /// snap_sensitivity: CS2 sens_step=0.01 스냅 정확성
    #[test]
    fn test_snap_sensitivity_cs2() {
        // CS2: yaw=0.022, 400 DPI
        // sens 2.0 → cm360 ≈ 51.95
        // target cm360=50 → ideal sens ≈ 2.078
        // floor=2.07, ceil=2.08 (step=0.01)
        let (floor_s, floor_c, ceil_s, ceil_c) =
            snap_sensitivity(50.0, 400, 0.022, 0.01);

        assert!(
            (floor_s - 2.07).abs() < 0.01,
            "floor_sens expected ~2.07, got {:.4}",
            floor_s
        );
        assert!(
            (ceil_s - 2.08).abs() < 0.01,
            "ceil_sens expected ~2.08, got {:.4}",
            ceil_s
        );
        // floor_cm360 > target > ceil_cm360 (감도↑ → cm360↓)
        assert!(
            floor_c > 50.0 && ceil_c < 50.0,
            "floor_cm360={:.2} > 50 > ceil_cm360={:.2}",
            floor_c, ceil_c
        );
    }
}
