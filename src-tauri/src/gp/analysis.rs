//! 수렴 판정, 이봉(bimodal) 감지, 변경 유의성 검정

use super::model::GaussianProcess;
use super::normal::standard_normal_cdf;
use serde::{Deserialize, Serialize};

/// 수렴 모드별 EI 임계값
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ConvergenceMode {
    Quick,     // ε = 0.01
    Deep,      // ε = 0.005
    Obsessive, // ε = 0.001
}

impl ConvergenceMode {
    /// 모드별 EI 임계값 반환
    pub fn ei_threshold(&self) -> f64 {
        match self {
            ConvergenceMode::Quick => 0.01,
            ConvergenceMode::Deep => 0.005,
            ConvergenceMode::Obsessive => 0.001,
        }
    }

    /// 모드별 최대 반복 횟수
    pub fn max_iterations(&self) -> usize {
        match self {
            ConvergenceMode::Quick => 15,
            ConvergenceMode::Deep => 25,
            ConvergenceMode::Obsessive => 40,
        }
    }
}

/// 수렴 상태
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvergenceStatus {
    pub converged: bool,
    pub reason: Option<String>,
}

/// 수렴 판정
/// 조건 1: max EI < ε
/// 조건 2: 최근 3회 최적값 변동 < 1 cm/360
/// 조건 3: 최대 반복 도달
pub fn check_convergence(
    max_ei: f64,
    mode: ConvergenceMode,
    recent_bests: &[f64],
    iteration: usize,
) -> ConvergenceStatus {
    // 조건 3: 최대 반복 도달
    if iteration >= mode.max_iterations() {
        return ConvergenceStatus {
            converged: true,
            reason: Some(format!("최대 반복 횟수 도달 ({}회)", iteration)),
        };
    }

    // 조건 1: EI < ε
    let ei_converged = max_ei < mode.ei_threshold();

    // 조건 2: 최근 3회 최적 cm360 변동 < 1
    let best_stable = if recent_bests.len() >= 3 {
        let last3 = &recent_bests[recent_bests.len() - 3..];
        let range = last3.iter().cloned().fold(f64::NEG_INFINITY, f64::max)
            - last3.iter().cloned().fold(f64::INFINITY, f64::min);
        range < 1.0
    } else {
        false
    };

    if ei_converged && best_stable {
        ConvergenceStatus {
            converged: true,
            reason: Some("EI 수렴 + 최적값 안정".to_string()),
        }
    } else if ei_converged {
        ConvergenceStatus {
            converged: true,
            reason: Some("EI 수렴 (탐색 이득 소진)".to_string()),
        }
    } else {
        ConvergenceStatus {
            converged: false,
            reason: None,
        }
    }
}

/// 이봉 감지용 피크 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Peak {
    /// 피크 위치 (cm/360)
    pub cm360: f64,
    /// 피크에서의 GP mean
    pub score: f64,
    /// 피크에서의 GP variance
    pub variance: f64,
    /// 주 피크 여부
    pub is_primary: bool,
}

/// GP mean curve에서 local maxima 스캔하여 이봉 감지
/// step: 스캔 간격 (기본 0.5)
pub fn detect_bimodal(
    gp: &GaussianProcess,
    range_min: f64,
    range_max: f64,
    step: f64,
) -> Vec<Peak> {
    if gp.n_observations() < 3 {
        return Vec::new();
    }

    // GP mean curve 샘플링
    let predictions = gp.predict_range(range_min, range_max, step);
    if predictions.len() < 3 {
        return Vec::new();
    }

    // local maxima 탐색
    let mut peaks = Vec::new();
    for i in 1..predictions.len() - 1 {
        let (x_prev, mean_prev, _) = predictions[i - 1];
        let (x_curr, mean_curr, var_curr) = predictions[i];
        let (x_next, mean_next, _) = predictions[i + 1];

        // local maximum: 양쪽보다 높음
        if mean_curr > mean_prev && mean_curr > mean_next {
            peaks.push(Peak {
                cm360: x_curr,
                score: mean_curr,
                variance: var_curr,
                is_primary: false,
            });
        }
    }

    // 경계 체크 (양 끝이 최대일 수 있음)
    if predictions.len() >= 2 {
        let (x0, m0, v0) = predictions[0];
        let (_, m1, _) = predictions[1];
        if m0 > m1 {
            peaks.push(Peak {
                cm360: x0,
                score: m0,
                variance: v0,
                is_primary: false,
            });
        }

        let last = predictions.len() - 1;
        let (xl, ml, vl) = predictions[last];
        let (_, ml_1, _) = predictions[last - 1];
        if ml > ml_1 {
            peaks.push(Peak {
                cm360: xl,
                score: ml,
                variance: vl,
                is_primary: false,
            });
        }
    }

    // 점수 기준 정렬 (높은 순)
    // NaN 방어: partial_cmp 실패 시 Equal 처리
    peaks.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

    // primary 표시
    if !peaks.is_empty() {
        peaks[0].is_primary = true;
    }

    peaks
}

/// 유의성 검정 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignificanceResult {
    /// z-score
    pub z_score: f64,
    /// p-value (단측)
    pub p_value: f64,
    /// 추천 라벨
    pub label: SignificanceLabel,
}

