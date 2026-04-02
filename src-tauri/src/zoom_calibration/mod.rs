//! 줌 캘리브레이션 엔진 — 멀티 배율 GP 최적화 + K 피팅
//!
//! 흐름:
//! 1. 게임 zoom_profiles 로드 → AI가 3개 핵심 비율 선택
//! 2. 각 비율에서 MDM 0% 기반 시작점 설정
//! 3. 비율별 dual-phase GP 실행 (6~8 트라이얼)
//!    Phase A: Steady-State (줌 FOV 에이밍)
//!    Phase B: Post-Zoom Correction (전환 보정)
//!    Phase C: Zoom-Out Re-acquisition (복귀 재획득)
//! 4. 3개 최적 배율로 k 파라미터 피팅
//! 5. 미측정 비율 보간 + 전체 루프 검증

pub mod commands;
pub mod comparator;
pub mod k_fitting;

use crate::calibration::fatigue::FatigueTracker;
use crate::game_db::conversion::{mdm_multiplier, zoom_multiplier};
use crate::gp::{
    check_convergence, next_candidate, ConvergenceMode, GaussianProcess,
};
use k_fitting::{fit_k_parameter, interpolate_multiplier, KDataPoint, KFitResult};
use serde::{Deserialize, Serialize};

/// 줌 캘리브레이션 페이즈
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ZoomPhase {
    /// Phase A — 줌 상태 에이밍
    Steady,
    /// Phase B — 줌 전환 후 보정
    Correction,
    /// Phase C — 줌 해제 후 재획득
    Zoomout,
}

/// 줌 프로파일 정보 (DB에서 로드)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoomProfileInfo {
    /// DB ID
    pub id: i64,
    /// 스코프 이름 (예: "HCOG 1x")
    pub scope_name: String,
    /// 줌 비율 (예: 2.0)
    pub zoom_ratio: f64,
    /// FOV 오버라이드 (Some이면 이 값 사용)
    pub fov_override: Option<f64>,
    /// 계산된 스코프 hFOV
    pub scope_fov: f64,
    /// 페이즈별 가중치
    pub weights: ZoomPhaseWeights,
}

/// 페이즈별 가중치
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoomPhaseWeights {
    pub steady: f64,
    pub correction: f64,
    pub zoomout: f64,
}

/// 비율별 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoomRatioResult {
    /// 줌 프로파일 DB ID
    pub zoom_profile_id: i64,
    /// 줌 비율
    pub ratio: f64,
    /// 스코프 hFOV
    pub scope_fov: f64,
    /// GP 최적화된 배율
    pub optimal_multiplier: f64,
    /// Phase A 점수
    pub steady_score: f64,
    /// Phase B 점수
    pub correction_score: f64,
    /// Phase C 점수
    pub zoomout_score: f64,
    /// 합성 점수
    pub composite_score: f64,
    /// MDM 0% 예측 배율
    pub mdm_predicted: f64,
    /// MDM 0% 대비 편차
    pub deviation: f64,
    /// GP 관측 데이터
    pub observations: Vec<(f64, f64)>,
}

/// 다음 트라이얼 정보
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoomTrialAction {
    /// 현재 비율 인덱스
    pub ratio_index: usize,
    /// 줌 비율
    pub ratio: f64,
    /// 스코프 이름
    pub scope_name: String,
    /// 테스트할 배율
    pub multiplier: f64,
    /// 현재 페이즈
    pub phase: ZoomPhase,
    /// 이 비율의 반복 횟수
    pub iteration: usize,
    /// 베이스라인 여부 (피로 측정용)
    pub is_baseline: bool,
}

/// 트라이얼 제출 피드백
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoomTrialFeedback {
    /// 현재 비율 수렴 여부
    pub ratio_converged: bool,
    /// 다음 비율로 이동 여부
    pub advance_to_next_ratio: bool,
    /// 전체 완료 여부
    pub all_complete: bool,
    /// 피로 중단 여부
    pub fatigue_stop: bool,
    /// 현재 비율의 현재 최적 배율
    pub current_best_multiplier: Option<f64>,
    /// 현재 비율의 현재 최적 점수
    pub current_best_score: Option<f64>,
}

