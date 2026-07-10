import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ExcelJS from 'exceljs'
import { buildExcelWorkbookPlans, parseProtoWorkspace } from '@datamanager/core'
import { describe, expect, it } from 'vitest'
import { extractRawExcelSheets, generateExcelWorkbook } from '../src/adapters/excel/excelWorkbook'

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

function plans() {
  const workspace = parseProtoWorkspace(
    ['FixtureEnumType.proto', 'KeyTable.proto', 'ReferenceTable.proto'].map((sourceFile) => ({
      sourceFile,
      source: readFileSync(resolve(fixtureRoot, sourceFile), 'utf8')
    }))
  )
  return buildExcelWorkbookPlans(workspace)
}

describe('Excel workbook adapter', () => {
  it('round-trips workbook structure, style, and 10,000-row validations', async () => {
    const binary = await generateExcelWorkbook(plans()[0]!)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(binary as unknown as Parameters<typeof workbook.xlsx.load>[0])
    expect(workbook.worksheets.map(({ name }) => name)).toEqual([
      'SingleTarget',
      'CompositeTarget',
      'GroupTarget',
      'NoKeyTarget',
      '_DropDown'
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
