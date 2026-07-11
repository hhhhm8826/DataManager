import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildExcelWorkbookPlans,
  createExcelEmbeddedMetadata,
  hasExcelErrors,
  validateExcelSheets
} from '../src/excel'
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
  it('uses Message @Memo source order and excludes memo values from domain rows', () => {
    const workspace = parseProtoWorkspace([
      {
        sourceFile: 'GameItemTable.proto',
        source: `syntax = "proto3";
message GameItem {
  int32 id = 1;
  // @Memo(memo-plan) 기획 메모
  string name = 2;
}
`
      }
    ])
    const sheet = buildExcelWorkbookPlans(workspace)[0]!.sheets[0]!
    expect(sheet.columnOrder).toEqual([
      { kind: 'field', name: 'id' },
      { kind: 'memo', id: 'memo-plan' },
      { kind: 'field', name: 'name' }
    ])
    expect(sheet.memoColumns).toEqual([{ id: 'memo-plan', name: '기획 메모' }])

    const validation = validateExcelSheets(workspace, 'GameItemTable.proto', [
      {
        name: 'GameItem',
        headers: ['id', '기획 메모', 'name'],
        rows: [[1, 'EXCEL_ONLY', '검']]
      }
    ])
    expect(validation.results[0]?.rows[0]).toEqual({ id: 1, name: '검' })
    expect(JSON.stringify(validation.results)).not.toContain('EXCEL_ONLY')

    const movedWorkspace = parseProtoWorkspace([
      {
        sourceFile: 'GameItemTable.proto',
        source: `syntax = "proto3";
message GameItem {
  // @Memo(memo-plan) 기획 메모
  int32 id = 1;
  string name = 2;
}
`
      }
    ])
    expect(buildExcelWorkbookPlans(movedWorkspace)[0]!.embeddedMetadata.fingerprint).not.toBe(
      buildExcelWorkbookPlans(workspace)[0]!.embeddedMetadata.fingerprint
    )
  })

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

  it('plans ordered memo columns and excludes current and stale memo values from domain rows', () => {
    const workspace = fixtureWorkspace()
    const tables = {
      'KeyTable.proto#SingleTarget': {
        memoColumns: [
          { id: 'memo-second', name: '검토 결과', order: 1 },
          { id: 'memo-first', name: '기획 메모', order: 0 }
        ]
      }
    }
    const plan = buildExcelWorkbookPlans(workspace, undefined, tables)[0]!
    expect(plan.sheets[0]?.memoColumns.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'memo-first', name: '기획 메모' },
      { id: 'memo-second', name: '검토 결과' }
    ])

    const staleMetadata = createExcelEmbeddedMetadata('KeyTable.proto', [
      {
        name: 'SingleTarget',
        memoColumns: [{ id: 'memo-old', name: '이전 메모' }]
      }
    ])
    const validation = validateExcelSheets(
      workspace,
      'KeyTable.proto',
      [
        {
          name: 'SingleTarget',
          headers: ['id', 'label', 'state', '기획 메모', '이전 메모'],
          rows: [[1, 'first', 'FixtureState_ACTIVE', 'CURRENT_SENTINEL', 'OLD_SENTINEL']],
          embeddedMetadata: staleMetadata
        },
        { name: 'CompositeTarget', headers: ['region', 'id', 'label'], rows: [] },
        { name: 'GroupTarget', headers: ['groupId', 'label'], rows: [] },
        { name: 'NoKeyTarget', headers: ['label'], rows: [] }
      ],
      tables
    )

    expect(validation.results[0]?.rows[0]).toEqual({
      id: 1,
      label: 'first',
      state: 'FixtureState_ACTIVE'
    })
    expect(JSON.stringify(validation.results)).not.toMatch(/SENTINEL/)
    expect(validation.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['EXCEL_MEMO_SCHEMA_STALE', 'EXCEL_MEMO_HEADER_MISSING'])
    )
    expect(validation.diagnostics.map(({ code }) => code)).not.toContain('EXCEL_HEADER_UNKNOWN')
  })

  it('blocks corrupt embedded memo metadata while preserving unknown-header errors', () => {
    const workspace = fixtureWorkspace()
    const validation = validateExcelSheets(workspace, 'KeyTable.proto', [
      {
        name: 'SingleTarget',
        headers: ['id', 'label', 'state', 'mystery'],
        rows: [[1, 'first', 'FixtureState_ACTIVE', 'value']],
        embeddedMetadataIssue: 'corrupt'
      },
      { name: 'CompositeTarget', headers: ['region', 'id', 'label'], rows: [] },
      { name: 'GroupTarget', headers: ['groupId', 'label'], rows: [] },
      { name: 'NoKeyTarget', headers: ['label'], rows: [] }
    ])

    expect(validation.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['EXCEL_MEMO_METADATA_CORRUPT', 'EXCEL_HEADER_UNKNOWN'])
    )
    expect(hasExcelErrors(validation)).toBe(true)
  })
})
