const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('G0 D1003/D1007/D1009/D1012: project metadata contract is shared across boundaries', () => {
  const core = read('packages/core/src/projectMetadata.ts')
  const nativePort = read('apps/desktop/src/adapters/native/NativePort.ts')
  const tauriPort = read('apps/desktop/src/adapters/native/TauriNativePort.ts')
  const rust = read('apps/desktop/src-tauri/src/commands/project_metadata.rs')

  assert.match(core, /WORKSPACE_METADATA_VERSION = 1/)
  assert.match(core, /primaryKeyTypePolicy/)
  assert.match(core, /hubThreshold/)
  assert.match(core, /savedLayout/)
  assert.match(core, /applyWorkspaceMetadataSectionUpdate/)
  assert.match(nativePort, /loadWorkspaceMetadata/)
  assert.match(nativePort, /updateWorkspaceMetadata/)
  assert.match(nativePort, /writeProtoWithMetadata/)
  assert.match(tauriPort, /invoke<unknown>\('load_workspace_metadata'/)
  assert.match(tauriPort, /invoke<unknown>\('update_workspace_metadata'/)
  assert.match(tauriPort, /invoke<unknown>\('write_proto_with_metadata'/)
  assert.match(rust, /WorkspaceMetadataState\(Mutex/)
  assert.match(rust, /WORKSPACE_METADATA_REVISION_CONFLICT/)
  assert.match(rust, /transaction\.json/)
  assert.match(rust, /original_sha256/)
  assert.match(rust, /replacement_sha256/)
  assert.match(rust, /recover_transaction/)
})

test('G0 D1007: schema rename and delete use the native Proto-metadata batch transaction', () => {
  const schemaScreen = read('apps/desktop/src/features/schema/SchemaScreen.tsx')
  const settingsScreen = read('apps/desktop/src/features/settings/SettingsScreen.tsx')
  const cargo = read('apps/desktop/src-tauri/Cargo.toml')

  assert.match(schemaScreen, /normalizeTableMetadataKey/)
  assert.match(schemaScreen, /nativePort\.writeProtoWithMetadata/)
  assert.match(schemaScreen, /newKey: null/)
  assert.doesNotMatch(settingsScreen, /열당 최대 테이블 수/)
  assert.match(cargo, /sha2 = "0\.10\.9"/)
})

test('G0 fixture keeps @Memo in Proto instead of project metadata', () => {
  const fixtureRoot = path.join(root, 'tests', 'fixtures', 'd1000-d1012', '긴 한글 경로', 'PROTO')
  const protoFiles = fs
    .readdirSync(fixtureRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.proto'))
    .map((entry) => entry.name)
  const metadata = JSON.parse(
    fs.readFileSync(path.join(fixtureRoot, '.datamanager', 'workspace.json'), 'utf8')
  )
  assert.equal(protoFiles.length, 11)
  assert.equal(metadata.version, 1)
  assert.equal(metadata.diagram.hubThreshold, 5)
  assert.deepEqual(metadata.tables, {})
  assert.match(
    fs.readFileSync(path.join(fixtureRoot, 'ShapeTable.proto'), 'utf8'),
    /@Memo\(memo-018f6f74\) 기획 메모/
  )
})
