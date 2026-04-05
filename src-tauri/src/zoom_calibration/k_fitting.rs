//! K 파라미터 피팅 — 줌 배율 곡선의 핵심
//!
//! 로그 선형 회귀: log(mult_i) = k × log(tan(h/2)/tan(s_i/2))
//! 최소제곱: k = Σ(x_i·y_i) / Σ(x_i²)
//! K 분산으로 피팅 품질 판정 (Low/Medium/High)

use serde::{Deserialize, Serialize};

/// 에이밍 타입 — tracking vs flicking 분리
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AimType {
    /// 순수 트래킹 (지속 추적)
    Tracking,
    /// 순수 플릭 (순간 조준)
    Flicking,
    /// 복합 (가중 평균)
    Combined,
}

/// 게임별 줌 사용 패턴 — tracking/flicking 비율
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameZoomProfile {
    /// 게임+옵틱 식별 (예: "cs2_awp", "apex_3x")
    pub id: String,
    /// 트래킹 비율 (0.0~1.0)
    pub tracking_ratio: f64,
    /// 플릭 비율 (1.0 - tracking_ratio)
    pub flicking_ratio: f64,
}

/// 기본 게임별 줌 사용 패턴
pub fn default_game_zoom_profiles() -> Vec<GameZoomProfile> {
    vec![
        GameZoomProfile { id: "cs2_awp".into(), tracking_ratio: 0.0, flicking_ratio: 1.0 },
        GameZoomProfile { id: "apex_3x".into(), tracking_ratio: 0.7, flicking_ratio: 0.3 },
        GameZoomProfile { id: "ow2_ana".into(), tracking_ratio: 0.9, flicking_ratio: 0.1 },
        GameZoomProfile { id: "r6_acog".into(), tracking_ratio: 0.4, flicking_ratio: 0.6 },
        GameZoomProfile { id: "cod_ads".into(), tracking_ratio: 0.8, flicking_ratio: 0.2 },
    ]
}

/// 에이밍 타입별 k 분리 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AimTypeKResult {
    /// 트래킹 전용 k
    pub k_tracking: f64,
    /// 플릭 전용 k
    pub k_flicking: f64,
    /// 복합 k (글로벌)
    pub k_combined: f64,
}

/// 게임 줌 프로파일에 따른 유효 k값 계산
/// k_effective = k_tracking × tracking_ratio + k_flicking × flicking_ratio
pub fn get_effective_k(aim_k: &AimTypeKResult, profile: &GameZoomProfile) -> f64 {
    aim_k.k_tracking * profile.tracking_ratio + aim_k.k_flicking * profile.flicking_ratio
}

/// K 피팅 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KFitResult {
    /// 피팅된 k 값
    pub k_value: f64,
    /// k 분산 (잔차 기반)
    pub k_variance: f64,
    /// 피팅 품질
    pub quality: KQuality,
    /// 피팅에 사용된 데이터 포인트
    pub data_points: Vec<KDataPoint>,
    /// 높은 분산일 때 구간별 k (low/high zoom)
    pub piecewise_k: Option<Vec<PiecewiseK>>,
    /// 에이밍 타입 (None = Combined/글로벌)
    pub aim_type: Option<AimType>,
}

/// 피팅 품질 등급
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum KQuality {
    /// 분산 < 0.05 — 안정적, 신뢰 가능
    Low,
    /// 분산 0.05~0.15 — 수용 가능 (주의 필요)
    Medium,
    /// 분산 > 0.15 — piecewise k 사용 권장
    High,
}

/// 피팅에 사용된 데이터 포인트
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KDataPoint {
    /// 줌 비율 (예: 2.0, 4.0)
    pub zoom_ratio: f64,
    /// 스코프 hFOV (도)
    pub scope_fov: f64,
    /// GP 최적화된 배율
    pub optimal_multiplier: f64,
    /// 배율에서의 합성 점수
    pub score: f64,
}

/// 구간별 k 값 (고분산 시)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PiecewiseK {
    /// 시작 줌 비율
    pub ratio_start: f64,
    /// 끝 줌 비율
    pub ratio_end: f64,
    /// 이 구간의 k 값
    pub k: f64,
}

/// K 분산 임계값
const K_VARIANCE_LOW: f64 = 0.05;
const K_VARIANCE_HIGH: f64 = 0.15;

/// 3개 이상의 (scope_fov, optimal_multiplier) 쌍에서 k 피팅
///
/// 모델: mult = (tan(hipfire_fov/2) / tan(scope_fov/2))^k
/// 로그 변환: log(mult) = k × log(tan(h/2) / tan(s/2))
/// 이는 y = k·x 형태 → k = Σ(x·y) / Σ(x²)
///
/// aim_type: 에이밍 타입별 분리 피팅 시 지정 (None = Combined/글로벌)
pub fn fit_k_parameter(
    hipfire_fov: f64,
    data: &[KDataPoint],
) -> KFitResult {
    fit_k_parameter_with_aim_type(hipfire_fov, data, None)
}

