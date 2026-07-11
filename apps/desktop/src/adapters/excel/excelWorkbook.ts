import ExcelJS from 'exceljs'
import {
  EXCEL_DROPDOWN_SHEET,
  EXCEL_MAX_DATA_ROWS,
  EXCEL_METADATA_MAGIC,
  EXCEL_METADATA_SHEET,
  parseExcelEmbeddedMetadata,
  type ExcelEmbeddedMetadata,
  type ExcelDomainValue,
  type ExcelWorkbookPlan,
  type RawExcelSheet
} from '@datamanager/core'

const HEADER_ROW = 1
const FIRST_DATA_ROW = 2
const LAST_DATA_ROW = FIRST_DATA_ROW + EXCEL_MAX_DATA_ROWS - 1

export interface ExcelProgress {
  completed: number
  total: number
  label: string
}

export interface ExcelReadOptions {
  signal?: AbortSignal
  onProgress?: (progress: ExcelProgress) => void
}

export interface ExcelMetadataInspection {
  metadata?: ExcelEmbeddedMetadata
  issue?: 'corrupt' | 'unsupported'
}

type DataValidationTarget = {
  dataValidations: { add(range: string, rule: object): void }
}

type BrowserXlsxLoader = {
  load(binary: ArrayBuffer): Promise<ExcelJS.Workbook>
}

