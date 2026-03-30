mod db;
mod game_db;
mod input;

use db::Database;
use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<Database>,
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
            });

            log::info!("AimForge initialized. DB at {:?}", db_path);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            input::commands::get_mouse_acceleration_status,
            input::commands::check_dpi,
            game_db::commands::get_available_games,
            game_db::commands::convert_sensitivity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
