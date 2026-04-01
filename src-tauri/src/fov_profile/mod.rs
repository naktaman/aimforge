//! FOV 프로파일 모듈
//! 동일 감도에서 FOV 90/100/110/120 테스트 → peripheral/center 분리 비교
//! 최적 FOV 추천: peripheral 최고 + center 하락 5% 미만

pub mod commands;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// FOV 테스트 결과 (단일 시나리오)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FovTestResult {
    pub fov_tested: f64,
    pub scenario_type: String,
    pub score: f64,
    pub peripheral_score: Option<f64>,
    pub center_score: Option<f64>,
}

/// FOV별 비교 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FovComparison {
    /// 테스트한 FOV 값
    pub fov: f64,
    /// peripheral 평균 점수
    pub avg_peripheral: f64,
    /// center 평균 점수
    pub avg_center: f64,
    /// 종합 점수 (0.6 × peripheral + 0.4 × center)
    pub composite: f64,
    /// 기준 FOV 대비 peripheral 변화율 (%)
    pub peripheral_delta_pct: f64,
    /// 기준 FOV 대비 center 변화율 (%)
    pub center_delta_pct: f64,
}

/// FOV 추천 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FovRecommendation {
    /// 추천 FOV
    pub recommended_fov: f64,
    /// 추천 이유 (한국어)
    pub reason: String,
    /// FOV별 비교 데이터
    pub comparisons: Vec<FovComparison>,
    /// 기준 FOV (최소 FOV)
    pub baseline_fov: f64,
}

