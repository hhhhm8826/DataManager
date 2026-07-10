import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  executeExcelWorkbookSpike,
  inspectExistingWorkbook
} from '../src/adapters/excel/excelWorkbookSpike'

describe('Excel workbook spike', () => {
  it('preserves workbook structure and reads the legacy XLSX fixture', async () => {
    const result = await executeExcelWorkbookSpike()

    expect(result.byteLength).toBeGreaterThan(0)
    expect(result.sheets).toEqual(['Item', 'RelatedItem', '_DropDown'])
    expect(result.headerStylePreserved).toBe(true)
    expect(result.enumValidationCoversLastRow).toBe(true)
    expect(result.messageReferenceValidationCoversLastRow).toBe(true)
    expect(result.validationCoversLastRow).toBe(true)

    const fixture = await readFile(
      new URL('../../../examples/EXCEL/TestTable.xlsx', import.meta.url)
    )
    const binary = new Uint8Array(fixture).slice().buffer as ArrayBuffer
    await expect(inspectExistingWorkbook(binary)).resolves.not.toHaveLength(0)
  })
})
