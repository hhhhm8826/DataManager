const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const repositoryRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
}

test('M5: workbook plans and input diagnostics stay in the pure core package', () => {
  const core = read('packages/core/src/excel.ts')
  const tests = read('packages/core/test/excel.test.ts')

  for (const marker of [
    'buildExcelWorkbookPlans',
    'validateExcelSheets',
    'EXCEL_HEADER_UNKNOWN',
    'EXCEL_CELL_TYPE_MISMATCH',
    'EXCEL_REQUIRED_KEY_EMPTY'
  ]) {
    assert.match(core, new RegExp(marker))
  }
  assert.match(tests, /one workbook per selected Proto file/)
  assert.match(tests, /schema-backed dropdown plans/)
  assert.match(tests, /before any export can proceed/)
  assert.doesNotMatch(core, /exceljs|@tauri-apps|node:/)
})

test('M5: ExcelJS adapter and worker cover styles, validations, progress, and cancellation', () => {
  const adapter = read('apps/desktop/src/adapters/excel/excelWorkbook.ts')
  const adapterTests = read('apps/desktop/test/excelWorkbook.test.ts')
  const workerClient = read('apps/desktop/src/adapters/excel/ExcelProductWorkerClient.ts')
  const workerTests = read('apps/desktop/test/ExcelProductWorkerClient.test.ts')

  assert.match(adapter, /LAST_DATA_ROW = FIRST_DATA_ROW \+ EXCEL_MAX_DATA_ROWS - 1/)
  assert.match(adapter, /state: 'veryHidden'/)
  assert.match(adapterTests, /C10001/)
  assert.match(adapterTests, /10,000 data rows with periodic progress/)
  assert.match(workerClient, /worker\.terminate\(\)/)
  assert.match(workerTests, /terminates the worker immediately/)
})

test('M5: cancel, overwrite, timestamp backup, and atomic replacement are explicit', () => {
  const screen = read('apps/desktop/src/features/excel/ExcelScreen.tsx')
  const screenTests = read('apps/desktop/test/ExcelScreen.test.tsx')
  const native = read('apps/desktop/src-tauri/src/commands/files.rs')

  for (const label of ['생성 취소', '백업 없이 덮어쓰기', '백업 후 생성']) {
    assert.match(screen, new RegExp(label))
  }
  assert.match(screenTests, /cancels without generating, backing up, or writing/)
  assert.match(screenTests, /without writing partial output/)
  assert.match(native, /%Y%m%d%H%M%S/)
  assert.match(native, /MOVEFILE_REPLACE_EXISTING \| MOVEFILE_WRITE_THROUGH/)
  assert.match(native, /KeyTable_20260710123456\.xlsx/)
})
