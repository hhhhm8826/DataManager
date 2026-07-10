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
The real legacy `config.json` import remains covered by native preview/import
tests; the full installed-app migration UI remains an interactive desktop gate.

## Installer and Cutover

The Windows bundle target is NSIS current-user mode. CI and
`scripts/windows-installer-smoke.ps1` use a unique temporary install directory,
launch the installed `datamanager-desktop.exe` with an isolated writable
AppData profile, invoke the generated `uninstall.exe`, and require the installed
executable and temporary profile to be removed. The local managed session passes
the install, five-second process launch, uninstall, and cleanup smoke.

The Electron implementation is intentionally still present. It must not be
removed from the active branch until Excel manual inspection, the real
legacy-import UI smoke, and the Windows workflow all pass. Native E2E and the
installed process launch gate now pass locally.

## Rollback

Until M8, the Electron source and its packaged artifact remain available.
Removing the new Tauri `settings.v2.json` resets only the new application. It
does not modify the legacy config or user data.
