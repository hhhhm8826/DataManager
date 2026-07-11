use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

pub(crate) const SETTINGS_FILE_NAME: &str = "settings.v2.json";
pub(crate) const SETTINGS_VERSION: u32 = 2;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeError {
    pub(crate) code: String,
    pub(crate) message: String,
    pub(crate) context: BTreeMap<String, Value>,
}

impl NativeError {
    pub(crate) fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            context: BTreeMap::new(),
        }
    }

    pub(crate) fn with_path(
        code: impl Into<String>,
        message: impl Into<String>,
        path: &Path,
    ) -> Self {
        Self::new(code, message).with_context("path", json!(path.display().to_string()))
    }

    pub(crate) fn with_context(mut self, key: impl Into<String>, value: Value) -> Self {
        self.context.insert(key.into(), value);
        self
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodegenOutput {
    pub(crate) language: String,
    pub(crate) directory: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagramSettings {
    pub(crate) file_colors: BTreeMap<String, String>,
    pub(crate) max_nodes_per_column: u32,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyImportRecord {
    pub(crate) source_path: String,
    pub(crate) imported_at_epoch_ms: u64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub(crate) version: u32,
    pub(crate) proto_root: String,
    pub(crate) excel_root: String,
    pub(crate) json_root: String,
    pub(crate) codegen_outputs: Vec<CodegenOutput>,
    pub(crate) protoc_executable: String,
    pub(crate) diagram: DiagramSettings,
    pub(crate) legacy_import: Option<LegacyImportRecord>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            proto_root: String::new(),
            excel_root: String::new(),
            json_root: String::new(),
            codegen_outputs: Vec::new(),
            protoc_executable: String::new(),
            diagram: DiagramSettings {
                file_colors: BTreeMap::new(),
                max_nodes_per_column: 8,
            },
            legacy_import: None,
        }
    }
}

pub(crate) type CommandResult<T> = Result<T, NativeError>;

#[tauri::command]
pub fn load_settings(app: AppHandle) -> CommandResult<AppSettings> {
    let target_path = settings_path(&app)?;
    if target_path.exists() {
        return load_settings_from_path(&target_path);
    }
    let resource_examples = app
        .path()
        .resource_dir()
        .map_err(|error| NativeError::new("EXAMPLE_RESOURCE_PATH_UNAVAILABLE", error.to_string()))?
        .join("examples");
    let workspace_root = target_path
        .parent()
        .ok_or_else(|| {
            NativeError::with_path(
                "SETTINGS_PATH_INVALID",
                "Settings path has no parent.",
                &target_path,
            )
        })?
        .join("example-workspace");
    initialize_example_settings(&target_path, &resource_examples, &workspace_root)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> CommandResult<AppSettings> {
    save_settings_to_path(&settings_path(&app)?, &settings)?;
    Ok(settings)
}

pub(crate) fn settings_path(app: &AppHandle) -> CommandResult<PathBuf> {
    #[cfg(feature = "e2e")]
    if let Some(path) = std::env::var_os("DATAMANAGER_E2E_SETTINGS_PATH") {
        let path = PathBuf::from(path);
        if !path.is_absolute() {
            return Err(NativeError::with_path(
                "E2E_SETTINGS_PATH_NOT_ABSOLUTE",
                "DATAMANAGER_E2E_SETTINGS_PATH must be absolute.",
                &path,
            ));
        }
        return Ok(path);
    }
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| NativeError::new("SETTINGS_PATH_UNAVAILABLE", error.to_string()))?;
    Ok(directory.join(SETTINGS_FILE_NAME))
}

pub(crate) fn load_settings_from_path(path: &Path) -> CommandResult<AppSettings> {
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(path)
        .map_err(|error| NativeError::with_path("SETTINGS_READ_FAILED", error.to_string(), path))?;
    let settings = serde_json::from_str::<AppSettings>(&content).map_err(|error| {
        NativeError::with_path("SETTINGS_PARSE_FAILED", error.to_string(), path)
    })?;
    validate_settings(&settings)?;
    Ok(settings)
}

fn initialize_example_settings(
    target_path: &Path,
    resource_examples: &Path,
    workspace_root: &Path,
) -> CommandResult<AppSettings> {
    if !workspace_root.exists() {
        let parent = workspace_root.parent().ok_or_else(|| {
            NativeError::with_path(
                "EXAMPLE_WORKSPACE_PATH_INVALID",
                "Example workspace path has no parent.",
                workspace_root,
            )
        })?;
        fs::create_dir_all(parent).map_err(|error| {
            NativeError::with_path("EXAMPLE_WORKSPACE_CREATE_FAILED", error.to_string(), parent)
        })?;
        let staging = parent.join(format!(
            ".example-workspace-{}-{}.tmp",
            std::process::id(),
            current_nonce()
        ));
        let copy_result = copy_directory(resource_examples, &staging).and_then(|()| {
            fs::rename(&staging, workspace_root).map_err(|error| {
                NativeError::with_path(
                    "EXAMPLE_WORKSPACE_COMMIT_FAILED",
                    error.to_string(),
                    workspace_root,
                )
            })
        });
        if let Err(error) = copy_result {
            let _ = fs::remove_dir_all(&staging);
            return Err(error);
        }
    }

    let code_root = workspace_root.join("CODE");
    let settings = AppSettings {
        proto_root: path_text(&workspace_root.join("PROTO")),
        excel_root: path_text(&workspace_root.join("EXCEL")),
        json_root: path_text(&workspace_root.join("JSON")),
        codegen_outputs: vec![
            codegen_output("cpp", &code_root.join("C++")),
            codegen_output("csharp", &code_root.join("C#")),
            codegen_output("go", &code_root.join("Go")),
            codegen_output("unreal", &code_root.join("Unreal C++")),
        ],
        protoc_executable: path_text(&workspace_root.join("PROTOC").join("protoc.exe")),
        ..AppSettings::default()
    };
    validate_example_workspace(&settings)?;
    save_settings_to_path(target_path, &settings)?;
    Ok(settings)
}

fn codegen_output(language: &str, directory: &Path) -> CodegenOutput {
    CodegenOutput {
        language: language.to_string(),
        directory: path_text(directory),
    }
}

fn path_text(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn validate_example_workspace(settings: &AppSettings) -> CommandResult<()> {
    for (field, value) in settings_paths(settings) {
        let path = Path::new(value);
        let valid = if field == "protocExecutable" {
            path.is_file()
        } else {
            path.is_dir()
        };
        if !valid {
            return Err(NativeError::with_path(
                "EXAMPLE_WORKSPACE_INCOMPLETE",
                "Bundled example workspace is incomplete.",
                path,
            )
            .with_context("field", json!(field)));
        }
    }
    Ok(())
}

fn copy_directory(source: &Path, target: &Path) -> CommandResult<()> {
    if !source.is_dir() {
        return Err(NativeError::with_path(
            "EXAMPLE_RESOURCE_MISSING",
            "Bundled example resources were not found.",
            source,
        ));
    }
    fs::create_dir_all(target).map_err(|error| {
        NativeError::with_path("EXAMPLE_COPY_FAILED", error.to_string(), target)
    })?;
    for entry in fs::read_dir(source)
        .map_err(|error| NativeError::with_path("EXAMPLE_COPY_FAILED", error.to_string(), source))?
    {
        let entry = entry.map_err(|error| {
            NativeError::with_path("EXAMPLE_COPY_FAILED", error.to_string(), source)
        })?;
        let file_type = entry.file_type().map_err(|error| {
            NativeError::with_path("EXAMPLE_COPY_FAILED", error.to_string(), &entry.path())
        })?;
        let destination = target.join(entry.file_name());
        if file_type.is_dir() {
            copy_directory(&entry.path(), &destination)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), &destination).map_err(|error| {
                NativeError::with_path("EXAMPLE_COPY_FAILED", error.to_string(), &destination)
            })?;
        } else {
            return Err(NativeError::with_path(
                "EXAMPLE_RESOURCE_UNSUPPORTED",
                "Bundled example resources cannot contain symbolic links.",
                &entry.path(),
            ));
        }
    }
    Ok(())
}

