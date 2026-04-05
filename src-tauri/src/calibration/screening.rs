//! DNA 스크리닝 (Stage 1) — 현재 sens 고정으로 ~20회 테스트
//! PartialAimDna 추출 + informed prior 생성

use serde::{Deserialize, Serialize};

/// DNA 스크리닝 데이터 (Stage 1 수집)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreeningData {
    /// 스크리닝 트라이얼 점수들
    pub scores: Vec<f64>,
    /// 트라이얼별 메트릭 (JSON 원본)
    pub trial_metrics: Vec<TrialMetricsSummary>,
    /// 추출된 부분 DNA
    pub partial_dna: Option<PartialAimDna>,
    /// 적응 속도
    pub adaptation_rate: Option<f64>,
    /// 목표 트라이얼 수
    pub target_trials: usize,
    /// 플래토 미도달 시 연장 횟수
    pub extension_count: usize,
}

/// 트라이얼 메트릭 요약 (프론트엔드에서 전달)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrialMetricsSummary {
    pub overshoot: f64,
    pub pre_aim_ratio: f64,
    pub direction_bias: f64,
    pub motor_breakdown: MotorBreakdown,
    pub tracking_smoothness: Option<f64>,
}

/// 운동체계 비율
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MotorBreakdown {
    pub finger: f64,
    pub wrist: f64,
    pub arm: f64,
}

/// 부분 Aim DNA — 스크리닝에서 추출되는 5개 특성
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartialAimDna {
    /// 손목/팔 비율 (wrist / (wrist + arm))
    pub wrist_arm_ratio: f64,
    /// 평균 오버슈트
    pub avg_overshoot: f64,
    /// pre-aim 비율
    pub pre_aim_ratio: f64,
    /// 방향 편향 (0=균일, 1=완전 편향)
    pub direction_bias: f64,
    /// 트래킹 부드러움 (있는 경우)
    pub tracking_smoothness: Option<f64>,
}

/// 게임 카테고리 — informed prior 결정에 사용
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum GameCategory {
    /// 택티컬 (Valorant, CS2 등) — mean=38
    Tactical,
    /// 무브먼트 (Apex, TF2 등) — mean=28
    Movement,
    /// 배틀로얄 (Fortnite, PUBG 등) — mean=32
    BattleRoyale,
}

impl GameCategory {
    /// 문자열로부터 파싱
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "tactical" => GameCategory::Tactical,
            "movement" => GameCategory::Movement,
            "br" | "battle_royale" | "battleroyale" => GameCategory::BattleRoyale,
            _ => GameCategory::BattleRoyale, // 기본값
        }
    }
}

/// Informed prior 파라미터
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InformedPrior {
    /// 사전 평균 (cm/360)
    pub mean: f64,
    /// 사전 분산
    pub variance: f64,
}

impl ScreeningData {
    /// 새 스크리닝 데이터 생성 (기본 20회)
    pub fn new() -> Self {
        Self {
            scores: Vec::new(),
            trial_metrics: Vec::new(),
            partial_dna: None,
            adaptation_rate: None,
            target_trials: 20,
            extension_count: 0,
        }
    }

    /// 트라이얼 결과 추가
    pub fn add_trial(&mut self, score: f64, metrics: TrialMetricsSummary) {
        self.scores.push(score);
        self.trial_metrics.push(metrics);
    }

    /// 스크리닝 완료 여부
    pub fn is_complete(&self) -> bool {
        self.scores.len() >= self.target_trials
    }

    /// 스크리닝 연장 (플래토 미도달 시)
    pub fn extend(&mut self, additional: usize) {
        self.target_trials += additional;
        self.extension_count += 1;
    }

    /// PartialAimDna 추출
    pub fn extract_partial_dna(&mut self) -> PartialAimDna {
        let n = self.trial_metrics.len() as f64;
        if n == 0.0 {
            let dna = PartialAimDna {
                wrist_arm_ratio: 0.5,
                avg_overshoot: 0.0,
                pre_aim_ratio: 0.0,
                direction_bias: 0.0,
                tracking_smoothness: None,
            };
            self.partial_dna = Some(dna.clone());
            return dna;
        }

        // 평균 계산
        let avg_overshoot = self.trial_metrics.iter().map(|m| m.overshoot).sum::<f64>() / n;
        let pre_aim_ratio = self.trial_metrics.iter().map(|m| m.pre_aim_ratio).sum::<f64>() / n;
        let direction_bias = self.trial_metrics.iter().map(|m| m.direction_bias).sum::<f64>() / n;

        // wrist_arm_ratio: wrist / (wrist + arm)
        let total_wrist: f64 = self.trial_metrics.iter().map(|m| m.motor_breakdown.wrist).sum();
        let total_arm: f64 = self.trial_metrics.iter().map(|m| m.motor_breakdown.arm).sum();
        let wrist_arm_ratio = if total_wrist + total_arm > 0.0 {
            total_wrist / (total_wrist + total_arm)
        } else {
            0.5
        };

        // tracking_smoothness: 있는 것만 평균
        let tracking_scores: Vec<f64> = self
            .trial_metrics
            .iter()
            .filter_map(|m| m.tracking_smoothness)
            .collect();
        let tracking_smoothness = if tracking_scores.is_empty() {
            None
        } else {
            Some(tracking_scores.iter().sum::<f64>() / tracking_scores.len() as f64)
        };

        let dna = PartialAimDna {
            wrist_arm_ratio,
            avg_overshoot,
            pre_aim_ratio,
            direction_bias,
            tracking_smoothness,
        };

        self.partial_dna = Some(dna.clone());
        dna
    }