/// 줌 캘리브레이션 최종 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoomCalibrationResult {
    /// 비율별 결과
    pub ratio_results: Vec<ZoomRatioResult>,
    /// K 피팅 결과
    pub k_fit: KFitResult,
    /// 모든 줌 프로파일에 대한 예측 배율
    pub predicted_multipliers: Vec<PredictedMultiplier>,
    /// 전체 반복 횟수
    pub total_iterations: usize,
}

/// 예측 배율 (측정 또는 보간)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PredictedMultiplier {
    /// 스코프 이름
    pub scope_name: String,
    /// 줌 비율
    pub zoom_ratio: f64,
    /// 배율 값
    pub multiplier: f64,
    /// 측정됨(true) or 보간됨(false)
    pub is_measured: bool,
}

/// K 조정 후 새 예측
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustedPredictions {
    /// 조정된 k 값
    pub k_value: f64,
    /// 업데이트된 모든 배율 예측
    pub predictions: Vec<PredictedMultiplier>,
}

/// 줌 캘리브레이션 엔진
pub struct ZoomCalibrationEngine {
    /// 프로파일 ID
    pub profile_id: i64,
    /// 힙파이어 cm/360
    base_cm360: f64,
    /// 힙파이어 hFOV
    hipfire_fov: f64,
    /// 선택된 줌 프로파일 (캘리브레이션 대상)
    selected_profiles: Vec<ZoomProfileInfo>,
    /// 전체 줌 프로파일 (보간 대상 포함)
    all_profiles: Vec<ZoomProfileInfo>,
    /// 비율별 GP 모델
    per_ratio_gp: Vec<GaussianProcess>,
    /// 현재 캘리브레이션 중인 비율 인덱스
    current_ratio_idx: usize,
    /// 비율별 반복 수
    iterations: Vec<usize>,
    /// 비율별 최근 최적값 (수렴 체크용)
    recent_bests: Vec<Vec<f64>>,
    /// 비율별 페이즈 점수 누적 (현재 배율의)
    phase_scores: Vec<PhaseAccumulator>,
    /// 비율별 완료된 결과
    ratio_results: Vec<Option<ZoomRatioResult>>,
    /// 수렴 모드
    convergence_mode: ConvergenceMode,
    /// 피로 추적
    fatigue: FatigueTracker,
    /// 현재 페이즈
    current_phase: ZoomPhase,
    /// 현재 테스트 중인 배율
    current_multiplier: f64,
    /// 마지막 K 피팅 결과 (finalize 후 저장)
    last_k_fit: Option<KFitResult>,
}

/// 페이즈별 점수 축적기
#[derive(Debug, Clone, Default)]
struct PhaseAccumulator {
    steady: Option<f64>,
    correction: Option<f64>,
    zoomout: Option<f64>,
}

impl PhaseAccumulator {
    /// 3-phase 완료 여부
    fn is_complete(&self) -> bool {
        self.steady.is_some() && self.correction.is_some() && self.zoomout.is_some()
    }

    /// 가중 합성 점수 계산
    fn composite(&self, weights: &ZoomPhaseWeights) -> f64 {
        let s = self.steady.unwrap_or(0.0);
        let c = self.correction.unwrap_or(0.0);
        let z = self.zoomout.unwrap_or(0.0);
        weights.steady * s + weights.correction * c + weights.zoomout * z
    }

    /// 초기화
    fn reset(&mut self) {
        self.steady = None;
        self.correction = None;
        self.zoomout = None;
    }
}

