//! Gaussian Process 모델 — Cholesky 분해 기반 사후 분포
//! predict(x) → (mean, variance), add_observation(x, y)

use super::kernel::Matern52Kernel;
use serde::{Deserialize, Serialize};

/// GP 사후 분포 모델
#[derive(Debug, Clone)]
pub struct GaussianProcess {
    /// 커널 하이퍼파라미터
    pub kernel: Matern52Kernel,
    /// 관측 노이즈 분산
    pub noise_var: f64,
    /// 관측 입력값 (cm/360)
    pub x_train: Vec<f64>,
    /// 관측 출력값 (composite score)
    pub y_train: Vec<f64>,
    /// Cholesky 하삼각 행렬 L (K + σ²I = LLᵀ)
    cholesky_l: Option<Vec<Vec<f64>>>,
    /// Cholesky로 풀어둔 α = L⁻ᵀL⁻¹y
    alpha: Option<Vec<f64>>,
    /// 수치 안정성 jitter
    jitter: f64,
    /// 사전 평균 (informed prior 사용 시)
    pub prior_mean: f64,
}

/// GP 예측 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Prediction {
    pub mean: f64,
    pub variance: f64,
}

impl GaussianProcess {
    /// 기본 하이퍼파라미터로 GP 생성
    pub fn new(kernel: Matern52Kernel, noise_var: f64) -> Self {
        Self {
            kernel,
            noise_var,
            x_train: Vec::new(),
            y_train: Vec::new(),
            cholesky_l: None,
            alpha: None,
            jitter: 1e-6,
            prior_mean: 0.0,
        }
    }

    /// 캘리브레이션 기본값으로 GP 생성
    pub fn default_for_calibration() -> Self {
        Self::new(Matern52Kernel::default_for_calibration(), 0.015)
    }

    /// 사전 평균 설정 (informed prior)
    pub fn set_prior_mean(&mut self, mean: f64) {
        self.prior_mean = mean;
    }

    /// 관측 데이터 개수
    pub fn n_observations(&self) -> usize {
        self.x_train.len()
    }

    /// 관측 데이터 추가 + Cholesky 재계산
    pub fn add_observation(&mut self, x: f64, y: f64) {
        self.x_train.push(x);
        self.y_train.push(y);
        self.recompute_cholesky();
    }

    /// 여러 관측 데이터 일괄 추가 — 향후 배치 초기화 시 사용 예정
    #[allow(dead_code)]
    pub fn add_observations(&mut self, xs: &[f64], ys: &[f64]) {
        assert_eq!(xs.len(), ys.len(), "입력/출력 길이 불일치");
        self.x_train.extend_from_slice(xs);
        self.y_train.extend_from_slice(ys);
        self.recompute_cholesky();
    }

    /// 새 입력에서 사후 분포 예측
    /// 반환: (mean, variance)
    pub fn predict(&self, x_new: f64) -> Prediction {
        let n = self.x_train.len();
        if n == 0 {
            // 관측 없으면 사전 분포 반환
            return Prediction {
                mean: self.prior_mean,
                variance: self.kernel.signal_var,
            };
        }

        // Cholesky 분해 실패 시 prior 분포 반환
        let (alpha, l) = match (self.alpha.as_ref(), self.cholesky_l.as_ref()) {
            (Some(a), Some(l)) => (a, l),
            _ => {
                return Prediction {
                    mean: self.prior_mean,
                    variance: self.kernel.signal_var,
                };
            }
        };

        // k* = 커널 벡터 (x_new vs 학습 데이터)
        let k_star = self.kernel.compute_vector(x_new, &self.x_train);

        // 사후 평균: μ* = k*ᵀ α + prior_mean
        // (y_train은 이미 prior_mean이 빠진 상태)
        let mean = dot(&k_star, alpha) + self.prior_mean;

        // 사후 분산: σ*² = k(x*,x*) - k*ᵀ (K+σ²I)⁻¹ k*
        // v = L⁻¹ k* (forward substitution)
        let v = forward_solve(l, &k_star);
        let k_self = self.kernel.compute(x_new, x_new);
        let variance = (k_self - dot(&v, &v)).max(1e-10); // 음수 방지

        Prediction { mean, variance }
    }

