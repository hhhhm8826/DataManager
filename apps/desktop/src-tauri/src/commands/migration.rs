use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use super::settings::{
    load_settings_from_path, save_settings_to_path, settings_path, AppSettings, CodegenOutput,
    CommandResult, DiagramSettings, LegacyImportRecord, NativeError, SETTINGS_VERSION,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyOutputDirectory {
    language: String,
    dir: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacySettings {
    #[serde(default)]
    proto_dir: String,
    #[serde(default)]
    excel_dir: String,
    #[serde(default)]
    json_dir: String,
    #[serde(default)]
    output_dirs: Vec<LegacyOutputDirectory>,
    #[serde(default)]
    protoc_path: String,
    #[serde(default)]
    file_colors: BTreeMap<String, String>,
    #[serde(default = "default_diagram_limit")]
    diagram_max_per_col: u32,
}

fn default_diagram_limit() -> u32 {
    8
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyPathCheck {
    field: String,
    input_path: String,
    resolved_path: String,
    kind: LegacyPathKind,
    status: LegacyPathStatus,
    message: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
enum LegacyPathKind {
    Directory,
    File,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
enum LegacyPathStatus {
    Ready,
    Missing,
    WrongType,
    ReadOnly,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyImportPreview {
    source_path: String,
    base_directory: String,
    settings: AppSettings,
    paths: Vec<LegacyPathCheck>,
}

#[tauri::command]
pub fn find_legacy_config() -> CommandResult<Option<String>> {
    Ok(legacy_config_candidates()
        .into_iter()
        .find(|candidate| candidate.is_file())
        .map(|path| path.display().to_string()))
}

#[tauri::command]
pub fn preview_legacy_import(source_path: String) -> CommandResult<LegacyImportPreview> {
    let source = authorize_discovered_source(Path::new(&source_path))?;
    preview_legacy_import_from_path(&source)
}

#[tauri::command]
pub fn import_legacy_settings(app: AppHandle, source_path: String) -> CommandResult<AppSettings> {
    let source = authorize_discovered_source(Path::new(&source_path))?;
    let target_path = settings_path(&app)?;
    import_legacy_from_paths(&source, &target_path, epoch_milliseconds())
}

fn legacy_config_candidates() -> Vec<PathBuf> {
    let mut candidates = BTreeSet::new();
    if let Ok(directory) = std::env::current_dir() {
        candidates.insert(directory.join("config.json"));
    }
    if let Ok(executable) = std::env::current_exe() {
        for ancestor in executable.ancestors().skip(1).take(6) {
            candidates.insert(ancestor.join("config.json"));
        }
    }
    candidates.into_iter().collect()
}

fn authorize_discovered_source(source_path: &Path) -> CommandResult<PathBuf> {
    let source = absolute_existing_path(source_path)?;
    let is_discovered = legacy_config_candidates().into_iter().any(|candidate| {
        dunce::canonicalize(candidate)
            .ok()
            .is_some_and(|candidate| candidate == source)
    });
    if is_discovered {
        return Ok(source);
    }
    Err(NativeError::with_path(
        "LEGACY_CONFIG_NOT_DISCOVERED",
        "Legacy config must be one of the application-discovered candidates.",
        &source,
    ))
}

fn preview_legacy_import_from_path(source_path: &Path) -> CommandResult<LegacyImportPreview> {
    if source_path.file_name().and_then(|name| name.to_str()) != Some("config.json") {
        return Err(NativeError::with_path(
            "LEGACY_CONFIG_NAME_INVALID",
            "Legacy settings must be read from a file named config.json.",
            source_path,
        ));
    }
    let absolute_source = absolute_existing_path(source_path)?;
    let base_directory = absolute_source.parent().ok_or_else(|| {
        NativeError::with_path(
            "LEGACY_CONFIG_BASE_UNAVAILABLE",
            "Legacy config has no parent directory.",
            &absolute_source,
        )
    })?;
    let content = fs::read_to_string(&absolute_source).map_err(|error| {
        NativeError::with_path(
            "LEGACY_CONFIG_READ_FAILED",
            error.to_string(),
            &absolute_source,
        )
    })?;
    let legacy = serde_json::from_str::<LegacySettings>(&content).map_err(|error| {
        NativeError::with_path(
            "LEGACY_CONFIG_PARSE_FAILED",
            error.to_string(),
            &absolute_source,
        )
    })?;

    let mut paths = Vec::new();
    let proto_root = migrate_path(
        "protoDir",
        &legacy.proto_dir,
        base_directory,
        LegacyPathKind::Directory,
        &mut paths,
    )?;
    let excel_root = migrate_path(
        "excelDir",
        &legacy.excel_dir,
        base_directory,
        LegacyPathKind::Directory,
        &mut paths,
    )?;
    let json_root = migrate_path(
        "jsonDir",
        &legacy.json_dir,
        base_directory,
        LegacyPathKind::Directory,
        &mut paths,
    )?;
    let protoc_executable = migrate_path(
        "protocPath",
        &legacy.protoc_path,
        base_directory,
        LegacyPathKind::File,
        &mut paths,
    )?;
    let codegen_outputs = legacy
        .output_dirs
        .into_iter()
        .map(|output| {
            let field = format!("outputDirs.{}", output.language);
            migrate_path(
                &field,
                &output.dir,
                base_directory,
                LegacyPathKind::Directory,
                &mut paths,
            )
            .map(|directory| CodegenOutput {
                language: output.language,
                directory,
            })
        })
        .collect::<CommandResult<Vec<_>>>()?;

    let settings = AppSettings {
        version: SETTINGS_VERSION,
        proto_root,
        excel_root,
        json_root,
        codegen_outputs,
        protoc_executable,
        diagram: DiagramSettings {
            file_colors: legacy.file_colors,
            max_nodes_per_column: legacy.diagram_max_per_col,
        },
        legacy_import: None,
    };
    super::settings::validate_settings(&settings)?;

    Ok(LegacyImportPreview {
        source_path: absolute_source.display().to_string(),
        base_directory: base_directory.display().to_string(),
        settings,
        paths,
    })
}

fn import_legacy_from_paths(
    source_path: &Path,
    target_path: &Path,
    imported_at_epoch_ms: u64,
) -> CommandResult<AppSettings> {
    let current = load_settings_from_path(target_path)?;
    if current.legacy_import.is_some() {
        return Err(NativeError::with_path(
            "LEGACY_IMPORT_ALREADY_COMPLETED",
            "Legacy settings have already been imported.",
            target_path,
        ));
    }

    let preview = preview_legacy_import_from_path(source_path)?;
    let mut settings = preview.settings;
    settings.legacy_import = Some(LegacyImportRecord {
        source_path: preview.source_path,
        imported_at_epoch_ms,
    });
    save_settings_to_path(target_path, &settings)?;
    Ok(settings)
}

fn migrate_path(
    field: &str,
    input: &str,
    base_directory: &Path,
    kind: LegacyPathKind,
    checks: &mut Vec<LegacyPathCheck>,
) -> CommandResult<String> {
    if input.is_empty() {
        checks.push(LegacyPathCheck {
            field: field.to_string(),
            input_path: String::new(),
            resolved_path: String::new(),
            kind,
            status: LegacyPathStatus::Missing,
            message: "No path was configured.".to_string(),
        });
        return Ok(String::new());
    }

    let input_path = Path::new(input);
    let combined = if input_path.is_absolute() {
        input_path.to_path_buf()
    } else {
        base_directory.join(input_path)
    };
    let resolved = normalize_absolute_path(&combined)?;
    let (status, message) = inspect_path(&resolved, kind);
    let resolved_path = resolved.display().to_string();
    checks.push(LegacyPathCheck {
        field: field.to_string(),
        input_path: input.to_string(),
        resolved_path: resolved_path.clone(),
        kind,
        status,
        message,
    });
    Ok(resolved_path)
}

fn inspect_path(path: &Path, kind: LegacyPathKind) -> (LegacyPathStatus, String) {
    let Ok(metadata) = fs::metadata(path) else {
        return (
            LegacyPathStatus::Missing,
            "Path does not currently exist; the value will still be preserved.".to_string(),
        );
    };
    let correct_kind = match kind {
        LegacyPathKind::Directory => metadata.is_dir(),
        LegacyPathKind::File => metadata.is_file(),
    };
    if !correct_kind {
        return (
            LegacyPathStatus::WrongType,
            "Path exists but has the wrong file type.".to_string(),
        );
    }
    if metadata.permissions().readonly() {
        return (
            LegacyPathStatus::ReadOnly,
            "Path is read-only; the value will be imported but writes may fail.".to_string(),
        );
    }
    (
        LegacyPathStatus::Ready,
        match kind {
            LegacyPathKind::Directory => "Directory is available.".to_string(),
            LegacyPathKind::File => "File is available.".to_string(),
        },
    )
}

fn absolute_existing_path(path: &Path) -> CommandResult<PathBuf> {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|error| NativeError::new("CURRENT_DIRECTORY_UNAVAILABLE", error.to_string()))?
            .join(path)
    };
    dunce::canonicalize(&absolute).map_err(|error| {
        NativeError::with_path("LEGACY_CONFIG_NOT_FOUND", error.to_string(), &absolute)
    })
}

fn normalize_absolute_path(path: &Path) -> CommandResult<PathBuf> {
    if !path.is_absolute() {
        return Err(NativeError::with_path(
            "PATH_NOT_ABSOLUTE",
            "Path normalization requires an absolute path.",
            path,
        ));
    }

    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if !normalized.pop() {
                    return Err(NativeError::with_path(
                        "PATH_TRAVERSAL_INVALID",
                        "Path traverses above its filesystem root.",
                        path,
                    ));
                }
            }
            Component::Prefix(_) | Component::RootDir | Component::Normal(_) => {
                normalized.push(component.as_os_str());
            }
        }
    }
    Ok(normalized)
}

fn epoch_milliseconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis() as u64)
}

