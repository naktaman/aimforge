//! 워밍업 플래토 감지 — 연속 3회 baseline 분산 < 5% → plateau 도달
//! 미도달 시 screening 연장 (+10회)

use serde::{Deserialize, Serialize};

/// 워밍업 플래토 감지기
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WarmupDetector {
    /// 플래토 판정에 필요한 연속 안정 baseline 수
    required_stable: usize,
    /// 변동계수 임계값 (5%)
    cv_threshold: f64,
    /// baseline 점수 기록
    scores: Vec<f64>,
    /// 플래토 도달 여부
    pub plateau_reached: bool,
    /// 플래토 도달까지 소요된 트라이얼 수
    pub warmup_trials: usize,
}

impl WarmupDetector {
    /// 기본 설정 (3회 연속 안정, CV < 5%)
    pub fn new() -> Self {
        Self {
            required_stable: 3,
            cv_threshold: 0.05,
            scores: Vec::new(),
            plateau_reached: false,
            warmup_trials: 0,
        }
    }

    /// baseline 점수 기록 + 플래토 체크
    /// 반환: 플래토 도달 여부
    pub fn record(&mut self, score: f64) -> bool {
        self.scores.push(score);
        self.warmup_trials += 1;

        if self.plateau_reached {
            return true;
        }

        // 연속 required_stable개 점수의 CV 체크
        if self.scores.len() >= self.required_stable {
            let recent = &self.scores[self.scores.len() - self.required_stable..];
            let cv = coefficient_of_variation(recent);

            if cv < self.cv_threshold {
                self.plateau_reached = true;
                return true;
            }
        }

        false
    }

    /// 플래토 도달 여부
    pub fn is_plateau_reached(&self) -> bool {
        self.plateau_reached
    }
}

/// 변동계수 (CV = 표준편차 / 평균)
fn coefficient_of_variation(values: &[f64]) -> f64 {
    if values.is_empty() {
        return f64::MAX;
    }

    let n = values.len() as f64;
    let mean = values.iter().sum::<f64>() / n;

    if mean.abs() < 1e-10 {
        return f64::MAX;
    }

    let variance = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n;
    let std_dev = variance.sqrt();

    (std_dev / mean).abs()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 안정적 점수 → 즉시 플래토
    #[test]
    fn test_stable_scores_plateau() {
        let mut wd = WarmupDetector::new();
        wd.record(0.75);
        wd.record(0.76);
        let reached = wd.record(0.74);
        assert!(reached, "안정적 점수 → 플래토");
    }

    /// 불안정 점수 → 플래토 미도달
    #[test]
    fn test_unstable_scores() {
        let mut wd = WarmupDetector::new();
        wd.record(0.5);
        wd.record(0.8);
        let reached = wd.record(0.3);
        assert!(!reached, "불안정 → 플래토 미도달");
    }

    /// 점진적 안정화
    #[test]
    fn test_gradual_stabilization() {
        let mut wd = WarmupDetector::new();
        // 워밍업 중 (불안정)
        wd.record(0.4);
        wd.record(0.6);
        wd.record(0.7);
        assert!(!wd.is_plateau_reached());

        // 안정화
        wd.record(0.75);
        wd.record(0.76);
        let reached = wd.record(0.74);
        assert!(reached, "안정화 후 플래토");
    }

    /// 변동계수 계산 정확성
    #[test]
    fn test_cv() {
        // 동일 값 → CV = 0
        assert!(coefficient_of_variation(&[1.0, 1.0, 1.0]) < 1e-10);
        // 큰 변동
        assert!(coefficient_of_variation(&[1.0, 2.0, 3.0]) > 0.3);
    }
}
