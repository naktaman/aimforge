//! Gaussian Process 모듈 — Bayesian Optimization 엔진
//!
//! 구성:
//! - normal: 정규분포 수학 함수 (erf, cdf, pdf)
//! - kernel: Matérn 5/2 커널
//! - model: GP 사후 분포 (Cholesky 기반)
//! - acquisition: Expected Improvement + 후보 탐색
//! - analysis: 수렴 판정, 이봉 감지, 유의성 검정

pub mod acquisition;
pub mod analysis;
pub mod kernel;
pub mod model;
pub mod normal;

// 주요 타입 re-export
pub use acquisition::{expected_improvement, next_candidate, NextCandidate};
pub use analysis::{
    check_convergence, detect_bimodal, significance_test, ConvergenceMode, ConvergenceStatus,
    Peak, SignificanceLabel, SignificanceResult,
};
pub use kernel::Matern52Kernel;
pub use model::{GaussianProcess, Prediction};
