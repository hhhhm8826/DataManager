const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const repositoryRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
}

test('M7: eight protoc languages and Unreal generation stay explicit and pure', () => {
  const codegen = read('packages/core/src/codegen.ts')
  const unreal = read('packages/core/src/unreal.ts')
  const tests = read('packages/core/test/unreal.test.ts')

  for (const marker of [
    "'cpp'",
    "'csharp'",
    "'java'",
    "'python'",
    "'go'",
    "'rust'",
    "'ruby'",
    "'php'",
    'protoc-gen-go',
    '--rust_opt=experimental-codegen=enabled,kernel=upb'
  ]) {
    assert.match(codegen, new RegExp(marker.replace(/[+]/g, '\\+')))
  }
  assert.match(unreal, /generateUnrealFiles/)
  assert.match(unreal, /FDataTableLoader/)
  assert.match(unreal, /FBase64::Decode/)
  assert.match(unreal, /UNREAL_MESSAGE_CYCLE_POINTER/)
  assert.match(tests, /stable normalized fixture snapshots/)
  assert.match(tests, /repeated, bytes, enum, and message fields/)
  assert.doesNotMatch(unreal, /node:|@tauri-apps/)
})

test('M7: native protoc and Unreal writes replace complete staged directories', () => {
  const native = read('apps/desktop/src-tauri/src/commands/codegen.rs')

  assert.match(native, /Command::new\(&request\.executable\)/)
  assert.match(native, /\.args\(&request\.args\)/)
  assert.match(native, /tauri::async_runtime::spawn_blocking/)
  assert.match(native, /--plugin=protoc-gen-/)
  assert.match(native, /--rust_opt=experimental-codegen=enabled,kernel=upb/)
  assert.match(native, /promote_staging/)
  assert.match(native, /discard_staging/)
  assert.match(native, /CODEGEN_OUTPUT_CONTAINS_PROTO_ROOT/)
  assert.match(native, /write_unreal_files/)
  assert.match(native, /UNREAL_FILE_NAME_INVALID/)
  assert.match(native, /successful_promotion_replaces_the_complete_directory/)
  assert.match(native, /unreal_batch_replaces_output_only_after_all_files_are_staged/)
  assert.doesNotMatch(native, /cmd\.exe|powershell|\/C/)
})

test('M7: UI exposes individual, all, cancellation, plugin, and process results', () => {
  const screen = read('apps/desktop/src/features/codegen/CodegenScreen.tsx')
  const tests = read('apps/desktop/test/CodegenScreen.test.tsx')

  assert.match(screen, /CODEGEN_DEFINITIONS/)
  assert.match(screen, /generateUnrealFiles/)
  assert.match(screen, /writeUnrealFiles/)
  assert.match(screen, /전체 생성/)
  assert.match(screen, /현재 작업 후 중단/)
  assert.match(screen, /exitCode/)
  assert.match(tests, /runs an individual configured language/)
  assert.match(tests, /runs all configured protoc and Unreal outputs in order/)
  assert.match(tests, /cancels an all-language run after the active process finishes/)
  assert.match(tests, /structured process failures without hiding stderr/)
})
