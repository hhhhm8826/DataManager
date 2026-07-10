# DataManager

DataManager is a Windows x64 desktop application for managing Proto schemas,
generating and validating Excel workbooks, exporting resolved JSON, visualizing
schema relationships, and generating application code. The production runtime
is Tauri 2 with a React and TypeScript frontend; Rust is limited to native file,
path, process, and atomic-write boundaries.

## Features

- Source-preserving Proto Table and Enum CRUD with legacy `// @PK` and
  `// @Key` compatibility.
- Searchable relationship diagram with persisted layout and file colors.
- Excel workbook generation, dropdown validation, collision choices, backup,
  progress, cancellation, and structured diagnostics.
- Deterministic JSON dependency closure and reference inlining.
- protoc output for C++, C#, Java, Python, Go, Rust, Ruby, and PHP.
- Unreal `DataTables.h` and loader generation.
- Versioned settings with reviewed, one-time legacy `config.json` import.

## Requirements

- Windows x64 with Microsoft Edge WebView2.
- Node.js 24 or newer.
- pnpm 11.10.0.
- Rust stable 1.97.0 or newer with `rustfmt` and `clippy`.
- Microsoft Excel only for the optional interactive workbook smoke test.

No global Tauri CLI, EdgeDriver, protoc plugin, or Electron installation is
required. Project dependencies and the example `protoc.exe` are repository
managed.

## Development

```powershell
pnpm install --frozen-lockfile
pnpm tauri:dev
```

The pure domain package is under `packages/core`. The desktop frontend and
native boundary are under `apps/desktop`.

## Verification

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm rust:test
pnpm rust:clippy
pnpm test:e2e
```

`pnpm test:e2e` builds an E2E-only Tauri binary and runs the complete native
workflow plus two fresh AppData sessions. The test-only WDIO permissions and
WebView2 arguments are not present in production builds.

The normal-session Excel and desktop evidence flow is:

```powershell
pnpm interactive:smoke
```

## Windows Installer

```powershell
pnpm tauri:build
pnpm excel:smoke
```

The unsigned NSIS installer is emitted at:

```text
target/release/bundle/nsis/DataManager_0.1.0_x64-setup.exe
```

Code signing and release publication are intentionally outside the rewrite
goal. The committed Windows workflow builds, installs, launches, uninstalls,
and uploads the installer and interactive evidence.

## Fixtures

The coherent rewrite examples live under `examples/TAURI_REWRITE`, separate
from stale legacy examples. Recreate and verify them with:

```powershell
pnpm fixtures:rewrite
pnpm fixtures:rewrite:check
```

The M0 legacy observations remain under `tests/fixtures/m0-legacy` as immutable
goldens. The active branch contains no Electron runtime or build path.

## Settings And Migration

- [Settings guide](docs/settings.md)
- [Migration and rollback](docs/migration.md)
- [Interactive smoke procedure](docs/interactive-smoke.md)
- [Parity evidence](docs/parity-matrix.md)
- [Rewrite progress](docs/rewrite-progress.md)

## Rollback

The pre-rewrite Electron reference remains available at commit
`3a4ba6ec652d750d88c88dcc9af8ada13b6eb169`. Create a separate worktree so the
Tauri workspace and user data remain untouched:

```powershell
git worktree add ..\DataManager-electron 3a4ba6ec652d750d88c88dcc9af8ada13b6eb169
Set-Location ..\DataManager-electron
npm ci
npm run build:win
```

The Tauri importer never modifies the legacy `config.json`, Proto, Excel, JSON,
or generated-code files. Removing `settings.v2.json` resets only Tauri settings.