export async function generateExcelWorkbook(
  plan: ExcelWorkbookPlan,
  onProgress?: (progress: ExcelProgress) => void
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'DataManager'
  workbook.created = new Date(0)
  const enumColumns = collectEnumColumns(plan)
  const sheetByName = new Map(plan.sheets.map((sheet) => [sheet.name, sheet]))
  const totalSheets = plan.sheets.length + (enumColumns.size > 0 ? 1 : 0) + 1

  for (const [sheetIndex, sheetPlan] of plan.sheets.entries()) {
    if (sheetPlan.name.length > 31) {
      throw new Error(`Excel sheet name '${sheetPlan.name}' exceeds 31 characters.`)
    }
    const sheet = workbook.addWorksheet(sheetPlan.name)
    const orderedColumns = resolveOrderedColumns(sheetPlan)
    sheet.columns = orderedColumns.map((entry) =>
      entry.kind === 'field'
        ? {
            key: entry.column.name,
            width: Math.min(
              48,
              Math.max(12, entry.column.name.length + 4, entry.column.type.length + 4)
            )
          }
        : {
            key: entry.column.id,
            width: Math.min(48, Math.max(12, entry.column.name.length + 4))
          }
    )
    sheet.addRow(orderedColumns.map(({ column }) => column.name))
    styleHeader(sheet, sheetPlan)

    for (const [columnIndex, entry] of orderedColumns.entries()) {
      if (entry.kind !== 'memo') continue
      const index = columnIndex + 1
      sheet.getColumn(index).numFmt = '@'
      sheet.getCell(HEADER_ROW, index).note = '메모'
    }

    for (const column of sheetPlan.columns) {
      const columnIndex = orderedColumns.findIndex(
        (entry) => entry.kind === 'field' && entry.column.name === column.name
      )
      const dataColumn = excelColumn(columnIndex + 1)
      if (column.enumValues) {
        const dropdownColumn = enumColumns.get(column.type)
        if (dropdownColumn) {
          addListValidation(
            sheet,
            `${dataColumn}${FIRST_DATA_ROW}:${dataColumn}${LAST_DATA_ROW}`,
            [
              `'${EXCEL_DROPDOWN_SHEET}'!$${excelColumn(dropdownColumn.index)}$2:$${excelColumn(dropdownColumn.index)}$${dropdownColumn.values.length + 1}`
            ],
            `정의된 Enum 값을 선택하세요. (${column.type})`
          )
        }
      }

      const reference = column.reference
      if (reference && reference.sourceFile === plan.sourceFile) {
        const targetSheet = sheetByName.get(reference.messageName)
        const keyIndex = targetSheet
          ? resolveOrderedColumns(targetSheet).findIndex(
              (candidate) =>
                candidate.kind === 'field' && candidate.column.name === reference.keyFieldName
            )
          : undefined
        if (keyIndex !== undefined && keyIndex >= 0) {
          const keyColumn = excelColumn(keyIndex + 1)
          const escapedSheet = reference.messageName.replace(/'/g, "''")
          const formula =
            `OFFSET('${escapedSheet}'!$${keyColumn}$2,0,0,` +
            `MAX(1,COUNTA('${escapedSheet}'!$${keyColumn}$2:$${keyColumn}$${LAST_DATA_ROW})),1)`
          addListValidation(
            sheet,
            `${dataColumn}${FIRST_DATA_ROW}:${dataColumn}${LAST_DATA_ROW}`,
            [formula],
            `${reference.messageName} 시트의 값을 선택하세요.`
          )
        }
      }
    }
    onProgress?.({
      completed: sheetIndex + 1,
      total: totalSheets,
      label: sheetPlan.name
    })
  }

  if (enumColumns.size > 0) {
    const dropdown = workbook.addWorksheet(EXCEL_DROPDOWN_SHEET, {
      state: 'veryHidden'
    })
    for (const [enumName, entry] of enumColumns) {
      dropdown.getCell(1, entry.index).value = enumName
      dropdown.getCell(1, entry.index).font = { bold: true }
      dropdown.getColumn(entry.index).width = Math.max(20, enumName.length + 2)
      entry.values.forEach((value, index) => {
        dropdown.getCell(index + 2, entry.index).value = value
      })
    }
    onProgress?.({
      completed: plan.sheets.length + 1,
      total: totalSheets,
      label: EXCEL_DROPDOWN_SHEET
    })
  }

  const metadataSheetName = availableMetadataSheetName(workbook)
  const metadataSheet = workbook.addWorksheet(metadataSheetName, { state: 'veryHidden' })
  metadataSheet.getCell('A1').value = EXCEL_METADATA_MAGIC
  metadataSheet.getCell('B1').value = plan.embeddedMetadata.version
  metadataSheet.getCell('A2').value = JSON.stringify(plan.embeddedMetadata)
  onProgress?.({
    completed: totalSheets,
    total: totalSheets,
    label: metadataSheetName
  })

  const binary = await workbook.xlsx.writeBuffer()
  return Uint8Array.from(binary as unknown as ArrayLike<number>)
}

export async function extractRawExcelSheets(
  binary: Uint8Array,
  options: ExcelReadOptions = {}
): Promise<RawExcelSheet[]> {
  throwIfAborted(options.signal)
  const workbook = new ExcelJS.Workbook()
  const arrayBuffer = binary.buffer.slice(
    binary.byteOffset,
    binary.byteOffset + binary.byteLength
  ) as ArrayBuffer
  await (workbook.xlsx as unknown as BrowserXlsxLoader).load(arrayBuffer)
  const embedded = readEmbeddedMetadata(workbook)
  const totalRows = Math.max(
    1,
    workbook.worksheets.reduce((sum, sheet) => sum + Math.max(0, sheet.rowCount - 1), 0)
  )
  let completed = 0
  const sheets: RawExcelSheet[] = []

  for (const sheet of workbook.worksheets) {
    throwIfAborted(options.signal)
    if (embedded.sheetIds.has(sheet.id)) continue
    const headerRow = sheet.getRow(HEADER_ROW)
    const headerCount = headerRow.cellCount
    const headers = Array.from({ length: headerCount }, (_, index) =>
      String(normalizeCellValue(headerRow.getCell(index + 1).value) ?? '')
    )
    const rows: ExcelDomainValue[][] = []
    for (let rowNumber = FIRST_DATA_ROW; rowNumber <= sheet.rowCount; rowNumber += 1) {
      throwIfAborted(options.signal)
      const row = sheet.getRow(rowNumber)
      rows.push(
        Array.from({ length: headerCount }, (_, index) =>
          normalizeCellValue(row.getCell(index + 1).value)
        )
      )
      completed += 1
      if (completed % 250 === 0) {
        options.onProgress?.({ completed, total: totalRows, label: sheet.name })
        await yieldToWorker()
      }
    }
    sheets.push({
      name: sheet.name,
      headers,
      rows,
      ...(embedded.metadata ? { embeddedMetadata: embedded.metadata } : {}),
      ...(embedded.issue ? { embeddedMetadataIssue: embedded.issue } : {})
    })
  }
  options.onProgress?.({ completed: totalRows, total: totalRows, label: 'complete' })
  return sheets
}

export async function inspectExcelWorkbookMetadata(
  binary: Uint8Array
): Promise<ExcelMetadataInspection> {
  const workbook = await loadWorkbook(binary)
  const embedded = readEmbeddedMetadata(workbook)
  return {
    ...(embedded.metadata ? { metadata: embedded.metadata } : {}),
    ...(embedded.issue ? { issue: embedded.issue } : {})
  }
}

function collectEnumColumns(
  plan: ExcelWorkbookPlan
): Map<string, { index: number; values: string[] }> {
  const result = new Map<string, { index: number; values: string[] }>()
  for (const sheet of plan.sheets) {
    for (const column of sheet.columns) {
      if (column.enumValues && !result.has(column.type)) {
        result.set(column.type, { index: result.size + 1, values: column.enumValues })
      }
    }
  }
  return result
}

function styleHeader(sheet: ExcelJS.Worksheet, plan: ExcelWorkbookPlan['sheets'][number]): void {
  const orderedColumns = resolveOrderedColumns(plan)
  const row = sheet.getRow(HEADER_ROW)
  row.height = 22
  row.eachCell((cell, columnNumber) => {
    const entry = orderedColumns[columnNumber - 1]
    const column = entry?.kind === 'field' ? entry.column : undefined
    const memo = entry?.kind === 'memo'
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: memo ? 'FF6B7280' : column?.keyMode === 'primary' ? 'FFFFCC00' : 'FF4472C4'
      }
    }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(1, orderedColumns.length) }
  }
}

