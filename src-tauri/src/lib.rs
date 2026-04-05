mod aim_dna;
mod calibration;
mod crossgame;
mod db;
mod error;
mod fov_profile;
mod game_db;
mod gp;
mod hardware;
mod input;
mod movement;
mod trajectory;
mod training;
mod validate;
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
                .map_err(|e| format!("앱 데이터 디렉토리 접근 실패: {}", e))?;
            std::fs::create_dir_all(&app_dir).ok();

            let db_path = app_dir.join("aimforge.db");
            let database = Database::new(&db_path)
                .map_err(|e| format!("데이터베이스 초기화 실패: {}", e))?;
            database.initialize_schema()
                .map_err(|e| format!("스키마 생성 실패: {}", e))?;

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
            aim_dna::commands::get_dna_trend_cmd,
            aim_dna::commands::detect_reference_game_cmd,
            // DNA 히스토리 + 변경점 이벤트
            aim_dna::commands::get_dna_snapshots_cmd,
            aim_dna::commands::save_change_event_cmd,
            aim_dna::commands::get_change_events_cmd,
            aim_dna::commands::compare_snapshots_cmd,
            aim_dna::commands::detect_stagnation_cmd,
            training::commands::generate_training_prescriptions,
            training::commands::get_stage_recommendations,
            training::commands::get_benchmark_preset_list,
            training::commands::submit_stage_result,
            training::commands::calculate_adaptive_difficulty,
            training::commands::get_stage_results,
            training::commands::calculate_readiness_score,
            training::commands::get_readiness_history,
            training::commands::start_style_transition,
            training::commands::get_style_transition_status,
            training::commands::update_style_transition,
            crossgame::commands::compare_game_dna,
            crossgame::commands::predict_crossgame_timeline,
            crossgame::commands::record_crossgame_progress,
            crossgame::commands::get_cross_game_history_cmd,
            crossgame::commands::generate_crossgame_prescriptions_cmd,
            crossgame::commands::convert_crossgame_zoom_sensitivity,
            trajectory::commands::analyze_trajectory_cmd,
            trajectory::commands::get_click_vectors_cmd,
            // Phase 5: 신규 커맨드
            db::commands::log_crash,
            db::commands::get_crash_logs,
            db::commands::get_daily_stats,
            db::commands::get_skill_progress,
            db::commands::save_user_setting,
            db::commands::get_user_setting,
            db::commands::get_all_user_settings,
            db::commands::create_game_profile,
            db::commands::get_game_profiles,
            db::commands::update_game_profile,
            db::commands::delete_game_profile,
            db::commands::set_active_game_profile,
            db::commands::create_routine,
            db::commands::get_routines,
            db::commands::delete_routine,
            db::commands::add_routine_step,
            db::commands::get_routine_steps,
            db::commands::remove_routine_step,
            db::commands::swap_routine_step_order,
            db::commands::export_database,
            // Day 20~21: Movement + FOV + Hardware
            movement::commands::get_movement_presets,
            movement::commands::get_movement_profiles,
            movement::commands::save_movement_profile,
            movement::commands::update_movement_profile,
            movement::commands::delete_movement_profile,
            movement::commands::calculate_weighted_recommendation,
            movement::commands::export_movement_profile,
            movement::commands::import_movement_profile_from_string,
            movement::commands::calibrate_max_speed,
            fov_profile::commands::save_fov_test_result,
            fov_profile::commands::get_fov_test_results,
            fov_profile::commands::compare_fov_profiles,
            fov_profile::commands::delete_fov_test_results,
            hardware::commands::save_hardware_combo,
            hardware::commands::get_hardware_combos,
            hardware::commands::update_hardware_combo,
            hardware::commands::delete_hardware_combo,
            hardware::commands::compare_hardware_combos,
            // Day 24~25: Recoil Pattern CRUD
            game_db::recoil_commands::get_recoil_patterns,
            game_db::recoil_commands::save_recoil_pattern,
            game_db::recoil_commands::update_recoil_pattern,
            game_db::recoil_commands::delete_recoil_pattern,
            // objective-shamir: 주별 통계 + 아카이브 + DB 최적화
            db::commands::get_weekly_stats,
            db::commands::archive_old_trials,
            db::commands::optimize_database,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
