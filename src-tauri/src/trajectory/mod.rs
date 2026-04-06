//! 궤적 분석 모듈 — 클릭 벡터 추출, GMM 2-클러스터, 감도 진단

pub mod commands;

use serde::Serialize;

/// 궤적 포인트 (프론트엔드 TrajectoryPoint와 동일)
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrajectoryPoint {
    pub timestamp_us: f64,
    /// 향후 카메라 회전 기반 3D 궤적 분석 시 사용 예정
    #[allow(dead_code)]
    pub camera_yaw: f64,
    /// 향후 카메라 회전 기반 3D 궤적 분석 시 사용 예정
    #[allow(dead_code)]
    pub camera_pitch: f64,
    pub dx_cm: f64,
    pub dy_cm: f64,
}

/// 클릭 이벤트 (프론트엔드 ClickEvent와 동일)
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClickEvent {
    pub timestamp_us: f64,
    pub crosshair_velocity: f64,
    /// 향후 가속도 기반 클릭 분류 시 사용 예정
    #[allow(dead_code)]
    #[serde(default)]
    pub crosshair_acceleration: f64,
    /// 향후 감속 패턴 분석 시 사용 예정
    #[allow(dead_code)]
    pub is_decelerating: bool,
    /// 향후 각도 오차 세분화 분석 시 사용 예정
    #[allow(dead_code)]
    pub angular_error: f64,
    pub hit: bool,
    /// 향후 방향 전환 패턴 분석 시 사용 예정
    #[allow(dead_code)]
    #[serde(default)]
    pub time_since_direction_change: f64,
    /// 향후 클릭 타입별 분리 분석 시 사용 예정
    #[allow(dead_code)]
    #[serde(default)]
    pub click_type: String,
}

/// 추출된 클릭 벡터 — 클릭 시점 전후 궤적에서 산출
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClickVector {
    /// X축 이동량 (도)
    pub dx_deg: f64,
    /// Y축 이동량 (도)
    pub dy_deg: f64,
    /// 이동 크기 (도)
    pub magnitude_deg: f64,
    /// 이동 소요 시간 (ms)
    pub duration_ms: f64,
    /// 최고 속도 (도/초)
    pub peak_velocity: f64,
    /// 클릭 시점 속도 (도/초)
    pub end_velocity: f64,
    /// 오버슈팅 여부 (속도 부호 반전 감지)
    pub overshoot: bool,
    /// 모터 영역 (finger/wrist/arm)
    pub motor_region: String,
    /// 명중 여부
    pub hit: bool,
}

/// GMM 단일 클러스터 파라미터
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GmmCluster {
    pub mean: f64,
    pub std_dev: f64,
    pub weight: f64,
    pub sample_count: usize,
}

/// GMM 2-컴포넌트 결과
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GmmClusterResult {
    pub cluster_a: GmmCluster,
    pub cluster_b: GmmCluster,
    /// 분리도 (Bhattacharyya 거리 기반, 0~1)
    pub separation_score: f64,
    /// 이봉 분포 감지 여부
    pub bimodal_detected: bool,
}

/// 감도 진단 결과
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SensDiagnosis {
    /// 행동 유형: overshoot_dominant / undershoot_dominant / balanced
    pub current_behavior: String,
    /// 일관성 점수 (0~100)
    pub consistency_score: f64,
    /// 권장 cm/360 조정량 (양수=감도 낮춤, 음수=감도 높임)
    pub recommended_adjustment: f64,
    /// 진단 신뢰도 (0~1)
    pub confidence: f64,
    /// 상세 설명 (한국어)
    pub details: String,
}

/// 궤적 분석 통합 결과
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrajectoryAnalysisResult {
    pub click_vectors: Vec<ClickVector>,
    pub gmm: Option<GmmClusterResult>,
    pub diagnosis: SensDiagnosis,
    pub total_clicks: usize,
}

// ═══════════════════════════════════════════════════
// 클릭 벡터 추출
// ═══════════════════════════════════════════════════

