/// Game DB 모듈
/// 게임별 감도 변환 공식, FOV 정보, 물리 변환 함수 제공
/// 각 게임의 yaw 값과 FOV 모델을 기반으로 cm/360, sens 변환 수행

pub mod commands;
pub mod conversion;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 게임 프리셋 — 각 게임의 감도/FOV 변환에 필요한 상수
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GamePreset {
    /// 게임 고유 ID (예: "cs2", "valorant")
    pub id: String,
    /// 게임 표시 이름
    pub name: String,
    /// yaw 값 (degrees per count at sens=1, dpi=1)
    /// 예: CS2 = 0.022, Valorant = 0.07
    pub yaw: f64,
    /// 기본 FOV (horizontal, degrees)
    pub default_fov: f64,
    /// FOV 모델 타입 ("horizontal", "vertical", "diagonal")
    pub fov_type: String,
    /// 게임의 기본 화면비 (예: 16.0/9.0)
    pub default_aspect_ratio: f64,
    /// 감도 최소 단위 (None이면 제한 없음, 예: CS2=0.01, R6=1.0)
    pub sens_step: Option<f64>,
    /// 이동 시 감도 가중 비율 (이동사격 비중)
    pub movement_ratio: f64,
}

/// 감도 변환 결과 (단일 방식)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensitivityConversion {
    /// 원본 게임 ID
    pub from_game: String,
    /// 대상 게임 ID
    pub to_game: String,
    /// 원본 감도
    pub from_sens: f64,
    /// 변환된 감도
    pub to_sens: f64,
    /// cm/360 값 (공통 단위)
    pub cm_per_360: f64,
}

/// 방식별 변환 결과 (cm360, 감도, 배율)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionResult {
    pub cm360: f64,
    pub sens: f64,
    pub multiplier: f64,
}

/// 6가지 변환 방식 동시 계산 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllMethodsConversion {
    pub src_game: String,
    pub dst_game: String,
    pub src_cm360: f64,
    pub src_fov_h: f64,
    pub dst_fov_h: f64,
    /// method name → 변환 결과
    pub results: HashMap<String, ConversionResult>,
}

/// sens_step 스냅 결과 — floor/ceil 두 후보 + 추천
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnappedSensitivity {
    pub floor_sens: f64,
    pub floor_cm360: f64,
    pub ceil_sens: f64,
    pub ceil_cm360: f64,
    pub recommended_sens: f64,
    pub recommended_cm360: f64,
}

/// 기본 게임 프리셋 목록 반환
/// 주요 FPS 게임 10개의 yaw/FOV 데이터 내장
pub fn get_default_presets() -> Vec<GamePreset> {
    vec![
        GamePreset {
            id: "cs2".to_string(),
            name: "Counter-Strike 2".to_string(),
            yaw: 0.022,
            default_fov: 106.26, // 4:3 → 16:9 환산 hFOV
            fov_type: "horizontal".to_string(),
            default_aspect_ratio: 16.0 / 9.0,
            sens_step: Some(0.01),
            movement_ratio: 0.34, // ADAD strafe 비중 높음
        },
        GamePreset {
            id: "valorant".to_string(),
            name: "Valorant".to_string(),
            yaw: 0.07,
            default_fov: 103.0,
            fov_type: "horizontal".to_string(),
            default_aspect_ratio: 16.0 / 9.0,
            sens_step: Some(0.001), // 소수 3자리까지 지원
            movement_ratio: 0.30,
        },
        GamePreset {
            id: "overwatch2".to_string(),
            name: "Overwatch 2".to_string(),
            yaw: 0.0066,
            default_fov: 103.0,
            fov_type: "horizontal".to_string(),
            default_aspect_ratio: 16.0 / 9.0,
            sens_step: Some(0.01),
            movement_ratio: 0.30,
        },
        GamePreset {
            id: "apex".to_string(),
            name: "Apex Legends".to_string(),
            yaw: 0.022,
            default_fov: 110.0,
            fov_type: "horizontal".to_string(),
            default_aspect_ratio: 16.0 / 9.0,
            sens_step: Some(0.1),
            movement_ratio: 0.35, // 이동사격 비중 높음
        },
        GamePreset {
            id: "r6siege".to_string(),
            name: "Rainbow Six Siege".to_string(),
            yaw: 0.00572958,
            default_fov: 60.0, // 기본 vFOV (변환은 fov_type으로 처리)
            fov_type: "vertical".to_string(),
            default_aspect_ratio: 16.0 / 9.0,
            sens_step: Some(1.0), // 정수 감도
            movement_ratio: 0.25, // 포지션 홀드 비중 높음
        },
        GamePreset {
            id: "fortnite".to_string(),
            name: "Fortnite".to_string(),
            yaw: 0.5515,
            default_fov: 80.0,
            fov_type: "horizontal".to_string(),
            default_aspect_ratio: 16.0 / 9.0,
            sens_step: Some(0.1),
            movement_ratio: 0.40, // 빌드 모드 + 이동 비중 높음
        },
        GamePreset {
            id: "cod_mw".to_string(),
            name: "Call of Duty: MW3".to_string(),
            yaw: 0.0066,
            default_fov: 80.0,
            fov_type: "horizontal".to_string(),
            default_aspect_ratio: 16.0 / 9.0,
            sens_step: Some(0.01),
            movement_ratio: 0.30,
        },
        GamePreset {
            id: "battlefield".to_string(),
            name: "Battlefield 2042".to_string(),
            yaw: 0.0023328,
            default_fov: 78.0, // vFOV
            fov_type: "vertical".to_string(),
            default_aspect_ratio: 16.0 / 9.0,
            sens_step: Some(1.0), // 정수 감도
            movement_ratio: 0.30,
        },
        GamePreset {
            id: "pubg".to_string(),
            name: "PUBG".to_string(),
            yaw: 0.002222,
            default_fov: 103.0,
            fov_type: "horizontal".to_string(),
            default_aspect_ratio: 16.0 / 9.0,
            sens_step: Some(1.0), // 정수 감도
            movement_ratio: 0.30,
        },
        GamePreset {
            id: "quake".to_string(),
            name: "Quake Champions".to_string(),
            yaw: 0.022,
            default_fov: 130.0,
            fov_type: "horizontal".to_string(),
            default_aspect_ratio: 16.0 / 9.0,
            sens_step: Some(0.01),
            movement_ratio: 0.30,
        },
    ]
}
