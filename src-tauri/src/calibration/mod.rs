//! 캘리브레이션 엔진 — 2-stage, 3-mode 감도 교정 오케스트레이터
//!
//! Stage 1: DNA Screening (~20회) — 현재 sens 고정, PartialAimDna 추출
//! Stage 2: Calibration — GP Bayesian Optimization으로 최적 cm/360 탐색
//!
//! 3 Mode: Explore (넓은 범위) / Refine (±5~10%) / Fixed (수집만)

pub mod commands;
pub mod fatigue;
pub mod screening;
pub mod warmup;

use crate::gp::{
    check_convergence, detect_bimodal, next_candidate, significance_test, ConvergenceMode,
    GaussianProcess, Peak, SignificanceResult,
};
use fatigue::FatigueTracker;
use screening::{GameCategory, PartialAimDna, ScreeningData, TrialMetricsSummary};
use warmup::WarmupDetector;

use serde::{Deserialize, Serialize};

/// 캘리브레이션 스테이지
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CalibrationStage {
    /// Stage 1: DNA 스크리닝
    Screening,
    /// Stage 2: GP 캘리브레이션
    Calibration,
    /// 완료
    Complete,
}

/// 캘리브레이션 모드
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CalibrationMode {
    /// 넓은 범위 탐색 (current ± 15, clamp 15~60)
    Explore,
    /// 좁은 범위 정밀 조정 (center ± 5~10%)
    Refine,
    /// 감도 고정, DNA/메트릭만 수집
    Fixed,
}

impl CalibrationMode {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "explore" => CalibrationMode::Explore,
            "refine" => CalibrationMode::Refine,
            "fixed" => CalibrationMode::Fixed,
            _ => CalibrationMode::Explore,
        }
    }
}

/// 캘리브레이션 설정
#[derive(Debug, Clone)]
struct CalibrationConfig {
    /// 탐색 범위 [min, max] cm/360
    range_min: f64,
    range_max: f64,
    /// 수렴 모드
    convergence_mode: ConvergenceMode,
    /// grid search 간격
    search_step: f64,
    /// EI 탐색-활용 파라미터
    xi: f64,
}

/// 다음 트라이얼 지시
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NextTrialAction {
    /// 테스트할 cm/360 값
    pub cm360: f64,
    /// 스테이지 정보
    pub stage: CalibrationStage,
    /// 반복 횟수
    pub iteration: usize,
    /// baseline 측정인지 여부
    pub is_baseline: bool,
}

/// 트라이얼 제출 후 피드백
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrialFeedback {
    /// 수렴 여부
    pub converged: bool,
    /// 피로 중단 여부
    pub fatigue_stop: bool,
    /// 스크리닝 → 캘리브레이션 전환 여부
    pub stage_transition: bool,
    /// 현재 최적 cm/360 (GP 기준)
    pub current_best_cm360: Option<f64>,
    /// 현재 최적 점수
    pub current_best_score: Option<f64>,
    /// 피드백 메시지
    pub message: Option<String>,
}

/// 캘리브레이션 최종 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationResult {
    /// 추천 cm/360
    pub recommended_cm360: f64,
    /// 추천 점수 (GP mean)
    pub recommended_score: f64,
    /// 현재 cm/360
    pub current_cm360: f64,
    /// 이봉 감지 결과
    pub peaks: Vec<Peak>,
    /// 이봉 감지 여부
    pub bimodal_detected: bool,
    /// 유의성 검정 결과
    pub significance: SignificanceResult,
    /// 부분 DNA (있으면)
    pub partial_dna: Option<PartialAimDna>,
    /// 적응 속도 (있으면)
    pub adaptation_rate: Option<f64>,
    /// 총 반복 횟수
    pub total_iterations: usize,
    /// GP 예측 곡선 (x, mean, variance)
    pub gp_curve: Vec<(f64, f64, f64)>,
    /// 관측 데이터 (x, y)
    pub observations: Vec<(f64, f64)>,
}

