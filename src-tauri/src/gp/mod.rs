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
pub use acquisition::next_candidate;
// SignificanceLabel은 calibration/go_no_go.rs에서 crate::gp::SignificanceLabel로 사용
#[allow(unused_imports)]
pub use analysis::{
    check_convergence, detect_bimodal, significance_test, ConvergenceMode, Peak, SignificanceLabel,
    SignificanceResult,
};
pub use model::GaussianProcess;