pub(crate) fn save_settings_to_path(path: &Path, settings: &AppSettings) -> CommandResult<()> {
    validate_settings(settings)?;
    let content = serde_json::to_vec_pretty(settings)
        .map_err(|error| NativeError::new("SETTINGS_SERIALIZE_FAILED", error.to_string()))?;
    write_atomically(path, &content)
}

pub(crate) fn validate_settings(settings: &AppSettings) -> CommandResult<()> {
    if settings.version != SETTINGS_VERSION {
        return Err(NativeError::new(
            "SETTINGS_VERSION_UNSUPPORTED",
            format!(
                "Unsupported settings version {}. Expected {}.",
                settings.version, SETTINGS_VERSION
            ),
        ));
    }
    if !(1..=50).contains(&settings.diagram.max_nodes_per_column) {
        return Err(NativeError::new(
            "SETTINGS_DIAGRAM_LIMIT_INVALID",
            "diagram.maxNodesPerColumn must be between 1 and 50.",
        ));
    }

    let mut languages = BTreeSet::new();
    for output in &settings.codegen_outputs {
        let language = output.language.trim();
        if language.is_empty() {
            return Err(NativeError::new(
                "SETTINGS_OUTPUT_LANGUAGE_INVALID",
                "Every code generation output must specify a language.",
            ));
        }
        if !languages.insert(language.to_lowercase()) {
            return Err(NativeError::new(
                "SETTINGS_OUTPUT_LANGUAGE_DUPLICATE",
                format!("Duplicate code generation language: {language}"),
            ));
        }
    }

    for (field, value) in settings_paths(settings) {
        if !value.is_empty() && !Path::new(value).is_absolute() {
            return Err(NativeError::new(
                "SETTINGS_PATH_NOT_ABSOLUTE",
                "Configured paths must be absolute.",
            )
            .with_context("field", json!(field))
            .with_context("path", json!(value)));
        }
    }
    Ok(())
}