impl ZoomCalibrationEngine {
    /// 엔진 생성
    ///
    /// selected_profiles: GP 캘리브레이션 대상 (보통 3개)
    /// all_profiles: 전체 줌 프로파일 (보간 대상 포함)
    pub fn new(
        profile_id: i64,
        base_cm360: f64,
        hipfire_fov: f64,
        selected_profiles: Vec<ZoomProfileInfo>,
        all_profiles: Vec<ZoomProfileInfo>,
        convergence_mode: ConvergenceMode,
    ) -> Self {
        let n = selected_profiles.len();

        // 비율별 GP 초기화
        let per_ratio_gp: Vec<GaussianProcess> = (0..n)
            .map(|_| {
                let mut gp = GaussianProcess::default_for_calibration();
                gp.set_prior_mean(0.5); // 합성 점수 기대값
                gp
            })
            .collect();

        // 첫 번째 비율의 시작 배율 (MDM 0%)
        let first_mult = if !selected_profiles.is_empty() {
            mdm_multiplier(hipfire_fov, selected_profiles[0].scope_fov, 0.0)
        } else {
            1.0
        };

        ZoomCalibrationEngine {
            profile_id,
            base_cm360,
            hipfire_fov,
            selected_profiles,
            all_profiles,
            per_ratio_gp,
            current_ratio_idx: 0,
            iterations: vec![0; n],
            recent_bests: vec![Vec::new(); n],
            phase_scores: vec![PhaseAccumulator::default(); n],
            ratio_results: vec![None; n],
            convergence_mode,
            fatigue: FatigueTracker::new(),
            current_phase: ZoomPhase::Steady,
            current_multiplier: first_mult,
            last_k_fit: None,
        }
    }

    /// 다음 트라이얼 반환
    pub fn get_next_trial(&self) -> Option<ZoomTrialAction> {
        if self.current_ratio_idx >= self.selected_profiles.len() {
            return None;
        }

        let profile = &self.selected_profiles[self.current_ratio_idx];
        let iteration = self.iterations[self.current_ratio_idx];
        let is_baseline = self.fatigue.needs_baseline();

        Some(ZoomTrialAction {
            ratio_index: self.current_ratio_idx,
            ratio: profile.zoom_ratio,
            scope_name: profile.scope_name.clone(),
            multiplier: self.current_multiplier,
            phase: self.current_phase,
            iteration,
            is_baseline,
        })
    }

