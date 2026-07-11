# D1000-D1012 Contract Fixture

`긴 한글 경로/PROTO` is the shared G0 project fixture. It intentionally covers:

- a seven-neighbor hub and satellites for D1002/D1003;
- an Enum reference and metadata-free Enum source for D1001;
- direct self references for D1008;
- existing `optional` and `repeated` syntax that must remain source-preserving;
- an Excel-only memo column, key policy, threshold, and saved layout in
  `.datamanager/workspace.json`;
- spaces and Korean characters in the containing filesystem path.

The `.datamanager` directory is product data, not a Proto input. Native listing,
diagram parsing, imports, and code generation must only see the direct `*.proto`
files.
