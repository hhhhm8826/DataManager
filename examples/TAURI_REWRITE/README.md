# Tauri Rewrite Generated Examples

These files are regenerated from `tests/fixtures/m0-legacy/proto` by the new
Tauri rewrite domain and adapters. They are intentionally separate from the
legacy `examples/CODE`, `examples/EXCEL`, and `examples/JSON` directories,
which contain outputs from different schema revisions.

Run `pnpm fixtures:rewrite` to replace this directory and
`pnpm fixtures:rewrite:check` to verify its manifest. All eight protoc
languages use bundled `libprotoc 34.1`; Go additionally uses the committed
`protoc-gen-go`, while Rust opts into protoc's experimental upb codegen.
