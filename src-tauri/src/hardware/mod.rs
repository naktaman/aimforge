//! Hardware 콤보 비교 모듈
//! 마우스/마우스패드 조합별 최적 감도 + DNA 비교
//! 두 하드웨어 콤보 간 Aim DNA 23피처 델타 + cm/360 이동 분석

pub mod commands;

use serde::{Deserialize, Serialize};

/// 하드웨어 콤보 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareCombo {
    pub id: i64,
    pub mouse_model: String,
    pub dpi: i64,
    pub verified_dpi: Option<i64>,
    pub polling_rate: Option<i64>,
    pub mousepad_model: Option<String>,
}

/// 하드웨어 비교 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareComparison {
    /// 콤보 A 정보
    pub combo_a: HardwareCombo,
    /// 콤보 B 정보
    pub combo_b: HardwareCombo,
    /// 최적 cm/360 이동 (B - A)
    pub optimal_shift: f64,
    /// 이동 비율 (%)
    pub shift_pct: f64,
    /// 이동 방향 설명
    pub shift_description: String,
    /// DNA 23피처 델타 목록
    pub dna_deltas: Vec<DnaFeatureDelta>,
    /// 개선된 피처 수
    pub improved_count: usize,
    /// 악화된 피처 수
    pub degraded_count: usize,
    /// 종합 요약 (한국어)
    pub summary: String,
}

/// DNA 피처 델타 (하드웨어 간)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnaFeatureDelta {
    pub feature: String,
    pub value_a: f64,
    pub value_b: f64,
    /// (B - A) / A × 100
    pub delta_pct: f64,
    /// "improved", "degraded", "unchanged"
    pub status: String,
}

/// DNA 피처 쌍 목록을 델타로 변환
/// crossgame/mod.rs의 FeatureDelta 패턴 재사용
pub fn compute_dna_deltas(
    features_a: &[(String, f64)],
    features_b: &[(String, f64)],
) -> Vec<DnaFeatureDelta> {
    let map_b: std::collections::HashMap<&str, f64> = features_b
        .iter()
        .map(|(k, v)| (k.as_str(), *v))
        .collect();

    features_a
        .iter()
        .filter_map(|(name, val_a)| {
            let val_b = map_b.get(name.as_str())?;
            let delta_pct = if val_a.abs() > 0.001 {
                (val_b - val_a) / val_a * 100.0
            } else {
                0.0
            };
            // 일부 피처는 낮을수록 좋음 (overshoot, phase_lag 등)
            let lower_is_better = matches!(
                name.as_str(),
                "overshoot_avg" | "phase_lag" | "fatigue_decay"
                    | "sens_attributed_overshoot" | "tracking_mad"
            );
            let status = if delta_pct.abs() < 2.0 {
                "unchanged".to_string()
            } else if (delta_pct > 0.0) ^ lower_is_better {
                "improved".to_string()
            } else {
                "degraded".to_string()
            };

            Some(DnaFeatureDelta {
                feature: name.clone(),
                value_a: *val_a,
                value_b: *val_b,
                delta_pct,
                status,
            })
        })
        .collect()
}

