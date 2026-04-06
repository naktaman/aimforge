//! 변환 방식 비교기 — 6가지 방식 × 3 반복 = 18 트라이얼
//!
//! Latin square 카운터밸런싱으로 순서 편향 제거
//! 대응 표본 t-검정 + Cohen's d 효과 크기로 통계적 비교
//! AI 추천 배지: 최고 합성 점수 방식에 ★

use serde::{Deserialize, Serialize};

/// 비교 가능한 6가지 변환 방식
pub const METHODS: [&str; 6] = [
    "MDM_0",
    "MDM_56.25",
    "MDM_75",
    "MDM_100",
    "Viewspeed_H",
    "Viewspeed_V",
];

/// 비교기 엔진
#[derive(Debug, Clone)]
pub struct ComparatorEngine {
    /// 트라이얼 실행 순서 (method_idx, rep)
    trial_order: Vec<(usize, usize)>,
    /// 방식별 반복별 결과
    results: Vec<Vec<ComparatorTrialData>>, // [method_idx][rep]
    /// 반복 횟수 — 향후 반복 횟수 동적 변경 시 사용 예정
    #[allow(dead_code)]
    repetitions: usize,
    /// 현재 트라이얼 인덱스
    current_trial: usize,
    /// 프로파일 ID
    pub profile_id: i64,
    /// 줌 프로파일 ID
    pub zoom_profile_id: i64,
    /// 방식별 배율 목록 (6개)
    multipliers: Vec<f64>,
}

/// 개별 트라이얼 데이터
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparatorTrialData {
    pub steady_score: f64,
    pub correction_score: f64,
    pub zoomout_score: f64,
    pub composite_score: f64,
}

/// 현재 트라이얼 정보 (프론트엔드에 전달)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparatorTrialAction {
    /// 현재 방식 이름
    pub method: String,
    /// 현재 방식 인덱스
    pub method_index: usize,
    /// 반복 번호 (0-based)
    pub repetition: usize,
    /// 전체 트라이얼 중 현재 위치 (1-based)
    pub trial_number: usize,
    /// 전체 트라이얼 수
    pub total_trials: usize,
    /// 적용할 배율
    pub multiplier: f64,
}

/// 트라이얼 제출 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparatorTrialFeedback {
    /// 다음 트라이얼 존재 여부
    pub has_next: bool,
    /// 완료된 트라이얼 수
    pub completed: usize,
    /// 전체 트라이얼 수
    pub total: usize,
}

/// 방식별 통계 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MethodScore {
    pub method: String,
    /// 해당 방식에 사용된 배율
    pub multiplier_used: f64,
    pub steady_mean: f64,
    pub correction_mean: f64,
    pub zoomout_mean: f64,
    pub composite_mean: f64,
    pub composite_std: f64,
    /// 최고 방식 대비 p-value
    pub p_value: Option<f64>,
    /// Cohen's d 효과 크기
    pub effect_size: Option<f64>,
    /// 순위 (1 = 최고)
    pub rank: usize,
    /// AI 추천 여부
    pub is_recommended: bool,
}

/// 비교기 전체 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparatorResult {
    /// 방식별 결과 (순위순)
    pub method_scores: Vec<MethodScore>,
    /// 추천 방식
    pub recommended_method: String,
    /// 방식 간 차이가 유의미한지 요약
    pub summary: String,
}

impl ComparatorEngine {
    /// 비교기 생성 — Latin square 순서 생성
    pub fn new(
        profile_id: i64,
        zoom_profile_id: i64,
        repetitions: usize,
        multipliers: Vec<f64>,
    ) -> Self {
        let trial_order = generate_balanced_order(METHODS.len(), repetitions);
        let results = vec![Vec::new(); METHODS.len()];

        ComparatorEngine {
            trial_order,
            results,
            repetitions,
            current_trial: 0,
            profile_id,
            zoom_profile_id,
            multipliers,
        }
    }

