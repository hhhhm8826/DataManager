use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, State};

use super::{
    files::{path_is_within, replace_file},
    settings::{load_settings_from_path, settings_path, CommandResult, NativeError},
};

const METADATA_DIRECTORY_NAME: &str = ".datamanager";
const METADATA_FILE_NAME: &str = "workspace.json";
const TRANSACTION_FILE_NAME: &str = "transaction.json";
const METADATA_VERSION: u32 = 1;
const DEFAULT_HUB_THRESHOLD: u32 = 5;
const MAX_METADATA_ENTRIES: usize = 10_000;
const MAX_IDENTIFIER_LENGTH: usize = 256;
const MAX_MEMO_COLUMNS: usize = 100;
const MAX_MEMO_NAME_LENGTH: usize = 128;
const MAX_COORDINATE_MAGNITUDE: f64 = 10_000_000.0;

#[derive(Default)]
pub struct WorkspaceMetadataState(Mutex<()>);

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MemoColumn {
    id: String,
    name: String,
    order: u32,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TableMetadata {
    memo_columns: Vec<MemoColumn>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiagramPosition {
    x: f64,
    y: f64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiagramViewport {
    x: f64,
    y: f64,
    zoom: f64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SavedDiagramLayout {
    #[serde(skip_serializing_if = "Option::is_none")]
    hub_threshold: Option<u32>,
    positions: BTreeMap<String, DiagramPosition>,
    viewport: DiagramViewport,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkspaceDiagramMetadata {
    hub_threshold: u32,
    saved_layout: Option<SavedDiagramLayout>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PrimaryKeyTypePolicy {
    NumericOrEnum,
    String,
    Unrestricted,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkspaceMetadata {
    version: u32,
    revision: u64,
    primary_key_type_policy: PrimaryKeyTypePolicy,
    tables: BTreeMap<String, TableMetadata>,
    diagram: WorkspaceDiagramMetadata,
}

impl Default for WorkspaceMetadata {
    fn default() -> Self {
        Self {
            version: METADATA_VERSION,
            revision: 0,
            primary_key_type_policy: PrimaryKeyTypePolicy::Unrestricted,
            tables: BTreeMap::new(),
            diagram: WorkspaceDiagramMetadata {
                hub_threshold: DEFAULT_HUB_THRESHOLD,
                saved_layout: None,
            },
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkspaceMetadataUpdateRequest {
    expected_revision: u64,
    section: String,
    value: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProtoMetadataMutation {
    old_key: String,
    new_key: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProtoMetadataTransactionRequest {
    source_file: String,
    contents: Vec<u8>,
    expected_revision: u64,
    mutation: ProtoMetadataMutation,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
enum TransactionPhase {
    Staged,
    ProtoReplaced,
    MetadataReplaced,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TransactionFile {
    target: String,
    staged: String,
    backup: Option<String>,
    original_sha256: Option<String>,
    replacement_sha256: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TransactionJournal {
    version: u32,
    phase: TransactionPhase,
    proto: TransactionFile,
    metadata: TransactionFile,
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum StopAfterPhase {
    Never,
    BeforeProtoReplace,
    AfterProtoReplace,
    BeforeMetadataReplace,
    AfterMetadataReplace,
}

#[tauri::command]
pub fn load_workspace_metadata(
    app: AppHandle,
    state: State<'_, WorkspaceMetadataState>,
) -> CommandResult<WorkspaceMetadata> {
    let _guard = lock_metadata(&state)?;
    let root = configured_proto_root(&app)?;
    recover_transaction(&root)?;
    load_metadata_from_root(&root)
}

#[tauri::command]
pub fn update_workspace_metadata(
    app: AppHandle,
    state: State<'_, WorkspaceMetadataState>,
    request: WorkspaceMetadataUpdateRequest,
) -> CommandResult<WorkspaceMetadata> {
    let _guard = lock_metadata(&state)?;
    let root = configured_proto_root(&app)?;
    recover_transaction(&root)?;
    update_metadata_in_root(&root, request)
}

#[tauri::command]
pub fn write_proto_with_metadata(
    app: AppHandle,
    state: State<'_, WorkspaceMetadataState>,
    request: ProtoMetadataTransactionRequest,
) -> CommandResult<WorkspaceMetadata> {
    let _guard = lock_metadata(&state)?;
    let root = configured_proto_root(&app)?;
    recover_transaction(&root)?;
    match write_proto_with_metadata_in_root(&root, request, StopAfterPhase::Never) {
        Ok(metadata) => Ok(metadata),
        Err(error) => {
            recover_transaction(&root)?;
            Err(error)
        }
    }
}

fn lock_metadata<'a>(
    state: &'a State<'_, WorkspaceMetadataState>,
) -> CommandResult<std::sync::MutexGuard<'a, ()>> {
    state.0.lock().map_err(|_| {
        NativeError::new(
            "WORKSPACE_METADATA_LOCK_FAILED",
            "Workspace metadata lock is unavailable.",
        )
    })
}

fn configured_proto_root(app: &AppHandle) -> CommandResult<PathBuf> {
    let settings = load_settings_from_path(&settings_path(app)?)?;
    if settings.proto_root.is_empty() {
        return Err(NativeError::new(
            "WORKSPACE_METADATA_ROOT_NOT_CONFIGURED",
            "Configure a Proto root before using project metadata.",
        ));
    }
    let configured = Path::new(&settings.proto_root);
    let root = dunce::canonicalize(configured).map_err(|error| {
        NativeError::with_path(
            "WORKSPACE_METADATA_ROOT_CANONICALIZE_FAILED",
            error.to_string(),
            configured,
        )
    })?;
    if !root.is_dir() {
        return Err(NativeError::with_path(
            "WORKSPACE_METADATA_ROOT_NOT_DIRECTORY",
            "The configured Proto root is not a directory.",
            &root,
        ));
    }
    Ok(root)
}

fn load_metadata_from_root(root: &Path) -> CommandResult<WorkspaceMetadata> {
    let path = metadata_file_path(root, false)?;
    if !path.exists() {
        return Ok(WorkspaceMetadata::default());
    }
    load_metadata_from_path(&path)
}

fn load_metadata_from_path(path: &Path) -> CommandResult<WorkspaceMetadata> {
    let content = fs::read_to_string(path).map_err(|error| {
        NativeError::with_path("WORKSPACE_METADATA_READ_FAILED", error.to_string(), path)
    })?;
    let metadata = serde_json::from_str::<WorkspaceMetadata>(&content).map_err(|error| {
        NativeError::with_path("WORKSPACE_METADATA_PARSE_FAILED", error.to_string(), path)
    })?;
    validate_metadata(&metadata)?;
    Ok(metadata)
}

fn update_metadata_in_root(
    root: &Path,
    request: WorkspaceMetadataUpdateRequest,
) -> CommandResult<WorkspaceMetadata> {
    let path = metadata_file_path(root, true)?;
    let mut current = if path.exists() {
        load_metadata_from_path(&path)?
    } else {
        WorkspaceMetadata::default()
    };
    if current.revision != request.expected_revision {
        return Err(NativeError::new(
            "WORKSPACE_METADATA_REVISION_CONFLICT",
            "Workspace metadata was changed by another screen.",
        )
        .with_context("expectedRevision", json!(request.expected_revision))
        .with_context("actualRevision", json!(current.revision)));
    }

    match request.section.as_str() {
        "primaryKeyTypePolicy" => {
            current.primary_key_type_policy = parse_section_value(request.value, &request.section)?;
        }
        "tables" => current.tables = parse_section_value(request.value, &request.section)?,
        "diagram" => current.diagram = parse_section_value(request.value, &request.section)?,
        _ => {
            return Err(NativeError::new(
                "WORKSPACE_METADATA_SECTION_UNKNOWN",
                "Unknown workspace metadata section.",
            )
            .with_context("section", json!(request.section)));
        }
    }
    current.revision = current.revision.checked_add(1).ok_or_else(|| {
        NativeError::new(
            "WORKSPACE_METADATA_REVISION_OVERFLOW",
            "Workspace metadata revision cannot be incremented.",
        )
    })?;
    validate_metadata(&current)?;
    write_metadata_atomically(&path, &current)?;
    Ok(current)
}

fn parse_section_value<T>(value: Value, section: &str) -> CommandResult<T>
where
    T: for<'de> Deserialize<'de>,
{
    serde_json::from_value(value).map_err(|error| {
        NativeError::new("WORKSPACE_METADATA_SECTION_INVALID", error.to_string())
            .with_context("section", json!(section))
    })
}

fn metadata_file_path(root: &Path, create: bool) -> CommandResult<PathBuf> {
    let directory = root.join(METADATA_DIRECTORY_NAME);
    if !directory.exists() {
        if !create {
            return Ok(directory.join(METADATA_FILE_NAME));
        }
        fs::create_dir(&directory).map_err(|error| {
            NativeError::with_path(
                "WORKSPACE_METADATA_DIRECTORY_CREATE_FAILED",
                error.to_string(),
                &directory,
            )
        })?;
    }

    let metadata = fs::symlink_metadata(&directory).map_err(|error| {
        NativeError::with_path(
            "WORKSPACE_METADATA_DIRECTORY_INSPECT_FAILED",
            error.to_string(),
            &directory,
        )
    })?;
    if metadata.file_type().is_symlink() {
        return Err(NativeError::with_path(
            "WORKSPACE_METADATA_DIRECTORY_LINK_REJECTED",
            "The .datamanager directory cannot be a symbolic link.",
            &directory,
        ));
    }
    let canonical_directory = dunce::canonicalize(&directory).map_err(|error| {
        NativeError::with_path(
            "WORKSPACE_METADATA_DIRECTORY_CANONICALIZE_FAILED",
            error.to_string(),
            &directory,
        )
    })?;
    if !canonical_directory.is_dir() || !path_is_within(&canonical_directory, root) {
        return Err(NativeError::with_path(
            "WORKSPACE_METADATA_DIRECTORY_OUTSIDE_ROOT",
            "The .datamanager directory resolves outside the Proto root.",
            &canonical_directory,
        ));
    }

    let path = canonical_directory.join(METADATA_FILE_NAME);
    if path.exists() {
        let canonical_path = dunce::canonicalize(&path).map_err(|error| {
            NativeError::with_path(
                "WORKSPACE_METADATA_PATH_CANONICALIZE_FAILED",
                error.to_string(),
                &path,
            )
        })?;
        if !canonical_path.is_file() || !path_is_within(&canonical_path, &canonical_directory) {
            return Err(NativeError::with_path(
                "WORKSPACE_METADATA_PATH_OUTSIDE_DIRECTORY",
                "workspace.json resolves outside the .datamanager directory.",
                &canonical_path,
            ));
        }
        return Ok(canonical_path);
    }
    Ok(path)
}

fn validate_metadata(metadata: &WorkspaceMetadata) -> CommandResult<()> {
    if metadata.version != METADATA_VERSION {
        return Err(NativeError::new(
            "WORKSPACE_METADATA_VERSION_UNSUPPORTED",
            format!(
                "Unsupported workspace metadata version {}. Expected {}.",
                metadata.version, METADATA_VERSION
            ),
        ));
    }
    if !(1..=50).contains(&metadata.diagram.hub_threshold) {
        return Err(NativeError::new(
            "WORKSPACE_METADATA_HUB_THRESHOLD_INVALID",
            "diagram.hubThreshold must be between 1 and 50.",
        ));
    }

    let positions = metadata
        .diagram
        .saved_layout
        .as_ref()
        .map_or(0, |layout| layout.positions.len());
    if metadata.tables.len() + positions > MAX_METADATA_ENTRIES {
        return Err(NativeError::new(
            "WORKSPACE_METADATA_ENTRY_LIMIT_EXCEEDED",
            format!("Workspace metadata cannot exceed {MAX_METADATA_ENTRIES} entries."),
        ));
    }

    for (key, table) in &metadata.tables {
        validate_table_key(key)?;
        if table.memo_columns.len() > MAX_MEMO_COLUMNS {
            return Err(NativeError::new(
                "WORKSPACE_METADATA_MEMO_LIMIT_EXCEEDED",
                format!("Table '{key}' has too many memo columns."),
            ));
        }
        let mut ids = BTreeSet::new();
        let mut orders = BTreeSet::new();
        let mut names = BTreeSet::new();
        for column in &table.memo_columns {
            if !valid_memo_id(&column.id)
                || column.name.trim().is_empty()
                || column.name.trim().chars().count() > MAX_MEMO_NAME_LENGTH
                || column.name.chars().any(char::is_control)
                || !ids.insert(column.id.as_str())
                || !orders.insert(column.order)
                || !names.insert(column.name.trim().to_lowercase())
            {
                return Err(NativeError::new(
                    "WORKSPACE_METADATA_MEMO_INVALID",
                    format!("Table '{key}' has invalid or duplicate memo column metadata."),
                ));
            }
        }
    }

    if let Some(layout) = &metadata.diagram.saved_layout {
        if layout
            .hub_threshold
            .is_some_and(|threshold| !(1..=50).contains(&threshold))
        {
            return Err(NativeError::new(
                "WORKSPACE_METADATA_HUB_THRESHOLD_INVALID",
                "diagram.savedLayout.hubThreshold must be between 1 and 50.",
            ));
        }
        for (key, position) in &layout.positions {
            if key.is_empty()
                || key.chars().count() > MAX_IDENTIFIER_LENGTH
                || !valid_coordinate(position.x)
                || !valid_coordinate(position.y)
            {
                return Err(NativeError::new(
                    "WORKSPACE_METADATA_POSITION_INVALID",
                    format!("Invalid saved diagram position for '{key}'."),
                ));
            }
        }
        let viewport = &layout.viewport;
        if !valid_coordinate(viewport.x)
            || !valid_coordinate(viewport.y)
            || !viewport.zoom.is_finite()
            || !(0.01..=16.0).contains(&viewport.zoom)
        {
            return Err(NativeError::new(
                "WORKSPACE_METADATA_VIEWPORT_INVALID",
                "Saved diagram viewport is invalid.",
            ));
        }
    }
    Ok(())
}

fn validate_table_key(key: &str) -> CommandResult<()> {
    let Some((source_file, message_name)) = key.rsplit_once('#') else {
        return Err(invalid_table_key(key));
    };
    let source_is_invalid = source_file.is_empty()
        || source_file.chars().count() > MAX_IDENTIFIER_LENGTH
        || source_file.starts_with('/')
        || source_file.contains('\\')
        || source_file
            .as_bytes()
            .get(1)
            .is_some_and(|character| *character == b':')
        || source_file
            .split('/')
            .any(|segment| segment.is_empty() || segment == "." || segment == "..")
        || !source_file.ends_with(".proto");
    let mut chars = message_name.chars();
    let message_is_invalid = chars
        .next()
        .is_none_or(|character| character != '_' && !character.is_ascii_alphabetic())
        || !chars.all(|character| character == '_' || character.is_ascii_alphanumeric());
    if source_is_invalid || message_is_invalid {
        return Err(invalid_table_key(key));
    }
    Ok(())
}

fn invalid_table_key(key: &str) -> NativeError {
    NativeError::new(
        "WORKSPACE_METADATA_TABLE_KEY_INVALID",
        format!("Invalid table metadata key: {key}"),
    )
}

fn valid_memo_id(value: &str) -> bool {
    value.starts_with("memo-")
        && value.len() <= MAX_IDENTIFIER_LENGTH
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
}

fn valid_coordinate(value: f64) -> bool {
    value.is_finite() && value.abs() <= MAX_COORDINATE_MAGNITUDE
}

fn write_proto_with_metadata_in_root(
    root: &Path,
    request: ProtoMetadataTransactionRequest,
    stop_after: StopAfterPhase,
) -> CommandResult<WorkspaceMetadata> {
    validate_source_file(&request.source_file)?;
    validate_table_key(&request.mutation.old_key)?;
    if let Some(new_key) = &request.mutation.new_key {
        validate_table_key(new_key)?;
        if table_key_source(new_key) != request.source_file {
            return Err(NativeError::new(
                "WORKSPACE_METADATA_MUTATION_SOURCE_MISMATCH",
                "The new table metadata key must use the edited source file.",
            ));
        }
    }
    if table_key_source(&request.mutation.old_key) != request.source_file {
        return Err(NativeError::new(
            "WORKSPACE_METADATA_MUTATION_SOURCE_MISMATCH",
            "The old table metadata key must use the edited source file.",
        ));
    }

    let proto_target = canonical_proto_target(root, &request.source_file)?;
    let metadata_target = metadata_file_path(root, true)?;
    let mut metadata = if metadata_target.exists() {
        load_metadata_from_path(&metadata_target)?
    } else {
        WorkspaceMetadata::default()
    };
    if metadata.revision != request.expected_revision {
        return Err(revision_conflict(
            request.expected_revision,
            metadata.revision,
        ));
    }

    let moved = metadata.tables.remove(&request.mutation.old_key);
    if let (Some(new_key), Some(table)) = (request.mutation.new_key, moved) {
        metadata.tables.insert(new_key, table);
    }
    metadata.revision = metadata.revision.checked_add(1).ok_or_else(|| {
        NativeError::new(
            "WORKSPACE_METADATA_REVISION_OVERFLOW",
            "Workspace metadata revision cannot be incremented.",
        )
    })?;
    validate_metadata(&metadata)?;

    let mut metadata_contents = serde_json::to_vec_pretty(&metadata).map_err(|error| {
        NativeError::new("WORKSPACE_METADATA_SERIALIZE_FAILED", error.to_string())
    })?;
    metadata_contents.push(b'\n');

    let proto = stage_transaction_file(root, &proto_target, &request.contents, "proto")?;
    let metadata_file =
        match stage_transaction_file(root, &metadata_target, &metadata_contents, "metadata") {
            Ok(file) => file,
            Err(error) => {
                cleanup_transaction_file(root, &proto);
                return Err(error);
            }
        };
    let mut journal = TransactionJournal {
        version: 1,
        phase: TransactionPhase::Staged,
        proto,
        metadata: metadata_file,
    };
    if let Err(error) = write_transaction_journal(root, &journal) {
        cleanup_transaction_file(root, &journal.proto);
        cleanup_transaction_file(root, &journal.metadata);
        return Err(error);
    }
    if stop_after == StopAfterPhase::BeforeProtoReplace {
        return Err(interrupted_transaction());
    }

    replace_staged_file(root, &journal.proto)?;
    if stop_after == StopAfterPhase::AfterProtoReplace {
        return Err(interrupted_transaction());
    }
    journal.phase = TransactionPhase::ProtoReplaced;
    write_transaction_journal(root, &journal)?;
    if stop_after == StopAfterPhase::BeforeMetadataReplace {
        return Err(interrupted_transaction());
    }

    replace_staged_file(root, &journal.metadata)?;
    if stop_after == StopAfterPhase::AfterMetadataReplace {
        return Err(interrupted_transaction());
    }
    journal.phase = TransactionPhase::MetadataReplaced;
    write_transaction_journal(root, &journal)?;

    finalize_transaction(root, &journal)?;
    Ok(metadata)
}

fn revision_conflict(expected: u64, actual: u64) -> NativeError {
    NativeError::new(
        "WORKSPACE_METADATA_REVISION_CONFLICT",
        "Workspace metadata was changed by another screen.",
    )
    .with_context("expectedRevision", json!(expected))
    .with_context("actualRevision", json!(actual))
}

fn interrupted_transaction() -> NativeError {
    NativeError::new(
        "WORKSPACE_TRANSACTION_INTERRUPTED",
        "Injected transaction interruption.",
    )
}

fn validate_source_file(source_file: &str) -> CommandResult<()> {
    let path = Path::new(source_file);
    if source_file.is_empty()
        || source_file.contains('\\')
        || path.is_absolute()
        || !source_file.ends_with(".proto")
        || path
            .components()
            .any(|component| !matches!(component, std::path::Component::Normal(_)))
    {
        return Err(NativeError::new(
            "WORKSPACE_PROTO_SOURCE_INVALID",
            "Proto source must be a normalized relative .proto path.",
        )
        .with_context("sourceFile", json!(source_file)));
    }
    Ok(())
}

fn table_key_source(key: &str) -> &str {
    key.rsplit_once('#').map_or("", |(source, _)| source)
}

fn canonical_proto_target(root: &Path, source_file: &str) -> CommandResult<PathBuf> {
    let requested = root.join(source_file);
    let target = dunce::canonicalize(&requested).map_err(|error| {
        NativeError::with_path(
            "WORKSPACE_PROTO_CANONICALIZE_FAILED",
            error.to_string(),
            &requested,
        )
    })?;
    if !target.is_file() || !path_is_within(&target, root) {
        return Err(NativeError::with_path(
            "WORKSPACE_PROTO_OUTSIDE_ROOT",
            "The edited Proto file must exist inside the configured Proto root.",
            &target,
        ));
    }
    Ok(target)
}

fn stage_transaction_file(
    root: &Path,
    target: &Path,
    contents: &[u8],
    label: &str,
) -> CommandResult<TransactionFile> {
    let parent = target.parent().ok_or_else(|| {
        NativeError::with_path(
            "WORKSPACE_TRANSACTION_PARENT_UNAVAILABLE",
            "Transaction target has no parent.",
            target,
        )
    })?;
    let nonce = transaction_nonce();
    let staged = parent.join(format!(
        ".datamanager-{label}-{}-{nonce}.tmp",
        std::process::id()
    ));
    write_synced_new_file(&staged, contents)?;

    let original_sha256 = if target.exists() {
        match hash_file(target) {
            Ok(hash) => Some(hash),
            Err(error) => {
                let _ = fs::remove_file(&staged);
                return Err(error);
            }
        }
    } else {
        None
    };
    let backup = if target.exists() {
        let path = parent.join(format!(
            ".datamanager-{label}-{}-{nonce}.bak",
            std::process::id()
        ));
        let original = match fs::read(target) {
            Ok(original) => original,
            Err(error) => {
                let _ = fs::remove_file(&staged);
                return Err(NativeError::with_path(
                    "WORKSPACE_TRANSACTION_BACKUP_READ_FAILED",
                    error.to_string(),
                    target,
                ));
            }
        };
        if let Err(error) = write_synced_new_file(&path, &original) {
            let _ = fs::remove_file(&staged);
            return Err(error);
        }
        Some(relative_path(root, &path)?)
    } else {
        None
    };

    Ok(TransactionFile {
        target: relative_path(root, target)?,
        staged: relative_path(root, &staged)?,
        backup,
        original_sha256,
        replacement_sha256: hash_bytes(contents),
    })
}

fn write_synced_new_file(path: &Path, contents: &[u8]) -> CommandResult<()> {
    let result = (|| -> std::io::Result<()> {
        let mut file = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(path)?;
        file.write_all(contents)?;
        file.sync_all()
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(path);
        return Err(NativeError::with_path(
            "WORKSPACE_TRANSACTION_STAGE_FAILED",
            error.to_string(),
            path,
        ));
    }
    Ok(())
}

fn transaction_nonce() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos())
}

fn relative_path(root: &Path, path: &Path) -> CommandResult<String> {
    let relative = path.strip_prefix(root).map_err(|_| {
        NativeError::with_path(
            "WORKSPACE_TRANSACTION_PATH_OUTSIDE_ROOT",
            "Transaction path is outside the Proto root.",
            path,
        )
    })?;
    Ok(relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/"))
}

fn resolve_relative_path(root: &Path, relative: &str) -> CommandResult<PathBuf> {
    let path = Path::new(relative);
    if relative.is_empty()
        || relative.contains('\\')
        || path.is_absolute()
        || path
            .components()
            .any(|component| !matches!(component, std::path::Component::Normal(_)))
    {
        return Err(NativeError::new(
            "WORKSPACE_TRANSACTION_PATH_INVALID",
            "Transaction journal contains an invalid relative path.",
        )
        .with_context("path", json!(relative)));
    }
    Ok(root.join(path))
}

fn transaction_path(root: &Path, create: bool) -> CommandResult<PathBuf> {
    let metadata_path = metadata_file_path(root, create)?;
    Ok(metadata_path
        .parent()
        .expect("metadata path has a validated parent")
        .join(TRANSACTION_FILE_NAME))
}

fn write_transaction_journal(root: &Path, journal: &TransactionJournal) -> CommandResult<()> {
    let path = transaction_path(root, true)?;
    let mut content = serde_json::to_vec_pretty(journal).map_err(|error| {
        NativeError::new("WORKSPACE_TRANSACTION_SERIALIZE_FAILED", error.to_string())
    })?;
    content.push(b'\n');
    write_metadata_atomically_with(&path, &content, replace_file)
}

fn read_transaction_journal(root: &Path) -> CommandResult<Option<TransactionJournal>> {
    let path = transaction_path(root, false)?;
    if !path.exists() {
        return Ok(None);
    }
    let file_type = fs::symlink_metadata(&path).map_err(|error| {
        NativeError::with_path(
            "WORKSPACE_TRANSACTION_INSPECT_FAILED",
            error.to_string(),
            &path,
        )
    })?;
    if file_type.file_type().is_symlink() || !file_type.is_file() {
        return Err(NativeError::with_path(
            "WORKSPACE_TRANSACTION_LINK_REJECTED",
            "transaction.json must be a regular file.",
            &path,
        ));
    }
    let content = fs::read_to_string(&path).map_err(|error| {
        NativeError::with_path(
            "WORKSPACE_TRANSACTION_READ_FAILED",
            error.to_string(),
            &path,
        )
    })?;
    let journal = serde_json::from_str::<TransactionJournal>(&content).map_err(|error| {
        NativeError::with_path(
            "WORKSPACE_TRANSACTION_PARSE_FAILED",
            error.to_string(),
            &path,
        )
    })?;
    if journal.version != 1 {
        return Err(NativeError::new(
            "WORKSPACE_TRANSACTION_VERSION_UNSUPPORTED",
            "Unsupported workspace transaction journal version.",
        ));
    }
    validate_journal_paths(root, &journal)?;
    Ok(Some(journal))
}

fn validate_journal_paths(root: &Path, journal: &TransactionJournal) -> CommandResult<()> {
    for file in [&journal.proto, &journal.metadata] {
        resolve_relative_path(root, &file.target)?;
        resolve_relative_path(root, &file.staged)?;
        if let Some(backup) = &file.backup {
            resolve_relative_path(root, backup)?;
        }
    }
    Ok(())
}

fn replace_staged_file(root: &Path, file: &TransactionFile) -> CommandResult<()> {
    let staged = resolve_relative_path(root, &file.staged)?;
    let target = resolve_relative_path(root, &file.target)?;
    replace_file(&staged, &target).map_err(|error| {
        NativeError::with_path(
            "WORKSPACE_TRANSACTION_REPLACE_FAILED",
            error.to_string(),
            &target,
        )
    })
}

fn recover_transaction(root: &Path) -> CommandResult<()> {
    let Some(journal) = read_transaction_journal(root)? else {
        return Ok(());
    };
    let proto_is_new = file_matches_hash(
        root,
        &journal.proto.target,
        &journal.proto.replacement_sha256,
    )?;
    let metadata_is_new = file_matches_hash(
        root,
        &journal.metadata.target,
        &journal.metadata.replacement_sha256,
    )?;
    if proto_is_new && metadata_is_new {
        return finalize_transaction(root, &journal);
    }

    restore_transaction_file(root, &journal.proto)?;
    restore_transaction_file(root, &journal.metadata)?;
    finalize_transaction(root, &journal)
}

fn restore_transaction_file(root: &Path, file: &TransactionFile) -> CommandResult<()> {
    let target = resolve_relative_path(root, &file.target)?;
    match (&file.original_sha256, &file.backup) {
        (Some(original_hash), Some(backup)) => {
            if file_matches_hash(root, &file.target, original_hash)? {
                return Ok(());
            }
            let backup_path = resolve_relative_path(root, backup)?;
            if !backup_path.exists() || hash_file(&backup_path)? != *original_hash {
                return Err(NativeError::with_path(
                    "WORKSPACE_TRANSACTION_BACKUP_INVALID",
                    "Transaction backup is missing or does not match its recorded hash.",
                    &backup_path,
                ));
            }
            replace_file(&backup_path, &target).map_err(|error| {
                NativeError::with_path(
                    "WORKSPACE_TRANSACTION_ROLLBACK_FAILED",
                    error.to_string(),
                    &target,
                )
            })?;
        }
        (None, None) => {
            if target.exists() {
                fs::remove_file(&target).map_err(|error| {
                    NativeError::with_path(
                        "WORKSPACE_TRANSACTION_ROLLBACK_FAILED",
                        error.to_string(),
                        &target,
                    )
                })?;
            }
        }
        _ => {
            return Err(NativeError::new(
                "WORKSPACE_TRANSACTION_JOURNAL_INVALID",
                "Transaction journal backup metadata is inconsistent.",
            ));
        }
    }
    Ok(())
}

fn file_matches_hash(root: &Path, relative: &str, expected: &str) -> CommandResult<bool> {
    let path = resolve_relative_path(root, relative)?;
    if !path.exists() {
        return Ok(false);
    }
    Ok(hash_file(&path)? == expected)
}

fn hash_file(path: &Path) -> CommandResult<String> {
    let bytes = fs::read(path).map_err(|error| {
        NativeError::with_path("WORKSPACE_TRANSACTION_HASH_FAILED", error.to_string(), path)
    })?;
    Ok(hash_bytes(&bytes))
}

fn hash_bytes(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn cleanup_transaction_file(root: &Path, file: &TransactionFile) {
    for relative in [Some(file.staged.as_str()), file.backup.as_deref()]
        .into_iter()
        .flatten()
    {
        if let Ok(path) = resolve_relative_path(root, relative) {
            let _ = fs::remove_file(path);
        }
    }
}

fn finalize_transaction(root: &Path, journal: &TransactionJournal) -> CommandResult<()> {
    cleanup_transaction_file(root, &journal.proto);
    cleanup_transaction_file(root, &journal.metadata);
    let journal_path = transaction_path(root, false)?;
    if journal_path.exists() {
        fs::remove_file(&journal_path).map_err(|error| {
            NativeError::with_path(
                "WORKSPACE_TRANSACTION_CLEANUP_FAILED",
                error.to_string(),
                &journal_path,
            )
        })?;
    }
    Ok(())
}

fn write_metadata_atomically(path: &Path, metadata: &WorkspaceMetadata) -> CommandResult<()> {
    let mut content = serde_json::to_vec_pretty(metadata).map_err(|error| {
        NativeError::new("WORKSPACE_METADATA_SERIALIZE_FAILED", error.to_string())
    })?;
    content.push(b'\n');
    write_metadata_atomically_with(path, &content, replace_file)
}

fn write_metadata_atomically_with<F>(path: &Path, content: &[u8], replace: F) -> CommandResult<()>
where
    F: FnOnce(&Path, &Path) -> std::io::Result<()>,
{
    let parent = path.parent().ok_or_else(|| {
        NativeError::with_path(
            "WORKSPACE_METADATA_PARENT_UNAVAILABLE",
            "Workspace metadata path has no parent.",
            path,
        )
    })?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    let temporary = parent.join(format!(".workspace-{}-{nonce}.tmp", std::process::id()));
    let result = (|| -> std::io::Result<()> {
        let mut file = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)?;
        file.write_all(content)?;
        file.sync_all()?;
        replace(&temporary, path)
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(&temporary);
        return Err(NativeError::with_path(
            "WORKSPACE_METADATA_WRITE_FAILED",
            error.to_string(),
            path,
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::{fs, io, path::Path};

    use serde_json::json;

    use super::{
        load_metadata_from_root, metadata_file_path, update_metadata_in_root, validate_metadata,
        write_metadata_atomically_with, write_proto_with_metadata_in_root, ProtoMetadataMutation,
        ProtoMetadataTransactionRequest, SavedDiagramLayout, StopAfterPhase, WorkspaceMetadata,
        WorkspaceMetadataUpdateRequest, METADATA_DIRECTORY_NAME, METADATA_FILE_NAME,
        TRANSACTION_FILE_NAME,
    };
    use crate::commands::{files::list_proto_files_in_root, settings::temporary_directory};

    fn shared_fixture_root() -> std::path::PathBuf {
        dunce::canonicalize(
            Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../../tests/fixtures/d1000-d1012/긴 한글 경로/PROTO"),
        )
        .unwrap()
    }

    fn transaction_fixture(label: &str) -> (std::path::PathBuf, Vec<u8>) {
        let root = temporary_directory(label);
        fs::create_dir_all(&root).unwrap();
        let original = b"syntax = \"proto3\";\nmessage Item {}\n".to_vec();
        fs::write(root.join("ItemTable.proto"), &original).unwrap();
        update_metadata_in_root(
            &root,
            WorkspaceMetadataUpdateRequest {
                expected_revision: 0,
                section: "tables".to_string(),
                value: json!({
                  "ItemTable.proto#Item": {
                    "memoColumns": [{ "id": "memo-plan", "name": "기획 메모", "order": 0 }]
                  }
                }),
            },
        )
        .unwrap();
        (root, original)
    }

    fn rename_request() -> ProtoMetadataTransactionRequest {
        ProtoMetadataTransactionRequest {
            source_file: "ItemTable.proto".to_string(),
            contents: b"syntax = \"proto3\";\nmessage Renamed {}\n".to_vec(),
            expected_revision: 1,
            mutation: ProtoMetadataMutation {
                old_key: "ItemTable.proto#Item".to_string(),
                new_key: Some("ItemTable.proto#Renamed".to_string()),
            },
        }
    }

    fn delete_request() -> ProtoMetadataTransactionRequest {
        ProtoMetadataTransactionRequest {
            source_file: "ItemTable.proto".to_string(),
            contents: b"syntax = \"proto3\";\n".to_vec(),
            expected_revision: 1,
            mutation: ProtoMetadataMutation {
                old_key: "ItemTable.proto#Item".to_string(),
                new_key: None,
            },
        }
    }

    #[test]
    fn missing_metadata_uses_defaults_without_creating_a_file() {
        let root = temporary_directory("metadata-missing");
        fs::create_dir_all(&root).unwrap();
        let metadata = load_metadata_from_root(&root).unwrap();
        assert_eq!(metadata, WorkspaceMetadata::default());
        assert!(!root.join(METADATA_DIRECTORY_NAME).exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn section_updates_round_trip_and_stale_revisions_are_rejected() {
        let root = temporary_directory("metadata-update");
        fs::create_dir_all(&root).unwrap();
        let first = update_metadata_in_root(
            &root,
            WorkspaceMetadataUpdateRequest {
                expected_revision: 0,
                section: "primaryKeyTypePolicy".to_string(),
                value: json!("string"),
            },
        )
        .unwrap();
        let second = update_metadata_in_root(
            &root,
            WorkspaceMetadataUpdateRequest {
                expected_revision: 1,
                section: "diagram".to_string(),
                value: json!({ "hubThreshold": 8, "savedLayout": null }),
            },
        )
        .unwrap();
        assert_eq!(first.revision, 1);
        assert_eq!(second.revision, 2);
        assert_eq!(second.diagram.hub_threshold, 8);
        assert!(update_metadata_in_root(
            &root,
            WorkspaceMetadataUpdateRequest {
                expected_revision: 1,
                section: "tables".to_string(),
                value: json!({}),
            },
        )
        .is_err());
        assert_eq!(load_metadata_from_root(&root).unwrap(), second);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn corrupt_and_unknown_metadata_are_not_overwritten() {
        let root = temporary_directory("metadata-corrupt");
        let directory = root.join(METADATA_DIRECTORY_NAME);
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join(METADATA_FILE_NAME);
        fs::write(&path, b"{not json}\n").unwrap();
        assert!(load_metadata_from_root(&root).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"{not json}\n");
        fs::write(&path, br#"{"version":99}"#).unwrap();
        assert!(load_metadata_from_root(&root).is_err());
        assert_eq!(fs::read(&path).unwrap(), br#"{"version":99}"#);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn failed_atomic_replace_preserves_original_and_removes_owned_temp() {
        let root = temporary_directory("metadata-atomic");
        let directory = root.join(METADATA_DIRECTORY_NAME);
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join(METADATA_FILE_NAME);
        fs::write(&path, b"original\n").unwrap();
        let result = write_metadata_atomically_with(&path, b"replacement\n", |_, _| {
            Err(io::Error::new(io::ErrorKind::PermissionDenied, "injected"))
        });
        assert!(result.is_err());
        assert_eq!(fs::read(&path).unwrap(), b"original\n");
        assert_eq!(fs::read_dir(&directory).unwrap().count(), 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn restart_recovery_never_leaves_proto_and_metadata_in_different_generations() {
        for (label, stop_after, committed) in [
            (
                "transaction-before-proto",
                StopAfterPhase::BeforeProtoReplace,
                false,
            ),
            (
                "transaction-after-proto",
                StopAfterPhase::AfterProtoReplace,
                false,
            ),
            (
                "transaction-before-metadata",
                StopAfterPhase::BeforeMetadataReplace,
                false,
            ),
            (
                "transaction-after-metadata",
                StopAfterPhase::AfterMetadataReplace,
                true,
            ),
        ] {
            let (root, original) = transaction_fixture(label);
            let replacement = rename_request().contents.clone();
            assert!(
                write_proto_with_metadata_in_root(&root, rename_request(), stop_after).is_err()
            );
            assert!(root
                .join(METADATA_DIRECTORY_NAME)
                .join(TRANSACTION_FILE_NAME)
                .exists());

            super::recover_transaction(&root).unwrap();

            let proto = fs::read(root.join("ItemTable.proto")).unwrap();
            let metadata = load_metadata_from_root(&root).unwrap();
            if committed {
                assert_eq!(proto, replacement);
                assert_eq!(metadata.revision, 2);
                assert!(metadata.tables.contains_key("ItemTable.proto#Renamed"));
                assert!(!metadata.tables.contains_key("ItemTable.proto#Item"));
            } else {
                assert_eq!(proto, original);
                assert_eq!(metadata.revision, 1);
                assert!(metadata.tables.contains_key("ItemTable.proto#Item"));
                assert!(!metadata.tables.contains_key("ItemTable.proto#Renamed"));
            }
            let leftovers = fs::read_dir(root.join(METADATA_DIRECTORY_NAME))
                .unwrap()
                .chain(fs::read_dir(&root).unwrap())
                .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
                .filter(|name| {
                    name.ends_with(".tmp")
                        || name.ends_with(".bak")
                        || name == TRANSACTION_FILE_NAME
                })
                .collect::<Vec<_>>();
            assert!(leftovers.is_empty(), "leftovers: {leftovers:?}");
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn interrupted_delete_recovers_to_one_complete_generation_at_all_replace_boundaries() {
        for (label, stop_after, committed) in [
            (
                "delete-before-proto",
                StopAfterPhase::BeforeProtoReplace,
                false,
            ),
            (
                "delete-after-proto",
                StopAfterPhase::AfterProtoReplace,
                false,
            ),
            (
                "delete-before-metadata",
                StopAfterPhase::BeforeMetadataReplace,
                false,
            ),
            (
                "delete-after-metadata",
                StopAfterPhase::AfterMetadataReplace,
                true,
            ),
        ] {
            let (root, original) = transaction_fixture(label);
            assert!(
                write_proto_with_metadata_in_root(&root, delete_request(), stop_after).is_err()
            );
            super::recover_transaction(&root).unwrap();
            let proto = fs::read(root.join("ItemTable.proto")).unwrap();
            let metadata = load_metadata_from_root(&root).unwrap();
            if committed {
                assert_eq!(proto, delete_request().contents);
                assert_eq!(metadata.revision, 2);
                assert!(metadata.tables.is_empty());
            } else {
                assert_eq!(proto, original);
                assert_eq!(metadata.revision, 1);
                assert!(metadata.tables.contains_key("ItemTable.proto#Item"));
            }
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn successful_rename_and_delete_are_atomic_and_clean() {
        let (root, _) = transaction_fixture("transaction-success");
        let renamed =
            write_proto_with_metadata_in_root(&root, rename_request(), StopAfterPhase::Never)
                .unwrap();
        assert_eq!(renamed.revision, 2);
        assert!(renamed.tables.contains_key("ItemTable.proto#Renamed"));

        let deleted = write_proto_with_metadata_in_root(
            &root,
            ProtoMetadataTransactionRequest {
                source_file: "ItemTable.proto".to_string(),
                contents: b"syntax = \"proto3\";\n".to_vec(),
                expected_revision: 2,
                mutation: ProtoMetadataMutation {
                    old_key: "ItemTable.proto#Renamed".to_string(),
                    new_key: None,
                },
            },
            StopAfterPhase::Never,
        )
        .unwrap();
        assert_eq!(deleted.revision, 3);
        assert!(deleted.tables.is_empty());
        assert_eq!(
            fs::read(root.join("ItemTable.proto")).unwrap(),
            b"syntax = \"proto3\";\n"
        );
        assert!(!root
            .join(METADATA_DIRECTORY_NAME)
            .join(TRANSACTION_FILE_NAME)
            .exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn recovery_rejects_journal_path_traversal_without_touching_outside_files() {
        let (root, _) = transaction_fixture("transaction-traversal");
        let outside = root.parent().unwrap().join("outside.proto");
        fs::write(&outside, b"outside").unwrap();
        let journal = root
            .join(METADATA_DIRECTORY_NAME)
            .join(TRANSACTION_FILE_NAME);
        fs::write(
            &journal,
            br#"{
              "version": 1,
              "phase": "staged",
              "proto": {"target":"../outside.proto","staged":"x","backup":null,"originalSha256":null,"replacementSha256":"x"},
              "metadata": {"target":".datamanager/workspace.json","staged":"x","backup":null,"originalSha256":null,"replacementSha256":"x"}
            }"#,
        )
        .unwrap();
        assert!(super::recover_transaction(&root).is_err());
        assert_eq!(fs::read(&outside).unwrap(), b"outside");
        fs::remove_file(outside).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn transaction_rejects_arbitrary_source_paths_before_changing_project_files() {
        for (index, source_file) in [
            "../ItemTable.proto",
            "C:/outside/ItemTable.proto",
            "ItemTable.txt",
            ".datamanager/workspace.json",
        ]
        .into_iter()
        .enumerate()
        {
            let (root, original) = transaction_fixture(&format!("transaction-source-{index}"));
            let result = write_proto_with_metadata_in_root(
                &root,
                ProtoMetadataTransactionRequest {
                    source_file: source_file.to_string(),
                    contents: b"changed".to_vec(),
                    expected_revision: 1,
                    mutation: ProtoMetadataMutation {
                        old_key: "ItemTable.proto#Item".to_string(),
                        new_key: None,
                    },
                },
                StopAfterPhase::Never,
            );
            assert!(result.is_err());
            assert_eq!(fs::read(root.join("ItemTable.proto")).unwrap(), original);
            assert_eq!(load_metadata_from_root(&root).unwrap().revision, 1);
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn shared_fixture_shape_is_valid() {
        assert!(validate_metadata(&WorkspaceMetadata::default()).is_ok());
        let parsed: WorkspaceMetadata = serde_json::from_value(json!({
          "version": 1,
          "revision": 0,
          "primaryKeyTypePolicy": "unrestricted",
          "tables": {
            "ItemTable.proto#Item": {
              "memoColumns": [{ "id": "memo-018f6f74", "name": "기획 메모", "order": 0 }]
            }
          },
          "diagram": { "hubThreshold": 5, "savedLayout": null }
        }))
        .unwrap();
        assert!(validate_metadata(&parsed).is_ok());

        let fixture_root = shared_fixture_root();
        let fixture = load_metadata_from_root(&fixture_root).unwrap();
        assert_eq!(
            fixture.primary_key_type_policy,
            parsed.primary_key_type_policy
        );
        assert_eq!(fixture.diagram.hub_threshold, 5);
        assert!(fixture.tables.is_empty());
        assert_eq!(
            fixture.diagram.saved_layout.as_ref().unwrap().hub_threshold,
            None
        );
        let saved_threshold: SavedDiagramLayout = serde_json::from_value(json!({
          "hubThreshold": 3,
          "positions": {},
          "viewport": { "x": 0, "y": 0, "zoom": 1 }
        }))
        .unwrap();
        assert_eq!(saved_threshold.hub_threshold, Some(3));
        let proto_files = list_proto_files_in_root(&fixture_root).unwrap();
        assert_eq!(proto_files.len(), 11);
        assert!(proto_files
            .iter()
            .all(|entry| !entry.path.contains(METADATA_DIRECTORY_NAME)));
    }

    #[test]
    fn metadata_path_is_exact_and_rejects_a_link_when_supported() {
        let root = temporary_directory("metadata-link");
        let outside = temporary_directory("metadata-outside");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        let link = root.join(METADATA_DIRECTORY_NAME);
        #[cfg(target_os = "windows")]
        let linked = std::os::windows::fs::symlink_dir(&outside, &link).or_else(|_| {
            let output = std::process::Command::new("cmd")
                .args(["/C", "mklink", "/J"])
                .arg(&link)
                .arg(&outside)
                .output()?;
            if output.status.success() {
                Ok(())
            } else {
                Err(io::Error::other(String::from_utf8_lossy(&output.stderr)))
            }
        });
        #[cfg(not(target_os = "windows"))]
        let linked = std::os::unix::fs::symlink(&outside, &link);
        assert!(linked.is_ok(), "failed to create link fixture: {linked:?}");
        assert!(metadata_file_path(&root, false).is_err());
        fs::remove_dir(&link).unwrap();
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }
}
