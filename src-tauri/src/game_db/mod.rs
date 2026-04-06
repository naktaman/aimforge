//! Game DB 모듈
//! 게임별 감도 변환 공식, FOV 정보, 물리 변환 함수 제공
//! 각 게임의 yaw 값과 FOV 모델을 기반으로 cm/360, sens 변환 수행

pub mod commands;
pub mod conversion;
pub mod recoil_commands;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 게임 프리셋 — 각 게임의 감도/FOV 변환에 필요한 상수
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
pub struct ConversionResult {
    pub cm360: f64,
    pub sens: f64,
    pub multiplier: f64,
}

/// 6가지 변환 방식 동시 계산 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
pub struct SnappedSensitivity {
    pub floor_sens: f64,
    pub floor_cm360: f64,
    pub ceil_sens: f64,
    pub ceil_cm360: f64,
    pub recommended_sens: f64,
    pub recommended_cm360: f64,
}

/// 게임 프리셋 헬퍼 매크로 — 반복 코드 축소
macro_rules! preset {
    ($id:expr, $name:expr, $yaw:expr, $fov:expr, $fov_type:expr, $ar:expr, $step:expr, $mr:expr) => {
        GamePreset {
            id: $id.to_string(),
            name: $name.to_string(),
            yaw: $yaw,
            default_fov: $fov,
            fov_type: $fov_type.to_string(),
            default_aspect_ratio: $ar,
            sens_step: $step,
            movement_ratio: $mr,
        }
    };
}

