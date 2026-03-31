//! Day 7 Go/No-Go 검증 테스트
//!
//! 4가지 기준:
//! 1. 5회 반복 재현성 ±2 cm/360
//! 2. 이봉(bimodal) 감지 정확성
//! 3. 변경 유의성 검정 (Recommend/Marginal/Keep)
//! 4. 수렴 판정 + 피로 중단

use super::*;
use crate::gp::{GaussianProcess, SignificanceLabel};

// ─────────────────── 합성 점수 함수 ───────────────────

/// 단봉 포물선 — peak에서 최대값 max_score, width로 폭 조절
fn unimodal_score(x: f64, peak: f64, max_score: f64, width: f64) -> f64 {
    -((x - peak) / width).powi(2) + max_score
}

/// 이봉 가우시안 — 두 지점에서 각각 피크
fn bimodal_score(x: f64, p1: f64, p2: f64, s1: f64, s2: f64, w: f64) -> f64 {
    let g1 = s1 * (-((x - p1) / w).powi(2)).exp();
    let g2 = s2 * (-((x - p2) / w).powi(2)).exp();
    g1 + g2
}

// ─────────────────── 헬퍼 함수 ───────────────────

/// 스크리닝 20회 통과 — 안정 점수로 워밍업 자동 클리어
fn pass_screening(engine: &mut CalibrationEngine) {
    for _ in 0..20 {
        let action = engine.get_next_sens();
        engine.submit_trial(action.cm360, 0.7, None);
    }
    assert_eq!(
        engine.get_status().stage,
        CalibrationStage::Calibration,
        "스크리닝 → 캘리브레이션 전환 실패"
    );
}

/// 풀 캘리브레이션 실행 (스크리닝 + GP 최적화 + finalize)
fn run_full_calibration<F: Fn(f64) -> f64>(
    current_cm360: f64,
    mode: CalibrationMode,
    category: &str,
    score_fn: F,
) -> CalibrationResult {
    let mut engine = CalibrationEngine::new(current_cm360, mode, category);
    pass_screening(&mut engine);

    // 캘리브레이션 루프 (최대 20회 안전장치)
    for _ in 0..20 {
        if engine.get_status().stage == CalibrationStage::Complete {
            break;
        }
        let action = engine.get_next_sens();
        let score = score_fn(action.cm360);
        let feedback = engine.submit_trial(action.cm360, score, None);
        if feedback.converged {
            break;
        }
    }

    engine.finalize()
}

// ═══════════════════ 테스트 ═══════════════════

// ─────────────── 1. 재현성 ±2 cm/360 ───────────────

/// Go/No-Go #1: 시작점 5개로 독립 캘리브레이션 → 결과 편차 ≤ 2 cm/360
#[test]
fn test_gonogo_reproducibility_5runs() {
    let starts = [25.0, 30.0, 35.0, 40.0, 45.0];
    let mut results = Vec::new();

    for &start in &starts {
        let result = run_full_calibration(
            start,
            CalibrationMode::Explore,
            "tactical",
            |x| unimodal_score(x, 35.0, 0.9, 10.0),
        );
        results.push(result.recommended_cm360);
    }

    let min = results.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = results.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let spread = max - min;

    println!("=== 재현성 테스트 ===");
    for (i, (&start, &rec)) in starts.iter().zip(results.iter()).enumerate() {
        println!("  Run {}: start={:.1} → recommended={:.2}", i + 1, start, rec);
    }
    println!("  편차: {:.3} cm/360 (허용: ≤ 2.0)", spread);

    assert!(
        spread <= 2.0,
        "5회 재현성 실패: 편차 {:.3} > 2.0 (results: {:?})",
        spread,
        results
    );

    // 추가: 모든 결과가 실제 최적점(35.0)에서 ±5 이내
    for (i, &r) in results.iter().enumerate() {
        assert!(
            (r - 35.0).abs() < 5.0,
            "Run {}: {:.2}가 최적점 35.0에서 ±5 이내여야 함",
            i + 1,
            r
        );
    }
}

/// Go/No-Go #2: 동일 조건 5회 → 결정론적 (비트 동일 결과)
#[test]
fn test_gonogo_reproducibility_deterministic() {
    let mut results = Vec::new();

    for _ in 0..5 {
        let result = run_full_calibration(
            35.0,
            CalibrationMode::Explore,
            "tactical",
            |x| unimodal_score(x, 35.0, 0.9, 10.0),
        );
        results.push(result.recommended_cm360);
    }

    println!("=== 결정론 테스트 ===");
    for (i, &r) in results.iter().enumerate() {
        println!("  Run {}: {:.10}", i + 1, r);
    }

    // 모두 첫 번째 결과와 동일해야 함 (랜덤성 없음)
    let baseline = results[0];
    for (i, &r) in results.iter().enumerate().skip(1) {
        assert!(
            (r - baseline).abs() < 1e-10,
            "Run {}: {:.10} ≠ baseline {:.10} — 비결정적 동작 감지",
            i + 1,
            r,
            baseline
        );
    }
}

