//! 피로도 추적 — baseline 반복으로 성능 저하 감지
//! baseline_interval마다 기준 sens로 테스트, decline > 15% → 세션 중단 권고

use serde::{Deserialize, Serialize};

/// 피로도 추적기
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FatigueTracker {
    /// baseline 측정 간격 (트라이얼 수)
    baseline_interval: usize,
    /// 성능 저하 임계값 (15%)
    decline_threshold: f64,
    /// baseline 점수 기록
    baseline_scores: Vec<f64>,
    /// 마지막 baseline 이후 트라이얼 수
    trials_since_baseline: usize,
    /// 피로 감지됨
    pub fatigued: bool,
    /// 피로 감소율 (DNA 기록용)
    pub fatigue_decay_rate: Option<f64>,
}

impl FatigueTracker {
    /// 기본 설정으로 생성 (interval=3, threshold=15%)
    pub fn new() -> Self {
        Self {
            baseline_interval: 3,
            decline_threshold: 0.15,
            baseline_scores: Vec::new(),
            trials_since_baseline: 0,
            fatigued: false,
            fatigue_decay_rate: None,
        }
    }

    /// 트라이얼 완료 기록 — baseline 측정 시점인지 반환
    pub fn on_trial_complete(&mut self) -> bool {
        self.trials_since_baseline += 1;
        self.trials_since_baseline >= self.baseline_interval
    }

    /// baseline 점수 기록 + 피로 체크
    /// 반환: 피로 감지 여부
    pub fn record_baseline(&mut self, score: f64) -> bool {
        self.baseline_scores.push(score);
        self.trials_since_baseline = 0;

        // 최소 2개 baseline이 있어야 비교 가능
        if self.baseline_scores.len() < 2 {
            return false;
        }

        // 첫 baseline 대비 현재 decline 계산
        let initial = self.baseline_scores[0];
        if initial <= 0.0 {
            return false;
        }

        let decline = (initial - score) / initial;

        // 피로 감소율 업데이트
        self.fatigue_decay_rate = Some(decline);

        if decline > self.decline_threshold {
            self.fatigued = true;
            true
        } else {
            false
        }
    }

    /// baseline 측정이 필요한 시점인지 확인
    pub fn needs_baseline(&self) -> bool {
        self.trials_since_baseline >= self.baseline_interval
    }

    /// 피로 감지 여부 — 향후 API 확장 시 사용 예정
    #[allow(dead_code)]
    pub fn is_fatigued(&self) -> bool {
        self.fatigued
    }

    /// baseline 측정 횟수 — 향후 API 확장 시 사용 예정
    #[allow(dead_code)]
    pub fn baseline_count(&self) -> usize {
        self.baseline_scores.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 정상 상태 — 피로 미감지
    #[test]
    fn test_no_fatigue() {
        let mut ft = FatigueTracker::new();
        ft.record_baseline(0.8);
        ft.record_baseline(0.78);
        ft.record_baseline(0.76);
        assert!(!ft.is_fatigued(), "소폭 하락은 피로가 아님");
    }

    /// 피로 감지 — 15% 이상 하락
    #[test]
    fn test_fatigue_detected() {
        let mut ft = FatigueTracker::new();
        ft.record_baseline(0.8);
        let fatigued = ft.record_baseline(0.6); // 25% 하락
        assert!(fatigued, "25% 하락 → 피로 감지");
        assert!(ft.is_fatigued());
    }

    /// baseline 간격 카운트
    #[test]
    fn test_baseline_interval() {
        let mut ft = FatigueTracker::new();
        assert!(!ft.on_trial_complete()); // 1회
        assert!(!ft.on_trial_complete()); // 2회
        assert!(ft.on_trial_complete());  // 3회 → baseline 필요
    }

    /// fatigue_decay_rate 기록
    #[test]
    fn test_decay_rate() {
        let mut ft = FatigueTracker::new();
        ft.record_baseline(1.0);
        ft.record_baseline(0.9); // 10% 하락
        assert!((ft.fatigue_decay_rate.unwrap() - 0.1).abs() < 0.01);
    }
}