    /// 다음 트라이얼 정보 반환
    pub fn get_next_trial(&self, multipliers: &[f64]) -> Option<ComparatorTrialAction> {
        if self.current_trial >= self.trial_order.len() {
            return None;
        }

        let (method_idx, rep) = self.trial_order[self.current_trial];
        Some(ComparatorTrialAction {
            method: METHODS[method_idx].to_string(),
            method_index: method_idx,
            repetition: rep,
            trial_number: self.current_trial + 1,
            total_trials: self.trial_order.len(),
            multiplier: multipliers.get(method_idx).copied().unwrap_or(1.0),
        })
    }

    /// 트라이얼 결과 제출
    pub fn submit_trial(&mut self, data: ComparatorTrialData) -> ComparatorTrialFeedback {
        if self.current_trial >= self.trial_order.len() {
            return ComparatorTrialFeedback {
                has_next: false,
                completed: self.trial_order.len(),
                total: self.trial_order.len(),
            };
        }

        let (method_idx, _rep) = self.trial_order[self.current_trial];
        self.results[method_idx].push(data);
        self.current_trial += 1;

        ComparatorTrialFeedback {
            has_next: self.current_trial < self.trial_order.len(),
            completed: self.current_trial,
            total: self.trial_order.len(),
        }
    }

    /// 모든 트라이얼 완료 여부
    pub fn is_complete(&self) -> bool {
        self.current_trial >= self.trial_order.len()
    }

    /// 최종 결과 분석
    pub fn finalize(&self) -> ComparatorResult {
        let mut method_scores: Vec<MethodScore> = METHODS
            .iter()
            .enumerate()
            .map(|(i, &method)| {
                let trials = &self.results[i];
                let n = trials.len() as f64;
                if n == 0.0 {
                    return MethodScore {
                        method: method.to_string(),
                        multiplier_used: self.multipliers.get(i).copied().unwrap_or(0.0),
                        steady_mean: 0.0,
                        correction_mean: 0.0,
                        zoomout_mean: 0.0,
                        composite_mean: 0.0,
                        composite_std: 0.0,
                        p_value: None,
                        effect_size: None,
                        rank: 0,
                        is_recommended: false,
                    };
                }

                let steady_mean = trials.iter().map(|t| t.steady_score).sum::<f64>() / n;
                let correction_mean = trials.iter().map(|t| t.correction_score).sum::<f64>() / n;
                let zoomout_mean = trials.iter().map(|t| t.zoomout_score).sum::<f64>() / n;
                let composite_mean = trials.iter().map(|t| t.composite_score).sum::<f64>() / n;
                let composite_std = if n > 1.0 {
                    let variance = trials
                        .iter()
                        .map(|t| (t.composite_score - composite_mean).powi(2))
                        .sum::<f64>()
                        / (n - 1.0);
                    variance.sqrt()
                } else {
                    0.0
                };

                MethodScore {
                    method: method.to_string(),
                    multiplier_used: self.multipliers.get(i).copied().unwrap_or(0.0),
                    steady_mean,
                    correction_mean,
                    zoomout_mean,
                    composite_mean,
                    composite_std,
                    p_value: None,
                    effect_size: None,
                    rank: 0,
                    is_recommended: false,
                }
            })
            .collect();

        // 합성 점수로 정렬 (높은 순)
        // NaN 방어: partial_cmp 실패 시 Equal 처리
        method_scores.sort_by(|a, b| b.composite_mean.partial_cmp(&a.composite_mean).unwrap_or(std::cmp::Ordering::Equal));

        // 순위 부여
        for (rank, ms) in method_scores.iter_mut().enumerate() {
            ms.rank = rank + 1;
        }

        // 최고 방식 대비 t-검정 + 효과 크기
        if method_scores.len() >= 2 {
            let best_method_name = method_scores[0].method.clone();
            let best_composite_mean = method_scores[0].composite_mean;
            let best_composite_std = method_scores[0].composite_std;
            let best_method_idx = METHODS.iter().position(|&m| m == best_method_name).unwrap_or(0);
            let best_scores: Vec<f64> = self.results[best_method_idx]
                .iter()
                .map(|t| t.composite_score)
                .collect();

            for ms in method_scores.iter_mut().skip(1) {
                let other_idx = METHODS.iter().position(|&m| m == ms.method).unwrap_or(0);
                let other_trials = &self.results[other_idx];

                if best_scores.len() >= 2 && other_trials.len() >= 2 {
                    let other_scores: Vec<f64> = other_trials.iter().map(|t| t.composite_score).collect();

                    let (_, p_value) = paired_t_test(&best_scores, &other_scores);
                    let d = cohens_d(
                        ms.composite_mean,
                        ms.composite_std,
                        best_composite_mean,
                        best_composite_std,
                    );

                    ms.p_value = Some(p_value);
                    ms.effect_size = Some(d);
                }
            }
        }

        // AI 추천
        method_scores[0].is_recommended = true;
        let recommended_method = method_scores[0].method.clone();

        // 요약 생성
        let summary = generate_summary(&method_scores);

        ComparatorResult {
            method_scores,
            recommended_method,
            summary,
        }
    }
}