/// 캘리브레이션 상태 (프론트엔드 전송용)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationStatus {
    pub stage: CalibrationStage,
    pub mode: CalibrationMode,
    pub iteration: usize,
    pub max_iterations: usize,
    pub screening_progress: Option<(usize, usize)>, // (현재, 목표)
    pub current_best: Option<(f64, f64)>,            // (cm360, score)
    pub gp_curve: Vec<(f64, f64, f64)>,              // (x, mean, var)
    pub observations: Vec<(f64, f64)>,               // (cm360, score)
}

/// 캘리브레이션 엔진
pub struct CalibrationEngine {
    /// GP 모델
    gp: GaussianProcess,
    /// 현재 스테이지
    stage: CalibrationStage,
    /// 캘리브레이션 모드
    mode: CalibrationMode,
    /// 피로도 추적
    fatigue: FatigueTracker,
    /// 워밍업 감지
    warmup: WarmupDetector,
    /// 설정
    config: CalibrationConfig,
    /// 현재 반복
    iteration: usize,
    /// 현재 (기존) cm/360
    current_cm360: f64,
    /// 게임 카테고리
    game_category: GameCategory,
    /// 스크리닝 데이터
    screening_data: ScreeningData,
    /// 최근 최적 cm360 기록 (수렴 판정용)
    recent_bests: Vec<f64>,
    /// 초기 탐색점 큐 (Explore 모드)
    initial_points: Vec<f64>,
    /// DB 세션 ID — GP 관측점 저장용 (start_calibration에서 설정)
    pub session_id: Option<i64>,
}

impl CalibrationEngine {
    /// 새 캘리브레이션 엔진 생성
    pub fn new(
        current_cm360: f64,
        mode: CalibrationMode,
        game_category: &str,
    ) -> Self {
        Self::with_convergence(current_cm360, mode, game_category, ConvergenceMode::Quick)
    }

    /// 수렴 모드를 지정하여 캘리브레이션 엔진 생성
    pub fn with_convergence(
        current_cm360: f64,
        mode: CalibrationMode,
        game_category: &str,
        convergence_mode: ConvergenceMode,
    ) -> Self {
        let category = GameCategory::from_str(game_category);

        // 모드별 탐색 범위 설정
        let (range_min, range_max) = match mode {
            CalibrationMode::Explore => {
                let min = (current_cm360 - 15.0).max(15.0);
                let max = (current_cm360 + 15.0).min(60.0);
                (min, max)
            }
            CalibrationMode::Refine => {
                let min = current_cm360 * 0.9;
                let max = current_cm360 * 1.1;
                (min, max)
            }
            CalibrationMode::Fixed => (current_cm360, current_cm360),
        };

        // 초기 탐색점 (Explore 모드)
        let initial_points = match mode {
            CalibrationMode::Explore => vec![
                current_cm360,
                (current_cm360 * 0.8).max(range_min),
                (current_cm360 * 1.2).min(range_max),
            ],
            CalibrationMode::Refine => vec![
                current_cm360,
                current_cm360 * 0.95,
                current_cm360 * 1.05,
            ],
            CalibrationMode::Fixed => vec![],
        };

        let config = CalibrationConfig {
            range_min,
            range_max,
            convergence_mode,
            search_step: 0.5,
            xi: 0.01,
        };

        Self {
            gp: GaussianProcess::default_for_calibration(),
            stage: CalibrationStage::Screening,
            mode,
            fatigue: FatigueTracker::new(),
            warmup: WarmupDetector::new(),
            config,
            iteration: 0,
            current_cm360,
            game_category: category,
            screening_data: ScreeningData::new(),
            recent_bests: Vec::new(),
            initial_points,
            session_id: None,
        }
    }

