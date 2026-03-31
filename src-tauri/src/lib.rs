mod aim_dna;
mod calibration;
mod db;
mod game_db;
mod gp;
mod input;
mod zoom_calibration;

use calibration::CalibrationEngine;
use db::Database;
use input::MouseInputState;
use zoom_calibration::comparator::ComparatorEngine;
use zoom_calibration::ZoomCalibrationEngine;
use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<Database>,
    /// Raw Input 캡처 상태 — start_mouse_capture로 활성화
    pub mouse_input: Mutex<Option<MouseInputState>>,
    /// 캘리브레이션 엔진 — start_calibration으로 활성화
    pub calibration: Mutex<Option<CalibrationEngine>>,
    /// 줌 캘리브레이션 엔진 — start_zoom_calibration으로 활성화
    pub zoom_calibration: Mutex<Option<ZoomCalibrationEngine>>,
    /// 변환 방식 비교기 — start_comparator로 활성화
    pub comparator: Mutex<Option<ComparatorEngine>>,
}

#[tauri::command]
fn get_app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "AimForge",
        "version": "0.1.0",
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&app_dir).ok();

            let db_path = app_dir.join("aimforge.db");
            let database = Database::new(&db_path).expect("failed to initialize database");
            database.initialize_schema().expect("failed to create schema");

            app.manage(AppState {
                db: Mutex::new(database),
                mouse_input: Mutex::new(None),
                calibration: Mutex::new(None),
                zoom_calibration: Mutex::new(None),
                comparator: Mutex::new(None),
            });

            log::info!("AimForge initialized. DB at {:?}", db_path);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            input::commands::get_mouse_acceleration_status,
            input::commands::check_dpi,
            input::commands::start_mouse_capture,
            input::commands::stop_mouse_capture,
            input::commands::drain_mouse_batch,
            game_db::commands::get_available_games,
            game_db::commands::convert_sensitivity,
            game_db::commands::convert_all_methods,
            game_db::commands::snap_sensitivity,
            db::commands::start_session,
            db::commands::save_trial,
            db::commands::end_session,
            calibration::commands::start_calibration,
            calibration::commands::get_next_trial_sens,
            calibration::commands::submit_calibration_trial,
            calibration::commands::get_calibration_status,
            calibration::commands::finalize_calibration,
            calibration::commands::cancel_calibration,
            zoom_calibration::commands::get_zoom_profiles,
            zoom_calibration::commands::start_zoom_calibration,
            zoom_calibration::commands::get_next_zoom_trial,
            zoom_calibration::commands::submit_zoom_trial,
            zoom_calibration::commands::finalize_zoom_calibration,
            zoom_calibration::commands::adjust_k,
            zoom_calibration::commands::get_zoom_calibration_status,
            zoom_calibration::commands::start_comparator,
            zoom_calibration::commands::get_next_comparator_trial,
            zoom_calibration::commands::submit_comparator_trial,
            zoom_calibration::commands::finalize_comparator,
            zoom_calibration::commands::save_landscape,
            aim_dna::commands::compute_aim_dna_cmd,
            aim_dna::commands::get_aim_dna,
            aim_dna::commands::get_aim_dna_history,
            aim_dna::commands::get_sessions_history,
            aim_dna::commands::get_session_detail,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