/// 트라이얼 궤적 + 클릭에서 클릭 벡터 추출
/// 각 클릭 시점 기준 200ms 이전 궤적을 역추적하여 이동 벡터 산출
pub fn extract_click_vectors(
    trajectory: &[TrajectoryPoint],
    clicks: &[ClickEvent],
    cm360: f64,
) -> Vec<ClickVector> {
    if trajectory.is_empty() || clicks.is_empty() {
        return vec![];
    }

    let lookback_us = 200_000.0; // 200ms를 마이크로초로
    // cm → 도 변환 계수
    let cm_to_deg = 360.0 / cm360;

    clicks
        .iter()
        .filter_map(|click| {
            let click_ts = click.timestamp_us;
            let start_ts = click_ts - lookback_us;

            // 클릭 시점과 가장 가까운 궤적 인덱스 찾기
            let click_idx = trajectory
                .iter()
                .position(|p| p.timestamp_us >= click_ts)
                .unwrap_or(trajectory.len().saturating_sub(1));

            // 시작 시점 인덱스 찾기
            let start_idx = trajectory
                .iter()
                .position(|p| p.timestamp_us >= start_ts)
                .unwrap_or(0);

            if start_idx >= click_idx || click_idx == 0 {
                return None;
            }

            // 200ms 구간 내 이동량 합산
            let mut total_dx_cm = 0.0_f64;
            let mut total_dy_cm = 0.0_f64;
            let mut peak_vel = 0.0_f64;
            let mut prev_sign_x: Option<bool> = None;
            let mut had_reversal = false;

            for i in start_idx..=click_idx.min(trajectory.len() - 1) {
                total_dx_cm += trajectory[i].dx_cm;
                total_dy_cm += trajectory[i].dy_cm;

                // 프레임 간 속도 산출
                if i > start_idx {
                    let dt_s = (trajectory[i].timestamp_us - trajectory[i - 1].timestamp_us) / 1_000_000.0;
                    if dt_s > 0.0 {
                        let dx_deg = trajectory[i].dx_cm * cm_to_deg;
                        let dy_deg = trajectory[i].dy_cm * cm_to_deg;
                        let vel = (dx_deg * dx_deg + dy_deg * dy_deg).sqrt() / dt_s;
                        if vel > peak_vel {
                            peak_vel = vel;
                        }

                        // X축 방향 반전 감지 (오버슈팅 지표)
                        let sign_x = trajectory[i].dx_cm >= 0.0;
                        if let Some(prev) = prev_sign_x {
                            if prev != sign_x && trajectory[i].dx_cm.abs() > 0.01 {
                                had_reversal = true;
                            }
                        }
                        prev_sign_x = Some(sign_x);
                    }
                }
            }

            let dx_deg = total_dx_cm * cm_to_deg;
            let dy_deg = total_dy_cm * cm_to_deg;
            let magnitude_deg = (dx_deg * dx_deg + dy_deg * dy_deg).sqrt();
            let distance_cm = (total_dx_cm * total_dx_cm + total_dy_cm * total_dy_cm).sqrt();
            let duration_ms = (click_ts - trajectory[start_idx].timestamp_us) / 1000.0;

            // 모터 영역 분류: finger <2cm, wrist 2~5cm, arm >5cm
            let motor_region = if distance_cm < 2.0 {
                "finger"
            } else if distance_cm < 5.0 {
                "wrist"
            } else {
                "arm"
            };

            Some(ClickVector {
                dx_deg,
                dy_deg,
                magnitude_deg,
                duration_ms,
                peak_velocity: peak_vel,
                end_velocity: click.crosshair_velocity,
                overshoot: had_reversal,
                motor_region: motor_region.to_string(),
                hit: click.hit,
            })
        })
        .collect()
}

// ═══════════════════════════════════════════════════
// GMM 2-Component EM 알고리즘
// ═══════════════════════════════════════════════════

/// 가우시안 PDF 계산
fn gaussian_pdf(x: f64, mean: f64, std_dev: f64) -> f64 {
    if std_dev <= 0.0 {
        return 0.0;
    }
    let z = (x - mean) / std_dev;
    (-0.5 * z * z).exp() / (std_dev * (2.0 * std::f64::consts::PI).sqrt())
}

