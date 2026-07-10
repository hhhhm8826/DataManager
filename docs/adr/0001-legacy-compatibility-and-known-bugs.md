# ADR 0001: Legacy Compatibility and Intentional Corrections

## Status

Accepted for the Tauri rewrite.

## Context

The Electron implementation is the compatibility source, but not every
implementation detail is a product contract. The rewrite must preserve data
meaning and file readability while correcting demonstrated data-loss,
correctness, and security defects.

## Decisions

1. Preserve // @PK and // @Key annotations in Proto files.
2. Rename every user-facing PK label to 기본키 and every Key label to 합성키.
3. Preserve old Key group semantics. A matching group key produces an array
   when referenced. Do not reinterpret it as a multi-column unique key.
4. Preserve the legacy multiple-@PK JSON reference shape through a golden
   test before deciding on a migration path.
5. Use tests/fixtures/m0-legacy rather than examples as the golden source.
6. Keep the Electron implementation available until every M8 parity gate
   passes.

## Baseline Behaviors to Preserve

| Behavior | Evidence |
| --- | --- |
| Single primary key reference becomes one inline object. | RootTarget.json |
| Multiple primary key reference is matched on the first key and becomes an array. | RootTarget.json |
| Group key reference becomes an array. | RootTarget.json |
| Enum _MAX is excluded from Excel dropdown values. | M0 characterization test |
| JSON uses two-space indentation and a final newline. | RootTarget.json |
| Relative paths resolve from the legacy app root. | SettingsService.ts and config.json |

## Known Baseline Defects to Correct

| Defect | Baseline evidence | Rewrite policy |
| --- | --- | --- |
| Field reorder renumbers existing fields. | TableCreator constructs field numbers from the current visual index. | Preserve existing field numbers and allocate new values after the current maximum. |
| Proto update deletes then appends blocks. | ProtoParserService update and remove methods. | Use a source-preserving parser and patcher; unrelated declarations, imports, comments, and line endings must remain byte-identical. |
| Excel message validation has a 20-row candidate limit. | ExcelService MAX_DROPDOWN_ROWS. | Support the actual required range without the 20-row cap. |
| Missing references, no-key references, and cycles are silent or partial. | excel.ipc.ts resolver and M0 fixture. | Return deterministic diagnostics with file, Message, field, and row locations; never produce order-dependent JSON. |
| Writes are direct and can partially replace output. | ProtoParserService, JsonService, ExcelService. | Use same-directory temp files, flush, and atomic replace; preserve originals on failure. |
| Legacy path handling has no root-boundary validation. | SettingsService and IPC handlers. | Canonicalize paths and permit only approved roots selected by the user or migration flow. |
| Legacy IPC returns unstructured strings. | shared/types.ts IpcResult. | Use structured native error DTOs: code, message, context. |
| Unreal output has known correctness issues. | Goal document and legacy output. | Do not clone documented generator bugs; record intentional output changes with new snapshots. |

## Consequences

The new core package can be designed independently of Electron, but all
observable behaviors in the preserve table need a contract test before the
legacy source is removed. Any intentional difference must be listed in this
ADR or a successor ADR and in the final parity report.