/// aim_type을 명시적으로 지정하여 k 피팅
pub fn fit_k_parameter_with_aim_type(
    hipfire_fov: f64,
    data: &[KDataPoint],
    aim_type: Option<AimType>,
) -> KFitResult {
    assert!(data.len() >= 2, "k 피팅에는 최소 2개 데이터 필요");

    let hip_half_tan = (hipfire_fov.to_radians() / 2.0).tan();

    // 로그 변환: x_i = log(fov_ratio), y_i = log(mult)
    let mut xy_sum = 0.0;
    let mut xx_sum = 0.0;
    let mut log_data: Vec<(f64, f64)> = Vec::new();

    for dp in data {
        let scope_half_tan = (dp.scope_fov.to_radians() / 2.0).tan();
        if scope_half_tan <= 0.0 || dp.optimal_multiplier <= 0.0 {
            continue;
        }

        let fov_ratio = hip_half_tan / scope_half_tan;
        if fov_ratio <= 0.0 {
            continue;
        }

        let x = fov_ratio.ln();
        let y = dp.optimal_multiplier.ln();

        xy_sum += x * y;
        xx_sum += x * x;
        log_data.push((x, y));
    }

    // 최소제곱 해: k = Σ(x·y) / Σ(x²)
    let k_value = if xx_sum > 1e-15 {
        xy_sum / xx_sum
    } else {
        1.0 // 기본값 (MDM 0%)
    };

    // 잔차 분산 계산
    let n = log_data.len() as f64;
    let residual_sum: f64 = log_data
        .iter()
        .map(|(x, y)| {
            let predicted = k_value * x;
            (y - predicted).powi(2)
        })
        .sum();
    let k_variance = if n > 1.0 {
        residual_sum / (n - 1.0)
    } else {
        0.0
    };

    // 품질 판정
    let quality = if k_variance < K_VARIANCE_LOW {
        KQuality::Low
    } else if k_variance < K_VARIANCE_HIGH {
        KQuality::Medium
    } else {
        KQuality::High
    };

    // 고분산 시 piecewise k 계산
    let piecewise_k = if quality == KQuality::High && data.len() >= 3 {
        Some(compute_piecewise_k(hipfire_fov, data))
    } else {
        None
    };

    KFitResult {
        k_value,
        k_variance,
        quality,
        data_points: data.to_vec(),
        piecewise_k,
        aim_type,
    }
}

/// 구간별 k 계산 — 인접 데이터 쌍마다 독립 k 피팅
fn compute_piecewise_k(hipfire_fov: f64, data: &[KDataPoint]) -> Vec<PiecewiseK> {
    let hip_half_tan = (hipfire_fov.to_radians() / 2.0).tan();
    let mut pieces = Vec::new();

    // 줌 비율 기준 정렬된 데이터 사용
    let mut sorted = data.to_vec();
    sorted.sort_by(|a, b| a.zoom_ratio.partial_cmp(&b.zoom_ratio).unwrap_or(std::cmp::Ordering::Equal));

    for pair in sorted.windows(2) {
        let a = &pair[0];
        let b = &pair[1];

        let tan_a = (a.scope_fov.to_radians() / 2.0).tan();
        let tan_b = (b.scope_fov.to_radians() / 2.0).tan();

        if tan_a <= 0.0 || tan_b <= 0.0 || a.optimal_multiplier <= 0.0 || b.optimal_multiplier <= 0.0 {
            continue;
        }

        // 두 점에서 k 계산
        let x_a = (hip_half_tan / tan_a).ln();
        let y_a = a.optimal_multiplier.ln();
        let x_b = (hip_half_tan / tan_b).ln();
        let y_b = b.optimal_multiplier.ln();

        let dx = x_b - x_a;
        let k = if dx.abs() > 1e-15 {
            (y_b - y_a) / dx
        } else {
            1.0
        };

        pieces.push(PiecewiseK {
            ratio_start: a.zoom_ratio,
            ratio_end: b.zoom_ratio,
            k,
        });
    }

    pieces
}

/// 피팅된 k로 미측정 비율의 배율 보간
/// mult = (tan(hipfire_fov/2) / tan(scope_fov/2))^k
pub fn interpolate_multiplier(hipfire_fov: f64, scope_fov: f64, k: f64) -> f64 {
    let hip_half = (hipfire_fov.to_radians() / 2.0).tan();
    let scope_half = (scope_fov.to_radians() / 2.0).tan();

    if scope_half <= 0.0 {
        return 1.0;
    }

    (hip_half / scope_half).powf(k)
}