    /// 여러 지점에서 예측 (GP 곡선 생성용)
    pub fn predict_range(&self, x_min: f64, x_max: f64, step: f64) -> Vec<(f64, f64, f64)> {
        let mut results = Vec::new();
        let mut x = x_min;
        while x <= x_max {
            let pred = self.predict(x);
            results.push((x, pred.mean, pred.variance));
            x += step;
        }
        results
    }

    /// 현재까지의 최대 관측 score (f_best)
    pub fn best_observation(&self) -> Option<(f64, f64)> {
        if self.y_train.is_empty() {
            return None;
        }
        let mut best_idx = 0;
        for i in 1..self.y_train.len() {
            if self.y_train[i] > self.y_train[best_idx] {
                best_idx = i;
            }
        }
        Some((self.x_train[best_idx], self.y_train[best_idx]))
    }

    /// Cholesky 분해 재계산 (내부용)
    /// K + σ²I + jitter·I = LLᵀ
    fn recompute_cholesky(&mut self) {
        let n = self.x_train.len();
        if n == 0 {
            self.cholesky_l = None;
            self.alpha = None;
            return;
        }

        // 커널 행렬 K 계산
        let mut k_matrix = self.kernel.compute_matrix(&self.x_train);

        // 대각에 노이즈 + jitter 추가
        for (i, row) in k_matrix.iter_mut().enumerate().take(n) {
            row[i] += self.noise_var + self.jitter;
        }

        // Cholesky 분해: K = LLᵀ (실패 시 prior 분포로 폴백)
        let l = match cholesky_decompose(&k_matrix) {
            Ok(l) => l,
            Err(e) => {
                log::warn!("Cholesky 분해 실패, prior 분포로 폴백: {}", e);
                self.cholesky_l = None;
                self.alpha = None;
                return;
            }
        };

        // α = L⁻ᵀ(L⁻¹(y - prior_mean))
        // prior_mean을 빼서 zero-mean GP로 변환
        let y_centered: Vec<f64> = self.y_train.iter().map(|&y| y - self.prior_mean).collect();
        let z = forward_solve(&l, &y_centered);
        let alpha = backward_solve(&l, &z);

        self.cholesky_l = Some(l);
        self.alpha = Some(alpha);
    }
}

/// Cholesky 분해: 양정치 대칭 행렬 A → 하삼각 행렬 L (A = LLᵀ)
/// 행렬이 양정치가 아니면 Err 반환 (NaN 입력 등 방어)
fn cholesky_decompose(a: &[Vec<f64>]) -> Result<Vec<Vec<f64>>, String> {
    let n = a.len();
    let mut l = vec![vec![0.0; n]; n];

    for i in 0..n {
        for j in 0..=i {
            let mut sum = 0.0;
            sum += l[i][..j].iter().zip(l[j][..j].iter()).map(|(a, b)| a * b).sum::<f64>();

            if i == j {
                let diag = a[i][i] - sum;
                if diag <= 0.0 || diag.is_nan() {
                    return Err(format!(
                        "Cholesky 실패: 행렬이 양정치가 아님 (i={}, diag={})", i, diag
                    ));
                }
                l[i][j] = diag.sqrt();
            } else {
                l[i][j] = (a[i][j] - sum) / l[j][j];
            }
        }
    }

    Ok(l)
}

/// 전방 대입: Lx = b → x (하삼각)
fn forward_solve(l: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
    let n = b.len();
    let mut x = vec![0.0; n];
    for i in 0..n {
        let mut sum = 0.0;
        for j in 0..i {
            sum += l[i][j] * x[j];
        }
        x[i] = (b[i] - sum) / l[i][i];
    }
    x
}

/// 후방 대입: Lᵀx = b → x (상삼각)
fn backward_solve(l: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
    let n = b.len();
    let mut x = vec![0.0; n];
    for i in (0..n).rev() {
        let mut sum = 0.0;
        for j in (i + 1)..n {
            sum += l[j][i] * x[j]; // Lᵀ[i][j] = L[j][i]
        }
        x[i] = (b[i] - sum) / l[i][i];
    }
    x
}