/// 유의성 라벨
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SignificanceLabel {
    /// p < 0.05: "변경 추천 (유의미한 개선)"
    Recommend,
    /// p < 0.2: "약간 나을 수 있지만 큰 차이 없음"
    Marginal,
    /// p >= 0.2: "현재 감도 유지 — 이미 최적 근처"
    Keep,
}

/// 변경 유의성 검정
/// z = (mean_optimal - mean_current) / sqrt(var_opt + var_cur)
pub fn significance_test(
    gp: &GaussianProcess,
    current_cm360: f64,
    optimal_cm360: f64,
) -> SignificanceResult {
    let pred_current = gp.predict(current_cm360);
    let pred_optimal = gp.predict(optimal_cm360);

    let combined_var = pred_optimal.variance + pred_current.variance;
    let combined_std = combined_var.sqrt();

    // 분산이 거의 0이면 직접 비교
    let z_score = if combined_std < 1e-10 {
        if pred_optimal.mean > pred_current.mean {
            3.0 // 큰 z-score
        } else {
            0.0
        }
    } else {
        (pred_optimal.mean - pred_current.mean) / combined_std
    };

    // p-value: 단측 검정 (optimal이 current보다 나은지)
    let p_value = 1.0 - standard_normal_cdf(z_score);

    let label = if p_value < 0.05 {
        SignificanceLabel::Recommend
    } else if p_value < 0.2 {
        SignificanceLabel::Marginal
    } else {
        SignificanceLabel::Keep
    };

    SignificanceResult {
        z_score,
        p_value,
        label,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gp::kernel::Matern52Kernel;

    /// 수렴 — EI 소진 + 안정
    #[test]
    fn test_convergence_ei_and_stable() {
        let recent = vec![35.0, 35.2, 35.1];
        let status = check_convergence(0.001, ConvergenceMode::Quick, &recent, 10);
        assert!(status.converged, "EI < ε + 안정 → 수렴");
    }

    /// 수렴 — 최대 반복 도달
    #[test]
    fn test_convergence_max_iterations() {
        let recent = vec![30.0, 35.0, 40.0]; // 불안정하지만 max iter
        let status = check_convergence(0.1, ConvergenceMode::Quick, &recent, 15);
        assert!(status.converged, "최대 반복 → 수렴");
    }

    /// 미수렴
    #[test]
    fn test_not_converged() {
        let recent = vec![30.0, 35.0];
        let status = check_convergence(0.1, ConvergenceMode::Quick, &recent, 5);
        assert!(!status.converged, "EI 높고 반복 부족 → 미수렴");
    }

    /// 이봉 감지 — 합성 이봉 데이터
    #[test]
    fn test_bimodal_detection() {
        let mut gp = GaussianProcess::new(
            Matern52Kernel::new(3.0, 0.1), // 짧은 length_scale로 이봉 허용
            0.015,
        );

        // 두 피크: 25와 45에서 높은 점수
        gp.add_observation(20.0, 0.3);
        gp.add_observation(25.0, 0.85);
        gp.add_observation(30.0, 0.4);
        gp.add_observation(35.0, 0.3);
        gp.add_observation(40.0, 0.4);
        gp.add_observation(45.0, 0.8);
        gp.add_observation(50.0, 0.3);

        let peaks = detect_bimodal(&gp, 15.0, 55.0, 0.5);
        assert!(
            peaks.len() >= 2,
            "이봉 데이터에서 2개 이상 피크 감지: got {}",
            peaks.len()
        );
        assert!(peaks[0].is_primary, "첫 번째 피크가 primary");
    }

    /// 단봉 데이터 — 1개 피크만 감지
    #[test]
    fn test_unimodal() {
        let mut gp = GaussianProcess::default_for_calibration();
        let score = |x: f64| -> f64 { -((x - 35.0) / 10.0).powi(2) + 0.9 };

        for x in (15..=55).step_by(5) {
            gp.add_observation(x as f64, score(x as f64));
        }

        let peaks = detect_bimodal(&gp, 15.0, 55.0, 0.5);
        assert!(
            peaks.len() >= 1,
            "단봉 데이터에서 최소 1개 피크"
        );
        // primary 피크가 35 근처
        assert!(
            (peaks[0].cm360 - 35.0).abs() < 5.0,
            "primary 피크가 최적 근처: got {}",
            peaks[0].cm360
        );
    }

    /// 유의성 검정 — 큰 차이 → Recommend
    #[test]
    fn test_significance_large_difference() {
        let mut gp = GaussianProcess::default_for_calibration();
        gp.add_observation(30.0, 0.5);
        gp.add_observation(35.0, 0.9);
        gp.add_observation(40.0, 0.6);

        let result = significance_test(&gp, 30.0, 35.0);
        assert_eq!(
            result.label,
            SignificanceLabel::Recommend,
            "큰 차이 → Recommend: z={}, p={}",
            result.z_score,
            result.p_value
        );
    }

    /// 유의성 검정 — 동일값 → Keep
    #[test]
    fn test_significance_same_value() {
        let mut gp = GaussianProcess::default_for_calibration();
        gp.add_observation(30.0, 0.7);
        gp.add_observation(35.0, 0.7);
        gp.add_observation(40.0, 0.7);

        let result = significance_test(&gp, 35.0, 35.0);
        assert_eq!(
            result.label,
            SignificanceLabel::Keep,
            "동일점 → Keep: z={}, p={}",
            result.z_score,
            result.p_value
        );
    }
}