pub(crate) fn settings_paths(settings: &AppSettings) -> Vec<(&str, &str)> {
    let mut paths = vec![
        ("protoRoot", settings.proto_root.as_str()),
        ("excelRoot", settings.excel_root.as_str()),
        ("jsonRoot", settings.json_root.as_str()),
        ("protocExecutable", settings.protoc_executable.as_str()),
    ];
    paths.extend(
        settings
            .codegen_outputs
            .iter()
            .map(|output| (output.language.as_str(), output.directory.as_str())),
    );
    paths
}

pub(crate) fn write_atomically(path: &Path, content: &[u8]) -> CommandResult<()> {
    write_atomically_with(path, content, |temporary_path, target_path| {
        fs::rename(temporary_path, target_path)
    })
}

fn write_atomically_with<F>(path: &Path, content: &[u8], replace: F) -> CommandResult<()>
where
    F: FnOnce(&Path, &Path) -> std::io::Result<()>,
{
    let parent = path.parent().ok_or_else(|| {
        NativeError::with_path(
            "SETTINGS_PATH_INVALID",
            "Settings path has no parent.",
            path,
        )
    })?;
    fs::create_dir_all(parent).map_err(|error| {
        NativeError::with_path(
            "SETTINGS_DIRECTORY_CREATE_FAILED",
            error.to_string(),
            parent,
        )
    })?;

    let nonce = current_nonce();
    let temporary_path = parent.join(format!(".settings-{}-{nonce}.tmp", std::process::id()));

    let result = (|| -> std::io::Result<()> {
        let mut file = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary_path)?;
        file.write_all(content)?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        replace(&temporary_path, path)
    })();

    if let Err(error) = result {
        let _ = fs::remove_file(&temporary_path);
        return Err(NativeError::with_path(
            "SETTINGS_WRITE_FAILED",
            error.to_string(),
            path,
        ));
    }

    Ok(())
}

fn current_nonce() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos())
}

#[cfg(test)]
pub(crate) fn temporary_directory(label: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    std::env::temp_dir().join(format!(
        "datamanager-{label}-{}-{nonce}",
        std::process::id()
    ))
}

#[cfg(test)]
mod tests {
    use std::{ffi::OsString, fs, io};

    use super::{
        initialize_example_settings, load_settings_from_path, temporary_directory,
        validate_settings, write_atomically, write_atomically_with, AppSettings, CodegenOutput,
        SETTINGS_VERSION,
    };