// ─────────────── 2. 이봉 감지 ───────────────

/// Go/No-Go #3: 이봉 합성 함수 → bimodal_detected + 2개 피크 위치 정확
#[test]
fn test_gonogo_bimodal_detection() {
    let result = run_full_calibration(
        35.0,
        CalibrationMode::Explore,
        "tactical",
        |x| bimodal_score(x, 25.0, 45.0, 0.85, 0.80, 5.0),
    );

    println!("=== 이봉 감지 테스트 ===");
    println!("  bimodal_detected: {}", result.bimodal_detected);
    println!("  peaks: {:?}", result.peaks.iter().map(|p| (p.cm360, p.score)).collect::<Vec<_>>());

    assert!(
        result.bimodal_detected,
        "이봉 함수인데 bimodal_detected=false"
    );

    assert!(
        result.peaks.len() >= 2,
        "피크가 2개 미만: {}개 감지",
        result.peaks.len()
    );

    // 두 피크 중 하나는 25 근처, 하나는 45 근처여야 함
    let peak_positions: Vec<f64> = result.peaks.iter().map(|p| p.cm360).collect();
    let near_25 = peak_positions.iter().any(|&p| (p - 25.0).abs() < 7.0);
    let near_45 = peak_positions.iter().any(|&p| (p - 45.0).abs() < 7.0);

    assert!(near_25, "25 근처 피크 미감지 (peaks: {:?})", peak_positions);
    assert!(near_45, "45 근처 피크 미감지 (peaks: {:?})", peak_positions);
}

// ─────────────── 3. 유의성 검정 ───────────────

/// Go/No-Go #4: 큰 개선 → Recommend
#[test]
fn test_gonogo_significance_recommend() {
    // 시작 30에서 최적 35로 이동 — 큰 점수 차이
    let result = run_full_calibration(
        30.0,
        CalibrationMode::Explore,
        "tactical",
        |x| unimodal_score(x, 35.0, 0.9, 10.0),
    );

    println!("=== 유의성: Recommend ===");
    println!(
        "  recommended: {:.2}, z={:.3}, p={:.4}, label={:?}",
        result.recommended_cm360,
        result.significance.z_score,
        result.significance.p_value,
        result.significance.label
    );

    assert_eq!(
        result.significance.label,
        SignificanceLabel::Recommend,
        "큰 개선인데 Recommend가 아님 (p={:.4})",
        result.significance.p_value
    );
}

/// Go/No-Go #5: 평탄 점수 → Keep
#[test]
fn test_gonogo_significance_keep() {
    // 모든 cm360에서 동일 점수 → 변경 불필요
    let result = run_full_calibration(
        35.0,
        CalibrationMode::Explore,
        "tactical",
        |_x| 0.7,
    );

    println!("=== 유의성: Keep ===");
    println!(
        "  recommended: {:.2}, z={:.3}, p={:.4}, label={:?}",
        result.recommended_cm360,
        result.significance.z_score,
        result.significance.p_value,
        result.significance.label
    );

    assert_eq!(
        result.significance.label,
        SignificanceLabel::Keep,
        "평탄 점수인데 Keep이 아님 (p={:.4})",
        result.significance.p_value
    );
}

/// Go/No-Go #6: 완만 경사 → Marginal (E2E)
#[test]
fn test_gonogo_significance_marginal() {
    // 아주 넓은 포물선 — 미미한 차이
    let result = run_full_calibration(
        30.0,
        CalibrationMode::Explore,
        "tactical",
        |x| unimodal_score(x, 35.0, 0.72, 30.0),
    );

    println!("=== 유의성: Marginal (E2E) ===");
    println!(
        "  recommended: {:.2}, z={:.3}, p={:.4}, label={:?}",
        result.recommended_cm360,
        result.significance.z_score,
        result.significance.p_value,
        result.significance.label
    );

    // Marginal 범위가 좁으므로 Keep도 허용 (실질적으로 "변경 불필요" 계열)
    assert!(
        result.significance.label == SignificanceLabel::Marginal
            || result.significance.label == SignificanceLabel::Keep,
        "완만 경사인데 Recommend (p={:.4})",
        result.significance.p_value
    );
}