    /// 트라이얼 결과 제출 (페이즈별)
    pub fn submit_trial(
        &mut self,
        phase: ZoomPhase,
        score: f64,
    ) -> ZoomTrialFeedback {
        let idx = self.current_ratio_idx;
        if idx >= self.selected_profiles.len() {
            return ZoomTrialFeedback {
                ratio_converged: false,
                advance_to_next_ratio: false,
                all_complete: true,
                fatigue_stop: false,
                current_best_multiplier: None,
                current_best_score: None,
            };
        }

        // 페이즈 점수 기록
        match phase {
            ZoomPhase::Steady => self.phase_scores[idx].steady = Some(score),
            ZoomPhase::Correction => self.phase_scores[idx].correction = Some(score),
            ZoomPhase::Zoomout => self.phase_scores[idx].zoomout = Some(score),
        }

        // 다음 페이즈로 진행
        self.current_phase = match phase {
            ZoomPhase::Steady => ZoomPhase::Correction,
            ZoomPhase::Correction => ZoomPhase::Zoomout,
            ZoomPhase::Zoomout => ZoomPhase::Steady, // 리셋 — 아래에서 처리
        };

        // 3-phase 완료 시 GP에 합성 점수 추가
        if self.phase_scores[idx].is_complete() {
            let weights = &self.selected_profiles[idx].weights;
            let composite = self.phase_scores[idx].composite(weights);

            // GP에 관측 추가 (x = multiplier, y = composite)
            self.per_ratio_gp[idx].add_observation(self.current_multiplier, composite);
            self.iterations[idx] += 1;

            // 피로 체크 — baseline 간격이면 측정
            let fatigued = if self.fatigue.on_trial_complete() {
                self.fatigue.record_baseline(composite)
            } else {
                false
            };
            if fatigued {
                return ZoomTrialFeedback {
                    ratio_converged: false,
                    advance_to_next_ratio: false,
                    all_complete: false,
                    fatigue_stop: true,
                    current_best_multiplier: self.per_ratio_gp[idx]
                        .best_observation()
                        .map(|(x, _)| x),
                    current_best_score: self.per_ratio_gp[idx]
                        .best_observation()
                        .map(|(_, y)| y),
                };
            }

            // 최근 최적값 기록
            if let Some((best_x, _)) = self.per_ratio_gp[idx].best_observation() {
                self.recent_bests[idx].push(best_x);
            }

            // 수렴 체크
            let profile = &self.selected_profiles[idx];
            let search_min = self.mdm_start(idx) * 0.7;
            let search_max = self.mdm_start(idx) * 1.3;
            let candidate = next_candidate(
                &self.per_ratio_gp[idx],
                search_min,
                search_max,
                0.02, // 배율 탐색 간격 (cm360보다 정밀)
                0.01,
            );

            let convergence = check_convergence(
                candidate.ei,
                self.convergence_mode,
                &self.recent_bests[idx],
                self.iterations[idx],
            );

            if convergence.converged {
                // 비율 완료 — 결과 저장
                let (best_mult, best_score) = self.per_ratio_gp[idx]
                    .best_observation()
                    .unwrap_or((self.current_multiplier, composite));

                let mdm_pred = self.mdm_start(idx);
                self.ratio_results[idx] = Some(ZoomRatioResult {
                    zoom_profile_id: profile.id,
                    ratio: profile.zoom_ratio,
                    scope_fov: profile.scope_fov,
                    optimal_multiplier: best_mult,
                    steady_score: self.phase_scores[idx].steady.unwrap_or(0.0),
                    correction_score: self.phase_scores[idx].correction.unwrap_or(0.0),
                    zoomout_score: self.phase_scores[idx].zoomout.unwrap_or(0.0),
                    composite_score: best_score,
                    mdm_predicted: mdm_pred,
                    deviation: best_mult - mdm_pred,
                    observations: self.per_ratio_gp[idx]
                        .x_train
                        .iter()
                        .zip(self.per_ratio_gp[idx].y_train.iter())
                        .map(|(&x, &y)| (x, y))
                        .collect(),
                });

                // 다음 비율로 이동
                self.current_ratio_idx += 1;
                let all_done = self.current_ratio_idx >= self.selected_profiles.len();

                if !all_done {
                    // 다음 비율 시작점 설정
                    self.current_multiplier = self.mdm_start(self.current_ratio_idx);
                    self.current_phase = ZoomPhase::Steady;
                }

                return ZoomTrialFeedback {
                    ratio_converged: true,
                    advance_to_next_ratio: !all_done,
                    all_complete: all_done,
                    fatigue_stop: false,
                    current_best_multiplier: Some(best_mult),
                    current_best_score: Some(best_score),
                };
            }

            // 다음 배율 설정 (EI 최대 지점)
            self.current_multiplier = candidate.cm360; // 여기서는 배율값이 cm360 필드에 저장됨
            self.phase_scores[idx].reset();
            self.current_phase = ZoomPhase::Steady;

            return ZoomTrialFeedback {
                ratio_converged: false,
                advance_to_next_ratio: false,
                all_complete: false,
                fatigue_stop: false,
                current_best_multiplier: self.per_ratio_gp[idx]
                    .best_observation()
                    .map(|(x, _)| x),
                current_best_score: self.per_ratio_gp[idx]
                    .best_observation()
                    .map(|(_, y)| y),
            };
        }

        // 3-phase 미완료 — 다음 페이즈 계속
        ZoomTrialFeedback {
            ratio_converged: false,
            advance_to_next_ratio: false,
            all_complete: false,
            fatigue_stop: false,
            current_best_multiplier: self.per_ratio_gp[idx]
                .best_observation()
                .map(|(x, _)| x),
            current_best_score: self.per_ratio_gp[idx]
                .best_observation()
                .map(|(_, y)| y),
        }
    }

    /// MDM 0% 기반 시작 배율
    fn mdm_start(&self, ratio_idx: usize) -> f64 {
        let profile = &self.selected_profiles[ratio_idx];
        mdm_multiplier(self.hipfire_fov, profile.scope_fov, 0.0)
    }