/// 두 하드웨어 콤보 간 비교 수행
pub fn compare_hardware(
    combo_a: HardwareCombo,
    combo_b: HardwareCombo,
    optimal_a: f64,
    optimal_b: f64,
    features_a: &[(String, f64)],
    features_b: &[(String, f64)],
) -> HardwareComparison {
    let optimal_shift = optimal_b - optimal_a;
    let shift_pct = if optimal_a.abs() > 0.001 {
        optimal_shift / optimal_a * 100.0
    } else {
        0.0
    };

    let dna_deltas = compute_dna_deltas(features_a, features_b);
    let improved_count = dna_deltas.iter().filter(|d| d.status == "improved").count();
    let degraded_count = dna_deltas.iter().filter(|d| d.status == "degraded").count();

    // 이동 방향 설명
    let shift_description = if optimal_shift.abs() < 0.5 {
        "최적 감도 변화 없음".to_string()
    } else if optimal_shift > 0.0 {
        format!(
            "{} → {}: 최적점 {:.1}cm 상승 (+{:.1}%) — 더 느린 감도 필요",
            combo_a.mousepad_model.as_deref().unwrap_or(&combo_a.mouse_model),
            combo_b.mousepad_model.as_deref().unwrap_or(&combo_b.mouse_model),
            optimal_shift, shift_pct
        )
    } else {
        format!(
            "{} → {}: 최적점 {:.1}cm 하강 ({:.1}%) — 더 빠른 감도 필요",
            combo_a.mousepad_model.as_deref().unwrap_or(&combo_a.mouse_model),
            combo_b.mousepad_model.as_deref().unwrap_or(&combo_b.mouse_model),
            optimal_shift.abs(), shift_pct
        )
    };

    // 종합 요약
    let summary = format!(
        "하드웨어 교체 시 최적 cm/360이 {:.1} → {:.1} ({:+.1}%) 이동. DNA 피처 {}개 개선, {}개 악화.",
        optimal_a, optimal_b, shift_pct, improved_count, degraded_count
    );

    HardwareComparison {
        combo_a,
        combo_b,
        optimal_shift,
        shift_pct,
        shift_description,
        dna_deltas,
        improved_count,
        degraded_count,
        summary,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_combo(id: i64, mouse: &str, pad: &str) -> HardwareCombo {
        HardwareCombo {
            id,
            mouse_model: mouse.to_string(),
            dpi: 800,
            verified_dpi: Some(800),
            polling_rate: Some(1000),
            mousepad_model: Some(pad.to_string()),
        }
    }

    fn make_features(values: &[(&str, f64)]) -> Vec<(String, f64)> {
        values.iter().map(|(k, v)| (k.to_string(), *v)).collect()
    }

    #[test]
    fn test_compute_dna_deltas_basic() {
        let a = make_features(&[("flick_peak_velocity", 100.0), ("overshoot_avg", 5.0)]);
        let b = make_features(&[("flick_peak_velocity", 110.0), ("overshoot_avg", 4.0)]);
        let deltas = compute_dna_deltas(&a, &b);
        assert_eq!(deltas.len(), 2);

        // flick_peak_velocity: +10% → improved (higher is better)
        let flick = deltas.iter().find(|d| d.feature == "flick_peak_velocity").unwrap();
        assert!((flick.delta_pct - 10.0).abs() < 0.1);
        assert_eq!(flick.status, "improved");

        // overshoot_avg: -20% → improved (lower is better)
        let os = deltas.iter().find(|d| d.feature == "overshoot_avg").unwrap();
        assert!((os.delta_pct - (-20.0)).abs() < 0.1);
        assert_eq!(os.status, "improved");
    }

    #[test]
    fn test_compute_dna_deltas_unchanged() {
        let a = make_features(&[("smoothness", 80.0)]);
        let b = make_features(&[("smoothness", 80.5)]); // +0.6% < 2% threshold
        let deltas = compute_dna_deltas(&a, &b);
        assert_eq!(deltas[0].status, "unchanged");
    }

    #[test]
    fn test_compare_hardware_shift() {
        let combo_a = make_combo(1, "GPX2", "Hien");
        let combo_b = make_combo(2, "GPX2", "QcK");
        let features = make_features(&[("smoothness", 80.0)]);

        let result = compare_hardware(
            combo_a, combo_b,
            32.0, 30.0, // optimal cm360
            &features, &features,
        );
        assert!((result.optimal_shift - (-2.0)).abs() < 0.01);
        assert!(result.shift_description.contains("하강"));
    }

    #[test]
    fn test_compare_hardware_no_shift() {
        let combo_a = make_combo(1, "GPX2", "Hien");
        let combo_b = make_combo(2, "GPX2", "QcK");
        let features = make_features(&[("smoothness", 80.0)]);

        let result = compare_hardware(
            combo_a, combo_b,
            32.0, 32.2, // 거의 동일
            &features, &features,
        );
        assert!(result.shift_description.contains("변화 없음"));
    }

    #[test]
    fn test_degraded_features() {
        let a = make_features(&[("smoothness", 80.0), ("tracking_mad", 5.0)]);
        let b = make_features(&[("smoothness", 70.0), ("tracking_mad", 6.0)]); // 둘 다 악화
        let deltas = compute_dna_deltas(&a, &b);
        let degraded = deltas.iter().filter(|d| d.status == "degraded").count();
        assert_eq!(degraded, 2);
    }
}
