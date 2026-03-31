//! Matérn 5/2 커널 구현
//! k(x,x') = σ² × (1 + √5·r/l + 5r²/(3l²)) × exp(-√5·r/l)
//! r = |x - x'| (유클리디안 거리)

use serde::{Deserialize, Serialize};

/// Matérn 5/2 커널 하이퍼파라미터
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Matern52Kernel {
    /// 길이 스케일 — 상관관계 감소 속도 제어
    pub length_scale: f64,
    /// 신호 분산 — 함수 값의 변동 범위
    pub signal_var: f64,
}

impl Matern52Kernel {
    /// 기본 하이퍼파라미터로 커널 생성
    pub fn new(length_scale: f64, signal_var: f64) -> Self {
        Self {
            length_scale,
            signal_var,
        }
    }

    /// 기본값: length_scale=5.0, signal_var=0.1
    pub fn default_for_calibration() -> Self {
        Self {
            length_scale: 5.0,
            signal_var: 0.1,
        }
    }

    /// 두 입력 x1, x2 사이의 커널 값 계산
    /// k(x1, x2) = σ² × (1 + √5·r/l + 5r²/(3l²)) × exp(-√5·r/l)
    pub fn compute(&self, x1: f64, x2: f64) -> f64 {
        let r = (x1 - x2).abs();
        let sqrt5 = 5.0_f64.sqrt();
        let ratio = sqrt5 * r / self.length_scale;

        // (1 + √5·r/l + 5r²/(3l²)) × exp(-√5·r/l)
        let term = 1.0 + ratio + (ratio * ratio) / 3.0;
        self.signal_var * term * (-ratio).exp()
    }

    /// 커널 행렬 K 계산 (n×n 대칭 행렬)
    /// K[i][j] = k(xs[i], xs[j])
    pub fn compute_matrix(&self, xs: &[f64]) -> Vec<Vec<f64>> {
        let n = xs.len();
        let mut matrix = vec![vec![0.0; n]; n];
        for i in 0..n {
            for j in i..n {
                let val = self.compute(xs[i], xs[j]);
                matrix[i][j] = val;
                matrix[j][i] = val; // 대칭
            }
        }
        matrix
    }

    /// 커널 벡터 k* 계산 — 새 입력 x_new와 기존 입력들 사이
    /// k*[i] = k(x_new, xs[i])
    pub fn compute_vector(&self, x_new: f64, xs: &[f64]) -> Vec<f64> {
        xs.iter().map(|&x| self.compute(x_new, x)).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 자기상관: k(x, x) = σ² 검증
    #[test]
    fn test_self_correlation() {
        let kernel = Matern52Kernel::default_for_calibration();
        let val = kernel.compute(30.0, 30.0);
        assert!((val - kernel.signal_var).abs() < 1e-10);
    }

    /// 대칭성: k(x1, x2) = k(x2, x1) 검증
    #[test]
    fn test_symmetry() {
        let kernel = Matern52Kernel::default_for_calibration();
        let k12 = kernel.compute(25.0, 35.0);
        let k21 = kernel.compute(35.0, 25.0);
        assert!((k12 - k21).abs() < 1e-10);
    }

    /// 거리 증가 시 커널 값 감소 검증
    #[test]
    fn test_decay_with_distance() {
        let kernel = Matern52Kernel::default_for_calibration();
        let close = kernel.compute(30.0, 31.0);
        let far = kernel.compute(30.0, 40.0);
        assert!(close > far, "가까운 점이 더 높은 상관관계를 가져야 함");
    }

    /// 커널 행렬 대칭성 검증
    #[test]
    fn test_matrix_symmetry() {
        let kernel = Matern52Kernel::default_for_calibration();
        let xs = vec![20.0, 30.0, 40.0];
        let matrix = kernel.compute_matrix(&xs);
        for i in 0..3 {
            for j in 0..3 {
                assert!((matrix[i][j] - matrix[j][i]).abs() < 1e-10);
            }
        }
    }

    /// 커널 행렬 대각 = σ² 검증
    #[test]
    fn test_matrix_diagonal() {
        let kernel = Matern52Kernel::default_for_calibration();
        let xs = vec![20.0, 30.0, 40.0];
        let matrix = kernel.compute_matrix(&xs);
        for i in 0..3 {
            assert!((matrix[i][i] - kernel.signal_var).abs() < 1e-10);
        }
    }

    /// 양의 값 검증 — Matérn 커널은 항상 양수
    #[test]
    fn test_always_positive() {
        let kernel = Matern52Kernel::default_for_calibration();
        for d in 0..100 {
            let val = kernel.compute(30.0, 30.0 + d as f64);
            assert!(val >= 0.0, "커널 값이 음수: d={}, val={}", d, val);
        }
    }
}