    /// 최종 결과 생성 — K 피팅 + 보간
    pub fn finalize(&mut self) -> ZoomCalibrationResult {
        // 완료된 비율 결과 수집
        let completed: Vec<ZoomRatioResult> = self
            .ratio_results
            .iter()
            .filter_map(|r| r.clone())
            .collect();

        // K 피팅 데이터 준비
        let k_data: Vec<KDataPoint> = completed
            .iter()
            .map(|r| KDataPoint {
                zoom_ratio: r.ratio,
                scope_fov: r.scope_fov,
                optimal_multiplier: r.optimal_multiplier,
                score: r.composite_score,
            })
            .collect();

        // K 피팅 (최소 2개 필요)
        let k_fit = if k_data.len() >= 2 {
            fit_k_parameter(self.hipfire_fov, &k_data)
        } else if k_data.len() == 1 {
            // 단일 비율 → k=1.0 기본값, 해당 배율만 사용
            KFitResult {
                k_value: 1.0,
                k_variance: 0.0,
                quality: k_fitting::KQuality::Medium,
                data_points: k_data,
                piecewise_k: None,
            }
        } else {
            KFitResult {
                k_value: 1.0,
                k_variance: 0.0,
                quality: k_fitting::KQuality::High,
                data_points: Vec::new(),
                piecewise_k: None,
            }
        };

        // 전체 줌 프로파일에 대해 배율 예측
        let predicted_multipliers = self.predict_all_multipliers(&k_fit, &completed);

        let total_iterations: usize = self.iterations.iter().sum();
        self.last_k_fit = Some(k_fit.clone());

        ZoomCalibrationResult {
            ratio_results: completed,
            k_fit,
            predicted_multipliers,
            total_iterations,
        }
    }

    /// K 수동 조정 → 새 예측 생성
    pub fn adjust_k(&mut self, delta: f64) -> AdjustedPredictions {
        let current_k = self
            .last_k_fit
            .as_ref()
            .map(|f| f.k_value)
            .unwrap_or(1.0);

        let new_k = (current_k + delta).max(0.0).min(3.0); // k 범위 제한

        let completed: Vec<ZoomRatioResult> = self
            .ratio_results
            .iter()
            .filter_map(|r| r.clone())
            .collect();

        // 기존 k_fit 업데이트
        if let Some(ref mut fit) = self.last_k_fit {
            fit.k_value = new_k;
        }

        let predictions = self.predict_all_multipliers_with_k(new_k, &completed);

        AdjustedPredictions {
            k_value: new_k,
            predictions,
        }
    }

    /// 전체 줌 프로파일 배율 예측
    fn predict_all_multipliers(
        &self,
        k_fit: &KFitResult,
        completed: &[ZoomRatioResult],
    ) -> Vec<PredictedMultiplier> {
        self.predict_all_multipliers_with_k(k_fit.k_value, completed)
    }

    /// 주어진 k로 전체 배율 예측
    fn predict_all_multipliers_with_k(
        &self,
        k: f64,
        completed: &[ZoomRatioResult],
    ) -> Vec<PredictedMultiplier> {
        self.all_profiles
            .iter()
            .map(|p| {
                // 측정된 비율인지 확인
                let measured = completed
                    .iter()
                    .find(|r| (r.ratio - p.zoom_ratio).abs() < 0.01);

                if let Some(m) = measured {
                    PredictedMultiplier {
                        scope_name: p.scope_name.clone(),
                        zoom_ratio: p.zoom_ratio,
                        multiplier: m.optimal_multiplier,
                        is_measured: true,
                    }
                } else {
                    let mult = interpolate_multiplier(self.hipfire_fov, p.scope_fov, k);
                    PredictedMultiplier {
                        scope_name: p.scope_name.clone(),
                        zoom_ratio: p.zoom_ratio,
                        multiplier: mult,
                        is_measured: false,
                    }
                }
            })
            .collect()
    }