    #[test]
    fn defaults_are_valid() {
        assert!(validate_settings(&AppSettings::default()).is_ok());
    }

    #[test]
    fn missing_settings_copy_bundled_examples_and_configure_every_workspace_root() {
        let directory = temporary_directory("example-defaults");
        let resources = directory.join("resources").join("examples");
        let workspace = directory.join("data").join("example-workspace");
        let settings_path = directory.join("data").join("settings.v2.json");
        for relative in [
            "PROTO",
            "EXCEL",
            "JSON",
            "CODE/C++",
            "CODE/C#",
            "CODE/Go",
            "CODE/Unreal C++",
            "PROTOC",
        ] {
            fs::create_dir_all(resources.join(relative)).unwrap();
        }
        fs::write(
            resources.join("PROTO/ItemTable.proto"),
            b"message Item {}\n",
        )
        .unwrap();
        fs::write(resources.join("PROTOC/protoc.exe"), b"fixture").unwrap();

        let settings = initialize_example_settings(&settings_path, &resources, &workspace).unwrap();

        assert_eq!(
            settings.proto_root,
            workspace.join("PROTO").to_string_lossy()
        );
        assert_eq!(settings.codegen_outputs.len(), 4);
        assert_eq!(
            settings.protoc_executable,
            workspace
                .join("PROTOC")
                .join("protoc.exe")
                .to_string_lossy()
        );
        assert!(workspace.join("PROTO/ItemTable.proto").is_file());
        assert_eq!(load_settings_from_path(&settings_path).unwrap(), settings);

        fs::write(workspace.join("PROTO/ItemTable.proto"), b"user change\n").unwrap();
        fs::remove_file(&settings_path).unwrap();
        initialize_example_settings(&settings_path, &resources, &workspace).unwrap();
        assert_eq!(
            fs::read(workspace.join("PROTO/ItemTable.proto")).unwrap(),
            b"user change\n"
        );

        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn unsupported_version_is_rejected() {
        let settings = AppSettings {
            version: SETTINGS_VERSION + 1,
            ..AppSettings::default()
        };
        assert!(validate_settings(&settings).is_err());
    }

    #[test]
    fn duplicate_output_languages_are_rejected() {
        let settings = AppSettings {
            codegen_outputs: vec![
                CodegenOutput {
                    language: "cpp".to_string(),
                    directory: String::new(),
                },
                CodegenOutput {
                    language: "CPP".to_string(),
                    directory: String::new(),
                },
            ],
            ..AppSettings::default()
        };
        assert!(validate_settings(&settings).is_err());
    }

    #[test]
    fn atomic_write_replaces_an_existing_settings_file() {
        let directory = temporary_directory("settings-replace");
        fs::create_dir_all(&directory).expect("test directory should be created");
        let path = directory.join("settings.v2.json");

        write_atomically(&path, br#"{"version":2,"value":"first"}"#)
            .expect("initial settings write should succeed");
        write_atomically(&path, br#"{"version":2,"value":"second"}"#)
            .expect("replacement settings write should succeed");

        assert_eq!(
            fs::read_to_string(&path).expect("replacement settings should be readable"),
            "{\"version\":2,\"value\":\"second\"}\n"
        );

        let remaining_files = fs::read_dir(&directory)
            .expect("test directory should be readable")
            .map(|entry| {
                entry
                    .expect("test directory entry should be readable")
                    .file_name()
            })
            .collect::<Vec<_>>();
        assert_eq!(remaining_files, vec![OsString::from("settings.v2.json")]);

        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }

    #[test]
    fn failed_replacement_preserves_the_original_and_removes_staging_file() {
        let directory = temporary_directory("settings-failure");
        fs::create_dir_all(&directory).expect("test directory should be created");
        let path = directory.join("settings.v2.json");
        fs::write(&path, b"original\n").expect("original should be written");

        let result = write_atomically_with(&path, b"replacement", |_temporary, _target| {
            Err(io::Error::new(io::ErrorKind::PermissionDenied, "injected"))
        });

        assert!(result.is_err());
        assert_eq!(
            fs::read(&path).expect("original should remain"),
            b"original\n"
        );
        assert_eq!(
            fs::read_dir(&directory)
                .expect("test directory should be readable")
                .count(),
            1
        );

        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }
}
