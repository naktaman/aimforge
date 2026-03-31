//! 정규분포 관련 수학 함수 — erf, cdf, pdf
//! Abramowitz & Stegun 7.1.26 근사 사용 (외부 의존 없음)

use std::f64::consts::{FRAC_2_SQRT_PI, PI};

/// 오차 함수 (error function) — Horner 형태의 유리 근사
/// Abramowitz & Stegun 7.1.28 기반, 최대 오차 ~2.5×10⁻⁵
/// x=0에서 정확히 0 반환
pub fn erf(x: f64) -> f64 {
    if x == 0.0 {
        return 0.0;
    }

    // 음수 대칭: erf(-x) = -erf(x)
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let ax = x.abs();

    // Abramowitz & Stegun 7.1.26 (Horner 형태로 수치 안정성 개선)
    const P: f64 = 0.3275911;
    const A1: f64 = 0.254829592;
    const A2: f64 = -0.284496736;
    const A3: f64 = 1.421413741;
    const A4: f64 = -1.453152027;
    const A5: f64 = 1.061405429;

    let t = 1.0 / (1.0 + P * ax);
    // Horner 방식: ((((a5*t + a4)*t + a3)*t + a2)*t + a1)*t
    let poly = ((((A5 * t + A4) * t + A3) * t + A2) * t + A1) * t;
    let result = 1.0 - poly * (-ax * ax).exp();

    sign * result
}

/// 표준정규분포 누적분포함수 Φ(z)
/// Φ(z) = (1 + erf(z/√2)) / 2
pub fn standard_normal_cdf(z: f64) -> f64 {
    0.5 * (1.0 + erf(z / std::f64::consts::SQRT_2))
}

/// 표준정규분포 확률밀도함수 φ(z)
/// φ(z) = (1/√(2π)) × exp(-z²/2)
pub fn standard_normal_pdf(z: f64) -> f64 {
    (1.0 / (2.0 * PI).sqrt()) * (-0.5 * z * z).exp()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// erf(0) = 0 검증
    #[test]
    fn test_erf_zero() {
        assert!((erf(0.0)).abs() < 1e-10);
    }

    /// erf(∞) → 1 검증
    #[test]
    fn test_erf_large() {
        assert!((erf(5.0) - 1.0).abs() < 1e-7);
    }

    /// erf 음수 대칭 검증
    #[test]
    fn test_erf_symmetry() {
        assert!((erf(1.0) + erf(-1.0)).abs() < 1e-10);
    }

    /// erf(1) ≈ 0.8427 검증
    #[test]
    fn test_erf_known_value() {
        assert!((erf(1.0) - 0.8427007929).abs() < 1e-6);
    }

    /// Φ(0) = 0.5 검증
    #[test]
    fn test_cdf_zero() {
        assert!((standard_normal_cdf(0.0) - 0.5).abs() < 1e-10);
    }

    /// Φ(-∞) → 0, Φ(∞) → 1 검증
    #[test]
    fn test_cdf_extremes() {
        assert!(standard_normal_cdf(-10.0) < 1e-10);
        assert!((standard_normal_cdf(10.0) - 1.0).abs() < 1e-10);
    }

    /// Φ(1.96) ≈ 0.975 검증 (95% 신뢰구간)
    #[test]
    fn test_cdf_1_96() {
        assert!((standard_normal_cdf(1.96) - 0.975).abs() < 0.001);
    }

    /// φ(0) = 1/√(2π) ≈ 0.3989 검증
    #[test]
    fn test_pdf_zero() {
        let expected = 1.0 / (2.0 * PI).sqrt();
        assert!((standard_normal_pdf(0.0) - expected).abs() < 1e-10);
    }

    /// φ(z) 대칭 검증
    #[test]
    fn test_pdf_symmetry() {
        assert!((standard_normal_pdf(1.5) - standard_normal_pdf(-1.5)).abs() < 1e-10);
    }
}