    /// AI 줌 비율 추천 — 분포가 고른 3개 선택
    pub fn recommend_ratios(profiles: &[ZoomProfileInfo], max_count: usize) -> Vec<usize> {
        if profiles.len() <= max_count {
            return (0..profiles.len()).collect();
        }

        // 줌 비율 정렬 후 균등 간격 선택
        let mut indices: Vec<(usize, f64)> = profiles
            .iter()
            .enumerate()
            .map(|(i, p)| (i, p.zoom_ratio))
            .collect();
        indices.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        let step = (indices.len() - 1) as f64 / (max_count - 1) as f64;
        let mut selected = Vec::new();
        for i in 0..max_count {
            let idx = (i as f64 * step).round() as usize;
            let idx = idx.min(indices.len() - 1);
            selected.push(indices[idx].0);
        }

        selected
    }

    /// 현재 캘리브레이션 상태 조회
    pub fn get_status(&self) -> ZoomCalibrationStatus {
        ZoomCalibrationStatus {
            current_ratio_index: self.current_ratio_idx,
            total_ratios: self.selected_profiles.len(),
            current_phase: self.current_phase,
            iterations: self.iterations.clone(),
            ratio_completed: self.ratio_results.iter().map(|r| r.is_some()).collect(),
        }
    }
}

