use std::{
    collections::HashSet,
    env, fs,
    io::Write,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use super::{
    files::list_proto_files_in_root,
    settings::{load_settings_from_path, settings_path, AppSettings, CommandResult, NativeError},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct LanguageDefinition {
    id: &'static str,
    out_flag: &'static str,
    options: &'static [&'static str],
    plugin: Option<&'static str>,
}

const LANGUAGES: [LanguageDefinition; 8] = [
    LanguageDefinition {
        id: "cpp",
        out_flag: "--cpp_out",
        options: &[],
        plugin: None,
    },
    LanguageDefinition {
        id: "csharp",
        out_flag: "--csharp_out",
        options: &[],
        plugin: None,
    },
    LanguageDefinition {
        id: "java",
        out_flag: "--java_out",
        options: &[],
        plugin: None,
    },
    LanguageDefinition {
        id: "python",
        out_flag: "--python_out",
        options: &[],
        plugin: None,
    },
    LanguageDefinition {
        id: "go",
        out_flag: "--go_out",
        options: &[],
        plugin: Some("protoc-gen-go"),
    },
    LanguageDefinition {
        id: "rust",
        out_flag: "--rust_out",
        options: &["--rust_opt=experimental-codegen=enabled,kernel=upb"],
        plugin: None,
    },
    LanguageDefinition {
        id: "ruby",
        out_flag: "--ruby_out",
        options: &[],
        plugin: None,
    },
    LanguageDefinition {
        id: "php",
        out_flag: "--php_out",
        options: &[],
        plugin: None,
    },
];

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginStatus {
    language: String,
    executable: String,
    available: bool,
    path: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodegenEnvironment {
    protoc_executable: String,
    protoc_version: String,
    plugins: Vec<PluginStatus>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtocRunResult {
    language: String,
    executable: String,
    args: Vec<String>,
    cwd: String,
    output_directory: String,
    stdout: String,
    stderr: String,
    exit_code: i32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct ProtocRequest {
    language: String,
    executable: PathBuf,
    args: Vec<String>,
    cwd: PathBuf,
    output_directory: PathBuf,
    staging_directory: PathBuf,
}

#[derive(Clone, Debug)]
struct ProcessResult {
    exit_code: i32,
    stdout: String,
    stderr: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GeneratedFileInput {
    file_name: String,
    contents: Vec<u8>,
}

#[tauri::command]
pub fn check_codegen_environment(app: AppHandle) -> CommandResult<CodegenEnvironment> {
    let settings = load_settings_from_path(&settings_path(&app)?)?;
    check_environment(&settings)
}

#[tauri::command]
pub async fn run_protoc_language(
    app: AppHandle,
    language: String,
) -> CommandResult<ProtocRunResult> {
    tauri::async_runtime::spawn_blocking(move || {
        let settings = load_settings_from_path(&settings_path(&app)?)?;
        let definition = language_definition(&language)?;
        check_protoc(&settings)?;
        let request = build_request(&settings, definition)?;
        execute_request(&request)
    })
    .await
    .map_err(|error| NativeError::new("PROTOC_TASK_JOIN_FAILED", error.to_string()))?
}

#[tauri::command]
pub fn write_unreal_files(
    app: AppHandle,
    files: Vec<GeneratedFileInput>,
) -> CommandResult<Vec<String>> {
    let settings = load_settings_from_path(&settings_path(&app)?)?;
    write_unreal_files_with_settings(&settings, files)
}

fn write_unreal_files_with_settings(
    settings: &AppSettings,
    files: Vec<GeneratedFileInput>,
) -> CommandResult<Vec<String>> {
    if files.is_empty() {
        return Err(NativeError::new(
            "UNREAL_OUTPUT_EMPTY",
            "No Unreal files were provided.",
        ));
    }
    let configured_output = settings
        .codegen_outputs
        .iter()
        .find(|output| output.language.trim().eq_ignore_ascii_case("unreal"))
        .ok_or_else(|| {
            NativeError::new(
                "UNREAL_OUTPUT_NOT_CONFIGURED",
                "No output directory is configured for Unreal.",
            )
        })?;
    let output = absolute_directory(&configured_output.directory, "UNREAL_OUTPUT")?;
    let output = canonical_output_target(&output)?;
    if !settings.proto_root.trim().is_empty() {
        let proto_root = canonical_directory(&settings.proto_root, "PROTO_ROOT")?;
        if same_or_ancestor(&output, &proto_root) {
            return Err(NativeError::with_path(
                "UNREAL_OUTPUT_CONTAINS_PROTO_ROOT",
                "Unreal output cannot be the Proto root or one of its ancestors.",
                &output,
            ));
        }
    }
    let mut names = HashSet::new();
    let mut total_bytes = 0_usize;
    for file in &files {
        if !valid_generated_file_name(&file.file_name) {
            return Err(NativeError::new(
                "UNREAL_FILE_NAME_INVALID",
                format!("Invalid Unreal output file name: {}", file.file_name),
            ));
        }
        if !names.insert(file.file_name.clone()) {
            return Err(NativeError::new(
                "UNREAL_FILE_NAME_DUPLICATE",
                format!("Duplicate Unreal output file name: {}", file.file_name),
            ));
        }
        total_bytes = total_bytes.saturating_add(file.contents.len());
    }
    if total_bytes > 64 * 1024 * 1024 {
        return Err(NativeError::new(
            "UNREAL_OUTPUT_TOO_LARGE",
            "Unreal generated output exceeds 64 MiB.",
        ));
    }

    let staging = unique_sibling(&output, "staging")?;
    fs::create_dir(&staging).map_err(|error| {
        NativeError::with_path("UNREAL_STAGING_CREATE_FAILED", error.to_string(), &staging)
    })?;
    for file in &files {
        let path = staging.join(&file.file_name);
        let result = fs::File::create(&path)
            .and_then(|mut output| {
                output.write_all(&file.contents)?;
                output.sync_all()
            })
            .map_err(|error| {
                NativeError::with_path("UNREAL_STAGING_WRITE_FAILED", error.to_string(), &path)
            });
        if let Err(error) = result {
            discard_staging(&staging);
            return Err(error);
        }
    }
    promote_staging(&staging, &output)?;
    Ok(files
        .into_iter()
        .map(|file| output.join(file.file_name).display().to_string())
        .collect())
}

fn valid_generated_file_name(value: &str) -> bool {
    let Some((stem, extension)) = value.rsplit_once('.') else {
        return false;
    };
    if stem.contains('.') || !matches!(extension, "h" | "cpp") {
        return false;
    }
    let mut characters = stem.chars();
    characters
        .next()
        .is_some_and(|character| character.is_ascii_alphabetic() || character == '_')
        && characters.all(|character| character.is_ascii_alphanumeric() || character == '_')
}

fn check_environment(settings: &AppSettings) -> CommandResult<CodegenEnvironment> {
    let version = check_protoc(settings)?;
    let protoc = canonical_file(&settings.protoc_executable, "PROTOC_EXECUTABLE")?;
    let plugins = LANGUAGES
        .iter()
        .filter_map(|definition| {
            definition.plugin.map(|plugin| {
                let path = find_executable(plugin, protoc.parent());
                PluginStatus {
                    language: definition.id.to_string(),
                    executable: plugin.to_string(),
                    available: path.is_some(),
                    path: path.map(|value| value.display().to_string()),
                }
            })
        })
        .collect();
    Ok(CodegenEnvironment {
        protoc_executable: protoc.display().to_string(),
        protoc_version: version,
        plugins,
    })
}

fn check_protoc(settings: &AppSettings) -> CommandResult<String> {
    let executable = canonical_file(&settings.protoc_executable, "PROTOC_EXECUTABLE")?;
    let output = Command::new(&executable)
        .arg("--version")
        .output()
        .map_err(|error| {
            NativeError::with_path(
                "PROTOC_VERSION_EXECUTION_FAILED",
                error.to_string(),
                &executable,
            )
        })?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        return Err(NativeError::new(
            "PROTOC_VERSION_FAILED",
            "protoc --version returned a failure status.",
        )
        .with_context("stdout", json!(stdout))
        .with_context("stderr", json!(stderr))
        .with_context("exitCode", json!(output.status.code())));
    }
    if !valid_protoc_version(&stdout) {
        return Err(NativeError::new(
            "PROTOC_VERSION_INVALID",
            format!("Unexpected protoc version output: {stdout}"),
        ));
    }
    Ok(stdout)
}

fn build_request(
    settings: &AppSettings,
    definition: LanguageDefinition,
) -> CommandResult<ProtocRequest> {
    let executable = canonical_file(&settings.protoc_executable, "PROTOC_EXECUTABLE")?;
    let proto_root = canonical_directory(&settings.proto_root, "PROTO_ROOT")?;
    let configured_output = settings
        .codegen_outputs
        .iter()
        .find(|output| normalize_language(&output.language) == Some(definition.id))
        .ok_or_else(|| {
            NativeError::new(
                "CODEGEN_OUTPUT_NOT_CONFIGURED",
                format!("No output directory is configured for {}.", definition.id),
            )
        })?;
    let configured_output = absolute_directory(&configured_output.directory, "CODEGEN_OUTPUT")?;
    let output_directory = canonical_output_target(&configured_output)?;
    if same_or_ancestor(&output_directory, &proto_root) {
        return Err(NativeError::with_path(
            "CODEGEN_OUTPUT_CONTAINS_PROTO_ROOT",
            "Code generation output cannot be the Proto root or one of its ancestors.",
            &output_directory,
        ));
    }
    let proto_files = list_proto_files_in_root(&proto_root)?;
    if proto_files.is_empty() {
        return Err(NativeError::with_path(
            "PROTOC_INPUT_EMPTY",
            "No editable Proto files were found.",
            &proto_root,
        ));
    }
    let staging_directory = unique_sibling(&output_directory, "staging")?;
    fs::create_dir(&staging_directory).map_err(|error| {
        NativeError::with_path(
            "CODEGEN_STAGING_CREATE_FAILED",
            error.to_string(),
            &staging_directory,
        )
    })?;
    let mut args = vec![format!("--proto_path={}", proto_root.display())];
    if let Some(plugin) = definition.plugin {
        let plugin_path = find_executable(plugin, executable.parent()).ok_or_else(|| {
            discard_staging(&staging_directory);
            NativeError::new(
                "PROTOC_PLUGIN_MISSING",
                format!("Required plugin '{plugin}' is not available on PATH."),
            )
            .with_context("language", json!(definition.id))
            .with_context("plugin", json!(plugin))
        })?;
        args.push(format!(
            "--plugin=protoc-gen-{}={}",
            definition.id,
            plugin_path.display()
        ));
    }
    args.extend(definition.options.iter().map(|option| option.to_string()));
    args.push(format!(
        "{}={}",
        definition.out_flag,
        staging_directory.display()
    ));
    args.extend(proto_files.into_iter().map(|entry| entry.file_name));
    Ok(ProtocRequest {
        language: definition.id.to_string(),
        executable,
        args,
        cwd: proto_root,
        output_directory,
        staging_directory,
    })
}

fn execute_request(request: &ProtocRequest) -> CommandResult<ProtocRunResult> {
    let output = Command::new(&request.executable)
        .args(&request.args)
        .current_dir(&request.cwd)
        .output()
        .map_err(|error| {
            discard_staging(&request.staging_directory);
            NativeError::with_path(
                "PROTOC_EXECUTION_START_FAILED",
                error.to_string(),
                &request.executable,
            )
        })?;
    let process = ProcessResult {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    };
    if process.exit_code != 0 {
        discard_staging(&request.staging_directory);
        return evaluate_result(request, process);
    }
    promote_staging(&request.staging_directory, &request.output_directory)?;
    evaluate_result(request, process)
}

fn canonical_output_target(path: &Path) -> CommandResult<PathBuf> {
    if path.exists() {
        let canonical = dunce::canonicalize(path).map_err(|error| {
            NativeError::with_path(
                "CODEGEN_OUTPUT_CANONICALIZE_FAILED",
                error.to_string(),
                path,
            )
        })?;
        if !canonical.is_dir() {
            return Err(NativeError::with_path(
                "CODEGEN_OUTPUT_NOT_DIRECTORY",
                "Code generation output must be a directory.",
                &canonical,
            ));
        }
        return Ok(canonical);
    }
    let name = path.file_name().ok_or_else(|| {
        NativeError::with_path(
            "CODEGEN_OUTPUT_INVALID",
            "Code generation output cannot be a filesystem root.",
            path,
        )
    })?;
    let parent = path.parent().ok_or_else(|| {
        NativeError::with_path(
            "CODEGEN_OUTPUT_INVALID",
            "Code generation output has no parent directory.",
            path,
        )
    })?;
    fs::create_dir_all(parent).map_err(|error| {
        NativeError::with_path(
            "CODEGEN_OUTPUT_PARENT_CREATE_FAILED",
            error.to_string(),
            parent,
        )
    })?;
    let canonical_parent = dunce::canonicalize(parent).map_err(|error| {
        NativeError::with_path(
            "CODEGEN_OUTPUT_PARENT_CANONICALIZE_FAILED",
            error.to_string(),
            parent,
        )
    })?;
    Ok(canonical_parent.join(name))
}

fn unique_sibling(target: &Path, purpose: &str) -> CommandResult<PathBuf> {
    let parent = target.parent().ok_or_else(|| {
        NativeError::with_path(
            "CODEGEN_OUTPUT_INVALID",
            "Code generation output has no parent directory.",
            target,
        )
    })?;
    let name = target
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("output");
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    Ok(parent.join(format!(
        ".datamanager-{name}-{}-{nonce}.{purpose}",
        std::process::id()
    )))
}

fn promote_staging(staging: &Path, target: &Path) -> CommandResult<()> {
    if !target.exists() {
        return fs::rename(staging, target).map_err(|error| {
            discard_staging(staging);
            NativeError::with_path("CODEGEN_OUTPUT_PROMOTE_FAILED", error.to_string(), target)
        });
    }
    let backup = unique_sibling(target, "backup")?;
    fs::rename(target, &backup).map_err(|error| {
        discard_staging(staging);
        NativeError::with_path("CODEGEN_OUTPUT_BACKUP_FAILED", error.to_string(), target)
    })?;
    if let Err(error) = fs::rename(staging, target) {
        let restore_error = fs::rename(&backup, target).err();
        discard_staging(staging);
        return Err(NativeError::with_path(
            "CODEGEN_OUTPUT_PROMOTE_FAILED",
            error.to_string(),
            target,
        )
        .with_context(
            "restoreError",
            json!(restore_error.map(|value| value.to_string())),
        ));
    }
    let _ = fs::remove_dir_all(backup);
    Ok(())
}

fn discard_staging(path: &Path) {
    let _ = fs::remove_dir_all(path);
}

fn same_or_ancestor(candidate: &Path, path: &Path) -> bool {
    let candidate_parts = candidate.components().collect::<Vec<_>>();
    let path_parts = path.components().collect::<Vec<_>>();
    candidate_parts.len() <= path_parts.len()
        && candidate_parts
            .iter()
            .zip(path_parts.iter())
            .all(|(left, right)| {
                if cfg!(windows) {
                    left.as_os_str()
                        .to_string_lossy()
                        .eq_ignore_ascii_case(&right.as_os_str().to_string_lossy())
                } else {
                    left == right
                }
            })
}

fn evaluate_result(
    request: &ProtocRequest,
    process: ProcessResult,
) -> CommandResult<ProtocRunResult> {
    if process.exit_code != 0 {
        return Err(NativeError::new(
            "PROTOC_EXECUTION_FAILED",
            format!("protoc generation failed for {}.", request.language),
        )
        .with_context("language", json!(request.language))
        .with_context("exitCode", json!(process.exit_code))
        .with_context("stdout", json!(process.stdout))
        .with_context("stderr", json!(process.stderr))
        .with_context("args", json!(request.args))
        .with_context("cwd", json!(request.cwd.display().to_string())));
    }
    Ok(ProtocRunResult {
        language: request.language.clone(),
        executable: request.executable.display().to_string(),
        args: request.args.clone(),
        cwd: request.cwd.display().to_string(),
        output_directory: request.output_directory.display().to_string(),
        stdout: process.stdout,
        stderr: process.stderr,
        exit_code: process.exit_code,
    })
}

fn language_definition(value: &str) -> CommandResult<LanguageDefinition> {
    let normalized = normalize_language(value).ok_or_else(|| {
        NativeError::new(
            "CODEGEN_LANGUAGE_UNSUPPORTED",
            format!("Unsupported code generation language: {value}"),
        )
    })?;
    LANGUAGES
        .iter()
        .copied()
        .find(|definition| definition.id == normalized)
        .ok_or_else(|| NativeError::new("CODEGEN_LANGUAGE_UNSUPPORTED", normalized))
}

fn normalize_language(value: &str) -> Option<&str> {
    let value = value.trim();
    if value.eq_ignore_ascii_case("golang") {
        return Some("go");
    }
    LANGUAGES
        .iter()
        .find(|definition| definition.id.eq_ignore_ascii_case(value))
        .map(|definition| definition.id)
}

fn valid_protoc_version(value: &str) -> bool {
    let Some(version) = value.strip_prefix("libprotoc ") else {
        return false;
    };
    let mut parts = version.split('.');
    parts
        .next()
        .is_some_and(|major| major.parse::<u32>().is_ok())
        && parts
            .next()
            .is_some_and(|minor| minor.parse::<u32>().is_ok())
}

fn canonical_file(value: &str, field: &str) -> CommandResult<PathBuf> {
    if value.trim().is_empty() {
        return Err(NativeError::new(
            format!("{field}_NOT_CONFIGURED"),
            format!("{field} is not configured."),
        ));
    }
    let path = Path::new(value);
    if !path.is_absolute() {
        return Err(NativeError::with_path(
            format!("{field}_NOT_ABSOLUTE"),
            format!("{field} must be absolute."),
            path,
        ));
    }
    let canonical = dunce::canonicalize(path).map_err(|error| {
        NativeError::with_path(format!("{field}_NOT_FOUND"), error.to_string(), path)
    })?;
    if !canonical.is_file() {
        return Err(NativeError::with_path(
            format!("{field}_NOT_FILE"),
            format!("{field} must be a file."),
            &canonical,
        ));
    }
    Ok(canonical)
}

fn canonical_directory(value: &str, field: &str) -> CommandResult<PathBuf> {
    let path = absolute_directory(value, field)?;
    let canonical = dunce::canonicalize(&path).map_err(|error| {
        NativeError::with_path(format!("{field}_NOT_FOUND"), error.to_string(), &path)
    })?;
    if !canonical.is_dir() {
        return Err(NativeError::with_path(
            format!("{field}_NOT_DIRECTORY"),
            format!("{field} must be a directory."),
            &canonical,
        ));
    }
    Ok(canonical)
}

fn absolute_directory(value: &str, field: &str) -> CommandResult<PathBuf> {
    if value.trim().is_empty() {
        return Err(NativeError::new(
            format!("{field}_NOT_CONFIGURED"),
            format!("{field} is not configured."),
        ));
    }
    let path = PathBuf::from(value);
    if !path.is_absolute() {
        return Err(NativeError::with_path(
            format!("{field}_NOT_ABSOLUTE"),
            format!("{field} must be absolute."),
            &path,
        ));
    }
    Ok(path)
}

fn find_executable(name: &str, additional_directory: Option<&Path>) -> Option<PathBuf> {
    let executable_name = if cfg!(windows) && !name.ends_with(".exe") {
        format!("{name}.exe")
    } else {
        name.to_string()
    };
    let mut directories = Vec::<PathBuf>::new();
    if let Some(directory) = additional_directory {
        directories.push(directory.to_path_buf());
    }
    if let Some(path) = env::var_os("PATH") {
        directories.extend(env::split_paths(&path));
    }
    directories
        .into_iter()
        .map(|directory| directory.join(&executable_name))
        .find(|candidate| candidate.is_file())
        .and_then(|candidate| dunce::canonicalize(candidate).ok())
}

#[cfg(test)]
mod tests {
    use std::{fs, path::Path};

    use super::{
        build_request, evaluate_result, language_definition, promote_staging, same_or_ancestor,
        valid_generated_file_name, valid_protoc_version, write_unreal_files_with_settings,
        GeneratedFileInput, ProcessResult,
    };
    use crate::commands::settings::{temporary_directory, AppSettings, CodegenOutput};

    #[test]
    fn fake_protoc_request_has_allowlisted_args_and_cwd() {
        let directory = temporary_directory("fake-protoc-request");
        let proto_root = directory.join("proto");
        let output = directory.join("generated cpp");
        let executable = directory.join("protoc.exe");
        fs::create_dir_all(&proto_root).expect("proto root should be created");
        fs::write(&executable, b"fake").expect("fake executable should be created");
        fs::write(proto_root.join("BTable.proto"), b"fixture").expect("fixture should be written");
        fs::write(proto_root.join("AEnumType.proto"), b"fixture")
            .expect("fixture should be written");
        let settings = AppSettings {
            protoc_executable: executable.display().to_string(),
            proto_root: proto_root.display().to_string(),
            codegen_outputs: vec![CodegenOutput {
                language: "cpp".to_string(),
                directory: output.display().to_string(),
            }],
            ..AppSettings::default()
        };

        let request = build_request(&settings, language_definition("cpp").unwrap()).unwrap();
        assert_eq!(request.cwd, dunce::canonicalize(&proto_root).unwrap());
        assert_eq!(
            request.args[0],
            format!("--proto_path={}", request.cwd.display())
        );
        assert_eq!(
            request.args[1],
            format!("--cpp_out={}", request.staging_directory.display())
        );
        assert_eq!(&request.args[2..], ["AEnumType.proto", "BTable.proto"]);

        assert!(!request.output_directory.exists());
        assert!(request.staging_directory.is_dir());

        fs::remove_dir_all(&request.staging_directory).expect("staging should be removed");
        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }

    #[test]
    fn rust_request_uses_the_bundled_experimental_upb_codegen() {
        let directory = temporary_directory("fake-rust-protoc-request");
        let proto_root = directory.join("proto");
        let output = directory.join("generated rust");
        let executable = directory.join("protoc.exe");
        fs::create_dir_all(&proto_root).expect("proto root should be created");
        fs::write(&executable, b"fake").expect("fake executable should be created");
        fs::write(proto_root.join("ItemTable.proto"), b"fixture")
            .expect("fixture should be written");
        let settings = AppSettings {
            protoc_executable: executable.display().to_string(),
            proto_root: proto_root.display().to_string(),
            codegen_outputs: vec![CodegenOutput {
                language: "rust".to_string(),
                directory: output.display().to_string(),
            }],
            ..AppSettings::default()
        };

        let request = build_request(&settings, language_definition("rust").unwrap()).unwrap();
        assert_eq!(
            &request.args[..3],
            [
                format!("--proto_path={}", request.cwd.display()),
                "--rust_opt=experimental-codegen=enabled,kernel=upb".to_string(),
                format!("--rust_out={}", request.staging_directory.display()),
            ]
        );
        assert_eq!(&request.args[3..], ["ItemTable.proto"]);

        fs::remove_dir_all(&request.staging_directory).expect("staging should be removed");
        fs::remove_dir_all(&directory).expect("test directory should be removed");
    }

    #[test]
    fn fake_protoc_failure_forwards_status_streams_and_request_context() {
        let request = super::ProtocRequest {
            language: "go".to_string(),
            executable: "C:\\tools\\protoc.exe".into(),
            args: vec![
                "--go_out=D:\\out".to_string(),
                "ItemTable.proto".to_string(),
            ],
            cwd: "D:\\proto".into(),
            output_directory: "D:\\out".into(),
            staging_directory: "D:\\out-staging".into(),
        };
        let error = evaluate_result(
            &request,
            ProcessResult {
                exit_code: 7,
                stdout: "partial".to_string(),
                stderr: "plugin failed".to_string(),
            },
        )
        .unwrap_err();

        assert_eq!(error.code, "PROTOC_EXECUTION_FAILED");
        assert_eq!(error.context["exitCode"], 7);
        assert_eq!(error.context["stderr"], "plugin failed");
        assert_eq!(error.context["args"][1], "ItemTable.proto");
        assert_eq!(error.context["cwd"], "D:\\proto");
    }

    #[test]
    fn successful_promotion_replaces_the_complete_directory() {
        let directory = temporary_directory("protoc-promotion");
        let target = directory.join("generated");
        let staging = directory.join("staging");
        fs::create_dir_all(&target).unwrap();
        fs::create_dir_all(&staging).unwrap();
        fs::write(target.join("old.txt"), b"old").unwrap();
        fs::write(staging.join("new.txt"), b"new").unwrap();

        promote_staging(&staging, &target).unwrap();

        assert!(!target.join("old.txt").exists());
        assert_eq!(fs::read(target.join("new.txt")).unwrap(), b"new");
        assert!(!staging.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn output_safety_rejects_proto_root_and_its_ancestors() {
        assert!(same_or_ancestor(
            Path::new("D:\\workspace"),
            Path::new("D:\\workspace\\proto")
        ));
        assert!(same_or_ancestor(
            Path::new("D:\\workspace\\proto"),
            Path::new("D:\\workspace\\proto")
        ));
        assert!(!same_or_ancestor(
            Path::new("D:\\workspace\\generated"),
            Path::new("D:\\workspace\\proto")
        ));
    }

    #[test]
    fn unreal_batch_replaces_output_only_after_all_files_are_staged() {
        let directory = temporary_directory("unreal-batch");
        let proto_root = directory.join("proto");
        let output = directory.join("unreal");
        fs::create_dir_all(&proto_root).unwrap();
        fs::create_dir_all(&output).unwrap();
        fs::write(output.join("Old.h"), b"old").unwrap();
        let settings = AppSettings {
            proto_root: proto_root.display().to_string(),
            codegen_outputs: vec![CodegenOutput {
                language: "unreal".to_string(),
                directory: output.display().to_string(),
            }],
            ..AppSettings::default()
        };

        let paths = write_unreal_files_with_settings(
            &settings,
            vec![
                GeneratedFileInput {
                    file_name: "DataTables.h".to_string(),
                    contents: b"tables".to_vec(),
                },
                GeneratedFileInput {
                    file_name: "DataTableLoader.cpp".to_string(),
                    contents: b"loader".to_vec(),
                },
            ],
        )
        .unwrap();

        assert_eq!(paths.len(), 2);
        assert!(!output.join("Old.h").exists());
        assert_eq!(fs::read(output.join("DataTables.h")).unwrap(), b"tables");
        assert_eq!(
            fs::read(output.join("DataTableLoader.cpp")).unwrap(),
            b"loader"
        );
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn unreal_batch_rejects_traversal_and_duplicate_names_before_writing() {
        assert!(valid_generated_file_name("DataTables.h"));
        assert!(valid_generated_file_name("DataTableLoader.cpp"));
        assert!(!valid_generated_file_name("../DataTables.h"));
        assert!(!valid_generated_file_name("Nested/DataTables.h"));
        assert!(!valid_generated_file_name("DataTables.hpp"));

        let directory = temporary_directory("unreal-invalid-batch");
        let output = directory.join("unreal");
        let settings = AppSettings {
            codegen_outputs: vec![CodegenOutput {
                language: "Unreal".to_string(),
                directory: output.display().to_string(),
            }],
            ..AppSettings::default()
        };
        let error = write_unreal_files_with_settings(
            &settings,
            vec![
                GeneratedFileInput {
                    file_name: "DataTables.h".to_string(),
                    contents: vec![],
                },
                GeneratedFileInput {
                    file_name: "DataTables.h".to_string(),
                    contents: vec![],
                },
            ],
        )
        .unwrap_err();
        assert_eq!(error.code, "UNREAL_FILE_NAME_DUPLICATE");
        assert!(!output.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn version_and_language_validation_are_concrete() {
        assert!(valid_protoc_version("libprotoc 30.2"));
        assert!(valid_protoc_version("libprotoc 3.21.12"));
        assert!(!valid_protoc_version("protoc unknown"));
        assert_eq!(language_definition("golang").unwrap().id, "go");
        assert_eq!(
            language_definition("typescript").unwrap_err().code,
            "CODEGEN_LANGUAGE_UNSUPPORTED"
        );
    }
}
