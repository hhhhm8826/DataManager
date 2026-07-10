# M0 Legacy Fixture

This fixture is the baseline contract for the Tauri rewrite. It is intentionally
small and internally coherent; do not substitute files from examples without a
separate characterization record.

Before cutover, the legacy characterization test performed this sequence against
the Electron services at reference commit
`3a4ba6ec652d750d88c88dcc9af8ada13b6eb169`:

1. Parse proto.
2. Generate KeyTable.xlsx and ReferenceTable.xlsx using the legacy Excel
   service.
3. Insert data.json rows into the generated sheets.
4. Read sheets using the legacy Excel service.
5. Resolve references using the legacy JSON export resolver.
6. Compare RootTarget.json and Unreal generator SHA-256 snapshots.

No binary XLSX fixture is checked in. The generated workbook is part of the
recorded characterization. After the verified Tauri cutover removed Electron
from the active branch, `tests/baseline/m0-golden.test.cjs` keeps these schema,
JSON, and normalized Unreal observations immutable. The new core, adapter,
fixture-regeneration, and native E2E suites verify the replacement behavior.
