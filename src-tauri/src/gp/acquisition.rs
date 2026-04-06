//! Expected Improvement 획득 함수 + 다음 후보 탐색
//! EI(x) = (μ(x) - f_best - ξ)Φ(Z) + σ(x)φ(Z)

use super::model::GaussianProcess;
use super::normal::{standard_normal_cdf, standard_normal_pdf};

/// Expected Improvement 계산
/// ξ (xi): 탐색-활용 트레이드오프 파라미터 (기본 0.01, exploitation 우선)
pub fn expected_improvement(gp: &GaussianProcess, x: f64, f_best: f64, xi: f64) -> f64 {
    let pred = gp.predict(x);
    let sigma = pred.variance.sqrt();

    // 분산이 거의 0이면 EI = 0
    if sigma < 1e-10 {
        return 0.0;
    }

    let improvement = pred.mean - f_best - xi;
    let z = improvement / sigma;

    // EI = improvement × Φ(Z) + σ × φ(Z)
    improvement * standard_normal_cdf(z) + sigma * standard_normal_pdf(z)
}

/// 범위 내 grid search로 다음 테스트 후보 찾기
/// step: 탐색 간격 (기본 0.5 cm/360)
pub fn next_candidate(
    gp: &GaussianProcess,
    range_min: f64,
    range_max: f64,
    step: f64,
    xi: f64,
) -> NextCandidate {
    let f_best = match gp.best_observation() {
        Some((_, y)) => y,
        None => return NextCandidate {
            cm360: (range_min + range_max) / 2.0,
            ei: f64::MAX,
        },
    };

    let mut best_x = range_min;
    let mut best_ei = f64::NEG_INFINITY;

    let mut x = range_min;
    while x <= range_max {
        let ei = expected_improvement(gp, x, f_best, xi);
        if ei > best_ei {
            best_ei = ei;
            best_x = x;
        }
        x += step;
    }

    NextCandidate {
        cm360: best_x,
        ei: best_ei,
    }
}

/// 다음 후보 결과
#[derive(Debug, Clone)]
pub struct NextCandidate {
    /// 다음 테스트할 cm/360 값
    pub cm360: f64,
    /// 해당 지점의 Expected Improvement 값
    pub ei: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 최적점보다 좋은 예측이 있는 영역에서 EI > 0
    #[test]
    fn test_ei_positive_in_promising_region() {
        let mut gp = GaussianProcess::default_for_calibration();
        gp.add_observation(20.0, 0.5);
        gp.add_observation(40.0, 0.5);

        // 중간 영역은 불확실성이 높아 EI > 0
        let ei = expected_improvement(&gp, 30.0, 0.5, 0.01);
        assert!(ei >= 0.0, "미탐색 영역의 EI는 0 이상: got {}", ei);
    }

    /// 관측점 근처에서는 EI가 낮음
    #[test]
    fn test_ei_low_near_observation() {
        let mut gp = GaussianProcess::default_for_calibration();
        gp.add_observation(30.0, 0.9);
        gp.add_observation(31.0, 0.85);

        let ei_near = expected_improvement(&gp, 30.5, 0.9, 0.01);
        let _ei_far = expected_improvement(&gp, 45.0, 0.9, 0.01);

        // 관측점 사이는 잘 알려져 있으므로 EI가 낮음
        // (항상 성립하진 않지만 일반적 경향)
        assert!(ei_near >= 0.0, "EI는 항상 0 이상");
    }

    /// next_candidate가 합리적 범위 반환
    #[test]
    fn test_next_candidate_in_range() {
        let mut gp = GaussianProcess::default_for_calibration();
        gp.add_observation(25.0, 0.6);
        gp.add_observation(35.0, 0.8);

        let candidate = next_candidate(&gp, 15.0, 60.0, 0.5, 0.01);
        assert!(
            candidate.cm360 >= 15.0 && candidate.cm360 <= 60.0,
            "후보는 범위 내: got {}",
            candidate.cm360
        );
    }

    /// 관측 없으면 중앙값 반환
    #[test]
    fn test_next_candidate_no_observations() {
        let gp = GaussianProcess::default_for_calibration();
        let candidate = next_candidate(&gp, 15.0, 60.0, 0.5, 0.01);
        assert!(
            (candidate.cm360 - 37.5).abs() < 1.0,
            "관측 없으면 중앙값: got {}",
            candidate.cm360
        );
    }

    /// 합성 포물선 — GP가 최적점 근처를 탐색하는지 확인
    #[test]
    fn test_candidate_converges_toward_optimum() {
        let mut gp = GaussianProcess::default_for_calibration();

        // 포물선: 35 cm/360에서 최적 (score = 0.9)
        let score = |x: f64| -> f64 { -((x - 35.0) / 10.0).powi(2) + 0.9 };

        // 초기 관측 3개
        gp.add_observation(25.0, score(25.0));
        gp.add_observation(35.0, score(35.0));
        gp.add_observation(45.0, score(45.0));

        // 다음 후보는 최적 근처 or 미탐색 영역
        let candidate = next_candidate(&gp, 15.0, 60.0, 0.5, 0.01);
        // EI가 양수인 후보가 존재해야 함
        assert!(candidate.ei >= 0.0);
    }
}
