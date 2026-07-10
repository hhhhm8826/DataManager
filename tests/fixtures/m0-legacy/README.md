# M0 Legacy Fixture

This fixture is the baseline contract for the Tauri rewrite. It is intentionally
small and internally coherent; do not substitute files from examples without a
separate characterization record.

The characterization test performs this sequence:

1. Parse proto.
2. Generate KeyTable.xlsx and ReferenceTable.xlsx using the legacy Excel
   service.
3. Insert data.json rows into the generated sheets.
4. Read sheets using the legacy Excel service.
5. Resolve references using the legacy JSON export resolver.
6. Compare RootTarget.json and Unreal generator SHA-256 snapshots.

No binary XLSX fixture is checked in. The generated workbook is part of the
test, which makes its structure and values reproducible from source.
