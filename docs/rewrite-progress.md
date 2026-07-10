# DataManager Tauri Rewrite Progress

## M0: Baseline and Contract

Status: complete

- `tests/fixtures/m0-legacy` is the coherent compatibility fixture.
- Before cutover, the Electron parser, XLSX, JSON, C++ protoc, and Unreal
  behavior was recorded by the M0 characterization suite at the reference
  commit. The active branch verifies those observations with
  `tests/baseline/m0-golden.test.cjs` and the replacement core/native suites.
- `docs/parity-matrix.md`, `docs/migration.md`, and ADR 0001 separate required
  compatibility from known legacy defects.

## M1: Tauri Skeleton and Technology Spike

Status: complete, including native WebView and default AppData restart smoke

Completed:

- pnpm/Cargo workspaces, strict TypeScript, React/Vite/Tauri 2 skeleton, narrow
  native adapter, structured errors, minimal dialog capability, and locked
  dependencies.
- ExcelJS worker spike with two sheets, header styles, cross-message dropdown,
  10,000-row validation ranges, and binary round-trip evidence (ADR 0002).
- React Testing Library and browser/native adapter tests.
- Official `@wdio/tauri-service` embedded provider. The optional
  `tauri-plugin-wdio` and `tauri-plugin-wdio-webdriver` Rust plugins plus the
  frontend guest plugin are compiled only for Cargo feature/Vite mode `e2e`, so
  execute/focus support and the WebDriver HTTP server are absent from normal
  release/installer builds.

Current evidence:

| Gate                                                       | Result                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                           | Pass with pnpm 11.10.0.                                                        |
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck`         | Pass.                                                                          |
| JavaScript tests                                           | Core 41, desktop 31, and M1-M8 contract suites pass.                           |
| `cargo test --all-features`                                | Pass: 24 native tests.                                                         |
| `cargo clippy --all-targets --all-features -- -D warnings` | Pass.                                                                          |
| Tauri release no-bundle build                              | Pass at `target/release/datamanager-desktop.exe`.                              |
| Embedded WebDriver server                                  | `/status` reports `ready:true`; test-only WDIO execute/focus commands respond. |
| Native E2E                                                 | Pass: four specs; M1 403 ms, M8 23.7 s, AppData save 1 s/reload 649 ms.        |

`pnpm test:e2e` builds the isolated test binary and caches the matching driver
in `.e2e-runtime`; it does not require `tauri-driver` or a manually installed
MSEdgeDriver.

## M2: Settings, Paths, and File Boundary

Status: complete, including default AppData restart, legacy import, and native dialogs

Completed:

- Settings v2 schema with `protoRoot`, `excelRoot`, `jsonRoot`,
  `protocExecutable`, per-language `codegenOutputs`, nested diagram settings,
  and a one-time legacy import record.
- Candidate discovery, dry-run diagnostics, legacy-base-relative resolution,
  and atomic one-time import for the existing Electron `config.json`.
- Full settings UI for roots, protoc, outputs, file colors, diagram limit, and
  dry-run-before-commit migration.
- Root-derived native binary read, atomic write, backup, and open commands.
  Existing paths and missing write descendants share one canonical boundary.
- No broad filesystem or shell capability. The OS opener uses an executable
  plus a validated path argument, never a shell command string.

Automated evidence:

- Current `config.json` imports all seven top-level settings without loss.
- Unicode, whitespace, long missing paths, wrong/missing/read-only states, and
  duplicate output languages are covered.
- Re-import is rejected and a malformed import leaves prior settings bytes
  unchanged.
- Outside-root and traversal requests are rejected.
- Injected settings/file replacement failures preserve the original bytes and
  remove staging files.
- UI tests prove preview is shown before the import command is invoked.
- Native E2E discovers the repository's actual `config.json`, renders its
  dry-run path checks, imports it only into isolated E2E settings, verifies the
  legacy `golang` output without field loss, and proves the source bytes remain
  unchanged.
- A separate pair of native E2E sessions removes the test-only settings-path
  override, saves through Tauri's default AppData location, starts a fresh app
  process, and verifies all roots plus the diagram limit are restored. The
  isolated AppData profile and workspace are removed after the run.

The managed service desktop cannot complete this gate: a test-only probe
cleared the Proto root, invoked the real directory picker, and received no
selection for 60 seconds while Win32 enumeration reported no visible top-level
window. The probe was removed after confirming the interactive-session boundary.
The subsequent normal-session interactive smoke passed both native directory
and protoc-file selection, closing the environment-specific gate.

## M3: Proto Domain and Table/Enum CRUD

Status: implementation, automated gates, and native CRUD/impact smoke complete

Completed:

- Span-based lexer/parser/patcher for proto3 syntax, package, go_package,
  imports, messages, enums, fields, options, and legacy `@PK`/`@Key`
  annotations.
- Unsupported grammar and invalid existing names/numbers become read-only with
  concrete diagnostics instead of being rewritten.
- Target-only message/Enum update and deletion, deterministic import insertion,
  field-number preservation, automatic new field numbering, and Enum NONE/MAX
  normalization.
- Multi-file workspace indexing, duplicate-symbol diagnostics, type source
  discovery, and deterministic reference impact analysis.
- Configured-root-only native Proto listing plus UTF-8-fatal file loading and
  atomic native writes.
- Default schema workspace UI with search, table/Enum create/update/delete,
  field reorder/type/cardinality/key controls, read-only state, and rename/delete
  impact confirmation.

Automated evidence:

- Core: 23 tests cover the M0 snapshot, CRLF and raw spans, unsupported syntax,
  invalid existing fields, patch/reparse, outside-target bytes, field numbers,
  imports, annotations, Enum sentinels, duplicate symbols, and impacts.
- Desktop: 13 tests cover the native adapter, UTF-8 rejection, settings, Excel
  spike, message rename/delete impact/save, Enum file creation, key-mode
  annotation changes, and read-only UI.
- Rust: 14 tests include deterministic non-recursive `{Name}Table.proto` and
  `{Name}EnumType.proto` discovery within the configured root.
- `tests/tauri-rewrite/m3-proto-domain.test.cjs` locks the core/native/UI
  architecture into the root test command.
- Native E2E persists a field edit; previews and cancels referenced Message
  rename/delete without changing source bytes; creates and deletes a temporary
  Table; creates, updates, and deletes an Enum with NONE/MAX normalization; and
  previews/cancels deletion of a referenced Enum. Test-only files are removed.

Remaining gate: none.

## M4: Schema UI and Relationship Diagram

Status: complete, including native graph interactions, drag/pan, and compact layout

Completed:

- Deterministic pure graph model with Message/Enum nodes, typed field edges,
  unresolved-reference diagnostics, neighbor discovery, and configured
  max-nodes-per-column layout.
- React Flow relationship diagram with drag, pan/zoom, auto-fit/reset,
  MiniMap, search dimming, neighbor hover emphasis, edge field labels on hover,
  file colors, and expanded Enum value details.
- Separate relationship, table, Enum, Excel, code generation, and settings work
  areas. The table and Enum areas reuse the source-preserving M3 editor in
  focused modes.
- Keyboard-operable work-area navigation and a single mutually exclusive key
  control with exact primary-key/group-key compatibility help.
- React Flow is loaded as a separate production chunk; the initial app chunk is
  251 kB and the diagram chunk is 182 kB before gzip.

Automated evidence:

- Core: 26 tests, including the exact M0 fixture set of 9 nodes and 10 edges,
  deterministic layout, cycles, Enum references, neighbors, and unresolved
  reference diagnostics.
- Desktop: 15 tests, including relationship rendering, Enum details, search
  dimming, all six work areas, keyboard activation, mutually exclusive key
  modes, and settings recovery through a fresh NativePort instance.
- `tests/tauri-rewrite/m4-schema-diagram.test.cjs` locks graph, interaction, and
  navigation architecture into the root test command.
- Production Vite build passes without the prior oversized-chunk warning.
- Native E2E verifies MiniMap rendering, search dimming, RootTarget neighbor
  hover emphasis, edge-label hover, and zoom transform changes.
- The product window minimum width is 520 px, so its 640 px responsive rules
  are reachable. Native E2E resizes the actual Tauri window to 600 x 800 and
  verifies no body overflow or header/toolbar/canvas overlap before restoring
  the desktop size.

Interactive evidence:

- Native E2E covers MiniMap, search, hover labels/emphasis, zoom, and the
  600 x 800 compact layout. Four embedded-WebDriver drag input strategies did
  not produce a React Flow position event, but the normal-session interactive
  smoke passed both node drag and canvas pan.

## M5: Excel Generation and Reading

Status: complete, including native generation/read/collision and Microsoft Excel inspection

Completed:

- Pure workbook plans group selected Messages by Proto source file and carry
  field order, key mode, Enum values without MAX, and Message key references.
- ExcelJS adapter creates one workbook per Proto file, one sheet per Message,
  styled/frozen headers, bounded column widths, a very-hidden Enum source
  sheet, and Enum/Message validations through data row 10,001 (10,000 rows).
- Product worker generates and reads workbook binaries outside the UI thread,
  transfers generated buffers, reports progress, and is terminated immediately
  on cancellation.
- Workbook reading normalizes primitive, formula, hyperlink, rich-text, and
  blank cells before pure schema validation.
- Diagnostics include file, sheet, row, column, and header for unknown/missing
  headers, type mismatches, missing sheets, and empty required keys.
- Excel work area supports Proto selection, existing-file discovery, read
  validation, progress/cancel, file open, and all collision paths: cancel,
  overwrite without backup, or timestamp backup before atomic replacement.
- Native backup names use `backup/{Name}_YYYYMMDDHHmmss.xlsx`. Windows existing
  targets use `MoveFileExW` with replace-existing and write-through flags.

Automated evidence:

- Core: 29 tests, including M0 workbook plans and location-rich invalid input
  diagnostics that gate later JSON export.
- Desktop: 24 tests, including binary workbook round-trip, header styles,
  hidden dropdown values, same-workbook references, 10,000-row progress,
  all collision paths, and worker cancellation without partial writes.
- Rust: 16 tests, including deterministic Excel discovery, backup naming, and
  real platform replacement of an existing file.
- `tests/tauri-rewrite/m5-excel-workflow.test.cjs` locks workbook, worker,
  collision, and native replacement architecture into the root test command.
- `scripts/windows-excel-smoke.ps1` parses successfully and targets installed
  Excel `16.0.20131.20112`. It verifies both workbooks, very-hidden dropdown
  sheets, frozen headers, and Enum/Message validations at rows 2 and 10,001.
  The managed Codex token cannot activate Excel COM (`0x80070520`), so this
  script must run from a normal signed-in Windows PowerShell session.
- Native E2E covers collision cancel, overwrite without backup, backup then
  overwrite, two timestamped backup files, worker reads of both populated
  workbooks, and exact valid sheet/row counts.
- Native E2E also starts a 10,000-row worker read, cancels it within the
  ten-second bound, then injects an invalid `SingleTarget!A2` value and verifies
  `EXCEL_CELL_TYPE_MISMATCH` at `R2C1` before restoring the original bytes.

Interactive evidence:

- Microsoft Excel 16.0 opened and validated both rewrite workbooks in the normal
  signed-in session. The interactive smoke also passed Enum/Message dropdowns
  through row 10,001, collision choices, and workbook file-open actions.
- Native E2E covers worker cancellation, invalid-input diagnostics, both
  generated workbooks, all collision choices, backup files, and successful
  populated reads.

## M6: JSON Export and Reference Resolution

Status: implementation and populated native dependency export complete

Completed:

- Pure recursive dependency collection with deterministic dependency-first
  ordering and explicit cycle paths.
- Required primary/group-key validation and full primary-key tuple duplicate
  detection before reference resolution.
- Single primary-key references inline one object. Legacy multiple-`@PK`
  references match the first PK and inline an array; legacy `@Key` group
  references inline all matching rows as an array.
- Multi-level references reuse already resolved rows. Missing data, missing
  targets, duplicate targets, no-key targets, and cycles return file/Message/
  field/row diagnostics and emit no files.
- Message rows serialize in schema field order as 2-space JSON arrays with a
  final newline; repeated runs are byte-identical.
- Excel work area supports Message-level JSON selection, recursively reads all
  required workbooks in the worker, validates every sheet first, and only then
  writes dependency JSON files through the configured atomic native boundary.

Automated evidence:

- Core: 34 tests, including the M0 single/composite/group/multi-level shapes,
  tuple duplicates, empty keys, missing and no-key targets, deterministic
  cycles, and repeated byte-identical serialization.
- Desktop: 26 tests, including successful JSON bytes and zero writes when an
  input workbook contains an empty required key.
- `tests/tauri-rewrite/m6-json-export.test.cjs` locks the pure resolver and
  validate-before-write UI sequence into the root test command.
- Native E2E populates both generated workbooks, validates ten rows across eight
  sheets, exports RootTarget with dependency closure, and asserts single object,
  composite/group arrays, nested MiddleTarget, null no-key value, Enum name, and
  final newline.

Remaining gate: none.

## M7: protoc and Unreal Code Generation

Status: complete, including all-language fixtures, native nine-output smoke, and output opening

Completed:

- Exact allowlisted definitions for C++, C#, Java, Python, Go, Rust, Ruby, and
  PHP, including legacy `golang` normalization, explicit Go plugin discovery,
  and bundled Rust upb codegen options.
- Native `protoc` execution uses an executable plus argument array and a fixed
  Proto working directory. It captures executable, arguments, cwd, stdout,
  stderr, exit code, and target output in structured results.
- Native protoc work runs in Tauri's blocking task pool so the WebView remains
  responsive and a current-process-then-stop cancellation request can be
  handled while generation is active.
- Each protoc run generates into a unique sibling staging directory. A failed
  process removes staging without changing the existing target; success swaps
  the complete directory with rollback on promotion failure. Output paths that
  contain the Proto root are rejected.
- Pure TypeScript Unreal generation for source-file Enum headers,
  `DataTables.h`, and `DataTableLoader.h/.cpp`, with dependency ordering,
  cycle-safe shared pointers, Base64 byte parsing, repeated values, uint8 Enum
  validation, stable newlines, and corrected Enum symbol prefixes/loader name.
- Unreal files cross one narrow native batch boundary that validates leaf file
  names, stages and flushes every file, and only then replaces the configured
  output directory.
- Code generation UI shows all nine targets, configured paths, protoc/plugin
  readiness, per-target and all-configured execution, current-process-then-stop
  cancellation, output-folder open actions, and structured process logs.
- Settings uses a fixed language selector for all eight protoc languages and
  Unreal while retaining visible legacy values for migration compatibility.

Automated evidence:

- Core: 41 tests, including eight-language contracts, corrected normalized
  Unreal fixture hashes, declaration order, cycles, unresolved types, Enum
  range, and primitive/repeated/bytes/Enum/Message parse generation.
- Desktop: 31 tests, including individual/all generation, Unreal batch handoff,
  cancellation between native runs, plugin missing state, stdout/stderr/exit
  display, and code-output selection.
- Rust: 24 tests, including exact C++ and Rust arguments/cwd, error forwarding,
  complete directory promotion, Proto-root safety, and transactional Unreal
  batch validation/replacement.
- `tests/tauri-rewrite/m7-code-generation.test.cjs` locks the pure/native/UI
  boundaries into the root test command.
- Repository `libprotoc 34.1` generates committed output for all eight protoc
  languages from the coherent M0 Proto set. Go additionally uses the committed
  `protoc-gen-go`; Rust passes
  `--rust_opt=experimental-codegen=enabled,kernel=upb` and produces four files.
- Native E2E generates and checks all eight protoc languages plus Unreal through
  the real Tauri command boundary. It also verifies current-process-then-stop
  cancellation and a structured real-protoc failure with stderr.

Interactive evidence:

- The normal-session interactive smoke passed protoc and Unreal output-folder
  opening. Native E2E covers all nine configured outputs, failure display, and
  cancellation.

## M8: Integration, Packaging, and Cutover

Status: complete

Completed:

- Test-only settings path injection is compiled exclusively with Cargo feature
  `e2e`. WDIO prepares an isolated `.e2e-workspace` from the coherent M0 Proto
  fixture and never edits repository examples.
- `tauri.e2e.conf.json` grants WDIO/core test permissions only to the E2E build;
  the normal application continues to use the minimal dialog-only capability.
- Windows E2E sets WebView2 `--no-sandbox` only on the test process. The managed
  Codex token cannot start WebView2's Chromium sandbox; direct probes proved
  that `--disable-gpu` alone remains unready while `--no-sandbox` starts the
  webview. Normal binaries and installers do not receive this environment flag.
- The native core-flow E2E covers settings persistence, a source-preserving
  schema edit plus Table/Enum CRUD and impact cancellation, exact relationship
  node/edge counts, interactions, and compact-window layout, Excel collision/
  backup/populated reads, resolved dependency JSON, all eight actual protoc
  outputs, transactional Unreal output, failure/cancellation, and generated-file
  checks.
- The same E2E discovers the real repository `config.json`, displays the dry-run
  result, imports it into isolated settings, verifies resolved paths and the
  legacy `golang` entry, and confirms the source file is unchanged.
- Two additional native sessions use an isolated user profile without the
  test-only settings override. The first writes `settings.v2.json` through the
  default AppData path; the second process reloads the saved roots and diagram
  limit, after which the profile and workspace are deleted.
- EdgeDriver is pinned as a project dev dependency and cached under
  `.e2e-runtime`. A minimal pnpm patch makes `@wdio/tauri-service` recognize the
  Edge 150 `Microsoft Edge WebDriver` version string as well as the older
  `MSEdgeDriver` form. It also splits multi-path Windows `where` output with
  CRLF-safe trimming, which is required on GitHub-hosted runners that already
  expose another driver. No global driver install is needed.
- Windows GitHub Actions runs locked install, format/lint/typecheck/tests, Cargo
  test/clippy, embedded WebDriver E2E, normal-feature NSIS build, silent
  install/launch/uninstall smoke, and separate installer/manual-evidence artifact
  uploads.
- Tauri `bundle.useLocalToolsDir` caches NSIS under `target/.tauri`, avoiding
  restricted user-cache directories and keeping CI/local behavior aligned.
- A normal-feature Windows x64 NSIS installer was built successfully. The
  normal release binary contains no WDIO plugin marker.
- `pnpm interactive:smoke` runs the Excel COM structure check, launches the
  normal release app with an isolated temporary AppData profile and copied Proto
  workspace, prompts for the five remaining UI checks, safely cleans both
  temporary roots, and writes a versioned JSON evidence report under `artifacts/`.
- Normal-session reports `interactive-smoke-20260710-183925.json` and
  `interactive-smoke-20260710-183954.json` both pass all six checks on Windows
  10.0.26200, PowerShell 7.5.8, WebView2 150.0.4078.48, and Excel
  16.0.20131.20112. Their application SHA-256
  `C998B471C798014CF04F8EF8701F758E040FEFD27BBA8B428E69062CF6078B7D`
  identifies the normal release executable used for those interactive runs.
- `pnpm fixtures:rewrite` regenerates the coherent Proto sources, two Excel
  workbooks, six dependency JSON files, eight actual protoc language outputs,
  and Unreal output under `examples/TAURI_REWRITE`. It never overwrites stale
  legacy examples. `pnpm fixtures:rewrite:check` verifies 51 text hashes and
  workbook structure against `tests/fixtures/m8-rewrite/manifest.json` and is
  part of the root test command.
- Windows workflow run
  [`29089116827`](https://github.com/hhhhm8826/DataManager/actions/runs/29089116827)
  passed every locked install, TypeScript, Rust, native E2E, NSIS,
  install/launch/uninstall, and artifact upload step for commit
  `61208cea2e6a69d5b295c6f7fece02017e91a26e`.
- After the CI and artifact gates passed, the active Electron main/preload IPC,
  renderer, package dependencies, electron-vite/electron-builder configuration,
  npm lockfile, legacy scripts, and stale IDE instructions were removed. The M0
  observations remain as immutable golden fixtures and rollback remains
  available at the reference commit.

Local package evidence:

| Evidence                     | Result                                                             |
| ---------------------------- | ------------------------------------------------------------------ |
| Installer                    | `target/release/bundle/nsis/DataManager_0.1.0_x64-setup.exe`       |
| Installer size               | 2,465,650 bytes                                                    |
| Installer SHA-256            | `9CEC601B8BB98F937B9B1DDB40C266B883019CC015142D11CE417CE8AAC906B2` |
| Signature                    | Not signed; signing is explicitly outside the goal boundary        |
| Release executable           | 9,840,640 bytes, product version 0.1.0                             |
| Installer creation           | Pass with NSIS 3.11 local tools cache                              |
| Silent install and uninstall | Pass; no install directory or new temporary profile remains        |
| Installed app launch         | Pass: installed process remained running for the five-second gate  |

Automated evidence:

- Core 41, desktop 31, Rust 24, and M1-M8 root contract tests pass.
- Format, lint, strict TypeScript, production Vite build, Cargo fmt/test/clippy,
  normal release no-bundle build, and NSIS bundling pass.
- The matching EdgeDriver 150.0.4078.48 downloads and validates through the
  project-local setup. Root `pnpm test:e2e` passes four native specs: settings
  rendering, the complete settings/schema/diagram/Excel/JSON/codegen flow, and
  default-AppData save/reload across two fresh application processes.
- A subsequent normal NSIS build contains no `wdio-webdriver`, `plugin:wdio`,
  `wdioTauri`, `TAURI_WEBDRIVER_PORT`, or `--no-sandbox` marker in its binary or
  frontend dist.
- Bundled `libprotoc 34.1` generates C++, C#, Java, Python, Go, Rust, Ruby, and
  PHP rewrite examples. Rust's experimental upb options and actual files are
  covered by the fixture harness and native E2E.

CI artifact evidence:

| Evidence                    | Result                                                             |
| --------------------------- | ------------------------------------------------------------------ |
| Workflow                    | Run `29089116827`, success                                         |
| Installer artifact          | `DataManager-windows-x64-nsis`, 2,446,690-byte ZIP                 |
| Installer artifact digest   | `7778CE22083A80761F9B4BF12F0916057E44F48CC006965667A3611085041F13` |
| Installer inside artifact   | `DataManager_0.1.0_x64-setup.exe`, 2,465,105 bytes                 |
| Installer SHA-256           | `A833537C4EFEB09663714A00C2CBFAD0AA88292F27E3B0CBC500C6EBA8086E5F` |
| Interactive artifact        | `DataManager-interactive-smoke`, 1,300-byte ZIP                    |
| Interactive artifact digest | `132D2EF60D05D55FFCB4E951BC02558A479881C0D6DBBD17602EB9B68C107FD6` |
| Interactive reports         | Two reports, all six checks pass                                   |

Remaining gate: run the Windows workflow from a clean checkout after the final
Electron-removal commit is pushed. All final-cutover checks pass locally; the
user retains commit ownership.