/// 기본 게임 프리셋 목록 반환
/// 50+ FPS/TPS 게임의 yaw/FOV 데이터 내장
/// 프론트엔드 gameDatabase.ts와 동기화 필수
pub fn get_default_presets() -> Vec<GamePreset> {
    let ar16_9 = 16.0 / 9.0;
    let ar4_3 = 4.0 / 3.0;

    vec![
        // ─── Tier 1: 핵심 FPS (yaw 교차검증 완료) ───
        preset!("cs2", "Counter-Strike 2", 0.022, 106.26, "horizontal", ar16_9, Some(0.01), 0.34),
        preset!("valorant", "Valorant", 0.07, 103.0, "horizontal", ar16_9, Some(0.001), 0.30),
        preset!("overwatch2", "Overwatch 2", 0.0066, 103.0, "horizontal", ar16_9, Some(0.01), 0.30),
        preset!("apex", "Apex Legends", 0.022, 110.0, "horizontal", ar16_9, Some(0.1), 0.35),
        preset!("pubg", "PUBG", 0.002222, 103.0, "horizontal", ar16_9, Some(1.0), 0.30),
        preset!("fortnite", "Fortnite", 0.005555, 80.0, "horizontal", ar16_9, Some(0.1), 0.40),
        preset!("tarkov", "Escape from Tarkov", 0.125, 50.0, "vertical", ar16_9, Some(0.01), 0.20),
        preset!("r6siege", "Rainbow Six Siege", 0.00572958, 60.0, "vertical", ar16_9, Some(1.0), 0.25),
        preset!("cod_mw", "Call of Duty: Warzone/MW3", 0.0066, 80.0, "horizontal", ar16_9, Some(0.01), 0.30),
        preset!("deadlock", "Deadlock", 0.022, 100.0, "horizontal", ar16_9, Some(0.01), 0.30),
        preset!("the_finals", "The Finals", 0.0066, 100.0, "horizontal", ar16_9, Some(0.1), 0.35),

        // ─── Tier 2: 인기 FPS/TPS ───
        preset!("battlefield", "Battlefield 2042", 0.0023328, 78.0, "vertical", ar16_9, Some(1.0), 0.30),
        preset!("destiny2", "Destiny 2", 0.0066, 105.0, "horizontal", ar16_9, Some(1.0), 0.30),
        preset!("halo_infinite", "Halo Infinite", 0.022, 78.0, "horizontal", ar16_9, Some(0.1), 0.30),
        preset!("hunt_showdown", "Hunt: Showdown", 0.022, 103.0, "horizontal", ar16_9, Some(0.01), 0.25),
        preset!("insurgency", "Insurgency: Sandstorm", 0.07, 90.0, "horizontal", ar16_9, Some(0.01), 0.25),
        preset!("squad", "Squad", 0.07, 90.0, "horizontal", ar16_9, Some(0.01), 0.25),
        preset!("rust", "Rust", 0.03, 90.0, "horizontal", ar16_9, Some(0.01), 0.30),
        preset!("quake", "Quake Champions", 0.022, 130.0, "horizontal", ar16_9, Some(0.01), 0.30),
        preset!("unreal_tournament", "Unreal Tournament", 0.005555, 100.0, "horizontal", ar16_9, Some(0.1), 0.30),
        preset!("tf2", "Team Fortress 2", 0.022, 90.0, "horizontal", ar16_9, Some(0.01), 0.30),
        preset!("l4d2", "Left 4 Dead 2", 0.022, 90.0, "horizontal", ar16_9, Some(0.01), 0.30),
        preset!("arma3", "ARMA 3", 0.0003927, 74.0, "horizontal", ar16_9, Some(0.01), 0.20),
        preset!("dayz", "DayZ", 0.0003927, 74.0, "horizontal", ar16_9, Some(0.01), 0.20),
        preset!("hell_let_loose", "Hell Let Loose", 0.07, 90.0, "horizontal", ar16_9, Some(0.01), 0.25),
        preset!("ready_or_not", "Ready or Not", 0.07, 90.0, "horizontal", ar16_9, Some(0.01), 0.20),
        preset!("paladins", "Paladins", 0.005555, 100.0, "horizontal", ar16_9, Some(1.0), 0.30),
        preset!("splitgate", "Splitgate", 0.005555, 100.0, "horizontal", ar16_9, Some(0.1), 0.30),
        preset!("rogue_company", "Rogue Company", 0.005555, 80.0, "horizontal", ar16_9, Some(1.0), 0.30),
        preset!("warframe", "Warframe", 0.01395, 78.0, "horizontal", ar16_9, Some(1.0), 0.35),
        preset!("xdefiant", "XDefiant", 0.00572958, 90.0, "horizontal", ar16_9, Some(1.0), 0.30),
        preset!("spectre_divide", "Spectre Divide", 0.07, 103.0, "horizontal", ar16_9, Some(0.001), 0.28),
        preset!("marvel_rivals", "Marvel Rivals", 0.005555, 100.0, "horizontal", ar16_9, Some(0.1), 0.30),
        preset!("delta_force", "Delta Force", 0.005555, 90.0, "horizontal", ar16_9, Some(0.1), 0.30),
        preset!("cs16", "Counter-Strike 1.6", 0.022, 90.0, "horizontal", ar4_3, Some(0.01), 0.30),
        preset!("css", "Counter-Strike: Source", 0.022, 90.0, "horizontal", ar16_9, Some(0.01), 0.30),

        // ─── 추가 인기 FPS/TPS ───
        preset!("csgo", "Counter-Strike: GO", 0.022, 106.26, "horizontal", ar16_9, Some(0.01), 0.34),
        preset!("cod_bo6", "Call of Duty: Black Ops 6", 0.0066, 80.0, "horizontal", ar16_9, Some(0.01), 0.30),
        preset!("apex_mobile", "Apex Legends Mobile", 0.022, 90.0, "horizontal", ar16_9, Some(0.1), 0.35),
        preset!("doom_eternal", "DOOM Eternal", 0.022, 120.0, "horizontal", ar16_9, Some(0.1), 0.30),
        preset!("titanfall2", "Titanfall 2", 0.022, 90.0, "horizontal", ar16_9, Some(0.1), 0.35),
        preset!("diabotical", "Diabotical", 0.022, 110.0, "horizontal", ar16_9, Some(0.01), 0.30),
        preset!("hyperscape", "Hyper Scape", 0.00572958, 100.0, "horizontal", ar16_9, Some(1.0), 0.30),
        preset!("gundam_evolution", "Gundam Evolution", 0.005555, 100.0, "horizontal", ar16_9, Some(0.1), 0.30),
        preset!("naraka", "Naraka: Bladepoint", 0.03, 90.0, "horizontal", ar16_9, Some(0.1), 0.35),
        preset!("valorant_console", "Valorant (Console)", 0.07, 103.0, "horizontal", ar16_9, Some(0.001), 0.30),
        preset!("battlefield_v", "Battlefield V", 0.0023328, 78.0, "vertical", ar16_9, Some(1.0), 0.30),
        preset!("battlefield_1", "Battlefield 1", 0.0023328, 78.0, "vertical", ar16_9, Some(1.0), 0.30),
        preset!("super_people", "Super People", 0.005555, 90.0, "horizontal", ar16_9, Some(1.0), 0.30),
        preset!("back4blood", "Back 4 Blood", 0.07, 90.0, "horizontal", ar16_9, Some(0.1), 0.30),
        preset!("deep_rock", "Deep Rock Galactic", 0.07, 90.0, "horizontal", ar16_9, Some(0.1), 0.30),
        preset!("borderlands3", "Borderlands 3", 0.07, 90.0, "horizontal", ar16_9, Some(0.1), 0.30),
        preset!("remnant2", "Remnant 2", 0.07, 90.0, "horizontal", ar16_9, Some(0.1), 0.30),
        preset!("gta_online", "GTA Online", 0.0066, 80.0, "horizontal", ar16_9, Some(1.0), 0.30),
        preset!("arma_reforger", "Arma Reforger", 0.0003927, 74.0, "horizontal", ar16_9, Some(0.01), 0.20),
        preset!("prey", "Prey (2017)", 0.022, 95.0, "horizontal", ar16_9, Some(0.1), 0.25),

        // ─── Tier 1: 에임 트레이너 ───
        preset!("kovaaks", "KovaaK's 2.0", 0.022, 103.0, "horizontal", ar16_9, Some(0.001), 0.30),
        preset!("aimlab", "Aim Lab", 0.022, 103.0, "horizontal", ar16_9, Some(0.001), 0.30),

        // ─── Tier 2: 에임 트레이너 ───
        preset!("aiming_pro", "Aiming.Pro", 0.022, 103.0, "horizontal", ar16_9, Some(0.001), 0.30),
    ]
}