/// FOV 테스트 결과 비교 분석
/// 추천 규칙: peripheral 최고 + center 하락 5% 미만인 FOV
pub fn compare_fov_results(results: &[FovTestResult]) -> Option<FovRecommendation> {
    if results.is_empty() {
        return None;
    }

    // FOV별 그룹핑
    let mut grouped: HashMap<i64, Vec<&FovTestResult>> = HashMap::new();
    for r in results {
        let fov_key = (r.fov_tested * 10.0).round() as i64; // 소수점 1자리까지 키
        grouped.entry(fov_key).or_default().push(r);
    }

    // FOV별 평균 산출
    let mut fov_stats: Vec<(f64, f64, f64)> = Vec::new(); // (fov, avg_peripheral, avg_center)
    for (fov_key, entries) in &grouped {
        let fov = *fov_key as f64 / 10.0;
        let (mut sum_p, mut sum_c, mut cnt_p, mut cnt_c) = (0.0, 0.0, 0u32, 0u32);
        for e in entries {
            if let Some(p) = e.peripheral_score {
                sum_p += p;
                cnt_p += 1;
            }
            if let Some(c) = e.center_score {
                sum_c += c;
                cnt_c += 1;
            }
        }
        let avg_p = if cnt_p > 0 { sum_p / cnt_p as f64 } else { 0.0 };
        let avg_c = if cnt_c > 0 { sum_c / cnt_c as f64 } else { 0.0 };
        fov_stats.push((fov, avg_p, avg_c));
    }

    // FOV 오름차순 정렬
    fov_stats.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

    if fov_stats.is_empty() {
        return None;
    }

    // 기준: 최소 FOV
    let baseline = &fov_stats[0];
    let baseline_fov = baseline.0;
    let baseline_p = baseline.1;
    let baseline_c = baseline.2;

    // 비교 데이터 생성
    let comparisons: Vec<FovComparison> = fov_stats
        .iter()
        .map(|(fov, avg_p, avg_c)| {
            let p_delta = if baseline_p > 0.0 {
                (avg_p - baseline_p) / baseline_p * 100.0
            } else {
                0.0
            };
            let c_delta = if baseline_c > 0.0 {
                (avg_c - baseline_c) / baseline_c * 100.0
            } else {
                0.0
            };
            FovComparison {
                fov: *fov,
                avg_peripheral: *avg_p,
                avg_center: *avg_c,
                composite: 0.6 * avg_p + 0.4 * avg_c,
                peripheral_delta_pct: p_delta,
                center_delta_pct: c_delta,
            }
        })
        .collect();

    // 추천: peripheral 가장 높은 FOV 중 center 하락 5% 미만
    let mut best_fov = baseline_fov;
    let mut best_peripheral = baseline_p;

    for comp in &comparisons {
        // center 하락이 5% 미만이고 peripheral이 더 높으면 선택
        if comp.center_delta_pct > -5.0 && comp.avg_peripheral > best_peripheral {
            best_peripheral = comp.avg_peripheral;
            best_fov = comp.fov;
        }
    }

    // 추천 이유 생성
    let best_comp = comparisons.iter().find(|c| (c.fov - best_fov).abs() < 0.1);
    let reason = if let Some(comp) = best_comp {
        if (best_fov - baseline_fov).abs() < 0.1 {
            "기준 FOV가 최적: 넓은 FOV에서 peripheral 향상이 center 하락을 상쇄하지 못함".to_string()
        } else {
            format!(
                "FOV {:.0}: peripheral +{:.1}%, center {:.1}% → peripheral 향상이 크고 center 하락이 허용 범위 내",
                best_fov, comp.peripheral_delta_pct, comp.center_delta_pct
            )
        }
    } else {
        format!("FOV {:.0} 추천", best_fov)
    };

    Some(FovRecommendation {
        recommended_fov: best_fov,
        reason,
        comparisons,
        baseline_fov,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 테스트 데이터 생성 헬퍼
    fn make_result(fov: f64, peripheral: f64, center: f64) -> FovTestResult {
        FovTestResult {
            fov_tested: fov,
            scenario_type: "flick".to_string(),
            score: (peripheral + center) / 2.0,
            peripheral_score: Some(peripheral),
            center_score: Some(center),
        }
    }

    #[test]
    fn test_empty_results() {
        assert!(compare_fov_results(&[]).is_none());
    }

    #[test]
    fn test_single_fov() {
        let results = vec![make_result(90.0, 70.0, 80.0)];
        let rec = compare_fov_results(&results).unwrap();
        assert!((rec.recommended_fov - 90.0).abs() < 0.1);
        assert_eq!(rec.comparisons.len(), 1);
    }

    #[test]
    fn test_peripheral_improvement_within_center_tolerance() {
        // FOV 110: peripheral +14%, center -2% → 추천
        let results = vec![
            make_result(90.0, 70.0, 80.0),
            make_result(100.0, 75.0, 79.0),
            make_result(110.0, 80.0, 78.5), // peripheral +14.3%, center -1.9%
            make_result(120.0, 82.0, 74.0), // peripheral +17.1%, center -7.5% (center 하락 과다)
        ];
        let rec = compare_fov_results(&results).unwrap();
        assert!((rec.recommended_fov - 110.0).abs() < 0.1,
            "FOV 110 추천 (peripheral 향상 + center 하락 5% 미만)");
    }

    #[test]
    fn test_center_drop_too_large() {
        // 모든 넓은 FOV에서 center 하락 > 5% → 기준 FOV 유지
        let results = vec![
            make_result(90.0, 70.0, 80.0),
            make_result(100.0, 75.0, 74.0), // center -7.5%
            make_result(110.0, 80.0, 72.0), // center -10%
        ];
        let rec = compare_fov_results(&results).unwrap();
        assert!((rec.recommended_fov - 90.0).abs() < 0.1,
            "center 하락 과다 시 기준 FOV 유지");
    }

    #[test]
    fn test_multiple_entries_per_fov() {
        // 동일 FOV에 여러 시나리오 결과 → 평균 사용
        let results = vec![
            FovTestResult { fov_tested: 90.0, scenario_type: "flick".to_string(), score: 75.0, peripheral_score: Some(70.0), center_score: Some(80.0) },
            FovTestResult { fov_tested: 90.0, scenario_type: "tracking".to_string(), score: 75.0, peripheral_score: Some(60.0), center_score: Some(90.0) },
            FovTestResult { fov_tested: 110.0, scenario_type: "flick".to_string(), score: 80.0, peripheral_score: Some(80.0), center_score: Some(78.0) },
            FovTestResult { fov_tested: 110.0, scenario_type: "tracking".to_string(), score: 78.0, peripheral_score: Some(72.0), center_score: Some(84.0) },
        ];
        let rec = compare_fov_results(&results).unwrap();
        // 90: avg_p=65, avg_c=85 / 110: avg_p=76, avg_c=81
        assert_eq!(rec.comparisons.len(), 2);
    }

    #[test]
    fn test_composite_formula() {
        let results = vec![make_result(90.0, 70.0, 80.0)];
        let rec = compare_fov_results(&results).unwrap();
        let comp = &rec.comparisons[0];
        let expected = 0.6 * 70.0 + 0.4 * 80.0; // 74.0
        assert!((comp.composite - expected).abs() < 0.01);
    }
}