/// Piecewise k로 보간 — 해당 구간의 k를 사용
pub fn interpolate_multiplier_piecewise(
    hipfire_fov: f64,
    scope_fov: f64,
    zoom_ratio: f64,
    pieces: &[PiecewiseK],
) -> f64 {
    // 해당 구간 찾기
    let k = pieces
        .iter()
        .find(|p| zoom_ratio >= p.ratio_start && zoom_ratio <= p.ratio_end)
        .map(|p| p.k)
        .unwrap_or_else(|| {
            // 범위 밖이면 가장 가까운 구간 사용
            if zoom_ratio < pieces[0].ratio_start {
                pieces[0].k
            } else {
                pieces.last().map(|p| p.k).unwrap_or(1.0)
            }
        });

    interpolate_multiplier(hipfire_fov, scope_fov, k)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 알려진 k=1.0에서 정확하게 복원되는지 검증
    #[test]
    fn test_k_fitting_known_value() {
        let hipfire_fov = 103.0;
        let k_true = 1.0;

        let data = vec![
            make_data_point(hipfire_fov, 70.0, 2.0, k_true),
            make_data_point(hipfire_fov, 40.0, 4.0, k_true),
            make_data_point(hipfire_fov, 20.0, 8.0, k_true),
        ];

        let result = fit_k_parameter(hipfire_fov, &data);
        assert!(
            (result.k_value - k_true).abs() < 0.01,
            "k=1.0 복원 실패: got {:.4}",
            result.k_value
        );
        assert_eq!(result.quality, KQuality::Low, "완벽한 피팅은 Low 분산");
    }

    /// 알려진 k=0.5에서 복원 검증
    #[test]
    fn test_k_fitting_half() {
        let hipfire_fov = 103.0;
        let k_true = 0.5;

        let data = vec![
            make_data_point(hipfire_fov, 60.0, 1.5, k_true),
            make_data_point(hipfire_fov, 35.0, 3.0, k_true),
            make_data_point(hipfire_fov, 15.0, 6.0, k_true),
        ];

        let result = fit_k_parameter(hipfire_fov, &data);
        assert!(
            (result.k_value - k_true).abs() < 0.02,
            "k=0.5 복원 실패: got {:.4}",
            result.k_value
        );
    }

    /// 고분산 데이터에서 piecewise k 생성 검증
    #[test]
    fn test_piecewise_k_detection() {
        let hipfire_fov = 103.0;

        // 의도적으로 다른 k값 사용하여 고분산 유도
        let data = vec![
            KDataPoint {
                zoom_ratio: 2.0,
                scope_fov: 60.0,
                optimal_multiplier: interpolate_multiplier(hipfire_fov, 60.0, 0.5),
                score: 80.0,
            },
            KDataPoint {
                zoom_ratio: 4.0,
                scope_fov: 35.0,
                optimal_multiplier: interpolate_multiplier(hipfire_fov, 35.0, 1.5),
                score: 78.0,
            },
            KDataPoint {
                zoom_ratio: 8.0,
                scope_fov: 15.0,
                optimal_multiplier: interpolate_multiplier(hipfire_fov, 15.0, 1.5),
                score: 75.0,
            },
        ];

        let result = fit_k_parameter(hipfire_fov, &data);
        // 분산이 높아야 piecewise가 생성됨
        if result.quality == KQuality::High {
            assert!(
                result.piecewise_k.is_some(),
                "High 분산이면 piecewise_k 존재해야 함"
            );
            let pieces = result.piecewise_k.unwrap();
            assert_eq!(pieces.len(), 2, "3개 데이터 → 2개 구간");
        }
        // 분산 수치 자체가 0이 아님을 확인
        assert!(result.k_variance > 0.0, "다른 k로 만든 데이터는 분산 > 0");
    }

    /// 보간 정확성 검증
    #[test]
    fn test_interpolation() {
        let hipfire_fov = 103.0;
        let k = 0.8;
        let scope_fov = 50.0;

        let mult = interpolate_multiplier(hipfire_fov, scope_fov, k);
        // zoom_multiplier와 동일한 결과여야 함
        let expected = crate::game_db::conversion::zoom_multiplier(hipfire_fov, scope_fov, k);
        assert!(
            (mult - expected).abs() < 0.001,
            "보간 결과가 zoom_multiplier와 일치해야 함: {} vs {}",
            mult, expected
        );
    }

    /// 테스트 헬퍼: 알려진 k로 정확한 배율 생성
    fn make_data_point(hipfire_fov: f64, scope_fov: f64, zoom_ratio: f64, k: f64) -> KDataPoint {
        let mult = interpolate_multiplier(hipfire_fov, scope_fov, k);
        KDataPoint {
            zoom_ratio,
            scope_fov,
            optimal_multiplier: mult,
            score: 80.0,
        }
    }
}