    /// 적응 속도 계산 — 같은 sens에서 점수 변화율
    /// 양수 = 적응 중 (점수 상승), 음수 = 피로
    pub fn compute_adaptation_rate(&mut self) -> f64 {
        if self.scores.len() < 4 {
            self.adaptation_rate = Some(0.0);
            return 0.0;
        }

        // 전반부 vs 후반부 평균 비교
        let mid = self.scores.len() / 2;
        let first_half_avg = self.scores[..mid].iter().sum::<f64>() / mid as f64;
        let second_half_avg = self.scores[mid..].iter().sum::<f64>() / (self.scores.len() - mid) as f64;

        let rate = if first_half_avg > 0.0 {
            (second_half_avg - first_half_avg) / first_half_avg
        } else {
            0.0
        };

        self.adaptation_rate = Some(rate);
        rate
    }
}

/// Informed prior 생성 — 게임 카테고리 + partial DNA 기반
pub fn get_informed_prior(category: GameCategory, _partial_dna: &PartialAimDna) -> InformedPrior {
    // 게임 카테고리별 기본 prior
    let (base_mean, base_var) = match category {
        GameCategory::Tactical => (38.0, 120.0),
        GameCategory::Movement => (28.0, 120.0),
        GameCategory::BattleRoyale => (32.0, 120.0),
    };

    // 게임 카테고리 기본값 사용 (population 데이터 축적 후 prior 보정 가능)
    InformedPrior {
        mean: base_mean,
        variance: base_var,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_metrics(overshoot: f64, wrist: f64, arm: f64) -> TrialMetricsSummary {
        TrialMetricsSummary {
            overshoot,
            pre_aim_ratio: 0.3,
            direction_bias: 0.1,
            motor_breakdown: MotorBreakdown {
                finger: 0.1,
                wrist,
                arm,
            },
            tracking_smoothness: None,
        }
    }

    /// PartialAimDna 추출 검증
    #[test]
    fn test_extract_partial_dna() {
        let mut sd = ScreeningData::new();
        for _ in 0..5 {
            sd.add_trial(0.7, make_metrics(0.1, 0.6, 0.3));
        }

        let dna = sd.extract_partial_dna();
        assert!((dna.avg_overshoot - 0.1).abs() < 0.01);
        assert!((dna.wrist_arm_ratio - 0.667).abs() < 0.01, "wrist/(wrist+arm): got {}", dna.wrist_arm_ratio);
    }

    /// 적응 속도 — 상승 추세
    #[test]
    fn test_adaptation_rate_positive() {
        let mut sd = ScreeningData::new();
        // 전반부: 낮은 점수, 후반부: 높은 점수
        for s in [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85] {
            sd.add_trial(s, make_metrics(0.1, 0.5, 0.5));
        }
        let rate = sd.compute_adaptation_rate();
        assert!(rate > 0.0, "상승 추세 → 양의 적응 속도: got {}", rate);
    }

    /// Informed prior — 택티컬 게임
    #[test]
    fn test_informed_prior_tactical() {
        let dna = PartialAimDna {
            wrist_arm_ratio: 0.6,
            avg_overshoot: 0.1,
            pre_aim_ratio: 0.3,
            direction_bias: 0.1,
            tracking_smoothness: None,
        };
        let prior = get_informed_prior(GameCategory::Tactical, &dna);
        assert!((prior.mean - 38.0).abs() < 0.01);
        assert!((prior.variance - 120.0).abs() < 0.01);
    }

    /// 스크리닝 완료 판정
    #[test]
    fn test_screening_completion() {
        let mut sd = ScreeningData::new();
        for _ in 0..19 {
            sd.add_trial(0.7, make_metrics(0.1, 0.5, 0.5));
        }
        assert!(!sd.is_complete());
        sd.add_trial(0.7, make_metrics(0.1, 0.5, 0.5));
        assert!(sd.is_complete());
    }
}
