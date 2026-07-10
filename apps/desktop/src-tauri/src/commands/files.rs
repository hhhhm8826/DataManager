use std::{
    ffi::OsString,
    fs,
    io::Write,
    path::{Component, Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use serde_json::json;
use tauri::AppHandle;

use chrono::Local;

use super::settings::{
    load_settings_from_path, settings_path, AppSettings, CommandResult, NativeError,
};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtoFileEntry {
    pub(crate) path: String,
    pub(crate) file_name: String,
}

#[tauri::command]
pub fn list_proto_files(app: AppHandle) -> CommandResult<Vec<ProtoFileEntry>> {
    let settings = load_settings_from_path(&settings_path(&app)?)?;
    if settings.proto_root.is_empty() {
        return Err(NativeError::new(
            "PROTO_ROOT_NOT_CONFIGURED",
            "Configure a Proto root before loading schemas.",
        ));
    }
    let root = authorize_path(Path::new(&settings.proto_root), &settings, false)?;
    list_proto_files_in_root(&root)
}

#[tauri::command]
pub fn list_excel_files(app: AppHandle) -> CommandResult<Vec<ProtoFileEntry>> {
    let settings = load_settings_from_path(&settings_path(&app)?)?;
    if settings.excel_root.is_empty() {
        return Err(NativeError::new(
            "EXCEL_ROOT_NOT_CONFIGURED",
            "Configure an Excel root before loading workbooks.",
        ));
    }
    let root = authorize_path(Path::new(&settings.excel_root), &settings, false)?;
    list_excel_files_in_root(&root)
}

#[tauri::command]
pub fn read_file(app: AppHandle, path: String) -> CommandResult<Vec<u8>> {
    let settings = load_settings_from_path(&settings_path(&app)?)?;
    let authorized = authorize_path(Path::new(&path), &settings, false)?;
    if !authorized.is_file() {
        return Err(NativeError::with_path(
            "FILE_NOT_REGULAR",
            "The requested path is not a regular file.",
            &authorized,
        ));
    }
    fs::read(&authorized)
        .map_err(|error| NativeError::with_path("FILE_READ_FAILED", error.to_string(), &authorized))
}

#[tauri::command]
pub fn write_file(app: AppHandle, path: String, contents: Vec<u8>) -> CommandResult<String> {
    let settings = load_settings_from_path(&settings_path(&app)?)?;
    let authorized = authorize_path(Path::new(&path), &settings, true)?;
    write_file_atomically(&authorized, &contents)?;
    Ok(authorized.display().to_string())
}

#[tauri::command]
pub fn backup_file(app: AppHandle, path: String) -> CommandResult<String> {
    let settings = load_settings_from_path(&settings_path(&app)?)?;
    let source = authorize_path(Path::new(&path), &settings, false)?;
    if !source.is_file() {
        return Err(NativeError::with_path(
            "BACKUP_SOURCE_NOT_FILE",
            "Only regular files can be backed up.",
            &source,
        ));
    }
    let parent = source.parent().ok_or_else(|| {
        NativeError::with_path(
            "BACKUP_PARENT_UNAVAILABLE",
            "Backup source has no parent directory.",
            &source,
        )
    })?;
    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("backup");
    let extension = source.extension().and_then(|value| value.to_str());
    let timestamp = Local::now().format("%Y%m%d%H%M%S").to_string();
    let file_name = backup_file_name(stem, extension, &timestamp);
    let target = parent.join("backup").join(file_name);
    let authorized_target = authorize_path(&target, &settings, true)?;
    let contents = fs::read(&source).map_err(|error| {
        NativeError::with_path("BACKUP_SOURCE_READ_FAILED", error.to_string(), &source)
    })?;
    write_file_atomically(&authorized_target, &contents)?;
    Ok(authorized_target.display().to_string())
}

#[tauri::command]
pub fn open_path(app: AppHandle, path: String) -> CommandResult<()> {
    let settings = load_settings_from_path(&settings_path(&app)?)?;
    let authorized = authorize_path(Path::new(&path), &settings, false)?;
    spawn_path_opener(&authorized).map_err(|error| {
        NativeError::with_path("PATH_OPEN_FAILED", error.to_string(), &authorized)
    })?;
    Ok(())
}

fn authorize_path(
    path: &Path,
    settings: &AppSettings,
    allow_missing: bool,
) -> CommandResult<PathBuf> {
    let normalized = normalize_absolute_path(path)?;
    let candidate = canonicalize_candidate(&normalized, allow_missing)?;
    let allowed_roots = allowed_roots(settings);
    if allowed_roots.is_empty() {
        return Err(NativeError::new(
            "FILE_ROOTS_NOT_CONFIGURED",
            "No existing workspace roots are configured.",
        ));
    }

    if allowed_roots
        .iter()
        .any(|root| path_is_within(&candidate, root))
    {
        return Ok(candidate);
    }

    Err(NativeError::with_path(
        "FILE_ACCESS_OUTSIDE_ROOT",
        "The requested path is outside the configured workspace roots.",
        &candidate,
    )
    .with_context(
        "allowedRoots",
        json!(allowed_roots
            .iter()
            .map(|root| root.display().to_string())
            .collect::<Vec<_>>()),
    ))
}

fn allowed_roots(settings: &AppSettings) -> Vec<PathBuf> {
    let configured = [
        settings.proto_root.as_str(),
        settings.excel_root.as_str(),
        settings.json_root.as_str(),
    ]
    .into_iter()
    .chain(
        settings
            .codegen_outputs
            .iter()
            .map(|output| output.directory.as_str()),
    );

    configured
        .filter(|value| !value.is_empty())
        .filter_map(|value| dunce::canonicalize(value).ok())
        .filter(|path| path.is_dir())
        .collect()
}

pub(crate) fn list_proto_files_in_root(root: &Path) -> CommandResult<Vec<ProtoFileEntry>> {
    if !root.is_dir() {
        return Err(NativeError::with_path(
            "PROTO_ROOT_NOT_DIRECTORY",
            "The configured Proto root is not a directory.",
            root,
        ));
    }

    let mut files = Vec::new();
    let entries = fs::read_dir(root).map_err(|error| {
        NativeError::with_path("PROTO_ROOT_READ_FAILED", error.to_string(), root)
    })?;
    for entry in entries {
        let entry = entry.map_err(|error| {
            NativeError::with_path("PROTO_DIRECTORY_ENTRY_FAILED", error.to_string(), root)
        })?;
        let file_name = entry.file_name().to_string_lossy().into_owned();
        if !(is_message_file_name(&file_name) || is_enum_file_name(&file_name)) {
            continue;
        }
        let path = dunce::canonicalize(entry.path()).map_err(|error| {
            NativeError::with_path(
                "PROTO_FILE_CANONICALIZE_FAILED",
                error.to_string(),
                &entry.path(),
            )
        })?;
        if !path_is_within(&path, root) {
            return Err(NativeError::with_path(
                "PROTO_FILE_OUTSIDE_ROOT",
                "A Proto file resolves outside the configured Proto root.",
                &path,
            ));
        }
        if !path.is_file() {
            continue;
        }
        files.push(ProtoFileEntry {
            path: path.display().to_string(),
            file_name,
        });
    }
    files.sort_by(|left, right| {
        left.file_name
            .to_ascii_lowercase()
            .cmp(&right.file_name.to_ascii_lowercase())
            .then_with(|| left.file_name.cmp(&right.file_name))
    });
    Ok(files)
}

fn list_excel_files_in_root(root: &Path) -> CommandResult<Vec<ProtoFileEntry>> {
    if !root.is_dir() {
        return Err(NativeError::with_path(
            "EXCEL_ROOT_NOT_DIRECTORY",
            "The configured Excel root is not a directory.",
            root,
        ));
    }
    let mut files = Vec::new();
    let entries = fs::read_dir(root).map_err(|error| {
        NativeError::with_path("EXCEL_ROOT_READ_FAILED", error.to_string(), root)
    })?;
    for entry in entries {
        let entry = entry.map_err(|error| {
            NativeError::with_path("EXCEL_DIRECTORY_ENTRY_FAILED", error.to_string(), root)
        })?;
        let file_name = entry.file_name().to_string_lossy().into_owned();
        if !file_name.to_ascii_lowercase().ends_with(".xlsx") {
            continue;
        }
        let path = dunce::canonicalize(entry.path()).map_err(|error| {
            NativeError::with_path(
                "EXCEL_FILE_CANONICALIZE_FAILED",
                error.to_string(),
                &entry.path(),
            )
        })?;
        if !path_is_within(&path, root) {
            return Err(NativeError::with_path(
                "EXCEL_FILE_OUTSIDE_ROOT",
                "An Excel file resolves outside the configured Excel root.",
                &path,
            ));
        }
        if path.is_file() {
            files.push(ProtoFileEntry {
                path: path.display().to_string(),
                file_name,
            });
        }
    }
    files.sort_by(|left, right| {
        left.file_name
            .to_ascii_lowercase()
            .cmp(&right.file_name.to_ascii_lowercase())
            .then_with(|| left.file_name.cmp(&right.file_name))
    });
    Ok(files)
}

fn is_message_file_name(value: &str) -> bool {
    valid_prefixed_proto_file(value, "Table.proto")
}

fn is_enum_file_name(value: &str) -> bool {
    valid_prefixed_proto_file(value, "EnumType.proto")
}

fn valid_prefixed_proto_file(value: &str, suffix: &str) -> bool {
    let Some(prefix) = value.strip_suffix(suffix) else {
        return false;
    };
    let mut characters = prefix.chars();
    characters
        .next()
        .is_some_and(|character| character == '_' || character.is_ascii_alphabetic())
        && characters.all(|character| character == '_' || character.is_ascii_alphanumeric())
}

fn canonicalize_candidate(path: &Path, allow_missing: bool) -> CommandResult<PathBuf> {
    if path.exists() {
        return dunce::canonicalize(path).map_err(|error| {
            NativeError::with_path("FILE_PATH_CANONICALIZE_FAILED", error.to_string(), path)
        });
    }
    if !allow_missing {
        return Err(NativeError::with_path(
            "FILE_NOT_FOUND",
            "The requested path does not exist.",
            path,
        ));
    }

    let mut ancestor = path.to_path_buf();
    let mut missing = Vec::<OsString>::new();
    while !ancestor.exists() {
        let name = ancestor.file_name().ok_or_else(|| {
            NativeError::with_path(
                "FILE_EXISTING_ANCESTOR_NOT_FOUND",
                "No existing ancestor could be found for the requested path.",
                path,
            )
        })?;
        missing.push(name.to_os_string());
        if !ancestor.pop() {
            return Err(NativeError::with_path(
                "FILE_EXISTING_ANCESTOR_NOT_FOUND",
                "No existing ancestor could be found for the requested path.",
                path,
            ));
        }
    }

    let mut canonical = dunce::canonicalize(&ancestor).map_err(|error| {
        NativeError::with_path(
            "FILE_PATH_CANONICALIZE_FAILED",
            error.to_string(),
            &ancestor,
        )
    })?;
    for component in missing.into_iter().rev() {
        canonical.push(component);
    }
    Ok(canonical)
}

fn normalize_absolute_path(path: &Path) -> CommandResult<PathBuf> {
    if !path.is_absolute() {
        return Err(NativeError::with_path(
            "FILE_PATH_NOT_ABSOLUTE",
            "File commands require an absolute path.",
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
                        "FILE_PATH_TRAVERSAL_INVALID",
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

#[cfg(target_os = "windows")]
fn path_is_within(candidate: &Path, root: &Path) -> bool {
    let candidate = candidate.to_string_lossy().to_lowercase();
    let mut root = root.to_string_lossy().to_lowercase();
    while root.ends_with('\\') || root.ends_with('/') {
        root.pop();
    }
    candidate == root
        || candidate
            .strip_prefix(&root)
            .is_some_and(|suffix| suffix.starts_with('\\') || suffix.starts_with('/'))
}

#[cfg(not(target_os = "windows"))]
fn path_is_within(candidate: &Path, root: &Path) -> bool {
    candidate.starts_with(root)
}

fn write_file_atomically(path: &Path, contents: &[u8]) -> CommandResult<()> {
    write_file_atomically_with(path, contents, replace_file)
}

#[cfg(target_os = "windows")]
fn replace_file(temporary_path: &Path, target_path: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let temporary = temporary_path
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let target = target_path
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let result = unsafe {
        MoveFileExW(
            temporary.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
fn replace_file(temporary_path: &Path, target_path: &Path) -> std::io::Result<()> {
    fs::rename(temporary_path, target_path)
}

fn backup_file_name(stem: &str, extension: Option<&str>, timestamp: &str) -> String {
    match extension {
        Some(extension) => format!("{stem}_{timestamp}.{extension}"),
        None => format!("{stem}_{timestamp}"),
    }
}

fn write_file_atomically_with<F>(path: &Path, contents: &[u8], replace: F) -> CommandResult<()>
where
    F: FnOnce(&Path, &Path) -> std::io::Result<()>,
{
    let parent = path.parent().ok_or_else(|| {
        NativeError::with_path(
            "FILE_PARENT_UNAVAILABLE",
            "File has no parent directory.",
            path,
        )
    })?;
    fs::create_dir_all(parent).map_err(|error| {
        NativeError::with_path("FILE_DIRECTORY_CREATE_FAILED", error.to_string(), parent)
    })?;
    let temporary = parent.join(format!(
        ".datamanager-{}-{}.tmp",
        std::process::id(),
        epoch_milliseconds()
    ));

    let result = (|| -> std::io::Result<()> {
        let mut file = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)?;
        file.write_all(contents)?;
        file.sync_all()?;
        replace(&temporary, path)
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(&temporary);
        return Err(NativeError::with_path(
            "FILE_WRITE_FAILED",
            error.to_string(),
            path,
        ));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn spawn_path_opener(path: &Path) -> std::io::Result<()> {
    Command::new("explorer.exe").arg(path).spawn().map(|_| ())
}

#[cfg(target_os = "macos")]
fn spawn_path_opener(path: &Path) -> std::io::Result<()> {
    Command::new("open").arg(path).spawn().map(|_| ())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn spawn_path_opener(path: &Path) -> std::io::Result<()> {
    Command::new("xdg-open").arg(path).spawn().map(|_| ())
}

fn epoch_milliseconds() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis())
}

#[cfg(test)]
mod tests {
    use std::{fs, io};

    use super::{
        authorize_path, backup_file_name, list_excel_files_in_root, list_proto_files_in_root,
        write_file_atomically, write_file_atomically_with,
    };
    use crate::commands::settings::{temporary_directory, AppSettings};

    #[test]
    fn configured_root_allows_unicode_spaces_and_long_descendants() {
        let directory = temporary_directory("file-unicode");
        let root = directory.join("한글 root with spaces");
        fs::create_dir_all(&root).expect("allowed root should be created");
        let settings = AppSettings {
            proto_root: root.display().to_string(),
            ..AppSettings::default()
        };
        let target = root.join("긴 이름".repeat(20)).join("Table.proto");

        let authorized = authorize_path(&target, &settings, true)
            .expect("missing descendant inside root should be authorized");
        assert!(authorized.ends_with("Table.proto"));

        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }

    #[test]
    fn outside_root_and_traversal_are_rejected() {
        let directory = temporary_directory("file-boundary");
        let root = directory.join("allowed");
        let outside = directory.join("outside");
        fs::create_dir_all(&root).expect("allowed root should be created");
        fs::create_dir_all(&outside).expect("outside root should be created");
        let settings = AppSettings {
            proto_root: root.display().to_string(),
            ..AppSettings::default()
        };

        assert!(authorize_path(&outside.join("secret.proto"), &settings, true).is_err());
        assert!(authorize_path(&root.join(r"..\outside\secret.proto"), &settings, true).is_err());

        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }

    #[test]
    fn failed_file_replacement_keeps_original_bytes() {
        let directory = temporary_directory("file-write-failure");
        fs::create_dir_all(&directory).expect("test directory should be created");
        let path = directory.join("Table.proto");
        fs::write(&path, b"original").expect("original should be written");

        let result = write_file_atomically_with(&path, b"changed", |_temporary, _target| {
            Err(io::Error::new(io::ErrorKind::PermissionDenied, "injected"))
        });

        assert!(result.is_err());
        assert_eq!(
            fs::read(&path).expect("original should remain"),
            b"original"
        );
        assert_eq!(
            fs::read_dir(&directory)
                .expect("test directory should be readable")
                .count(),
            1
        );

        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }

    #[test]
    fn proto_listing_is_non_recursive_filtered_and_deterministic() {
        let directory = temporary_directory("proto-listing");
        fs::create_dir_all(directory.join("nested")).expect("nested directory should be created");
        for name in [
            "ZedTable.proto",
            "AlphaEnumType.proto",
            "Ignored.proto",
            "notes.txt",
        ] {
            fs::write(directory.join(name), b"fixture").expect("fixture should be written");
        }
        fs::write(
            directory.join("nested").join("NestedTable.proto"),
            b"fixture",
        )
        .expect("nested fixture should be written");

        let listed = list_proto_files_in_root(&directory).expect("listing should succeed");
        assert_eq!(
            listed
                .iter()
                .map(|entry| entry.file_name.as_str())
                .collect::<Vec<_>>(),
            vec!["AlphaEnumType.proto", "ZedTable.proto"]
        );

        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }

    #[test]
    fn excel_listing_and_backup_name_follow_the_collision_contract() {
        let directory = temporary_directory("excel-listing");
        fs::create_dir_all(directory.join("backup")).expect("backup directory should be created");
        for name in ["Zed.xlsx", "alpha.XLSX", "Ignored.xls"] {
            fs::write(directory.join(name), b"fixture").expect("fixture should be written");
        }
        fs::write(directory.join("backup").join("Nested.xlsx"), b"fixture")
            .expect("nested fixture should be written");

        let listed = list_excel_files_in_root(&directory).expect("listing should succeed");
        assert_eq!(
            listed
                .iter()
                .map(|entry| entry.file_name.as_str())
                .collect::<Vec<_>>(),
            vec!["alpha.XLSX", "Zed.xlsx"]
        );
        assert_eq!(
            backup_file_name("KeyTable", Some("xlsx"), "20260710123456"),
            "KeyTable_20260710123456.xlsx"
        );

        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }

    #[test]
    fn atomic_write_replaces_an_existing_file_on_the_platform() {
        let directory = temporary_directory("file-replace");
        fs::create_dir_all(&directory).expect("test directory should be created");
        let path = directory.join("Existing.xlsx");
        fs::write(&path, b"original").expect("original should be written");

        write_file_atomically(&path, b"replacement").expect("replacement should succeed");
        assert_eq!(
            fs::read(&path).expect("replacement should be readable"),
            b"replacement"
        );
        assert_eq!(
            fs::read_dir(&directory)
                .expect("directory should be readable")
                .count(),
            1
        );

        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }
}
