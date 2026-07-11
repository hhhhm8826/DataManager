const assert = require('node:assert/strict')
const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs')
const { join, resolve } = require('node:path')
const test = require('node:test')

const root = resolve(__dirname, '..', '..')

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

test('G4: JSON self references use row identity, an explicit stack, and a hard limit', () => {
  const source = read('packages/core/src/jsonExport.ts')
  const tests = read('packages/core/test/jsonExport.test.ts')

  assert.match(source, /type !== message\.name && messages\.has\(type\)/)
  assert.match(source, /interface RowResolutionFrame/)
  assert.match(source, /const frames: RowResolutionFrame\[\] = \[\]/)
  assert.match(source, /const visiting = new Set<number>\(\)/)
  assert.match(source, /const memo = new Map<number, JsonObject>\(\)/)
  assert.match(source, /rowIdentity\(message, rows\[index\]!, index\)/)
  assert.match(source, /JSON_REFERENCE_ROW_CYCLE/)
  assert.match(source, /JSON_REFERENCE_EXPANSION_LIMIT = 100_000/)
  assert.match(source, /countExpandedObjects/)
  assert.match(source, /lookupIndexes/)
  for (const marker of [
    'terminating chain',
    'reports a %s self-reference cycle',
    'multi-row',
    'sharing the same resolved parent',
    'multiple primary and group keys',
    'missing and blank self references',
    '10,000-row chain',
    'MEMO_SENTINEL'
  ]) {
    assert.match(tests, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('G4: every generated target contains the Category self-reference fixture', () => {
  const expected = [
    'examples/TAURI_REWRITE/CODE/cpp/CategoryTable.pb.h',
    'examples/TAURI_REWRITE/CODE/csharp/CategoryTable.cs',
    'examples/TAURI_REWRITE/CODE/java/d1000/CategoryTable.java',
    'examples/TAURI_REWRITE/CODE/python/CategoryTable_pb2.py',
    'examples/TAURI_REWRITE/CODE/go/d1000/CategoryTable.pb.go',
    'examples/TAURI_REWRITE/CODE/rust/CategoryTable.u.pb.rs',
    'examples/TAURI_REWRITE/CODE/ruby/CategoryTable_pb.rb',
    'examples/TAURI_REWRITE/CODE/php/D1000/Category.php'
  ]
  for (const path of expected) {
    assert.equal(existsSync(join(root, path)), true, `missing ${path}`)
    assert.match(read(path), /Category/)
  }
  const unrealTables = read('examples/TAURI_REWRITE/CODE/unreal/DataTables.h')
  const unrealLoader = read('examples/TAURI_REWRITE/CODE/unreal/DataTableLoader.cpp')
  assert.match(unrealTables, /TSharedPtr<FCategory> parent;/)
  assert.match(unrealTables, /TArray<TSharedPtr<FCategory>> children;/)
  assert.match(unrealLoader, /parent = MakeShared<FCategory>/)
})

test('G4: memo sentinel text is absent from every generated JSON and code artifact', () => {
  const outputRoot = join(root, 'examples', 'TAURI_REWRITE')
  for (const path of files(outputRoot)) {
    if (/\.xlsx$/i.test(path)) continue
    const source = readFileSync(path, 'utf8')
    assert.doesNotMatch(source, /MEMO_SENTINEL|CURRENT_SENTINEL|OLD_SENTINEL/, path)
  }
})