#[cfg(test)]
mod tests {
    use std::{fs, path::Path};

    use super::{import_legacy_from_paths, preview_legacy_import_from_path};
    use crate::commands::settings::{
        load_settings_from_path, save_settings_to_path, temporary_directory, AppSettings,
    };

    fn repository_root() -> &'static Path {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .ancestors()
            .nth(3)
            .expect("manifest should be inside repository")
    }

    #[test]
    fn current_legacy_fixture_is_imported_without_field_loss() {
        let root = repository_root();
        let preview = preview_legacy_import_from_path(&root.join("config.json"))
            .expect("current legacy config should preview");

        assert_eq!(preview.base_directory, root.display().to_string());
        assert_eq!(
            preview.settings.proto_root,
            root.join("examples").join("PROTO").display().to_string()
        );
        assert_eq!(
            preview.settings.excel_root,
            root.join("examples").join("EXCEL").display().to_string()
        );
        assert_eq!(
            preview.settings.json_root,
            root.join("examples").join("JSON").display().to_string()
        );
        assert_eq!(preview.settings.codegen_outputs.len(), 4);
        assert_eq!(preview.settings.codegen_outputs[0].language, "cpp");
        assert_eq!(
            preview.settings.codegen_outputs[0].directory,
            root.join("examples")
                .join("CODE")
                .join("C++")
                .display()
                .to_string()
        );
        assert_eq!(
            preview.settings.protoc_executable,
            root.join("examples")
                .join("PROTOC")
                .join("protoc.exe")
                .display()
                .to_string()
        );
        assert_eq!(preview.settings.diagram.file_colors.len(), 2);
        assert_eq!(preview.settings.diagram.max_nodes_per_column, 8);
        assert_eq!(preview.paths.len(), 8);
    }

    #[test]
    fn unicode_spaces_and_long_missing_paths_are_preserved() {
        let directory = temporary_directory("legacy-unicode");
        fs::create_dir_all(&directory).expect("test directory should be created");
        let source = directory.join("config.json");
        let long_segment = "긴 경로 with spaces".repeat(12);
        fs::write(
            &source,
            format!(
                r#"{{"protoDir":"./한글 폴더/{long_segment}","excelDir":"","jsonDir":"","outputDirs":[],"protocPath":"","fileColors":{{}},"diagramMaxPerCol":8}}"#
            ),
        )
        .expect("legacy fixture should be written");

        let preview = preview_legacy_import_from_path(&source).expect("preview should succeed");
        assert!(preview.settings.proto_root.contains("한글 폴더"));
        assert!(preview.settings.proto_root.contains("with spaces"));
        assert_eq!(preview.paths[0].status, super::LegacyPathStatus::Missing);

        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }

    #[test]
    fn read_only_legacy_file_is_reported_without_losing_its_path() {
        let directory = temporary_directory("legacy-read-only");
        fs::create_dir_all(&directory).expect("test directory should be created");
        let source = directory.join("config.json");
        let protoc = directory.join("protoc.exe");
        fs::write(&protoc, b"fixture").expect("protoc fixture should be written");
        let original_permissions = fs::metadata(&protoc)
            .expect("protoc metadata should be readable")
            .permissions();
        let mut permissions = original_permissions.clone();
        permissions.set_readonly(true);
        fs::set_permissions(&protoc, permissions).expect("protoc should become read-only");
        fs::write(
            &source,
            r#"{"protoDir":"","excelDir":"","jsonDir":"","outputDirs":[],"protocPath":"./protoc.exe","fileColors":{},"diagramMaxPerCol":8}"#,
        )
        .expect("legacy fixture should be written");

        let preview = preview_legacy_import_from_path(&source).expect("preview should succeed");
        let check = preview
            .paths
            .iter()
            .find(|check| check.field == "protocPath")
            .expect("protoc check should exist");
        assert_eq!(check.resolved_path, protoc.display().to_string());
        assert_eq!(check.status, super::LegacyPathStatus::ReadOnly);

        fs::set_permissions(&protoc, original_permissions)
            .expect("protoc permissions should be restored");
        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }

    #[test]
    fn failed_import_does_not_change_existing_settings() {
        let directory = temporary_directory("legacy-failure");
        fs::create_dir_all(&directory).expect("test directory should be created");
        let target = directory.join("settings.v2.json");
        let source = directory.join("config.json");
        save_settings_to_path(&target, &AppSettings::default())
            .expect("initial settings should be written");
        let original = fs::read(&target).expect("initial settings should be readable");
        fs::write(&source, b"not json").expect("invalid legacy config should be written");

        assert!(import_legacy_from_paths(&source, &target, 1).is_err());
        assert_eq!(
            fs::read(&target).expect("settings should remain readable"),
            original
        );

        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }

    #[test]
    fn completed_import_cannot_run_twice() {
        let directory = temporary_directory("legacy-once");
        fs::create_dir_all(&directory).expect("test directory should be created");
        let source = repository_root().join("config.json");
        let target = directory.join("settings.v2.json");

        import_legacy_from_paths(&source, &target, 1).expect("first import should succeed");
        assert!(import_legacy_from_paths(&source, &target, 2).is_err());
        assert_eq!(
            load_settings_from_path(&target)
                .expect("imported settings should load")
                .legacy_import
                .expect("import record should exist")
                .imported_at_epoch_ms,
            1
        );

        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }
}
