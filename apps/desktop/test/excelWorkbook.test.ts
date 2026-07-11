import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ExcelJS from 'exceljs'
import {
  EXCEL_METADATA_MAGIC,
  buildExcelWorkbookPlans,
  parseProtoWorkspace
} from '@datamanager/core'
import { describe, expect, it } from 'vitest'
import {
  extractRawExcelSheets,
  generateExcelWorkbook,
  inspectExcelWorkbookMetadata
} from '../src/adapters/excel/excelWorkbook'

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

function plans() {
  return buildExcelWorkbookPlans(fixtureWorkspace())
}

describe('Excel workbook adapter', () => {
  it('renders Message-local memo columns at their exact source positions', async () => {
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
    const binary = await generateExcelWorkbook(buildExcelWorkbookPlans(workspace)[0]!)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(binary as unknown as Parameters<typeof workbook.xlsx.load>[0])
    const sheet = workbook.getWorksheet('GameItem')!
    expect((sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1)).toEqual([
      'id',
      '기획 메모',
      'name'
    ])
    expect(sheet.getCell('B1').note).toBe('메모')
    expect(sheet.getCell('B1').fill).toMatchObject({ fgColor: { argb: 'FF6B7280' } })
    expect(sheet.getCell('C1').fill).toMatchObject({ fgColor: { argb: 'FF4472C4' } })
  })

  it('round-trips workbook structure, style, and 10,000-row validations', async () => {
    const binary = await generateExcelWorkbook(plans()[0]!)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(binary as unknown as Parameters<typeof workbook.xlsx.load>[0])
    expect(workbook.worksheets.map(({ name }) => name)).toEqual([
      'SingleTarget',
      'CompositeTarget',
      'GroupTarget',
      'NoKeyTarget',
      '_DropDown',
      '_DataManager'
    ])
    const sheet = workbook.getWorksheet('SingleTarget')!
    expect((sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1)).toEqual([
      'id',
      'label',
      'state'
    ])
    expect(sheet.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FFFFCC00' } })
    expect(sheet.getCell('B1').fill).toMatchObject({ fgColor: { argb: 'FF4472C4' } })
    expect(sheet.getColumn(2).width).toBeGreaterThanOrEqual(12)
    const validation = (
      sheet as unknown as { dataValidations: { model: Record<string, { formulae: string[] }> } }
    ).dataValidations.model
    expect(validation.C2?.formulae).toEqual(["'_DropDown'!$A$2:$A$3"])
    expect(validation.C10001?.formulae).toEqual(["'_DropDown'!$A$2:$A$3"])
    const dropdown = workbook.getWorksheet('_DropDown')!
    expect(dropdown.state).toBe('veryHidden')
    expect((dropdown.getColumn(1).values as ExcelJS.CellValue[]).slice(1)).toEqual([
      'FixtureState',
      'FixtureState_NONE',
      'FixtureState_ACTIVE'
    ])
    const metadata = workbook.getWorksheet('_DataManager')!
    expect(metadata.state).toBe('veryHidden')
    expect(metadata.getCell('A1').value).toBe(EXCEL_METADATA_MAGIC)
  })

  it('writes memo headers after schema fields and reads marker metadata by magic', async () => {
    const plan = buildExcelWorkbookPlans(fixtureWorkspace(), undefined, {
      'KeyTable.proto#SingleTarget': {
        memoColumns: [{ id: 'memo-note', name: '기획 메모', order: 0 }]
      }
    })[0]!
    const binary = await generateExcelWorkbook(plan)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(binary as unknown as Parameters<typeof workbook.xlsx.load>[0])
    const sheet = workbook.getWorksheet('SingleTarget')!
    expect((sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1)).toEqual([
      'id',
      'label',
      'state',
      '기획 메모'
    ])
    expect(sheet.getCell('D1').fill).toMatchObject({ fgColor: { argb: 'FF6B7280' } })
    expect(sheet.getCell('D1').note).toBe('메모')
    expect(sheet.getColumn(4).numFmt).toBe('@')
    sheet.getCell('D2').value = 'MEMO_SENTINEL'
    const updated = Uint8Array.from(
      (await workbook.xlsx.writeBuffer()) as unknown as ArrayLike<number>
    )

    const extracted = await extractRawExcelSheets(updated)
    expect(extracted.map(({ name }) => name)).not.toContain('_DataManager')
    expect(extracted.find(({ name }) => name === 'SingleTarget')?.embeddedMetadata).toEqual(
      plan.embeddedMetadata
    )
    await expect(inspectExcelWorkbookMetadata(updated)).resolves.toEqual({
      metadata: plan.embeddedMetadata
    })
  })

  it('uses the full 10,000-row candidate range for same-workbook Message references', async () => {
    const binary = await generateExcelWorkbook(plans()[1]!)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(binary as unknown as Parameters<typeof workbook.xlsx.load>[0])
    const cycle = workbook.getWorksheet('CycleA')!
    const validation = (
      cycle as unknown as { dataValidations: { model: Record<string, { formulae: string[] }> } }
    ).dataValidations.model
    expect(validation.B2?.formulae[0]).toContain("COUNTA('CycleB'!$A$2:$A$10001)")
    expect(validation.B10001?.formulae[0]).toContain("COUNTA('CycleB'!$A$2:$A$10001)")
  })

  it('creates same-sheet validation for a direct self reference', async () => {
    const workspace = parseProtoWorkspace([
      {
        sourceFile: 'CategoryTable.proto',
        source:
          'syntax = "proto3";\nmessage Category {\n  // @PK\n  int32 id = 1;\n  Category parent = 2;\n}\n'
      }
    ])
    const binary = await generateExcelWorkbook(buildExcelWorkbookPlans(workspace)[0]!)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(binary as unknown as Parameters<typeof workbook.xlsx.load>[0])
    const sheet = workbook.getWorksheet('Category')!
    const validation = (
      sheet as unknown as { dataValidations: { model: Record<string, { formulae: string[] }> } }
    ).dataValidations.model

    expect(validation.B2?.formulae[0]).toContain("COUNTA('Category'!$A$2:$A$10001)")
    expect(validation.B10001?.formulae[0]).toContain("COUNTA('Category'!$A$2:$A$10001)")
  })

  it('uses a deterministic suffix when a Message owns the default metadata sheet name', async () => {
    const workspace = parseProtoWorkspace([
      {
        sourceFile: 'MetadataTable.proto',
        source: 'syntax = "proto3";\nmessage _DataManager { string value = 1; }\n'
      }
    ])
    const plan = buildExcelWorkbookPlans(workspace)[0]!
    const binary = await generateExcelWorkbook(plan)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(binary as unknown as Parameters<typeof workbook.xlsx.load>[0])

    expect(workbook.getWorksheet('_DataManager')).toBeDefined()
    expect(workbook.getWorksheet('_DataManager_2')?.getCell('A1').value).toBe(EXCEL_METADATA_MAGIC)
    const extracted = await extractRawExcelSheets(binary)
    expect(extracted.map(({ name }) => name)).toContain('_DataManager')
    expect(extracted.map(({ name }) => name)).not.toContain('_DataManager_2')
  })

  it('normalizes rich text, formulas, and blanks while reporting read progress', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Sample')
    sheet.addRow(['id', 'label', 'computed'])
    sheet.addRow([
      1,
      { richText: [{ text: 'rich' }, { text: ' text' }] },
      { formula: '1+1', result: 2 }
    ])
    sheet.addRow([2, null, true])
    const binary = Uint8Array.from(
      (await workbook.xlsx.writeBuffer()) as unknown as ArrayLike<number>
    )
    const progress: number[] = []
    const extracted = await extractRawExcelSheets(binary, {
      onProgress: ({ completed }) => progress.push(completed)
    })

    expect(extracted).toEqual([
      {
        name: 'Sample',
        headers: ['id', 'label', 'computed'],
        rows: [
          [1, 'rich text', 2],
          [2, null, true]
        ]
      }
    ])
    expect(progress.at(-1)).toBe(2)
  })

  it('reads 10,000 data rows with periodic progress without blocking the UI boundary', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Large')
    sheet.addRow(['id', 'label'])
    for (let index = 1; index <= 10_000; index += 1) {
      sheet.addRow([index, `row-${index}`])
    }
    const binary = Uint8Array.from(
      (await workbook.xlsx.writeBuffer()) as unknown as ArrayLike<number>
    )
    const progress: number[] = []
    const extracted = await extractRawExcelSheets(binary, {
      onProgress: ({ completed }) => progress.push(completed)
    })

    expect(extracted[0]?.rows).toHaveLength(10_000)
    expect(progress).toContain(250)
    expect(progress.at(-1)).toBe(10_000)
  }, 20_000)
})