/// 1D 데이터에 대한 2-컴포넌트 GMM EM 알고리즘
/// 클릭 magnitude 분포를 두 클러스터로 분리하여 이봉성 감지
pub fn gmm_em_2cluster(data: &[f64], max_iter: usize, tolerance: f64) -> Option<GmmClusterResult> {
    let n = data.len();
    if n < 6 {
        return None;
    }

    // 초기화: 데이터를 정렬하여 하위 1/3, 상위 1/3 평균으로 시드
    let mut sorted = data.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let third = n / 3;

    let mut mu_a = sorted[..third.max(1)].iter().sum::<f64>() / third.max(1) as f64;
    let mut mu_b = sorted[(n - third.max(1))..].iter().sum::<f64>() / third.max(1) as f64;

    // 분산 초기값: 전체 분산의 절반
    let global_mean = data.iter().sum::<f64>() / n as f64;
    let global_var = data.iter().map(|x| (x - global_mean).powi(2)).sum::<f64>() / n as f64;
    let mut sigma_a = (global_var / 2.0).sqrt().max(0.01);
    let mut sigma_b = (global_var / 2.0).sqrt().max(0.01);
    let mut w_a = 0.5_f64;

    let mut prev_ll = f64::NEG_INFINITY;
    let mut responsibilities = vec![0.0_f64; n];

    for _iter in 0..max_iter {
        // E-step: 각 데이터 포인트의 클러스터 A 귀속 확률 계산
        let mut log_likelihood = 0.0;
        for i in 0..n {
            let p_a = w_a * gaussian_pdf(data[i], mu_a, sigma_a);
            let p_b = (1.0 - w_a) * gaussian_pdf(data[i], mu_b, sigma_b);
            let total = p_a + p_b;
            if total > 1e-300 {
                responsibilities[i] = p_a / total;
                log_likelihood += total.ln();
            } else {
                responsibilities[i] = 0.5;
            }
        }

        // 수렴 판정
        if (log_likelihood - prev_ll).abs() < tolerance {
            break;
        }
        prev_ll = log_likelihood;

        // M-step: 파라미터 갱신
        let n_a: f64 = responsibilities.iter().sum();
        let n_b = n as f64 - n_a;

        if n_a < 1.0 || n_b < 1.0 {
            break; // 한쪽 클러스터가 비어버리면 중단
        }

        w_a = n_a / n as f64;
        mu_a = responsibilities.iter().zip(data).map(|(r, x)| r * x).sum::<f64>() / n_a;
        mu_b = responsibilities.iter().zip(data).map(|(r, x)| (1.0 - r) * x).sum::<f64>() / n_b;

        let var_a = responsibilities
            .iter()
            .zip(data)
            .map(|(r, x)| r * (x - mu_a).powi(2))
            .sum::<f64>() / n_a;
        let var_b = responsibilities
            .iter()
            .zip(data)
            .map(|(r, x)| (1.0 - r) * (x - mu_b).powi(2))
            .sum::<f64>() / n_b;

        sigma_a = var_a.sqrt().max(0.01);
        sigma_b = var_b.sqrt().max(0.01);
    }

    // 클러스터 A가 항상 작은 mean을 갖도록 정렬
    if mu_a > mu_b {
        std::mem::swap(&mut mu_a, &mut mu_b);
        std::mem::swap(&mut sigma_a, &mut sigma_b);
        w_a = 1.0 - w_a;
    }

    // Bhattacharyya 거리로 분리도 산출
    let avg_var = (sigma_a * sigma_a + sigma_b * sigma_b) / 2.0;
    let bhatt_dist = if avg_var > 0.0 {
        0.25 * (mu_a - mu_b).powi(2) / avg_var
            + 0.5 * (avg_var / (sigma_a * sigma_b).max(1e-10)).ln()
    } else {
        0.0
    };
    // 분리도를 0~1로 정규화 (dist=2 → score≈0.86)
    let separation_score = 1.0 - (-bhatt_dist * 0.5).exp();

    let count_a = (w_a * n as f64).round() as usize;
    let count_b = n - count_a;

    // 이봉 감지: 분리도 > 0.5 + 양쪽 모두 15% 이상
    let bimodal_detected = separation_score > 0.5 && w_a > 0.15 && w_a < 0.85;

    Some(GmmClusterResult {
        cluster_a: GmmCluster {
            mean: mu_a,
            std_dev: sigma_a,
            weight: w_a,
            sample_count: count_a,
        },
        cluster_b: GmmCluster {
            mean: mu_b,
            std_dev: sigma_b,
            weight: 1.0 - w_a,
            sample_count: count_b,
        },
        separation_score,
        bimodal_detected,
    })
}

// ═══════════════════════════════════════════════════
// 감도 진단
// ═══════════════════════════════════════════════════

