//! Movement 시스템 모듈
//! 10개 게임별 무브먼트 프리셋, 커스텀 에디터, 가중 감도 추천
//! final_cm360 = (1 - movement_ratio) × static_optimal + movement_ratio × moving_optimal

pub mod commands;

use serde::{Deserialize, Serialize};

/// 무브먼트 프리셋 — 게임별 이동 물리 파라미터
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MovementPreset {
    /// 게임 ID (game_db 프리셋과 매칭)
    pub game_id: String,
    /// 프리셋 이름
    pub name: String,
    /// 최대 이동 속도 (units/s)
    pub max_speed: f64,
    /// 정지까지 걸리는 시간 (초) — Counter-Strafe에 핵심
    pub stop_time: f64,
    /// 가속 타입 ("instant", "linear", "velocity_based")
    pub accel_type: String,
    /// 공중 제어 비율 (0.0~1.0) — Quake/Apex 등에서 중요
    pub air_control: f64,
    /// 카운터 스트레이프 보너스 배율 (1.0=효과 없음, <1.0=정지 빠름)
    pub cs_bonus: f64,
}

/// 가중 감도 추천 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeightedRecommendation {
    /// 정적 시나리오 최적 cm/360
    pub static_optimal: f64,
    /// 무빙 시나리오 최적 cm/360
    pub moving_optimal: f64,
    /// 게임 이동사격 비율 (movement_ratio)
    pub movement_ratio: f64,
    /// 최종 가중 추천 cm/360
    pub final_cm360: f64,
    /// 정적 대비 변화량 (cm)
    pub delta_from_static: f64,
    /// 변화 방향 설명
    pub direction: String,
}

/// 10개 게임 기본 무브먼트 프리셋 반환
/// 각 게임의 실제 이동 물리를 반영한 파라미터
pub fn get_default_presets() -> Vec<MovementPreset> {
    vec![
        MovementPreset {
            game_id: "cs2".to_string(),
            name: "Counter-Strike 2".to_string(),
            max_speed: 250.0,
            stop_time: 0.05,     // 거의 즉시 정지 (카운터 스트레이프)
            accel_type: "instant".to_string(),
            air_control: 0.03,   // 공중 제어 거의 불가
            cs_bonus: 0.85,      // 카운터 스트레이프 강한 보너스
        },
        MovementPreset {
            game_id: "valorant".to_string(),
            name: "Valorant".to_string(),
            max_speed: 200.0,
            stop_time: 0.04,     // CS2보다 약간 빠른 정지
            accel_type: "instant".to_string(),
            air_control: 0.0,    // 공중 제어 없음
            cs_bonus: 0.80,      // 카운터 스트레이프 보너스 강함
        },
        MovementPreset {
            game_id: "overwatch2".to_string(),
            name: "Overwatch 2".to_string(),
            max_speed: 550.0,    // 기본 5.5m/s (게임 내 단위)
            stop_time: 0.1,
            accel_type: "linear".to_string(),
            air_control: 0.3,    // 일부 영웅 공중 기동 가능
            cs_bonus: 1.0,       // 카운터 스트레이프 개념 없음
        },
        MovementPreset {
            game_id: "apex".to_string(),
            name: "Apex Legends".to_string(),
            max_speed: 340.0,    // 기본 전투 스프린트
            stop_time: 0.08,
            accel_type: "velocity_based".to_string(),
            air_control: 0.5,    // 에어 스트레이프 핵심 메카닉
            cs_bonus: 1.0,
        },
        MovementPreset {
            game_id: "r6siege".to_string(),
            name: "Rainbow Six Siege".to_string(),
            max_speed: 180.0,    // 느린 전술 이동
            stop_time: 0.06,
            accel_type: "instant".to_string(),
            air_control: 0.0,
            cs_bonus: 0.9,       // 약한 카운터 스트레이프 효과
        },
        MovementPreset {
            game_id: "fortnite".to_string(),
            name: "Fortnite".to_string(),
            max_speed: 450.0,    // 빌드 + 달리기
            stop_time: 0.1,
            accel_type: "linear".to_string(),
            air_control: 0.4,    // 빌드 점프 중 제어 가능
            cs_bonus: 1.0,
        },
        MovementPreset {
            game_id: "cod_mw".to_string(),
            name: "Call of Duty: MW3".to_string(),
            max_speed: 300.0,
            stop_time: 0.07,
            accel_type: "linear".to_string(),
            air_control: 0.1,
            cs_bonus: 1.0,
        },
        MovementPreset {
            game_id: "battlefield".to_string(),
            name: "Battlefield 2042".to_string(),
            max_speed: 350.0,
            stop_time: 0.12,     // 관성 있는 이동
            accel_type: "velocity_based".to_string(),
            air_control: 0.2,
            cs_bonus: 1.0,
        },
        MovementPreset {
            game_id: "pubg".to_string(),
            name: "PUBG".to_string(),
            max_speed: 280.0,
            stop_time: 0.15,     // 느린 정지 (관성 큼)
            accel_type: "velocity_based".to_string(),
            air_control: 0.05,
            cs_bonus: 1.0,
        },
        MovementPreset {
            game_id: "quake".to_string(),
            name: "Quake Champions".to_string(),
            max_speed: 520.0,    // 스트레이프 점프 가속
            stop_time: 0.2,      // 느린 감속 (번지홉 특성)
            accel_type: "velocity_based".to_string(),
            air_control: 0.9,    // 에어 컨트롤 핵심
            cs_bonus: 1.0,
        },
    ]
}