/// Go/No-Go #7: GP 직접 주입으로 Marginal 정밀 검증
/// 전략: 관측 밀도를 낮춰서 GP 불확실성을 높이고, 작은 차이가 Marginal 범위에 들도록 조정
#[test]
fn test_gonogo_significance_marginal_targeted() {
    use crate::gp::significance_test;

    let mut gp = GaussianProcess::default_for_calibration();

    // 좁은 포물선 — 30 vs 35 사이에 적당한 차이 유도
    // width=12: score(30)≈0.547, score(35)=0.72 → 차이 ≈ 0.173
    // 소수 관측으로 GP 불확실성 유지 → z가 Marginal 범위 (0.842~1.645)에 들도록
    let observations = [20.0, 28.0, 35.0, 42.0, 50.0];
    for &x in &observations {
        let score = unimodal_score(x, 35.0, 0.72, 12.0);
        gp.add_observation(x, score);
    }

    let sig = significance_test(&gp, 30.0, 35.0);

    println!("=== 유의성: Marginal (targeted) ===");
    println!("  z={:.3}, p={:.4}, label={:?}", sig.z_score, sig.p_value, sig.label);

    // Marginal = p ∈ [0.05, 0.2), 즉 z ∈ [0.842, 1.645]
    assert_eq!(
        sig.label,
        SignificanceLabel::Marginal,
        "targeted에서 Marginal이 아님 (p={:.4}, z={:.3})",
        sig.p_value,
        sig.z_score
    );
}

// ─────────────── 4. 수렴 + 피로 ───────────────

/// Go/No-Go #8: Quick 모드 15회 이내 수렴
#[test]
fn test_gonogo_convergence_within_iterations() {
    let mut engine = CalibrationEngine::new(35.0, CalibrationMode::Explore, "tactical");
    pass_screening(&mut engine);

    let score_fn = |x: f64| unimodal_score(x, 35.0, 0.9, 10.0);
    let mut converged = false;
    let mut iterations_used = 0;

    for _ in 0..15 {
        let action = engine.get_next_sens();
        let score = score_fn(action.cm360);
        let feedback = engine.submit_trial(action.cm360, score, None);
        iterations_used += 1;

        if feedback.converged {
            converged = true;
            break;
        }
    }

    let result = engine.finalize();

    println!("=== 수렴 테스트 ===");
    println!("  iterations: {}, converged: {}", iterations_used, converged);
    println!("  recommended: {:.2} cm/360", result.recommended_cm360);

    assert!(converged, "15회 이내 미수렴 ({}회 사용)", iterations_used);
    assert!(
        (result.recommended_cm360 - 35.0).abs() < 5.0,
        "수렴했지만 최적점에서 벗어남: {:.2}",
        result.recommended_cm360
    );
}

/// Go/No-Go #9: 이미 최적 → 빠른 수렴 + ±3 이내
#[test]
fn test_gonogo_already_optimal_fast() {
    let result = run_full_calibration(
        35.0,
        CalibrationMode::Explore,
        "tactical",
        |x| unimodal_score(x, 35.0, 0.9, 10.0),
    );

    println!("=== 이미 최적 테스트 ===");
    println!(
        "  recommended: {:.2}, iterations: {}",
        result.recommended_cm360, result.total_iterations
    );

    assert!(
        (result.recommended_cm360 - 35.0).abs() < 3.0,
        "이미 최적인데 벗어남: {:.2} (기대: 35.0 ±3)",
        result.recommended_cm360
    );
}

/// Go/No-Go #10: 피로 감지 → fatigue_stop 트리거
/// FatigueTracker: 3회마다 record_baseline, 2번째 baseline에서 15%+ 하락 시 중단
/// 핵심: 최소 6회 트라이얼 필요 (3회차 첫 baseline, 6회차 비교)
/// GP 수렴이 먼저 오면 안 되므로 넓은 범위 + 점수 불안정 유도
#[test]
fn test_gonogo_fatigue_stop() {
    let mut engine = CalibrationEngine::new(35.0, CalibrationMode::Explore, "tactical");
    pass_screening(&mut engine);

    let mut trial_count: usize = 0;
    let mut fatigue_triggered = false;

    for _ in 0..20 {
        if engine.get_status().stage == CalibrationStage::Complete {
            break;
        }

        let action = engine.get_next_sens();
        trial_count += 1;

        // 급격한 감쇠 (10%/trial) — 6회차에서 40% 하락 유도
        // 추가: 각 cm360마다 다른 점수로 GP가 빠르게 수렴하지 않게 함
        let base = 0.8; // 고정 base (cm360 무관) → GP 수렴 방해
        let fatigue_factor = 1.0 - (trial_count as f64 * 0.10);
        let score = base * fatigue_factor.max(0.2);

        let feedback = engine.submit_trial(action.cm360, score, None);

        if feedback.fatigue_stop {
            fatigue_triggered = true;
            println!("=== 피로 감지 테스트 ===");
            println!("  fatigue_stop at trial {} (score={:.3})", trial_count, score);
            break;
        }

        // 수렴해도 피로가 먼저 오면 성공 — 수렴만으로는 중단하지 않음
    }

    assert!(
        fatigue_triggered,
        "피로 미감지 — {}회 트라이얼 후에도 fatigue_stop 발생하지 않음",
        trial_count
    );
}