/// 캘리브레이션 상태 (UI 업데이트용)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoomCalibrationStatus {
    pub current_ratio_index: usize,
    pub total_ratios: usize,
    pub current_phase: ZoomPhase,
    pub iterations: Vec<usize>,
    pub ratio_completed: Vec<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 기본 엔진 생성 및 트라이얼 실행
    #[test]
    fn test_engine_basic_flow() {
        let profiles = make_test_profiles();
        let mut engine = ZoomCalibrationEngine::new(
            1,
            30.0,
            103.0,
            profiles.clone(),
            profiles,
            ConvergenceMode::Quick,
        );

        // 첫 트라이얼 가져오기
        let trial = engine.get_next_trial();
        assert!(trial.is_some(), "첫 트라이얼 존재");
        let trial = trial.unwrap();
        assert_eq!(trial.ratio_index, 0, "첫 번째 비율부터 시작");
        assert_eq!(trial.phase, ZoomPhase::Steady, "Phase A 시작");
    }

    /// 3-phase 완료 후 GP 업데이트 확인
    #[test]
    fn test_three_phase_cycle() {
        let profiles = make_test_profiles();
        let mut engine = ZoomCalibrationEngine::new(
            1,
            30.0,
            103.0,
            profiles.clone(),
            profiles,
            ConvergenceMode::Quick,
        );

        // Phase A, B, C 제출
        let fb_a = engine.submit_trial(ZoomPhase::Steady, 0.8);
        assert!(!fb_a.ratio_converged, "1회 후 미수렴");

        let fb_b = engine.submit_trial(ZoomPhase::Correction, 0.7);
        assert!(!fb_b.ratio_converged, "2회 후 미수렴");

        let fb_c = engine.submit_trial(ZoomPhase::Zoomout, 0.75);
        // 3-phase 완료 → GP에 1개 관측 추가됨
        assert_eq!(engine.per_ratio_gp[0].n_observations(), 1);
    }

    /// 수렴 후 다음 비율 이동 검증
    #[test]
    fn test_ratio_advancement() {
        let profiles = make_test_profiles();
        let mut engine = ZoomCalibrationEngine::new(
            1,
            30.0,
            103.0,
            profiles.clone(),
            profiles,
            ConvergenceMode::Quick,
        );

        // Quick 모드 최대 15회 → 15 × 3phase = 45 트라이얼이면 첫 비율 완료
        for _ in 0..15 {
            engine.submit_trial(ZoomPhase::Steady, 0.8);
            engine.submit_trial(ZoomPhase::Correction, 0.7);
            engine.submit_trial(ZoomPhase::Zoomout, 0.75);
        }

        // 첫 비율 완료됨
        assert!(
            engine.ratio_results[0].is_some(),
            "15회 반복 후 첫 비율 완료"
        );
    }

    /// K 피팅 E2E
    #[test]
    fn test_finalize_with_k_fit() {
        let profiles = make_test_profiles();
        let mut engine = ZoomCalibrationEngine::new(
            1,
            30.0,
            103.0,
            profiles.clone(),
            profiles.clone(),
            ConvergenceMode::Quick,
        );

        // 3개 비율 모두 결과 직접 설정 (빠른 테스트)
        for i in 0..3 {
            let p = &profiles[i];
            let k_true = 0.8;
            let mult = zoom_multiplier(103.0, p.scope_fov, k_true);
            engine.ratio_results[i] = Some(ZoomRatioResult {
                zoom_profile_id: p.id,
                ratio: p.zoom_ratio,
                scope_fov: p.scope_fov,
                optimal_multiplier: mult,
                steady_score: 0.8,
                correction_score: 0.7,
                zoomout_score: 0.75,
                composite_score: 0.77,
                mdm_predicted: mdm_multiplier(103.0, p.scope_fov, 0.0),
                deviation: 0.0,
                observations: vec![(mult, 0.77)],
            });
        }

        let result = engine.finalize();
        assert!(
            (result.k_fit.k_value - 0.8).abs() < 0.1,
            "k=0.8 근사 복원: got {:.3}",
            result.k_fit.k_value
        );
        assert!(
            !result.predicted_multipliers.is_empty(),
            "예측 배율 존재"
        );
    }

    /// AI 비율 추천 검증
    #[test]
    fn test_recommend_ratios() {
        let profiles = make_test_profiles();
        let selected = ZoomCalibrationEngine::recommend_ratios(&profiles, 2);
        assert_eq!(selected.len(), 2, "2개 선택");
        // 가장 낮은 비율과 가장 높은 비율이 선택되어야 함
    }

    /// K 조정 검증
    #[test]
    fn test_adjust_k() {
        let profiles = make_test_profiles();
        let mut engine = ZoomCalibrationEngine::new(
            1,
            30.0,
            103.0,
            profiles.clone(),
            profiles.clone(),
            ConvergenceMode::Quick,
        );

        // 결과 설정
        for i in 0..3 {
            let p = &profiles[i];
            engine.ratio_results[i] = Some(ZoomRatioResult {
                zoom_profile_id: p.id,
                ratio: p.zoom_ratio,
                scope_fov: p.scope_fov,
                optimal_multiplier: 1.5 + i as f64 * 0.5,
                steady_score: 0.8,
                correction_score: 0.7,
                zoomout_score: 0.75,
                composite_score: 0.77,
                mdm_predicted: 1.5,
                deviation: 0.0,
                observations: Vec::new(),
            });
        }

        engine.finalize();
        let adjusted = engine.adjust_k(0.05);
        assert!(
            adjusted.k_value > 0.0,
            "조정된 k > 0: got {:.3}",
            adjusted.k_value
        );
        assert!(
            !adjusted.predictions.is_empty(),
            "조정 후 예측 존재"
        );
    }

    /// 테스트 프로파일 생성 (3개 비율)
    fn make_test_profiles() -> Vec<ZoomProfileInfo> {
        vec![
            ZoomProfileInfo {
                id: 1,
                scope_name: "1x".to_string(),
                zoom_ratio: 1.5,
                fov_override: None,
                scope_fov: 70.0,
                weights: ZoomPhaseWeights {
                    steady: 0.5,
                    correction: 0.3,
                    zoomout: 0.2,
                },
            },
            ZoomProfileInfo {
                id: 2,
                scope_name: "3x".to_string(),
                zoom_ratio: 3.0,
                fov_override: None,
                scope_fov: 40.0,
                weights: ZoomPhaseWeights {
                    steady: 0.5,
                    correction: 0.3,
                    zoomout: 0.2,
                },
            },
            ZoomProfileInfo {
                id: 3,
                scope_name: "6x".to_string(),
                zoom_ratio: 6.0,
                fov_override: None,
                scope_fov: 20.0,
                weights: ZoomPhaseWeights {
                    steady: 0.5,
                    correction: 0.3,
                    zoomout: 0.2,
                },
            },
        ]
    }
}