/// 정적/무빙 최적값과 movement_ratio로 가중 감도 추천 산출
/// final = (1 - r) × static_optimal + r × moving_optimal
pub fn calculate_weighted_cm360(
    static_optimal: f64,
    moving_optimal: f64,
    movement_ratio: f64,
) -> WeightedRecommendation {
    // movement_ratio 범위 클램프 (0.0~1.0)
    let r = movement_ratio.clamp(0.0, 1.0);
    let final_cm360 = (1.0 - r) * static_optimal + r * moving_optimal;
    let delta = final_cm360 - static_optimal;

    let direction = if delta.abs() < 0.1 {
        "변화 없음".to_string()
    } else if delta < 0.0 {
        format!("정적 대비 {:.1}cm 낮음 (더 빠른 감도)", delta.abs())
    } else {
        format!("정적 대비 {:.1}cm 높음 (더 느린 감도)", delta)
    };

    WeightedRecommendation {
        static_optimal,
        moving_optimal,
        movement_ratio: r,
        final_cm360,
        delta_from_static: delta,
        direction,
    }
}

/// JSON 내보내기/가져오기용 데이터 구조
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MovementExportData {
    /// 포맷 버전 (현재 1)
    pub version: u32,
    /// 게임 ID
    pub game_id: String,
    /// 프리셋/프로필 이름
    pub name: String,
    /// 최대 이동 속도 (u/s)
    pub max_speed: f64,
    /// 정지 시간 (초)
    pub stop_time: f64,
    /// 가속 타입
    pub accel_type: String,
    /// 공중 제어 비율
    pub air_control: f64,
    /// 카운터 스트레이프 보너스
    pub cs_bonus: f64,
}

impl MovementExportData {
    /// MovementPreset으로부터 export 데이터 생성
    pub fn from_preset(preset: &MovementPreset) -> Self {
        Self {
            version: 1,
            game_id: preset.game_id.clone(),
            name: preset.name.clone(),
            max_speed: preset.max_speed,
            stop_time: preset.stop_time,
            accel_type: preset.accel_type.clone(),
            air_control: preset.air_control,
            cs_bonus: preset.cs_bonus,
        }
    }