    /// 다음 테스트할 cm/360 반환
    pub fn get_next_sens(&self) -> NextTrialAction {
        match self.stage {
            CalibrationStage::Screening => {
                // 스크리닝: 현재 sens 고정
                NextTrialAction {
                    cm360: self.current_cm360,
                    stage: self.stage,
                    iteration: self.screening_data.scores.len(),
                    is_baseline: false,
                }
            }
            CalibrationStage::Calibration => {
                // baseline 필요 시 현재 sens로 측정
                if self.fatigue.needs_baseline() {
                    return NextTrialAction {
                        cm360: self.current_cm360,
                        stage: self.stage,
                        iteration: self.iteration,
                        is_baseline: true,
                    };
                }

                // 초기 탐색점이 남아있으면 사용
                let next_cm360 = if self.iteration < self.initial_points.len() {
                    self.initial_points[self.iteration]
                } else {
                    // GP의 EI 기반 다음 후보
                    let candidate = next_candidate(
                        &self.gp,
                        self.config.range_min,
                        self.config.range_max,
                        self.config.search_step,
                        self.config.xi,
                    );
                    candidate.cm360
                };

                NextTrialAction {
                    cm360: next_cm360,
                    stage: self.stage,
                    iteration: self.iteration,
                    is_baseline: false,
                }
            }
            CalibrationStage::Complete => {
                // 완료 상태 — 더 이상 테스트 불필요
                NextTrialAction {
                    cm360: self.current_cm360,
                    stage: self.stage,
                    iteration: self.iteration,
                    is_baseline: false,
                }
            }
        }
    }

    /// 트라이얼 결과 제출
    pub fn submit_trial(
        &mut self,
        cm360: f64,
        score: f64,
        metrics: Option<TrialMetricsSummary>,
    ) -> TrialFeedback {
        match self.stage {
            CalibrationStage::Screening => self.submit_screening_trial(cm360, score, metrics),
            CalibrationStage::Calibration => self.submit_calibration_trial(cm360, score),
            CalibrationStage::Complete => TrialFeedback {
                converged: true,
                fatigue_stop: false,
                stage_transition: false,
                current_best_cm360: None,
                current_best_score: None,
                message: Some("이미 완료됨".to_string()),
            },
        }
    }

    /// 스크리닝 트라이얼 제출
    fn submit_screening_trial(
        &mut self,
        _cm360: f64,
        score: f64,
        metrics: Option<TrialMetricsSummary>,
    ) -> TrialFeedback {
        // 메트릭 기록
        if let Some(m) = metrics {
            self.screening_data.add_trial(score, m);
        } else {
            // 메트릭 없으면 기본값으로
            self.screening_data.add_trial(
                score,
                TrialMetricsSummary {
                    overshoot: 0.0,
                    pre_aim_ratio: 0.0,
                    direction_bias: 0.0,
                    motor_breakdown: screening::MotorBreakdown {
                        finger: 0.33,
                        wrist: 0.34,
                        arm: 0.33,
                    },
                    tracking_smoothness: None,
                },
            );
        }

        // 워밍업 체크
        self.warmup.record(score);

        // 스크리닝 완료 체크
        if self.screening_data.is_complete() {
            // 워밍업 미도달이면 연장
            if !self.warmup.is_plateau_reached() && self.screening_data.extension_count < 2 {
                self.screening_data.extend(10);
                return TrialFeedback {
                    converged: false,
                    fatigue_stop: false,
                    stage_transition: false,
                    current_best_cm360: None,
                    current_best_score: None,
                    message: Some("워밍업 미완료 — 스크리닝 연장 (+10회)".to_string()),
                };
            }

            // DNA 추출 + informed prior 생성
            let dna = self.screening_data.extract_partial_dna();
            self.screening_data.compute_adaptation_rate();

            let prior =
                screening::get_informed_prior(self.game_category, &dna);

            // GP에 prior 설정
            self.gp.set_prior_mean(prior.mean / 100.0); // score 스케일로 변환 (대략적)

            // Fixed 모드면 바로 완료
            if self.mode == CalibrationMode::Fixed {
                self.stage = CalibrationStage::Complete;
                return TrialFeedback {
                    converged: true,
                    fatigue_stop: false,
                    stage_transition: true,
                    current_best_cm360: Some(self.current_cm360),
                    current_best_score: None,
                    message: Some("Fixed 모드 — 스크리닝 완료".to_string()),
                };
            }

            // Stage 2로 전환
            self.stage = CalibrationStage::Calibration;
            self.iteration = 0;

            return TrialFeedback {
                converged: false,
                fatigue_stop: false,
                stage_transition: true,
                current_best_cm360: None,
                current_best_score: None,
                message: Some("스크리닝 완료 → 캘리브레이션 시작".to_string()),
            };
        }

        TrialFeedback {
            converged: false,
            fatigue_stop: false,
            stage_transition: false,
            current_best_cm360: None,
            current_best_score: None,
            message: None,
        }
    }

