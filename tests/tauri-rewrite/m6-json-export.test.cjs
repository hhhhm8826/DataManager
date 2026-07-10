const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const repositoryRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
}

test('M6: dependency closure and deterministic JSON resolution stay pure', () => {
  const resolver = read('packages/core/src/jsonExport.ts')
  const tests = read('packages/core/test/jsonExport.test.ts')

  for (const marker of [
    'collectJsonExportDependencies',
    'exportResolvedJson',
    'JSON_REFERENCE_TARGET_MISSING',
    'JSON_REFERENCE_TARGET_HAS_NO_KEY',
    'JSON_PRIMARY_KEY_DUPLICATE',
    'JSON_REFERENCE_CYCLE'
  ]) {
    assert.match(resolver, new RegExp(marker))
  }
  assert.match(tests, /single, composite, group, and multi-level shapes/)
  assert.match(tests, /byte-identical JSON/)
  assert.match(tests, /detects cycles deterministically/)
  assert.doesNotMatch(resolver, /node:|@tauri-apps|exceljs/)
})

test('M6: Excel input is fully validated before JSON writes begin', () => {
  const screen = read('apps/desktop/src/features/excel/ExcelScreen.tsx')
  const tests = read('apps/desktop/test/ExcelScreen.test.tsx')

  assert.match(screen, /collectJsonExportDependencies/)
  assert.match(screen, /validateExcelSheets/)
  assert.match(screen, /exportResolvedJson/)
  assert.match(screen, /workspacePath\(loaded\.settings\.jsonRoot/)
  assert.match(tests, /writes deterministic JSON only after workbook validation succeeds/)
  assert.match(tests, /does not write JSON when workbook input contains an empty required key/)
  assert.match(tests, /writeFile\)\.not\.toHaveBeenCalled/)
})