/// 클릭 벡터 분석으로 현재 감도 적절성 진단
/// overshoot 비율 + 종료속도 분포 기반으로 cm/360 조정 권장
pub fn diagnose_sensitivity(
    vectors: &[ClickVector],
    current_cm360: f64,
) -> SensDiagnosis {
    if vectors.is_empty() {
        return SensDiagnosis {
            current_behavior: "insufficient_data".into(),
            consistency_score: 0.0,
            recommended_adjustment: 0.0,
            confidence: 0.0,
            details: "분석할 클릭 데이터가 부족합니다.".into(),
        };
    }

    let n = vectors.len() as f64;

    // 오버슈팅 비율
    let overshoot_count = vectors.iter().filter(|v| v.overshoot).count() as f64;
    let overshoot_ratio = overshoot_count / n;

    // 종료 속도 분석 — 높은 종료 속도 = 마우스가 아직 움직이는 중 = 언더슈팅 경향
    let avg_end_velocity = vectors.iter().map(|v| v.end_velocity).sum::<f64>() / n;
    let high_end_vel_count = vectors.iter().filter(|v| v.end_velocity > 60.0).count() as f64;
    let high_end_vel_ratio = high_end_vel_count / n;

    // 명중률
    let hit_rate = vectors.iter().filter(|v| v.hit).count() as f64 / n;

    // magnitude 일관성 (변동계수)
    let avg_mag = vectors.iter().map(|v| v.magnitude_deg).sum::<f64>() / n;
    let var_mag = vectors.iter().map(|v| (v.magnitude_deg - avg_mag).powi(2)).sum::<f64>() / n;
    let cv = if avg_mag > 0.0 { var_mag.sqrt() / avg_mag } else { 1.0 };
    let consistency_score = ((1.0 - cv.min(1.0)) * 100.0).max(0.0);

    // 행동 유형 판단
    let (behavior, adjustment, details) = if overshoot_ratio > 0.5 {
        // 감도가 너무 높음 → cm/360 올리기 (감도 낮춤)
        let severity = (overshoot_ratio - 0.5) * 2.0; // 0~1
        let adj = severity * 5.0; // 최대 +5 cm/360
        (
            "overshoot_dominant",
            adj,
            format!(
                "오버슈팅 비율 {:.0}%로 감도가 높습니다. cm/360을 {:.1} 올려 {:.1}로 조정하면 안정성이 개선됩니다.",
                overshoot_ratio * 100.0, adj, current_cm360 + adj
            ),
        )
    } else if high_end_vel_ratio > 0.4 && avg_end_velocity > 50.0 {
        // 클릭 시점에 마우스가 아직 빠르게 움직이는 중 → 감도 올리기
        let severity = (high_end_vel_ratio - 0.4).min(0.5) * 2.0;
        let adj = -(severity * 4.0); // 최대 -4 cm/360
        (
            "undershoot_dominant",
            adj,
            format!(
                "클릭 시 평균 속도 {:.0}°/s로 타겟 도달 전 클릭 경향. cm/360을 {:.1} 낮춰 {:.1}로 조정을 권장합니다.",
                avg_end_velocity, adj.abs(), current_cm360 + adj
            ),
        )
    } else {
        (
            "balanced",
            0.0,
            format!(
                "현재 감도({:.1} cm/360)가 적절합니다. 명중률 {:.0}%, 일관성 {:.0}점.",
                current_cm360, hit_rate * 100.0, consistency_score
            ),
        )
    };

    // 신뢰도: 샘플 수 기반 (30개 이상이면 높음)
    let confidence = (n / 30.0).min(1.0);

    SensDiagnosis {
        current_behavior: behavior.into(),
        consistency_score,
        recommended_adjustment: adjustment,
        confidence,
        details,
    }
}

/// 궤적 분석 전체 파이프라인 실행
pub fn analyze_trajectory(
    trajectory_json: &str,
    clicks_json: &str,
    cm360: f64,
) -> Result<TrajectoryAnalysisResult, String> {
    // JSON 파싱
    let trajectory: Vec<TrajectoryPoint> =
        serde_json::from_str(trajectory_json).map_err(|e| format!("궤적 파싱 실패: {}", e))?;
    let clicks: Vec<ClickEvent> =
        serde_json::from_str(clicks_json).map_err(|e| format!("클릭 파싱 실패: {}", e))?;

    // 1. 클릭 벡터 추출
    let click_vectors = extract_click_vectors(&trajectory, &clicks, cm360);

    // 2. GMM 클러스터링 (magnitude 기반)
    let magnitudes: Vec<f64> = click_vectors.iter().map(|v| v.magnitude_deg).collect();
    let gmm = gmm_em_2cluster(&magnitudes, 30, 1e-6);

    // 3. 감도 진단
    let diagnosis = diagnose_sensitivity(&click_vectors, cm360);

    Ok(TrajectoryAnalysisResult {
        total_clicks: click_vectors.len(),
        click_vectors,
        gmm,
        diagnosis,
    })
}