/// 벡터 내적
fn dot(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b.iter()).map(|(a, b)| a * b).sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Cholesky 분해 정확성 — LLᵀ = A 검증
    #[test]
    fn test_cholesky_correctness() {
        // 2×2 양정치 행렬
        let a = vec![vec![4.0, 2.0], vec![2.0, 3.0]];
        let l = cholesky_decompose(&a).unwrap();

        // LLᵀ 복원
        for i in 0..2 {
            for j in 0..2 {
                let mut val = 0.0;
                for k in 0..2 {
                    val += l[i][k] * l[j][k];
                }
                assert!(
                    (val - a[i][j]).abs() < 1e-10,
                    "LLᵀ[{}][{}] = {}, A[{}][{}] = {}",
                    i, j, val, i, j, a[i][j]
                );
            }
        }
    }

    /// 관측 없는 GP → 사전 분포 반환 검증
    #[test]
    fn test_predict_no_observations() {
        let gp = GaussianProcess::default_for_calibration();
        let pred = gp.predict(30.0);
        assert!((pred.mean - 0.0).abs() < 1e-10, "사전 평균은 0이어야 함");
        assert!(
            (pred.variance - gp.kernel.signal_var).abs() < 1e-10,
            "사전 분산은 σ²이어야 함"
        );
    }

    /// 관측점에서 예측 — mean이 y 방향으로 이동, variance 감소
    #[test]
    fn test_predict_at_observation() {
        let mut gp = GaussianProcess::default_for_calibration();
        gp.add_observation(30.0, 0.8);

        let pred = gp.predict(30.0);
        // noise_var/(signal_var+noise_var) 비율만큼 사전 평균에 가까움
        // signal_var=0.1, noise=0.015 → mean ≈ 0.8 * 0.1/(0.1+0.015) ≈ 0.696
        // 정확한 값보다는 방향성 검증
        assert!(
            pred.mean > 0.5,
            "관측점 평균은 관측값 방향: got {}",
            pred.mean
        );
        assert!(
            pred.variance < gp.kernel.signal_var,
            "관측점 분산은 사전 분산보다 작아야 함"
        );
    }

    /// 관측점에서 멀리 떨어지면 사전 분포로 회귀
    #[test]
    fn test_predict_far_from_observation() {
        let mut gp = GaussianProcess::default_for_calibration();
        gp.add_observation(30.0, 0.8);

        let pred = gp.predict(100.0); // 매우 먼 점
        assert!(
            pred.variance > 0.05,
            "먼 점의 분산은 사전 분산에 가까워야 함"
        );
    }

    /// 여러 관측 후 보간 검증
    #[test]
    fn test_interpolation() {
        let mut gp = GaussianProcess::default_for_calibration();
        gp.add_observation(20.0, 0.5);
        gp.add_observation(30.0, 0.9);
        gp.add_observation(40.0, 0.6);

        // 중간점은 보간되어야 함
        let pred = gp.predict(25.0);
        assert!(
            pred.mean > 0.4 && pred.mean < 1.0,
            "보간된 평균이 합리적 범위: got {}",
            pred.mean
        );
    }

    /// prior_mean 설정 검증
    #[test]
    fn test_prior_mean() {
        let mut gp = GaussianProcess::default_for_calibration();
        gp.set_prior_mean(0.5);

        let pred = gp.predict(30.0);
        assert!(
            (pred.mean - 0.5).abs() < 1e-10,
            "관측 없으면 prior_mean 반환"
        );
    }

    /// best_observation 검증
    #[test]
    fn test_best_observation() {
        let mut gp = GaussianProcess::default_for_calibration();
        gp.add_observation(20.0, 0.5);
        gp.add_observation(30.0, 0.9);
        gp.add_observation(40.0, 0.6);

        let (x, y) = gp.best_observation().unwrap();
        assert!((x - 30.0).abs() < 1e-10);
        assert!((y - 0.9).abs() < 1e-10);
    }

    /// 30개 관측까지 스케일링 (최대 행렬 크기)
    #[test]
    fn test_scale_to_30() {
        let mut gp = GaussianProcess::default_for_calibration();
        for i in 0..30 {
            let x = 15.0 + i as f64 * 1.5;
            let y = -((x - 35.0) / 10.0).powi(2) + 0.9; // 35 cm/360 최적 포물선
            gp.add_observation(x, y);
        }
        let pred = gp.predict(35.0);
        assert!(pred.mean > 0.7, "최적점 근처에서 높은 예측: got {}", pred.mean);
    }
}
