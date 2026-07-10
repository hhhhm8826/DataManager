const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const repositoryRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
}

test('M3: source-preserving Proto domain APIs and behavioral gates are present', () => {
  const exports = read('packages/core/src/index.ts')
  const model = read('packages/core/src/proto/model.ts')
  const patcherTests = read('packages/core/test/protoPatcher.test.ts')
  const parserTests = read('packages/core/test/protoParser.test.ts')

  for (const api of [
    'parseProtoDocument',
    'parseProtoWorkspace',
    'updateMessage',
    'updateEnum',
    'deleteDeclaration',
    'findReferenceImpacts'
  ]) {
    assert.match(exports, new RegExp(`\\b${api}\\b`))
  }
  for (const spanField of ['span: SourceSpan', 'bodySpan: SourceSpan', 'leadingTrivia: string']) {
    assert.match(model, new RegExp(spanField))
  }
  assert.match(patcherTests, /preserves bytes outside the target/)
  assert.match(patcherTests, /keeps field numbers through reorder and rename/)
  assert.match(patcherTests, /adds NONE and MAX/)
  assert.match(patcherTests, /legacy group-key annotations/)
  assert.match(patcherTests, /preserves CRLF line endings/)
  assert.match(parserTests, /marks unsupported grammar read-only/)
  assert.match(parserTests, /M0 fixture declaration and annotation snapshot/)
})

test('M3: Proto discovery and writes stay behind the configured native boundary', () => {
  const nativeCommands = read('apps/desktop/src-tauri/src/lib.rs')
  const files = read('apps/desktop/src-tauri/src/commands/files.rs')
  const nativePort = read('apps/desktop/src/adapters/native/NativePort.ts')
  const workspaceService = read('apps/desktop/src/features/schema/protoWorkspaceService.ts')

  assert.match(nativeCommands, /commands::files::list_proto_files/)
  assert.match(files, /fn list_proto_files_in_root/)
  assert.match(files, /authorize_path\(Path::new\(&settings\.proto_root\)/)
  assert.match(files, /proto_listing_is_non_recursive_filtered_and_deterministic/)
  assert.match(nativePort, /listProtoFiles\(\)/)
  assert.match(workspaceService, /nativePort\.readFile/)
  assert.match(workspaceService, /TextDecoder\('utf-8', \{ fatal: true \}\)/)
  assert.doesNotMatch(workspaceService, /node:fs|@tauri-apps/)
})

test('M3: the schema UI exposes CRUD, key modes, and impact confirmation', () => {
  const screen = read('apps/desktop/src/features/schema/SchemaScreen.tsx')
  const tests = read('apps/desktop/test/SchemaScreen.test.tsx')

  for (const marker of [
    '테이블 추가',
    'Enum 추가',
    '기본키',
    '합성키',
    'findReferenceImpacts',
    'deleteDeclaration'
  ]) {
    assert.match(screen, new RegExp(marker))
  }
  assert.match(tests, /shows rename impacts/)
  assert.match(tests, /reference impacts before deleting/)
  assert.match(tests, /one key-mode control/)
  assert.match(tests, /normalized NONE and MAX sentinels/)
  assert.match(tests, /disabled read-only editor/)
})