// ═══════════════════════════════════════════════════
// 테스트
// ═══════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    /// 합성 궤적 데이터 생성 헬퍼
    fn make_trajectory(n: usize, dx_per_frame: f64) -> Vec<TrajectoryPoint> {
        (0..n)
            .map(|i| TrajectoryPoint {
                timestamp_us: i as f64 * 1000.0, // 1ms 간격
                camera_yaw: i as f64 * dx_per_frame * 0.5,
                camera_pitch: 0.0,
                dx_cm: dx_per_frame,
                dy_cm: 0.0,
            })
            .collect()
    }

    #[test]
    fn test_extract_click_vectors_basic() {
        // 200ms = 200 프레임 (1ms 간격)
        let trajectory = make_trajectory(300, 0.05); // 프레임당 0.05cm 이동
        let clicks = vec![ClickEvent {
            timestamp_us: 250_000.0, // 250ms 시점
            crosshair_velocity: 20.0,
            crosshair_acceleration: 0.0,
            is_decelerating: true,
            angular_error: 0.5,
            hit: true,
            time_since_direction_change: 100.0,
            click_type: "Flick".into(),
        }];

        let vectors = extract_click_vectors(&trajectory, &clicks, 30.0);
        assert_eq!(vectors.len(), 1);
        assert!(vectors[0].magnitude_deg > 0.0);
        assert!(vectors[0].hit);
    }

    #[test]
    fn test_gmm_two_clusters() {
        // 이봉 분포: 5° 중심 + 20° 중심
        let mut data: Vec<f64> = (0..50).map(|_| 5.0 + (rand_simple() - 0.5) * 2.0).collect();
        data.extend((0..50).map(|_| 20.0 + (rand_simple() - 0.5) * 2.0));

        let result = gmm_em_2cluster(&data, 30, 1e-6);
        assert!(result.is_some());
        let gmm = result.unwrap();

        // 두 클러스터 평균이 5와 20 근처여야 함
        assert!((gmm.cluster_a.mean - 5.0).abs() < 3.0, "cluster_a mean={}", gmm.cluster_a.mean);
        assert!((gmm.cluster_b.mean - 20.0).abs() < 3.0, "cluster_b mean={}", gmm.cluster_b.mean);
        assert!(gmm.bimodal_detected, "이봉 분포가 감지되어야 함");
    }

    #[test]
    fn test_gmm_unimodal() {
        // 단봉 분포: 10° 중심, 작은 분산
        let data: Vec<f64> = (0..100).map(|i| 10.0 + ((i % 5) as f64 - 2.0) * 0.3).collect();

        let result = gmm_em_2cluster(&data, 30, 1e-6);
        assert!(result.is_some());
        let gmm = result.unwrap();

        // 단봉이므로 두 클러스터 평균이 가까워야 함
        let mean_gap = (gmm.cluster_a.mean - gmm.cluster_b.mean).abs();
        assert!(
            mean_gap < 3.0 || !gmm.bimodal_detected,
            "단봉 분포에서 두 클러스터가 너무 멀리 분리됨: gap={:.2}, bimodal={}",
            mean_gap, gmm.bimodal_detected
        );
    }

    #[test]
    fn test_diagnose_overshoot() {
        // 오버슈팅이 우세한 벡터들
        let vectors: Vec<ClickVector> = (0..20)
            .map(|_| ClickVector {
                dx_deg: 10.0,
                dy_deg: 0.0,
                magnitude_deg: 10.0,
                duration_ms: 150.0,
                peak_velocity: 80.0,
                end_velocity: 15.0,
                overshoot: true, // 전부 오버슈팅
                motor_region: "wrist".into(),
                hit: true,
            })
            .collect();

        let diag = diagnose_sensitivity(&vectors, 30.0);
        assert_eq!(diag.current_behavior, "overshoot_dominant");
        assert!(diag.recommended_adjustment > 0.0, "cm/360 증가 권장");
    }

    #[test]
    fn test_diagnose_balanced() {
        // 균형잡힌 벡터들 (오버슈팅 30%, 적절한 종료 속도)
        let vectors: Vec<ClickVector> = (0..20)
            .map(|i| ClickVector {
                dx_deg: 8.0,
                dy_deg: 1.0,
                magnitude_deg: 8.1,
                duration_ms: 180.0,
                peak_velocity: 50.0,
                end_velocity: 20.0,
                overshoot: i < 6, // 30%만 오버슈팅
                motor_region: "wrist".into(),
                hit: true,
            })
            .collect();

        let diag = diagnose_sensitivity(&vectors, 30.0);
        assert_eq!(diag.current_behavior, "balanced");
        assert!((diag.recommended_adjustment).abs() < 0.01);
    }

    /// 간단한 결정적 유사 랜덤 생성 (테스트용)
    fn rand_simple() -> f64 {
        use std::sync::atomic::{AtomicU64, Ordering};
        static SEED: AtomicU64 = AtomicU64::new(12345);
        let s = SEED.fetch_add(1, Ordering::Relaxed);
        let x = ((s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)) >> 33) as f64;
        x / (u32::MAX as f64)
    }
}