    /// 캘리브레이션 트라이얼 제출
    fn submit_calibration_trial(&mut self, cm360: f64, score: f64) -> TrialFeedback {
        // 피로 체크
        if self.fatigue.on_trial_complete() && self.fatigue.record_baseline(score) {
            return TrialFeedback {
                converged: false,
                fatigue_stop: true,
                stage_transition: false,
                current_best_cm360: self.gp.best_observation().map(|(x, _)| x),
                current_best_score: self.gp.best_observation().map(|(_, y)| y),
                message: Some("피로 감지 — 세션 중단 권고".to_string()),
            };
        }

        // GP에 관측 추가
        self.gp.add_observation(cm360, score);
        self.iteration += 1;

        // 최적값 추적
        if let Some((best_x, _)) = self.gp.best_observation() {
            self.recent_bests.push(best_x);
        }

        // 수렴 체크
        let max_ei = if self.gp.n_observations() >= 2 {
            let candidate = next_candidate(
                &self.gp,
                self.config.range_min,
                self.config.range_max,
                self.config.search_step,
                self.config.xi,
            );
            candidate.ei
        } else {
            f64::MAX
        };

        let convergence = check_convergence(
            max_ei,
            self.config.convergence_mode,
            &self.recent_bests,
            self.iteration,
        );

        let (best_cm360, best_score) = self.gp.best_observation().unwrap_or((self.current_cm360, 0.0));

        if convergence.converged {
            self.stage = CalibrationStage::Complete;
        }

        TrialFeedback {
            converged: convergence.converged,
            fatigue_stop: false,
            stage_transition: false,
            current_best_cm360: Some(best_cm360),
            current_best_score: Some(best_score),
            message: convergence.reason,
        }
    }

    /// 캘리브레이션 최종 결과 생성
    pub fn finalize(&self) -> CalibrationResult {
        let (best_cm360, best_score) = self
            .gp
            .best_observation()
            .unwrap_or((self.current_cm360, 0.0));

        // 이봉 감지
        let peaks = if self.gp.n_observations() >= 3 {
            detect_bimodal(&self.gp, self.config.range_min, self.config.range_max, 0.5)
        } else {
            vec![]
        };

        let bimodal = peaks.len() >= 2;

        // 유의성 검정
        let significance = significance_test(&self.gp, self.current_cm360, best_cm360);

        // GP 곡선
        let gp_curve = if self.gp.n_observations() > 0 {
            self.gp
                .predict_range(self.config.range_min, self.config.range_max, 0.5)
        } else {
            vec![]
        };

        // 관측 데이터
        let observations: Vec<(f64, f64)> = self
            .gp
            .x_train
            .iter()
            .zip(self.gp.y_train.iter())
            .map(|(&x, &y)| (x, y))
            .collect();

        CalibrationResult {
            recommended_cm360: best_cm360,
            recommended_score: best_score,
            current_cm360: self.current_cm360,
            peaks,
            bimodal_detected: bimodal,
            significance,
            partial_dna: self.screening_data.partial_dna.clone(),
            adaptation_rate: self.screening_data.adaptation_rate,
            total_iterations: self.iteration,
            gp_curve,
            observations,
        }
    }

    /// GP 관측 DB 저장용 정보 조회 (iteration + posterior mean/var at point)
    pub fn get_observation_info(&self, cm360: f64) -> (usize, Option<f64>, Option<f64>) {
        if self.gp.n_observations() == 0 {
            return (self.iteration, None, None);
        }
        let pred = self.gp.predict(cm360);
        (self.iteration, Some(pred.mean), Some(pred.variance))
    }

    /// 현재 상태 조회
    pub fn get_status(&self) -> CalibrationStatus {
        let screening_progress = if self.stage == CalibrationStage::Screening {
            Some((
                self.screening_data.scores.len(),
                self.screening_data.target_trials,
            ))
        } else {
            None
        };

        let gp_curve = if self.gp.n_observations() > 0 {
            self.gp
                .predict_range(self.config.range_min, self.config.range_max, 0.5)
        } else {
            vec![]
        };

        let observations: Vec<(f64, f64)> = self
            .gp
            .x_train
            .iter()
            .zip(self.gp.y_train.iter())
            .map(|(&x, &y)| (x, y))
            .collect();

        CalibrationStatus {
            stage: self.stage,
            mode: self.mode,
            iteration: self.iteration,
            max_iterations: self.config.convergence_mode.max_iterations(),
            screening_progress,
            current_best: self.gp.best_observation(),
            gp_curve,
            observations,
        }
    }
}

