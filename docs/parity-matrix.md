# DataManager Rewrite Parity Matrix

## Baseline

- Repository: https://github.com/hhhhm8826/DataManager
- Required reference revision: 3a4ba6ec652d750d88c88dcc9af8ada13b6eb169
- Inspection date: 2026-07-10
- Legacy runtime: Electron, React, TypeScript, ExcelJS
- Rewrite target: Tauri 2, React, TypeScript, Rust only at native boundaries

The legacy repository had no discovered test or spec files before M0. Before
cutover, the M0 characterization suite executed the Electron-era TypeScript
services directly and produced the preserved goldens below. The final active
branch contains no Electron runtime; `pnpm test:baseline` verifies the immutable
observations while the new core, adapter, fixture, and native E2E suites verify
the replacement behavior.

## Fixture Contract

Fixture root: tests/fixtures/m0-legacy

The fixture is deliberately separate from examples because examples contain
stale outputs from different schema revisions. The pre-cutover M0
characterization created temporary XLSX files, inserted `data.json`, read them
through the legacy service, resolved references, and recorded JSON and Unreal
snapshots. The resulting schema, JSON, and normalized Unreal observations remain
under source control and are checked without retaining Electron code.

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

| Area                 | Legacy user flow and source                                              | Baseline status | New app status | Current evidence                                                                                                 |
| -------------------- | ------------------------------------------------------------------------ | --------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Startup and settings | App.tsx, SettingsPanel.tsx, SettingsService.ts                           | Baseline fixed  | Pass           | Settings v2/native/UI and legacy import tests, two fresh AppData sessions, and native directory/file dialogs.    |
| Table schema         | TableCreator.tsx, ProtoParserService.ts                                  | Baseline fixed  | Pass           | Parse/patch/reparse tests plus native field edit, Table CRUD, and referenced rename/delete cancellation.         |
| Enum schema          | EnumCreator.tsx, ProtoParserService.ts                                   | Baseline fixed  | Pass           | NONE/MAX and source-preservation tests plus native Enum CRUD and referenced deletion cancellation.               |
| Diagram              | DiagramCanvas.tsx, TableNode.tsx                                         | Baseline fixed  | Pass           | Native 9-node/10-edge, MiniMap, search/hover/zoom, compact non-overlap, and interactive drag/pan evidence.       |
| Excel and JSON       | ExcelPanel.tsx, ExcelService.ts, excel.ipc.ts, JsonService.ts            | Baseline fixed  | Pass           | Native collision/read/cancel/diagnostic/resolved JSON E2E plus Excel COM, dropdown, and workbook-open evidence.  |
| Code generation      | CodeGenPanel.tsx, CodeGeneratorService.ts, UnrealCodeGeneratorService.ts | Baseline fixed  | Pass           | Nine-output, cancellation, real failure/stderr E2E, generated snapshots, and interactive output-folder evidence. |
| Windows deployment   | electron-builder                                                         | Baseline fixed  | Pass           | CI NSIS artifact, installed five-second launch, uninstall, profile cleanup, and artifact digest verification.    |

## Historical Legacy Quality Evidence

| Command                                                                | Result                       | Notes                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| node --test tests/legacy-characterization/m0.characterization.test.cjs | Pass, 2 tests before cutover | Parser, Excel, JSON, protoc, Unreal fixture contracts recorded at the reference implementation.                                                                                                                                           |
| npm run legacy:typecheck                                               | Pass                         | Existing Electron TypeScript projects type-check.                                                                                                                                                                                         |
| npm run legacy:lint                                                    | Fail                         | Existing baseline errors include the unused ProtoParserService filename parameter and React set-state-in-effect rules in ExcelPanel and SettingsPanel. These are baseline debt, not Tauri gates.                                          |
| Legacy packaged app smoke                                              | Fail                         | dist/win-unpacked/data-manager.exe exited during a hidden five-second launch attempt with exit code -36861. This does not prevent source-service characterization; M8 needs a clean Tauri installer smoke on a clean Windows environment. |

## Historical Manual Baseline Routes

These routes describe the reference revision and remain for historical
comparison. Electron source is available at the baseline commit, not in the
final active branch.

| Flow                | Procedure                                                                                                 | Observable result                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Settings and reload | Select Proto, Excel, JSON directories; save; restart.                                                     | Paths persist and valid Proto files load automatically.                                         |
| Table CRUD          | Add a table, add/reorder fields, choose types, save, edit, and delete.                                    | Target Proto reparses; existing field numbers must be observed for later migration comparison.  |
| Enum CRUD           | Create/edit/delete Enum values and omit NONE/MAX once.                                                    | Validation prevents duplicate names/numbers and adds NONE/MAX according to legacy rules.        |
| Diagram             | Load fixture and inspect reference relationships.                                                         | Nodes, edges, search dimming, hover emphasis, pan/zoom, MiniMap, and Enum detail are available. |
| Excel and JSON      | Generate selected workbooks, choose backup/overwrite behavior, enter values, then export selected sheets. | Workbook sheets and dropdowns work; JSON preserves legacy reference shapes.                     |
| Code generation     | Configure protoc and output directories; run one language and Unreal.                                     | Generated outputs and failures are surfaced to the user.                                        |

## Final Cutover Evidence

- Windows workflow run
  [`29089116827`](https://github.com/hhhhm8826/DataManager/actions/runs/29089116827)
  passed all TypeScript, Rust, native E2E, NSIS, install/launch/uninstall, and
  artifact-upload steps for commit `61208cea2e6a69d5b295c6f7fece02017e91a26e`.
- The installer artifact ZIP digest is
  `7778CE22083A80761F9B4BF12F0916057E44F48CC006965667A3611085041F13`.
  Its single installer is 2,465,105 bytes with SHA-256
  `A833537C4EFEB09663714A00C2CBFAD0AA88292F27E3B0CBC500C6EBA8086E5F`.
- The interactive artifact ZIP digest is
  `132D2EF60D05D55FFCB4E951BC02558A479881C0D6DBBD17602EB9B68C107FD6`.
  Both contained reports pass all six normal-session checks.
- Electron packages, source processes, IPC, build configuration, npm lockfile,
  and legacy scripts are absent from the final active build. Rollback uses a
  separate worktree at the baseline commit.
- Final cutover commit
  `e2bd9537774b1c1cbf844ad4dab976c1011d4914` passes locked install, all
  TypeScript/Rust gates, four native E2E specs, normal NSIS packaging, and
  install/launch/uninstall from a `git archive` clean source tree. The user
  explicitly skipped a post-cutover hosted workflow run.
