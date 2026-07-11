const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join, resolve } = require('node:path')
const test = require('node:test')

const root = resolve(__dirname, '..', '..')

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

test('G3: workbook plans and the ExcelJS adapter preserve the memo boundary', () => {
  const core = read('packages/core/src/excel.ts')
  const adapter = read('apps/desktop/src/adapters/excel/excelWorkbook.ts')
  const tests = read('apps/desktop/test/excelWorkbook.test.ts')

  for (const marker of [
    'ExcelMemoColumnPlan',
    'EXCEL_METADATA_MAGIC',
    'createExcelEmbeddedMetadata',
    'parseExcelEmbeddedMetadata',
    'EXCEL_MEMO_SCHEMA_STALE',
    'EXCEL_MEMO_METADATA_CORRUPT',
    'EXCEL_MEMO_METADATA_UNSUPPORTED',
    'embeddedMemoNames',
    'memoSchemaChanges'
  ]) {
    assert.match(core, new RegExp(marker))
  }
  assert.match(adapter, /state: 'veryHidden'/)
  assert.match(
    adapter,
    /normalizeCellValue\(sheet\.getCell\('A1'\)\.value\) === EXCEL_METADATA_MAGIC/
  )
  assert.match(adapter, /sheet\.getColumn\(index\)\.numFmt = '@'/)
  assert.match(adapter, /getCell\(HEADER_ROW, index\)\.note = '메모'/)
  assert.match(adapter, /availableMetadataSheetName/)
  assert.match(tests, /direct self reference/)
  assert.match(tests, /default metadata sheet name/)
  assert.match(tests, /MEMO_SENTINEL/)
})

test('G3: Excel and JSON selections are separate, explicit, and tri-state', () => {
  const screen = read('apps/desktop/src/features/excel/ExcelScreen.tsx')
  const tests = read('apps/desktop/test/ExcelScreen.test.tsx')

  assert.match(screen, /excelSelectionInitialized/)
  assert.match(screen, /jsonSelectionInitialized/)
  assert.doesNotMatch(screen, /new Set\(nextPlans\.map/)
  assert.match(screen, /ariaLabel="Excel 생성 전체"/)
  assert.match(screen, /ariaLabel="JSON 테이블 전체"/)
  assert.match(screen, /ref\.current\.indeterminate = indeterminate/)
  assert.match(screen, /aria-checked=\{indeterminate \? 'mixed' : checked\}/)
  assert.match(screen, /Excel 생성 필요/)
  assert.match(screen, /직접 선택.*자동 포함/s)
  assert.match(tests, /starts both purposes at zero/)
  assert.match(tests, /preserves an explicit zero selection on reload/)
  assert.match(tests, /parent mixed selection/)
})

test('G3: workbook rows support tabs, included tables, search, and the Excel root action', () => {
  const screen = read('apps/desktop/src/features/excel/ExcelScreen.tsx')
  const styles = read('apps/desktop/src/styles.css')
  const tests = read('apps/desktop/test/ExcelScreen.test.tsx')

  assert.match(screen, /role="tablist"/)
  assert.match(screen, /role="tabpanel"/)
  assert.match(screen, /className="excel-generation-row"/)
  assert.match(screen, /className="excel-json-row"/)
  assert.match(screen, /className="excel-included-tables"/)
  assert.match(screen, /Excel 또는 테이블 검색/)
  assert.match(screen, /fileName, plan\.sourceFile/)
  assert.match(screen, /selectedMessages\.size}개 table[\s\S]*전체 선택/)
  assert.match(screen, /> JSON 생성/)
  assert.match(screen, /> Excel 폴더 열기/)
  assert.match(screen, /nativePort\.openPath\(loaded\.settings\.excelRoot\)/)
  assert.match(styles, /\.excel-generation-list[\s\S]*?max-height: 560px/)
  assert.match(styles, /\.excel-workbook-groups[\s\S]*?max-height: 560px/)
  assert.match(styles, /\.excel-json-row[\s\S]*?grid-template-columns/)
  assert.match(tests, /opens the configured Excel root/)
  assert.match(tests, /separates Excel and JSON work into tabs/)
  assert.match(tests, /searches file and table names/)
})

test('G3 D1017: Message-local @Memo order is Excel-only across every boundary', () => {
  const model = read('packages/core/src/proto/model.ts')
  const parser = read('packages/core/src/proto/parser.ts')
  const patcher = read('packages/core/src/proto/patcher.ts')
  const excel = read('packages/core/src/excel.ts')
  const screen = read('apps/desktop/src/features/schema/SchemaScreen.tsx')
  const codegen = read('apps/desktop/src-tauri/src/commands/codegen.rs')

  assert.match(model, /ProtoMemoDeclaration/)
  assert.match(model, /memos: ProtoMemoDeclaration\[\]/)
  assert.match(parser, /@Memo\\\(\(memo-/)
  assert.match(patcher, /\/\/ @Memo\(\$\{memo\.id\}\) \$\{memo\.name\}/)
  assert.match(excel, /columnOrder/)
  assert.match(excel, /memoColumnsForMessage/)
  assert.match(screen, /className="field-table-row memo-field-row"/)
  assert.doesNotMatch(screen, /className="memo-editor"/)
  assert.match(codegen, /strip_memo_directives/)
  assert.match(codegen, /CODEGEN_INPUT_STAGING_CREATE_FAILED/)
})