    /// export 데이터를 MovementPreset으로 변환
    pub fn to_preset(&self) -> MovementPreset {
        MovementPreset {
            game_id: self.game_id.clone(),
            name: self.name.clone(),
            max_speed: self.max_speed,
            stop_time: self.stop_time,
            accel_type: self.accel_type.clone(),
            air_control: self.air_control,
            cs_bonus: self.cs_bonus,
        }
    }

    /// 필드값 유효성 검증
    pub fn validate(&self) -> Result<(), String> {
        if self.max_speed <= 0.0 || self.max_speed > 2000.0 {
            return Err(format!("max_speed 범위 초과: {}", self.max_speed));
        }
        if self.stop_time < 0.0 || self.stop_time > 2.0 {
            return Err(format!("stop_time 범위 초과: {}", self.stop_time));
        }
        if !["instant", "linear", "velocity_based"].contains(&self.accel_type.as_str()) {
            return Err(format!("잘못된 accel_type: {}", self.accel_type));
        }
        if !(0.0..=1.0).contains(&self.air_control) {
            return Err(format!("air_control 범위 초과: {}", self.air_control));
        }
        if self.cs_bonus <= 0.0 || self.cs_bonus > 2.0 {
            return Err(format!("cs_bonus 범위 초과: {}", self.cs_bonus));
        }
        Ok(())
    }
}

/// 실제 게임 내 측정값으로 max_speed 자동 계산
/// distance_units: 게임 내 거리 (단위), time_sec: 측정 시간 (초)
pub fn calculate_max_speed_from_wall_time(distance_units: f64, time_sec: f64) -> Result<f64, String> {
    if distance_units <= 0.0 {
        return Err("거리는 0보다 커야 합니다".to_string());
    }
    if time_sec <= 0.0 {
        return Err("시간은 0보다 커야 합니다".to_string());
    }
    Ok(distance_units / time_sec)
}

