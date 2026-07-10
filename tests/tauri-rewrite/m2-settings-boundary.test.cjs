const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const repositoryRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
}

test('M2: the v2 settings contract covers every legacy config field', () => {
  const legacy = JSON.parse(read('config.json'))
  const coreSettings = read('packages/core/src/settings.ts')
  const migration = read('apps/desktop/src-tauri/src/commands/migration.rs')

  assert.deepEqual(Object.keys(legacy).sort(), [
    'diagramMaxPerCol',
    'excelDir',
    'fileColors',
    'jsonDir',
    'outputDirs',
    'protoDir',
    'protocPath'
  ])
  for (const field of [
    'protoRoot',
    'excelRoot',
    'jsonRoot',
    'codegenOutputs',
    'protocExecutable',
    'diagram',
    'legacyImport'
  ]) {
    assert.match(coreSettings, new RegExp(`${field}:`))
  }
  for (const legacyField of Object.keys(legacy)) {
    assert.match(migration, new RegExp(legacyField))
  }
  assert.match(migration, /current_legacy_fixture_is_imported_without_field_loss/)
  assert.match(migration, /LEGACY_IMPORT_ALREADY_COMPLETED/)
  assert.match(migration, /LEGACY_CONFIG_NOT_DISCOVERED/)
})

test('M2: native file commands share a canonical configured-root boundary', () => {
  const files = read('apps/desktop/src-tauri/src/commands/files.rs')
  const app = read('apps/desktop/src-tauri/src/lib.rs')

  for (const command of ['read_file', 'write_file', 'backup_file', 'open_path']) {
    assert.match(app, new RegExp(`commands::files::${command}`))
  }
  assert.match(files, /fn authorize_path/)
  assert.match(files, /dunce::canonicalize/)
  assert.match(files, /FILE_ACCESS_OUTSIDE_ROOT/)
  assert.match(files, /FILE_PATH_TRAVERSAL_INVALID/)
  assert.match(files, /\.create_new\(true\)/)
  assert.match(files, /failed_file_replacement_keeps_original_bytes/)
  assert.doesNotMatch(files, /Command::new\("(?:cmd|powershell|pwsh)"\)/)
})
