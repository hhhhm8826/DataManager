# Copilot Instructions - DataManager

## Architecture

DataManager is a Tauri 2 Windows desktop application.

- `packages/core`: pure TypeScript schema, Proto, validation, Excel planning,
  reference resolution, JSON, and generator logic. Do not import DOM, Node, or
  Tauri APIs here.
- `apps/desktop/src`: React UI, feature use cases, workers, and adapters.
- `apps/desktop/src-tauri`: narrow Rust commands for settings, canonical path
  checks, file I/O, atomic replacement, backup, opening paths, and protoc.
- `tests/fixtures/m0-legacy`: immutable legacy behavior goldens.
- `examples/TAURI_REWRITE`: reproducible outputs from the new implementation.

The active branch has no Electron compatibility layer, main/preload process, or
Node sidecar.

## Boundaries

- React components call feature use cases or native port interfaces, never the
  filesystem or child processes directly.
- Native responses and persisted settings are validated at the TypeScript
  boundary.
- Rust commands accept purpose-specific DTOs. Never pass arbitrary shell
  strings; protoc uses an executable and argument array.
- File writes stage, flush, and atomically replace within configured canonical
  roots. Preserve originals on failure.
- E2E-only WDIO plugins, capabilities, settings overrides, and WebView2 flags
  must remain behind the Cargo `e2e` feature and E2E Tauri config.

## Compatibility

- Display `// @PK` behavior as `기본키` and `// @Key` behavior as `합성키`.
- One or more primary-key fields reject empty values and duplicate tuples.
- Legacy group keys resolve matching rows as arrays.
- Primary-key and group-key modes are mutually exclusive.
- Preserve unrelated Proto declarations, comments, imports, and existing field
  numbers during edits.
- Legacy relative paths resolve from the source `config.json` directory.

## Tooling

- Use pnpm 11.10.0 and the committed lockfile.
- Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` for
  TypeScript changes.
- Run Cargo fmt, test, and Clippy for Rust changes.
- Run `pnpm test:e2e` for native workflow or boundary changes.
- Keep text files LF-normalized and binary fixture extensions marked in
  `.gitattributes`.