/// 균형 잡힌 트라이얼 순서 생성 (Williams 디자인 기반)
/// 각 반복에서 방식 순서를 순환 이동하여 순서 편향 최소화
fn generate_balanced_order(n_methods: usize, n_reps: usize) -> Vec<(usize, usize)> {
    let mut order = Vec::new();

    for rep in 0..n_reps {
        // 각 반복에서 순환 이동 (방식 순서가 매번 다름)
        let shift = rep % n_methods;
        for i in 0..n_methods {
            let method_idx = (i + shift) % n_methods;
            order.push((method_idx, rep));
        }
    }

    order
}

/// 대응 표본 t-검정 (paired t-test)
/// 두 조건의 차이가 0과 유의미하게 다른지 검정
/// 반환: (t_statistic, p_value)
pub fn paired_t_test(a: &[f64], b: &[f64]) -> (f64, f64) {
    let n = a.len().min(b.len());
    if n < 2 {
        return (0.0, 1.0);
    }

    // 차이 계산
    let diffs: Vec<f64> = a.iter().zip(b.iter()).map(|(x, y)| x - y).collect();
    let n_f = n as f64;

    let mean_diff = diffs.iter().sum::<f64>() / n_f;
    let var_diff = diffs
        .iter()
        .map(|d| (d - mean_diff).powi(2))
        .sum::<f64>()
        / (n_f - 1.0);
    let se_diff = (var_diff / n_f).sqrt();

    if se_diff < 1e-15 {
        return (0.0, 1.0);
    }

    let t_stat = mean_diff / se_diff;
    let df = n_f - 1.0;

    // t-분포 p-value 근사 (양측 검정)
    let p_value = t_distribution_p_value(t_stat.abs(), df);

    (t_stat, p_value)
}

/// t-분포 양측 p-value 근사 — 정규분포 근사 사용
/// df가 작아도 합리적인 근사 (df >= 2)
fn t_distribution_p_value(t_abs: f64, df: f64) -> f64 {
    // df가 충분히 크면 정규분포 근사
    if df >= 30.0 {
        let p = 2.0 * (1.0 - crate::gp::normal::standard_normal_cdf(t_abs));
        return p.clamp(0.0, 1.0);
    }

    // df < 30: 보정된 정규분포 근사 (Bailey 근사)
    // z ≈ t × (1 - 1/(4df)) / sqrt(1 + t²/(2df))
    let z = t_abs * (1.0 - 1.0 / (4.0 * df)) / (1.0 + t_abs * t_abs / (2.0 * df)).sqrt();
    let p = 2.0 * (1.0 - crate::gp::normal::standard_normal_cdf(z));
    p.clamp(0.0, 1.0)
}

/// Cohen's d 효과 크기 — 두 그룹 간 표준화된 평균 차이
/// d = (mean_a - mean_b) / pooled_sd
pub fn cohens_d(mean_a: f64, std_a: f64, mean_b: f64, std_b: f64) -> f64 {
    let pooled_sd = ((std_a.powi(2) + std_b.powi(2)) / 2.0).sqrt();
    if pooled_sd < 1e-15 {
        return 0.0;
    }
    (mean_a - mean_b).abs() / pooled_sd
}