/// 게임별 캘리브레이션 기준 거리 (units)
pub fn get_calibration_distance(game_id: &str) -> Option<f64> {
    match game_id {
        "cs2" => Some(128.0),          // 1블록 = 128 units
        "valorant" => Some(5.0),        // 약 5m
        "overwatch2" => Some(10.0),     // 약 10m
        "apex" => Some(10.0),           // 약 10m
        "r6siege" => Some(5.0),         // 약 5m
        "fortnite" => Some(10.0),       // 약 10m
        "cod_mw" => Some(256.0),        // Quake 단위 기반
        "battlefield" => Some(10.0),    // 약 10m
        "pubg" => Some(10.0),           // 약 10m
        "quake" => Some(320.0),         // Quake 단위
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_presets_count() {
        let presets = get_default_presets();
        assert_eq!(presets.len(), 10, "10개 게임 프리셋");
    }

    #[test]
    fn test_preset_game_ids_unique() {
        let presets = get_default_presets();
        let ids: Vec<&str> = presets.iter().map(|p| p.game_id.as_str()).collect();
        let mut unique = ids.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(ids.len(), unique.len(), "게임 ID 중복 없어야 함");
    }

    #[test]
    fn test_weighted_cm360_pure_static() {
        // movement_ratio = 0 → 정적 값 그대로
        let result = calculate_weighted_cm360(35.0, 28.0, 0.0);
        assert!((result.final_cm360 - 35.0).abs() < 0.001);
    }

    #[test]
    fn test_weighted_cm360_pure_moving() {
        // movement_ratio = 1 → 무빙 값 그대로
        let result = calculate_weighted_cm360(35.0, 28.0, 1.0);
        assert!((result.final_cm360 - 28.0).abs() < 0.001);
    }

    #[test]
    fn test_weighted_cm360_balanced() {
        // movement_ratio = 0.5 → 중간값
        let result = calculate_weighted_cm360(40.0, 30.0, 0.5);
        assert!((result.final_cm360 - 35.0).abs() < 0.001);
    }

    #[test]
    fn test_weighted_cm360_clamp() {
        // 범위 밖 값 클램프 확인
        let r1 = calculate_weighted_cm360(35.0, 28.0, -0.5);
        assert!((r1.final_cm360 - 35.0).abs() < 0.001);
        let r2 = calculate_weighted_cm360(35.0, 28.0, 1.5);
        assert!((r2.final_cm360 - 28.0).abs() < 0.001);
    }

    #[test]
    fn test_weighted_direction_text() {
        let lower = calculate_weighted_cm360(35.0, 28.0, 0.5);
        assert!(lower.direction.contains("낮음"), "무빙이 낮으면 '낮음' 포함");

        let higher = calculate_weighted_cm360(28.0, 35.0, 0.5);
        assert!(higher.direction.contains("높음"), "무빙이 높으면 '높음' 포함");

        let same = calculate_weighted_cm360(35.0, 35.0, 0.5);
        assert!(same.direction.contains("변화 없음"));
    }

    #[test]
    fn test_preset_params_valid() {
        for preset in get_default_presets() {
            assert!(preset.max_speed > 0.0, "{} max_speed > 0", preset.game_id);
            assert!(preset.stop_time >= 0.0, "{} stop_time >= 0", preset.game_id);
            assert!((0.0..=1.0).contains(&preset.air_control), "{} air_control 0~1", preset.game_id);
            assert!(preset.cs_bonus > 0.0, "{} cs_bonus > 0", preset.game_id);
        }
    }

    #[test]
    fn test_export_data_roundtrip() {
        // 프리셋 → export → preset 왕복 검증
        let preset = &get_default_presets()[0]; // CS2
        let export = MovementExportData::from_preset(preset);
        assert_eq!(export.version, 1);
        let restored = export.to_preset();
        assert_eq!(restored.game_id, preset.game_id);
        assert_eq!(restored.max_speed, preset.max_speed);
        assert_eq!(restored.stop_time, preset.stop_time);
    }

    #[test]
    fn test_export_data_serialization() {
        // JSON 직렬화/역직렬화 확인
        let preset = &get_default_presets()[3]; // Apex
        let export = MovementExportData::from_preset(preset);
        let json = serde_json::to_string(&export).unwrap();
        let restored: MovementExportData = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.game_id, "apex");
        assert!((restored.max_speed - 340.0).abs() < 0.001);
    }

    #[test]
    fn test_export_data_validation() {
        // 유효성 검증 통과
        let valid = MovementExportData {
            version: 1,
            game_id: "cs2".to_string(),
            name: "Test".to_string(),
            max_speed: 250.0,
            stop_time: 0.05,
            accel_type: "instant".to_string(),
            air_control: 0.03,
            cs_bonus: 0.85,
        };
        assert!(valid.validate().is_ok());

        // max_speed 범위 초과
        let mut bad = valid.clone();
        bad.max_speed = -10.0;
        assert!(bad.validate().is_err());

        // 잘못된 accel_type
        let mut bad2 = valid.clone();
        bad2.accel_type = "turbo".to_string();
        assert!(bad2.validate().is_err());
    }

    #[test]
    fn test_calculate_max_speed_normal() {
        // 128 units / 0.5초 = 256 u/s
        let result = calculate_max_speed_from_wall_time(128.0, 0.5);
        assert!(result.is_ok());
        assert!((result.unwrap() - 256.0).abs() < 0.001);
    }

    #[test]
    fn test_calculate_max_speed_zero_time() {
        // 시간 0 → 에러
        let result = calculate_max_speed_from_wall_time(128.0, 0.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_max_speed_negative() {
        // 음수 거리 → 에러
        let result = calculate_max_speed_from_wall_time(-10.0, 1.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_calibration_distances() {
        // 모든 10개 게임에 기준 거리 있어야 함
        for preset in get_default_presets() {
            assert!(
                get_calibration_distance(&preset.game_id).is_some(),
                "{} 캘리브레이션 거리 없음",
                preset.game_id
            );
        }
    }
}