#[cfg(test)]
mod go_no_go;

#[cfg(test)]
mod tests {
    use super::*;

    /// E2E: 스크리닝 → 캘리브레이션 전환
    #[test]
    fn test_screening_to_calibration_transition() {
        let mut engine = CalibrationEngine::new(35.0, CalibrationMode::Explore, "tactical");
        assert_eq!(engine.stage, CalibrationStage::Screening);

        // 20회 스크리닝 (안정적 점수로 워밍업 통과)
        for _ in 0..20 {
            let action = engine.get_next_sens();
            assert_eq!(action.cm360, 35.0, "스크리닝은 현재 sens 고정");

            let feedback = engine.submit_trial(35.0, 0.75, None);
            if feedback.stage_transition {
                assert_eq!(engine.stage, CalibrationStage::Calibration);
                return;
            }
        }

        assert_eq!(
            engine.stage,
            CalibrationStage::Calibration,
            "20회 후 캘리브레이션으로 전환"
        );
    }

    /// E2E: GP가 포물선 최적점을 찾는지 검증
    #[test]
    fn test_gp_finds_optimum() {
        let mut engine = CalibrationEngine::new(35.0, CalibrationMode::Explore, "tactical");

        // 스크리닝 빠르게 통과
        for _ in 0..20 {
            engine.submit_trial(35.0, 0.7, None);
        }
        assert_eq!(engine.stage, CalibrationStage::Calibration);

        // 합성 score 함수: 35 cm/360 최적
        let score_fn = |x: f64| -> f64 { -((x - 35.0) / 10.0).powi(2) + 0.9 };

        // 캘리브레이션 루프
        for _ in 0..15 {
            let action = engine.get_next_sens();
            let score = score_fn(action.cm360);
            let feedback = engine.submit_trial(action.cm360, score, None);

            if feedback.converged {
                break;
            }
        }

        let result = engine.finalize();
        assert!(
            (result.recommended_cm360 - 35.0).abs() < 5.0,
            "최적점 ±5 이내: got {} cm/360",
            result.recommended_cm360
        );
    }

    /// Fixed 모드 — 스크리닝만 하고 완료
    #[test]
    fn test_fixed_mode() {
        let mut engine = CalibrationEngine::new(35.0, CalibrationMode::Fixed, "tactical");

        for _ in 0..20 {
            let feedback = engine.submit_trial(35.0, 0.7, None);
            if feedback.converged {
                assert_eq!(engine.stage, CalibrationStage::Complete);
                return;
            }
        }

        assert_eq!(engine.stage, CalibrationStage::Complete);
    }

    /// 상태 조회 검증
    #[test]
    fn test_get_status() {
        let engine = CalibrationEngine::new(35.0, CalibrationMode::Explore, "tactical");
        let status = engine.get_status();
        assert_eq!(status.stage, CalibrationStage::Screening);
        assert_eq!(status.screening_progress, Some((0, 20)));
    }

