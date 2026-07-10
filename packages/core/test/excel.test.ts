import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildExcelWorkbookPlans, hasExcelErrors, validateExcelSheets } from '../src/excel'
import { parseProtoWorkspace } from '../src/proto/workspace'

const fixtureRoot = resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'tests',
  'fixtures',
  'm0-legacy',
  'proto'
)

function fixtureWorkspace() {
  return parseProtoWorkspace(
    ['FixtureEnumType.proto', 'KeyTable.proto', 'ReferenceTable.proto'].map((sourceFile) => ({
      sourceFile,
      source: readFileSync(resolve(fixtureRoot, sourceFile), 'utf8')
    }))
  )
}

describe('Excel contracts', () => {
  it('groups one workbook per selected Proto file with schema-backed dropdown plans', () => {
    const plans = buildExcelWorkbookPlans(fixtureWorkspace())

    expect(plans.map(({ fileName }) => fileName)).toEqual(['KeyTable.xlsx', 'ReferenceTable.xlsx'])
    expect(plans[0]?.sheets.map(({ name }) => name)).toEqual([
      'SingleTarget',
      'CompositeTarget',
      'GroupTarget',
      'NoKeyTarget'
    ])
    const singleTarget = plans[0]?.sheets[0]
    expect(singleTarget?.columns.map(({ name, keyMode }) => ({ name, keyMode }))).toEqual([
      { name: 'id', keyMode: 'primary' },
      { name: 'label', keyMode: 'none' },
      { name: 'state', keyMode: 'none' }
    ])
    expect(singleTarget?.columns[2]?.enumValues).toEqual([
      'FixtureState_NONE',
      'FixtureState_ACTIVE'
    ])
    const rootTarget = plans[1]?.sheets.find(({ name }) => name === 'RootTarget')
    expect(rootTarget?.columns.find(({ name }) => name === 'single')?.reference).toMatchObject({
      messageName: 'SingleTarget',
      keyFieldName: 'id',
      keyFieldType: 'int32'
    })
  })

  it('converts valid rows and diagnoses unknown headers, type mismatches, and empty keys', () => {
    const workspace = fixtureWorkspace()
    const validation = validateExcelSheets(workspace, 'KeyTable.proto', [
      {
        name: 'SingleTarget',
        headers: ['id', 'label', 'state', 'unexpected'],
        rows: [
          [1, 'first', 'FixtureState_ACTIVE', null],
          [null, 'missing key', 'FixtureState_NONE', null],
          [3, 99, 'INVALID', null]
        ]
      },
      { name: 'CompositeTarget', headers: ['region', 'id', 'label'], rows: [] },
      { name: 'GroupTarget', headers: ['groupId', 'label'], rows: [] },
      { name: 'NoKeyTarget', headers: ['label'], rows: [] }
    ])

    expect(hasExcelErrors(validation)).toBe(true)
    expect(validation.results[0]?.rows[0]).toEqual({
      id: 1,
      label: 'first',
      state: 'FixtureState_ACTIVE'
    })
    expect(validation.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'EXCEL_HEADER_UNKNOWN',
        'EXCEL_REQUIRED_KEY_EMPTY',
        'EXCEL_CELL_TYPE_MISMATCH'
      ])
    )
    expect(
      validation.diagnostics.find(({ code }) => code === 'EXCEL_REQUIRED_KEY_EMPTY')
    ).toMatchObject({
      sheetName: 'SingleTarget',
      row: 3,
      column: 1,
      header: 'id'
    })
  })

  it('reports missing schema headers and sheets before any export can proceed', () => {
    const validation = validateExcelSheets(fixtureWorkspace(), 'KeyTable.proto', [
      { name: 'SingleTarget', headers: ['id'], rows: [[1]] }
    ])

    expect(validation.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['EXCEL_HEADER_MISSING', 'EXCEL_SHEET_MISSING'])
    )
  })
})
