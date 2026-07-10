# DataManager Rewrite Parity Matrix

## Baseline

- Repository: https://github.com/hhhhm8826/DataManager
- Required reference revision: 3a4ba6ec652d750d88c88dcc9af8ada13b6eb169
- Inspection date: 2026-07-10
- Legacy runtime: Electron, React, TypeScript, ExcelJS
- Rewrite target: Tauri 2, React, TypeScript, Rust only at native boundaries

The legacy repository had no discovered test or spec files before M0. The
legacy characterization suite added in M0 is intentionally isolated from the
Electron product and executes the existing TypeScript services directly.

## Fixture Contract

Fixture root: tests/fixtures/m0-legacy

The fixture is deliberately separate from examples because examples contain
stale outputs from different schema revisions. The M0 test creates temporary
XLSX files from the fixture Proto definitions, inserts data.json rows, reads
them through the legacy Excel service, resolves references through the legacy
JSON export logic, and compares RootTarget.json byte-for-byte.

It contains all required reference cases:

| Case                        | Fixture evidence                           | Legacy observation fixed for the rewrite                                                         |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Single primary key          | SingleTarget                               | A reference inlines one row object.                                                              |
| Multiple primary key fields | CompositeTarget                            | A reference matched by the first primary key value inlines an array of matching rows.            |
| Legacy group key            | GroupTarget                                | Same groupId rows inline as an array.                                                            |
| No key                      | NoKeyTarget                                | The legacy resolver leaves the raw reference value unchanged.                                    |
| Multi-stage reference       | RootTarget to MiddleTarget to SingleTarget | The legacy resolver reuses an already resolved target row.                                       |
| Missing reference           | RootTarget second row                      | The legacy resolver leaves a missing raw reference unchanged.                                    |
| Circular reference          | CycleA and CycleB                          | The legacy resolver does not emit a diagnostic; M6 must replace this with a deterministic error. |
| Enum                        | FixtureState                               | Excel excludes _MAX from its Enum dropdown.                                                      |

The expected files are:

- expected/parsed-schema.json: parser shape and annotations.
- expected/RootTarget.json: JSON formatting and reference shape.
- expected/unreal-sha256.json: normalized legacy Unreal output snapshots.

The rewrite outputs are deliberately separate under `examples/TAURI_REWRITE`.
`tests/fixtures/m8-rewrite/manifest.json` records their text hashes, workbook
structure, tool hashes, and Unreal cycle diagnostics. `pnpm
fixtures:rewrite:check` regenerates them in a temporary directory and compares
both the fresh and committed artifacts to that manifest.

## Compatibility Rules

| Rule                   | Baseline evidence                                       | Rewrite requirement                                                                                                                                 |
| ---------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Annotation storage     | ProtoParserService reads and writes // @PK and // @Key  | Preserve both annotations in source files.                                                                                                          |
| Primary key behavior   | validatePrimaryKeys and RootTarget JSON                 | The new UI calls it 기본키. It permits one or more fields, rejects empty values and tuple duplicates, and inlines a single row for a one-field key. |
| Group key behavior     | GroupTarget golden JSON                                 | The new UI calls it 합성키. It preserves legacy group behavior: matching rows inline as an array. It is not a relational composite unique key.      |
| Key exclusivity        | TableCreator prevents simultaneous PK and Key selection | A table cannot use 기본키 and 합성키 modes together.                                                                                                |
| JSON format            | JsonService                                             | One Message per array file, two-space indentation, final newline.                                                                                   |
| Excel format           | ExcelService characterization                           | One workbook per Proto file, one Message sheet, primary-key header fill, enum validation, message validation, and 10,000-row validation coverage.   |
| protoc                 | CodeGeneratorService characterization                   | Current C++ invocation is checked. M7 expands this to all eight languages and structured errors.                                                    |
| Unreal                 | UnrealCodeGeneratorService hashes                       | M7 starts from this snapshot but corrects documented generator bugs with new snapshots.                                                             |
| Legacy path resolution | SettingsService and config.json                         | Relative paths resolve from the legacy app root. M2 imports them to the same absolute locations.                                                    |

## Functional Parity Status

Status meanings:

- Baseline fixed: legacy behavior is documented or covered by a fixture.
- Planned: not implemented in the new Tauri application yet.
- Pass: implemented and verified in the new application.

