/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const TypeScript = require('typescript')

const repositoryRoot = path.resolve(__dirname, '..', '..')

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const output = TypeScript.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: TypeScript.ModuleKind.CommonJS,
      target: TypeScript.ScriptTarget.ES2022
    }
  }).outputText
  module._compile(output, filename)
}

const { executeExcelWorkbookSpike, inspectExistingWorkbook } = require(
  path.join(repositoryRoot, 'apps', 'desktop', 'src', 'adapters', 'excel', 'excelWorkbookSpike.ts')
)

test('M1: Excel adapter spike preserves workbook structure and binary read/write', async () => {
  const result = await executeExcelWorkbookSpike()
  assert.ok(result.byteLength > 0)
  assert.deepEqual(result.sheets, ['Item', 'RelatedItem', '_DropDown'])
  assert.equal(result.headerStylePreserved, true)
  assert.equal(result.enumValidationCoversLastRow, true)
  assert.equal(result.messageReferenceValidationCoversLastRow, true)
  assert.equal(result.validationCoversLastRow, true)

  const existingWorkbook = fs.readFileSync(
    path.join(repositoryRoot, 'examples', 'EXCEL', 'TestTable.xlsx')
  )
  const binary = existingWorkbook.buffer.slice(
    existingWorkbook.byteOffset,
    existingWorkbook.byteOffset + existingWorkbook.byteLength
  )
  const sheets = await inspectExistingWorkbook(binary)
  assert.ok(sheets.length > 0)
})
