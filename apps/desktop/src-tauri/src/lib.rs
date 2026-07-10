mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());

    #[cfg(feature = "e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio::init())
        .plugin(tauri_plugin_wdio_webdriver::init());

    builder
        .invoke_handler(tauri::generate_handler![
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::migration::find_legacy_config,
            commands::migration::preview_legacy_import,
            commands::migration::import_legacy_settings,
            commands::files::list_proto_files,
            commands::files::list_excel_files,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::backup_file,
            commands::files::open_path,
            commands::codegen::check_codegen_environment,
            commands::codegen::run_protoc_language,
            commands::codegen::write_unreal_files
        ])
        .run(tauri::generate_context!())
        .expect("failed to run DataManager")
}