| Area                 | Legacy user flow and source                                              | Baseline status | New app status                                                         | Current evidence                                                                                                              |
| -------------------- | ------------------------------------------------------------------------ | --------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Startup and settings | App.tsx, SettingsPanel.tsx, SettingsService.ts                           | Baseline fixed  | Pass                                                                   | Settings v2/native/UI and legacy import tests, two fresh AppData sessions, and passing native directory/file dialogs.              |
| Table schema         | TableCreator.tsx, ProtoParserService.ts                                  | Baseline fixed  | Native CRUD and impact-confirmation pass                               | Parse/patch/reparse tests plus native field edit, temporary Table create/delete, and referenced rename/delete cancel E2E.     |
| Enum schema          | EnumCreator.tsx, ProtoParserService.ts                                   | Baseline fixed  | Native CRUD and impact-confirmation pass                               | NONE/MAX and source-preservation tests plus native Enum create/update/delete and referenced delete-cancel E2E.                |
| Diagram              | DiagramCanvas.tsx, TableNode.tsx                                         | Baseline fixed  | Pass                                                                   | Native 9-node/10-edge, MiniMap, search/hover/zoom, 600 x 800 non-overlap E2E, and passing interactive node drag/canvas pan.         |
| Excel and JSON       | ExcelPanel.tsx, ExcelService.ts, excel.ipc.ts, JsonService.ts            | Baseline fixed  | Pass                                                                   | Native collision/read/cancel/diagnostic/resolved JSON E2E plus passing Excel COM, dropdown, and workbook-open checks.               |
| Code generation      | CodeGenPanel.tsx, CodeGeneratorService.ts, UnrealCodeGeneratorService.ts | Baseline fixed  | Pass                                                                   | Passing nine-output, cancellation, real failure/stderr E2E, bundled Rust/Unreal snapshots, and interactive output-folder opening.  |
| Windows deployment   | electron-builder                                                         | Baseline fixed  | NSIS and installed process smoke pass                                  | 2,466,673-byte installer; install, five-second launch, uninstall, and profile cleanup pass.                                   |

## Legacy Quality Evidence

| Command                                                                | Result        | Notes                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| node --test tests/legacy-characterization/m0.characterization.test.cjs | Pass, 2 tests | Parser, Excel, JSON, protoc, Unreal fixture contracts.                                                                                                                                                                                    |
| npm run legacy:typecheck                                               | Pass          | Existing Electron TypeScript projects type-check.                                                                                                                                                                                         |
| npm run legacy:lint                                                    | Fail          | Existing baseline errors include the unused ProtoParserService filename parameter and React set-state-in-effect rules in ExcelPanel and SettingsPanel. These are baseline debt, not Tauri gates.                                          |
| Legacy packaged app smoke                                              | Fail          | dist/win-unpacked/data-manager.exe exited during a hidden five-second launch attempt with exit code -36861. This does not prevent source-service characterization; M8 needs a clean Tauri installer smoke on a clean Windows environment. |

## Manual Baseline Routes

These routes are retained for comparison while Electron remains in the tree.
The currently packaged Electron artifact did not stay running, so M0 records
them as explicit manual verification procedures rather than passing UI runs.

| Flow                | Procedure                                                                                                 | Observable result                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Settings and reload | Select Proto, Excel, JSON directories; save; restart.                                                     | Paths persist and valid Proto files load automatically.                                         |
| Table CRUD          | Add a table, add/reorder fields, choose types, save, edit, and delete.                                    | Target Proto reparses; existing field numbers must be observed for later migration comparison.  |
| Enum CRUD           | Create/edit/delete Enum values and omit NONE/MAX once.                                                    | Validation prevents duplicate names/numbers and adds NONE/MAX according to legacy rules.        |
| Diagram             | Load fixture and inspect reference relationships.                                                         | Nodes, edges, search dimming, hover emphasis, pan/zoom, MiniMap, and Enum detail are available. |
| Excel and JSON      | Generate selected workbooks, choose backup/overwrite behavior, enter values, then export selected sheets. | Workbook sheets and dropdowns work; JSON preserves legacy reference shapes.                     |
| Code generation     | Configure protoc and output directories; run one language and Unreal.                                     | Generated outputs and failures are surfaced to the user.                                        |
