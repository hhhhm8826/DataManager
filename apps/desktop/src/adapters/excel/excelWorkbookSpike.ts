import ExcelJS from 'exceljs'

const MAX_VALIDATION_ROWS = 10_000

export interface ExcelSpikeResult {
  byteLength: number
  sheets: string[]
  headerStylePreserved: boolean
  enumValidationCoversLastRow: boolean
  messageReferenceValidationCoversLastRow: boolean
  validationCoversLastRow: boolean
}

type DataValidationModel = Record<string, { formulae?: string[] }>
type HeaderCellStyle = {
  fill?: { fgColor?: { argb?: string }; pattern?: string; type?: string }
  font?: { bold?: boolean; color?: { argb?: string } }
}
type BrowserXlsxLoader = {
  load(binary: ArrayBuffer): Promise<ExcelJS.Workbook>
}

export async function executeExcelWorkbookSpike(): Promise<ExcelSpikeResult> {
  const workbook = new ExcelJS.Workbook()
  const itemSheet = workbook.addWorksheet('Item')
  const relatedItemSheet = workbook.addWorksheet('RelatedItem')
  const statusSheet = workbook.addWorksheet('_DropDown')

  statusSheet.addRows([
    ['ItemStatus'],
    ['ItemStatus_NONE'],
    ['ItemStatus_ACTIVE'],
    ['ItemStatus_MAX']
  ])

  itemSheet.columns = [
    { key: 'id', width: 14 },
    { key: 'name', width: 24 },
    { key: 'status', width: 24 },
    { key: 'relatedId', width: 16 }
  ]
  itemSheet.addRow(['id', 'name', 'status', 'relatedId'])

  relatedItemSheet.columns = [
    { key: 'id', width: 16 },
    { key: 'name', width: 24 }
  ]
  relatedItemSheet.addRow(['id', 'name'])

  itemSheet.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFCC00' }
  }
  itemSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  relatedItemSheet.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFCC00' }
  }
  relatedItemSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  const validations = (
    itemSheet as unknown as {
      dataValidations: { add(range: string, rule: object): void }
    }
  ).dataValidations
  validations.add('C2:C' + MAX_VALIDATION_ROWS, {
    type: 'list',
    allowBlank: true,
    formulae: ["'_DropDown'!$A$2:$A$3"]
  })
  validations.add('D2:D' + MAX_VALIDATION_ROWS, {
    type: 'list',
    allowBlank: true,
    formulae: ["OFFSET('RelatedItem'!$A$2,0,0,MAX(1,COUNTA('RelatedItem'!$A$2:$A$10001)),1)"]
  })
  relatedItemSheet.addRow(['related-001', 'Referenced sample'])
  itemSheet.addRow([1, 'Sample', 'ItemStatus_ACTIVE', 'related-001'])

  const binary = await workbook.xlsx.writeBuffer()
  const reloaded = new ExcelJS.Workbook()
  await reloaded.xlsx.load(binary)

  const reloadedItem = reloaded.getWorksheet('Item')
  if (!reloadedItem) throw new Error('Item worksheet was not restored.')
  const reloadedRelatedItem = reloaded.getWorksheet('RelatedItem')
  if (!reloadedRelatedItem) throw new Error('RelatedItem worksheet was not restored.')
  if (reloadedItem.getCell('A1').value !== 'id') {
    throw new Error('Header row was not restored.')
  }
  if (reloadedRelatedItem.getCell('A1').value !== 'id') {
    throw new Error('RelatedItem header row was not restored.')
  }
  const model = (
    reloadedItem as unknown as {
      dataValidations: { model: DataValidationModel }
    }
  ).dataValidations.model
  const header = reloadedItem.getCell('A1') as unknown as HeaderCellStyle
  const headerStylePreserved =
    header.fill?.type === 'pattern' &&
    header.fill.pattern === 'solid' &&
    header.fill.fgColor?.argb === 'FFFFCC00' &&
    header.font?.bold === true &&
    header.font.color?.argb === 'FFFFFFFF'
  const enumValidationCoversLastRow =
    model['C' + MAX_VALIDATION_ROWS]?.formulae?.[0] === "'_DropDown'!$A$2:$A$3"
  const messageReferenceValidationCoversLastRow =
    model['D' + MAX_VALIDATION_ROWS]?.formulae?.[0]?.includes(
      "COUNTA('RelatedItem'!$A$2:$A$10001)"
    ) === true

  return {
    byteLength: binary.byteLength,
    sheets: reloaded.worksheets.map((sheet) => sheet.name),
    headerStylePreserved,
    enumValidationCoversLastRow,
    messageReferenceValidationCoversLastRow,
    validationCoversLastRow: enumValidationCoversLastRow && messageReferenceValidationCoversLastRow
  }
}

export async function inspectExistingWorkbook(binary: ArrayBuffer): Promise<string[]> {
  const workbook = new ExcelJS.Workbook()
  // ExcelJS browser builds accept ArrayBuffer even though its public types only expose Node Buffer.
  await (workbook.xlsx as unknown as BrowserXlsxLoader).load(binary)
  return workbook.worksheets.map((sheet) => sheet.name)
}