/// 결과 요약 한국어 텍스트 생성
fn generate_summary(scores: &[MethodScore]) -> String {
    if scores.is_empty() {
        return "데이터 부족".to_string();
    }

    let best = &scores[0];

    // 2위와의 차이 확인
    if scores.len() >= 2 {
        let second = &scores[1];
        if let Some(p) = second.p_value {
            if p < 0.05 {
                return format!(
                    "최고: {} ({:.1}) — 2위 {} 대비 유의미한 차이 (p={:.3})",
                    best.method, best.composite_mean, second.method, p
                );
            } else if p < 0.2 {
                return format!(
                    "최고: {} ({:.1}) — 2위 {}와 약간의 차이 (p={:.3})",
                    best.method, best.composite_mean, second.method, p
                );
            } else {
                return format!(
                    "최고: {} ({:.1}) — {}와 유의미한 차이 없음 (p={:.3}), 편한 방식 선택 가능",
                    best.method, best.composite_mean, second.method, p
                );
            }
        }
    }

    format!("최고: {} ({:.1})", best.method, best.composite_mean)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 균형 잡힌 순서 생성 검증
    #[test]
    fn test_balanced_order() {
        let order = generate_balanced_order(6, 3);
        assert_eq!(order.len(), 18, "6방식 × 3반복 = 18 트라이얼");

        // 각 방식이 정확히 3번 등장하는지 확인
        let mut counts = [0usize; 6];
        for &(method_idx, _) in &order {
            counts[method_idx] += 1;
        }
        for (i, &c) in counts.iter().enumerate() {
            assert_eq!(c, 3, "방식 {}이 3번 등장해야 함: got {}", i, c);
        }
    }

    /// 대응 표본 t-검정 — 같은 값이면 p=1
    #[test]
    fn test_paired_t_test_same() {
        let a = vec![80.0, 82.0, 81.0];
        let b = vec![80.0, 82.0, 81.0];
        let (t, p) = paired_t_test(&a, &b);
        assert!(t.abs() < 0.01, "같은 값 → t≈0: got {}", t);
        assert!(p > 0.9, "같은 값 → p≈1: got {}", p);
    }

    /// 대응 표본 t-검정 — 큰 차이 (차이 분산 > 0 필요)
    #[test]
    fn test_paired_t_test_different() {
        let a = vec![90.0, 88.0, 92.0];
        let b = vec![70.0, 73.0, 68.0];
        let (t, p) = paired_t_test(&a, &b);
        assert!(t.abs() > 2.0, "큰 차이 → 큰 t: got {}", t);
        assert!(p < 0.1, "큰 차이 → 작은 p: got {}", p);
    }

    /// Cohen's d — 큰 효과 크기
    #[test]
    fn test_cohens_d_large() {
        let d = cohens_d(90.0, 2.0, 80.0, 2.0);
        assert!(d > 3.0, "10점 차이, std=2 → d>3: got {:.2}", d);
    }

    /// Cohen's d — 차이 없음
    #[test]
    fn test_cohens_d_zero() {
        let d = cohens_d(80.0, 5.0, 80.0, 5.0);
        assert!(d < 0.01, "같은 평균 → d≈0: got {:.4}", d);
    }

    /// 비교기 E2E 테스트
    #[test]
    fn test_comparator_e2e() {
        let multipliers = vec![1.0, 1.1, 1.2, 1.3, 0.9, 0.85];
        let mut engine = ComparatorEngine::new(1, 1, 3, multipliers.clone());

        // 18 트라이얼 제출
        let mut trial_count = 0;
        while let Some(_action) = engine.get_next_trial(&multipliers) {
            let data = ComparatorTrialData {
                steady_score: 80.0 + (trial_count % 6) as f64,
                correction_score: 75.0 + (trial_count % 6) as f64,
                zoomout_score: 78.0 + (trial_count % 6) as f64,
                composite_score: 78.0 + (trial_count % 6) as f64,
            };
            let feedback = engine.submit_trial(data);
            trial_count += 1;
            if !feedback.has_next {
                break;
            }
        }

        assert_eq!(trial_count, 18, "18 트라이얼 완료");
        assert!(engine.is_complete(), "비교기 완료 상태");

        let result = engine.finalize();
        assert_eq!(result.method_scores.len(), 6, "6가지 방식 결과");
        assert_eq!(result.method_scores[0].rank, 1, "1위 존재");
        assert!(result.method_scores[0].is_recommended, "1위에 추천 마크");
    }
}