function resolveOrderedColumns(
  plan: ExcelWorkbookPlan['sheets'][number]
): Array<
  | { kind: 'field'; column: ExcelWorkbookPlan['sheets'][number]['columns'][number] }
  | { kind: 'memo'; column: ExcelWorkbookPlan['sheets'][number]['memoColumns'][number] }
> {
  const result: Array<
    | { kind: 'field'; column: ExcelWorkbookPlan['sheets'][number]['columns'][number] }
    | { kind: 'memo'; column: ExcelWorkbookPlan['sheets'][number]['memoColumns'][number] }
  > = []
  const fields = new Map(plan.columns.map((column) => [column.name, column]))
  const memos = new Map(plan.memoColumns.map((column) => [column.id, column]))
  for (const entry of plan.columnOrder) {
    if (entry.kind === 'field') {
      const column = fields.get(entry.name)
      if (column) result.push({ kind: 'field', column })
    } else {
      const column = memos.get(entry.id)
      if (column) result.push({ kind: 'memo', column })
    }
  }
  return result
}

function availableMetadataSheetName(workbook: ExcelJS.Workbook): string {
  if (!workbook.getWorksheet(EXCEL_METADATA_SHEET)) return EXCEL_METADATA_SHEET
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${EXCEL_METADATA_SHEET}_${suffix}`
    if (!workbook.getWorksheet(candidate)) return candidate
  }
  throw new Error('No collision-free DataManager metadata sheet name is available.')
}

function readEmbeddedMetadata(workbook: ExcelJS.Workbook): {
  sheetIds: Set<number>
  metadata?: ExcelEmbeddedMetadata
  issue?: 'corrupt' | 'unsupported'
} {
  const markers = workbook.worksheets.filter(
    (sheet) => normalizeCellValue(sheet.getCell('A1').value) === EXCEL_METADATA_MAGIC
  )
  if (markers.length === 0) return { sheetIds: new Set() }
  const sheetIds = new Set(markers.map(({ id }) => id))
  if (markers.length !== 1) return { sheetIds, issue: 'corrupt' }
  const raw = normalizeCellValue(markers[0]!.getCell('A2').value)
  if (typeof raw !== 'string') return { sheetIds, issue: 'corrupt' }
  let input: unknown
  try {
    input = JSON.parse(raw)
  } catch {
    return { sheetIds, issue: 'corrupt' }
  }
  const parsed = parseExcelEmbeddedMetadata(input)
  return parsed.success
    ? { sheetIds, metadata: parsed.metadata }
    : { sheetIds, issue: parsed.issue }
}

async function loadWorkbook(binary: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  const arrayBuffer = binary.buffer.slice(
    binary.byteOffset,
    binary.byteOffset + binary.byteLength
  ) as ArrayBuffer
  await (workbook.xlsx as unknown as BrowserXlsxLoader).load(arrayBuffer)
  return workbook
}

function addListValidation(
  sheet: ExcelJS.Worksheet,
  range: string,
  formulae: string[],
  error: string
): void {
  ;(sheet as unknown as DataValidationTarget).dataValidations.add(range, {
    type: 'list',
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: '잘못된 값',
    error,
    formulae
  })
}

function normalizeCellValue(value: ExcelJS.CellValue): ExcelDomainValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Date) return value.toISOString()
  if ('result' in value) return normalizeCellValue(value.result ?? null)
  if ('richText' in value) return value.richText.map((part) => part.text).join('')
  if ('text' in value) return value.text
  if ('error' in value) return value.error
  return String(value)
}

function excelColumn(index: number): string {
  let value = index
  let result = ''
  while (value > 0) {
    value -= 1
    result = String.fromCharCode(65 + (value % 26)) + result
    value = Math.floor(value / 26)
  }
  return result
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('Excel operation was cancelled.', 'AbortError')
}

function yieldToWorker(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