    /// DB seed + 캘리브레이션 세션 INSERT 통합 검증
    /// 실제 IPC 흐름: start_calibration → DB 삽입 → 엔진 생성
    #[test]
    fn test_db_seed_and_calibration_session_insert() {
        use crate::db::Database;

        // 임시 DB 생성
        let tmp = std::env::temp_dir().join("aimforge_test_cal.db");
        let _ = std::fs::remove_file(&tmp);
        let db = Database::new(&tmp).expect("DB 생성 실패");
        db.initialize_schema().expect("스키마 초기화 실패");

        // seed_defaults가 profiles + games에 id=1 넣었는지 검증
        let profile_exists: bool = db.conn().query_row(
            "SELECT COUNT(*) > 0 FROM profiles WHERE id = 1",
            [],
            |row| row.get(0),
        ).expect("profiles 조회 실패");
        assert!(profile_exists, "기본 프로필(id=1)이 seed되어야 함");

        let game_exists: bool = db.conn().query_row(
            "SELECT COUNT(*) > 0 FROM games WHERE id = 1",
            [],
            |row| row.get(0),
        ).expect("games 조회 실패");
        assert!(game_exists, "기본 게임(id=1)이 seed되어야 함");

        // 캘리브레이션 세션 INSERT (FK 검증 — 이전 버그 재현 방지)
        let session_id = db
            .insert_calibration_session(1, "explore", 35.0, "tactical")
            .expect("캘리브레이션 세션 INSERT 실패 — FK 위반 가능성");

        assert!(session_id > 0, "세션 ID는 양수");

        // GP 모델 INSERT
        db.insert_gp_model(session_id, 5.0, 0.1, 0.015, None, None)
            .expect("GP 모델 INSERT 실패");

        // 엔진 생성 검증
        let engine = CalibrationEngine::new(35.0, CalibrationMode::Explore, "tactical");
        assert_eq!(engine.stage, CalibrationStage::Screening);

        // 정리
        let _ = std::fs::remove_file(&tmp);
    }

    /// E2E: 스크리닝 → 캘리브레이션 → finalize 전체 플로우
    #[test]
    fn test_full_calibration_e2e_with_db() {
        use crate::db::Database;

        let tmp = std::env::temp_dir().join("aimforge_test_cal_e2e.db");
        let _ = std::fs::remove_file(&tmp);
        let db = Database::new(&tmp).expect("DB 생성 실패");
        db.initialize_schema().expect("스키마 초기화 실패");

        // 1. start_calibration 흐름
        let session_id = db
            .insert_calibration_session(1, "explore", 35.0, "tactical")
            .expect("세션 INSERT 실패");
        db.insert_gp_model(session_id, 5.0, 0.1, 0.015, None, None)
            .expect("GP 모델 INSERT 실패");

        let mut engine = CalibrationEngine::new(35.0, CalibrationMode::Explore, "tactical");

        // 2. get_next_trial_sens 흐름
        let action = engine.get_next_sens();
        assert!(action.cm360 > 0.0, "추천 cm360은 양수");

        // 3. submit_calibration_trial — 스크리닝 통과
        for _ in 0..20 {
            engine.submit_trial(35.0, 0.7, None);
        }
        assert_eq!(engine.stage, CalibrationStage::Calibration);

        // 4. get_calibration_status 흐름
        let status = engine.get_status();
        assert_eq!(status.stage, CalibrationStage::Calibration);

        // 5. 캘리브레이션 트라이얼 몇 회
        let score_fn = |x: f64| -> f64 { -((x - 35.0) / 10.0).powi(2) + 0.9 };
        for _ in 0..10 {
            let action = engine.get_next_sens();
            engine.submit_trial(action.cm360, score_fn(action.cm360), None);
        }

        // 6. finalize_calibration 흐름 — 결과 생성 + DB 저장
        let result = engine.finalize();
        assert!(result.recommended_cm360 > 0.0, "추천값은 양수");

        // DB에 결과 저장 (commands::finalize_calibration과 동일 흐름)
        db.update_calibration_result(
            session_id,
            result.recommended_cm360,
            result.bimodal_detected,
            result.peaks.first().map(|p| p.cm360),
            result.peaks.get(1).map(|p| p.cm360),
            result.significance.p_value,
            result.significance.label.as_str(),
            result.total_iterations as i64,
        )
        .expect("캘리브레이션 결과 DB 저장 실패");

        // DB에서 결과 확인
        let is_complete: bool = db.conn().query_row(
            "SELECT is_complete = 1 FROM calibration_sessions WHERE id = ?1",
            rusqlite::params![session_id],
            |row| row.get(0),
        ).expect("결과 조회 실패");
        assert!(is_complete, "finalize 후 is_complete=1이어야 함");

        // 7. cancel_calibration 흐름 (엔진 리셋 시뮬레이션)
        let mut engine_slot: Option<CalibrationEngine> = Some(engine);
        engine_slot.take();
        assert!(engine_slot.is_none(), "취소 후 엔진은 None");

        let _ = std::fs::remove_file(&tmp);
    }
}
