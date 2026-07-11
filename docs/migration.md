# DataManager Migration Guide

## Settings v2

The Tauri application stores `settings.v2.json` in its application data
directory. Writes are staged in the same directory, flushed, and atomically
renamed. A failed parse, validation, migration, or replace leaves the previous
settings file unchanged.

| Legacy field       | Settings v2 field           | Migration rule                                                          |
| ------------------ | --------------------------- | ----------------------------------------------------------------------- |
| `protoDir`         | `protoRoot`                 | Resolve relative to the directory containing legacy `config.json`.      |
| `excelDir`         | `excelRoot`                 | Resolve relative to the legacy config directory.                        |
| `jsonDir`          | `jsonRoot`                  | Resolve relative to the legacy config directory.                        |
| `protocPath`       | `protocExecutable`          | Resolve relative to the legacy config directory and diagnose as a file. |
| `outputDirs`       | `codegenOutputs`            | Preserve every language and resolve every directory independently.      |
| `fileColors`       | `diagram.fileColors`        | Preserve every filename-to-color entry.                                 |
| `diagramMaxPerCol` | `diagram.maxNodesPerColumn` | Preserve as an integer from 1 through 50.                               |

All non-empty v2 paths are absolute. Relative legacy paths are never resolved
from the new executable or current working directory; the source
`config.json` parent remains the authoritative legacy base.

## Import Flow

1. The native application searches its current directory and executable
   ancestors for `config.json`.
2. The settings screen displays the discovered source without changing any
   settings.
3. `preview_legacy_import` returns every input path, resolved path, expected
   kind, and one of `ready`, `missing`, `wrongType`, or `readOnly`.
4. The user explicitly commits the preview.
5. The native command recomputes the preview and writes one settings file with
   a source path and import timestamp.
6. A completed import cannot be repeated.

Only application-discovered `config.json` candidates are accepted by the
preview and commit commands. The legacy source file and all Proto, Excel, JSON,
and generated files remain untouched.

## File Boundary

Native read, atomic write, backup, and open commands derive allowed roots from
`protoRoot`, `excelRoot`, `jsonRoot`, and `codegenOutputs`. Existing paths are
canonicalized. New write targets are checked from their nearest existing
ancestor. Junction/symlink escapes, `..` traversal, relative paths, and paths
outside configured roots are rejected with structured errors.

## Verified Cases

Rust tests cover the repository's current `config.json`, Unicode and spaces,
long missing paths, read-only paths, one-time import, failed import rollback,
outside-root access, traversal, and failed atomic replacement. TypeScript tests
cover runtime schema validation and the UI dry-run-before-commit flow.

The M8 isolated E2E workspace preloads an equivalent settings v2 file and
rechecks persistence after schema, Excel, JSON, and code generation operations.
It also discovers the repository's real `config.json`, exercises preview and
import in the native app, verifies every resolved path, and confirms that the
legacy file remains unchanged.

## Installer and Cutover

The Windows bundle target is NSIS current-user mode. CI and
`scripts/windows-installer-smoke.ps1` use a unique temporary install directory,
launch the installed `datamanager-desktop.exe` with an isolated writable
AppData profile, invoke the generated `uninstall.exe`, and require the installed
executable and temporary profile to be removed.

Windows workflow run
[`29089116827`](https://github.com/hhhhm8826/DataManager/actions/runs/29089116827)
passed locked install, TypeScript and Rust gates, native E2E, normal NSIS build,
installed-app launch, uninstall, and both artifact uploads for commit
`61208cea2e6a69d5b295c6f7fece02017e91a26e`. Its installer artifact contains
`DataManager_0.1.0_x64-setup.exe` (2,465,105 bytes, SHA-256
`A833537C4EFEB09663714A00C2CBFAD0AA88292F27E3B0CBC500C6EBA8086E5F`).

After that gate passed, the Electron package, main/preload IPC, renderer,
electron-vite/electron-builder configuration, npm lockfile, and legacy build
scripts were removed from the active branch. M0 observations remain as immutable
goldens and Git history retains the complete Electron implementation.

The final cutover commit
`e2bd9537774b1c1cbf844ad4dab976c1011d4914` was exported with `git archive` and
verified independently of the working tree. Locked install, TypeScript/Rust
gates, four native WebView E2E specs, normal NSIS build, install, five-second
launch, uninstall, and cleanup all passed. The user chose to skip a
post-cutover GitHub Actions run; run `29089116827` remains the hosted-runner
workflow evidence from immediately before the source removal.

## Rollback

The pre-rewrite Electron reference is commit
`3a4ba6ec652d750d88c88dcc9af8ada13b6eb169`. Restore it in a separate worktree
instead of replacing the Tauri checkout:

```powershell
git worktree add ..\DataManager-electron 3a4ba6ec652d750d88c88dcc9af8ada13b6eb169
Set-Location ..\DataManager-electron
npm ci
npm run build:win
```

Use copies of production workspaces when comparing releases. The Tauri import
flow leaves legacy `config.json` and all workspace files unchanged. Removing the
Tauri `settings.v2.json` resets only the new application's settings and does not
modify legacy configuration or user data.

## Excel Memo Migration

Older D1007 workspaces may contain `tables[*].memoColumns` in
`.datamanager/workspace.json`. These entries remain readable. When that Message
is next saved in the schema editor, DataManager writes each memo as an ordered
`// @Memo(memo-<id>) <name>` directive after the existing fields and removes the
legacy table entry in the same native transaction. Excel and JSON continue to
accept the legacy metadata until this save occurs.
