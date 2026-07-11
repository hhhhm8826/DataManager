import type { ProtoFieldDeclaration, ProtoMessageDeclaration, ProtoWorkspace } from './proto/model'
import { normalizeTableMetadataKey, type MemoColumn, type TableMetadata } from './projectMetadata'

export const EXCEL_MAX_DATA_ROWS = 10_000
export const EXCEL_DROPDOWN_SHEET = '_DropDown'
export const EXCEL_METADATA_SHEET = '_DataManager'
export const EXCEL_METADATA_MAGIC = 'DataManager.ExcelMetadata'
export const EXCEL_METADATA_VERSION = 1

export type ExcelKeyMode = 'none' | 'primary' | 'group'
export type ExcelDomainValue = string | number | boolean | null
export type ExcelDomainRow = Record<string, ExcelDomainValue>

export interface ExcelReferencePlan {
  messageName: string
  sourceFile: string
  keyFieldName: string
  keyFieldType: string
}

export interface ExcelColumnPlan {
  name: string
  type: string
  fieldNumber: number
  label: ProtoFieldDeclaration['label']
  keyMode: ExcelKeyMode
  enumValues: string[] | null
  reference: ExcelReferencePlan | null
}

export interface ExcelMemoColumnPlan {
  id: string
  name: string
}

export interface ExcelSheetPlan {
  name: string
  columns: ExcelColumnPlan[]
  memoColumns: ExcelMemoColumnPlan[]
  columnOrder: Array<{ kind: 'field'; name: string } | { kind: 'memo'; id: string }>
}

export interface ExcelEmbeddedTableMetadata {
  messageName: string
  memoColumns: ExcelMemoColumnPlan[]
}

export interface ExcelEmbeddedMetadata {
  magic: typeof EXCEL_METADATA_MAGIC
  version: typeof EXCEL_METADATA_VERSION
  sourceFile: string
  fingerprint: string
  tables: ExcelEmbeddedTableMetadata[]
}

export interface ExcelWorkbookPlan {
  sourceFile: string
  fileName: string
  sheets: ExcelSheetPlan[]
  embeddedMetadata: ExcelEmbeddedMetadata
}

export interface RawExcelSheet {
  name: string
  headers: string[]
  rows: ExcelDomainValue[][]
  embeddedMetadata?: ExcelEmbeddedMetadata
  embeddedMetadataIssue?: 'corrupt' | 'unsupported'
}

export interface ExcelReadResult {
  sourceFile: string
  messageName: string
  rows: ExcelDomainRow[]
}

export type ExcelDiagnosticSeverity = 'warning' | 'error'

export interface ExcelDiagnostic extends DiagnosticLike {
  code: string
  severity: ExcelDiagnosticSeverity
  message: string
  sourceFile: string
  sheetName: string
  row: number
  column: number
  header?: string
}

export interface ExcelValidationResult {
  results: ExcelReadResult[]
  diagnostics: ExcelDiagnostic[]
}

const numericTypes = new Set([
  'double',
  'fixed32',
  'fixed64',
  'float',
  'int32',
  'int64',
  'sfixed32',
  'sfixed64',
  'sint32',
  'sint64',
  'uint32',
  'uint64'
])
const integerTypes = new Set(
  [...numericTypes].filter((type) => type !== 'double' && type !== 'float')
)

export function buildExcelWorkbookPlans(
  workspace: ProtoWorkspace,
  selectedSourceFiles?: readonly string[],
  tableMetadata: Readonly<Record<string, TableMetadata>> = {}
): ExcelWorkbookPlan[] {
  const selected = selectedSourceFiles ? new Set(selectedSourceFiles) : null
  const messagesBySource = new Map<string, ProtoMessageDeclaration[]>()
  for (const message of workspace.messages) {
    if (selected && !selected.has(message.sourceFile)) continue
    const messages = messagesBySource.get(message.sourceFile) ?? []
    messages.push(message)
    messagesBySource.set(message.sourceFile, messages)
  }

  return [...messagesBySource]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([sourceFile, messages]) => {
      const sheets = messages.map((message) => {
        const memoColumns = memoColumnsForMessage(
          message,
          tableMetadata[normalizeTableMetadataKey(sourceFile, message.name)]?.memoColumns ?? []
        )
        return {
          name: message.name,
          columns: message.fields.map((field) => columnPlan(workspace, field)),
          memoColumns,
          columnOrder: [
            ...message.fields.map(({ name, order }) => ({ kind: 'field' as const, name, order })),
            ...memoColumns.map(({ id }, index) => ({
              kind: 'memo' as const,
              id,
              order:
                message.memos.find((memo) => memo.id === id)?.order ?? message.fields.length + index
            }))
          ]
            .sort((left, right) => left.order - right.order)
            .map((entry) =>
              entry.kind === 'field'
                ? { kind: entry.kind, name: entry.name }
                : { kind: entry.kind, id: entry.id }
            )
        }
      })
      return {
        sourceFile,
        fileName: sourceFile.replace(/\.proto$/, '') + '.xlsx',
        sheets,
        embeddedMetadata: createExcelEmbeddedMetadata(sourceFile, sheets)
      }
    })
}

export function validateExcelSheets(
  workspace: ProtoWorkspace,
  sourceFile: string,
  sheets: readonly RawExcelSheet[],
  tableMetadata: Readonly<Record<string, TableMetadata>> = {}
): ExcelValidationResult {
  const diagnostics: ExcelDiagnostic[] = []
  const results: ExcelReadResult[] = []
  const messages = workspace.messages.filter((message) => message.sourceFile === sourceFile)
  const messageByName = new Map(messages.map((message) => [message.name, message]))
  const presentSheets = new Set<string>()

  for (const sheet of sheets) {
    if (sheet.name === EXCEL_DROPDOWN_SHEET) continue
    const message = messageByName.get(sheet.name)
    if (!message) {
      diagnostics.push(
        excelDiagnostic(
          'EXCEL_SHEET_UNKNOWN',
          `Sheet '${sheet.name}' is not defined by ${sourceFile}.`,
          sourceFile,
          sheet.name,
          1,
          1,
          'warning'
        )
      )
      continue
    }
    presentSheets.add(sheet.name)
    const fieldByName = new Map(message.fields.map((field) => [field.name, field]))
    const currentMemoColumns = memoColumnsForMessage(
      message,
      tableMetadata[normalizeTableMetadataKey(sourceFile, message.name)]?.memoColumns ?? []
    )
    const currentMemoNames = new Set(currentMemoColumns.map(({ name }) => name.toLocaleLowerCase()))
    const embeddedTable = sheet.embeddedMetadata?.tables.find(
      ({ messageName }) => messageName === message.name
    )
    const embeddedMemoNames = new Set(
      (embeddedTable?.memoColumns ?? []).map(({ name }) => name.toLocaleLowerCase())
    )
    if (sheet.embeddedMetadataIssue) {
      diagnostics.push(
        excelDiagnostic(
          sheet.embeddedMetadataIssue === 'unsupported'
            ? 'EXCEL_MEMO_METADATA_UNSUPPORTED'
            : 'EXCEL_MEMO_METADATA_CORRUPT',
          'The embedded DataManager memo metadata cannot be used.',
          sourceFile,
          sheet.name,
          1,
          0,
          'error'
        )
      )
    } else if (sheet.embeddedMetadata) {
      const expected = createExcelEmbeddedMetadata(
        sourceFile,
        messages.map((entry) => ({
          name: entry.name,
          columns: [],
          memoColumns: memoColumnsForMessage(
            entry,
            tableMetadata[normalizeTableMetadataKey(sourceFile, entry.name)]?.memoColumns ?? []
          )
        }))
      )
      if (
        sheet.embeddedMetadata.sourceFile !== sourceFile ||
        sheet.embeddedMetadata.fingerprint !== expected.fingerprint
      ) {
        const changes = memoSchemaChanges(currentMemoColumns, embeddedTable?.memoColumns ?? [])
        diagnostics.push({
          ...excelDiagnostic(
            'EXCEL_MEMO_SCHEMA_STALE',
            'The workbook memo schema differs from the current project metadata.',
            sourceFile,
            sheet.name,
            1,
            0,
            'warning'
          ),
          context: { changes: changes.join(', ') }
        })
      }
    }
    const headerIndexes = new Map<string, number>()
    for (const [index, header] of sheet.headers.entries()) {
      const column = index + 1
      const normalizedHeader = header.toLocaleLowerCase()
      if (
        !fieldByName.has(header) &&
        !currentMemoNames.has(normalizedHeader) &&
        !embeddedMemoNames.has(normalizedHeader)
      ) {
        diagnostics.push(
          excelDiagnostic(
            'EXCEL_HEADER_UNKNOWN',
            `Header '${header}' is not defined by Message '${message.name}'.`,
            sourceFile,
            sheet.name,
            1,
            column,
            'error',
            header
          )
        )
      }
      if (headerIndexes.has(header)) {
        diagnostics.push(
          excelDiagnostic(
            'EXCEL_HEADER_DUPLICATE',
            `Header '${header}' appears more than once.`,
            sourceFile,
            sheet.name,
            1,
            column,
            'error',
            header
          )
        )
      } else {
        headerIndexes.set(header, index)
      }
    }
    for (const field of message.fields) {
      if (!headerIndexes.has(field.name)) {
        diagnostics.push(
          excelDiagnostic(
            'EXCEL_HEADER_MISSING',
            `Required schema header '${field.name}' is missing.`,
            sourceFile,
            sheet.name,
            1,
            0,
            'error',
            field.name
          )
        )
      }
    }
    for (const memo of currentMemoColumns) {
      if (
        !sheet.headers.some(
          (header) => header.toLocaleLowerCase() === memo.name.toLocaleLowerCase()
        )
      ) {
        diagnostics.push(
          excelDiagnostic(
            'EXCEL_MEMO_HEADER_MISSING',
            `Memo header '${memo.name}' is missing.`,
            sourceFile,
            sheet.name,
            1,
            0,
            'warning',
            memo.name
          )
        )
      }
    }

    const rows: ExcelDomainRow[] = []
    for (const [rowIndex, values] of sheet.rows.entries()) {
      const schemaValues = message.fields.map((field) => {
        const index = headerIndexes.get(field.name)
        return index === undefined ? null : values[index]
      })
      if (schemaValues.every(isBlank)) continue
      const excelRow = rowIndex + 2
      const row: ExcelDomainRow = {}
      for (const field of message.fields) {
        const index = headerIndexes.get(field.name)
        if (index === undefined) continue
        const value = values[index] ?? null
        row[field.name] = value
        if ((field.isPrimaryKey || field.isGroupKey) && isBlank(value)) {
          diagnostics.push(
            excelDiagnostic(
              'EXCEL_REQUIRED_KEY_EMPTY',
              `Key field '${field.name}' cannot be empty.`,
              sourceFile,
              sheet.name,
              excelRow,
              index + 1,
              'error',
              field.name
            )
          )
          continue
        }
        if (!isBlank(value)) {
          const typeError = validateCellType(workspace, field, value)
          if (typeError) {
            diagnostics.push(
              excelDiagnostic(
                'EXCEL_CELL_TYPE_MISMATCH',
                `Field '${field.name}' ${typeError}`,
                sourceFile,
                sheet.name,
                excelRow,
                index + 1,
                'error',
                field.name
              )
            )
          }
        }
      }
      rows.push(row)
    }
    results.push({ sourceFile, messageName: message.name, rows })
  }

  for (const message of messages) {
    if (!presentSheets.has(message.name)) {
      diagnostics.push(
        excelDiagnostic(
          'EXCEL_SHEET_MISSING',
          `Sheet '${message.name}' is missing.`,
          sourceFile,
          message.name,
          0,
          0,
          'error'
        )
      )
    }
  }
  return { results, diagnostics }
}

export function createExcelEmbeddedMetadata(
  sourceFile: string,
  sheets: readonly (Pick<ExcelSheetPlan, 'name' | 'memoColumns'> &
    Partial<Pick<ExcelSheetPlan, 'columnOrder'>>)[]
): ExcelEmbeddedMetadata {
  const tables = sheets.map(({ name, memoColumns }) => ({
    messageName: name,
    memoColumns: memoColumns.map(({ id, name: memoName }) => ({ id, name: memoName }))
  }))
  const serialized = JSON.stringify({
    sourceFile,
    tables: sheets.map(({ name, memoColumns, columnOrder }) => ({
      messageName: name,
      memoColumns: memoColumns.map(({ id, name: memoName }) => ({ id, name: memoName })),
      columnOrder: columnOrder ?? []
    }))
  })
  return {
    magic: EXCEL_METADATA_MAGIC,
    version: EXCEL_METADATA_VERSION,
    sourceFile,
    fingerprint: `dm1-${fnv1a(serialized)}`,
    tables
  }
}

export type ExcelEmbeddedMetadataParseResult =
  | { success: true; metadata: ExcelEmbeddedMetadata }
  | { success: false; issue: 'corrupt' | 'unsupported' }

export function parseExcelEmbeddedMetadata(input: unknown): ExcelEmbeddedMetadataParseResult {
  if (!isRecord(input)) return { success: false, issue: 'corrupt' }
  if (input.version !== EXCEL_METADATA_VERSION) return { success: false, issue: 'unsupported' }
  if (
    input.magic !== EXCEL_METADATA_MAGIC ||
    typeof input.sourceFile !== 'string' ||
    typeof input.fingerprint !== 'string' ||
    !Array.isArray(input.tables)
  ) {
    return { success: false, issue: 'corrupt' }
  }
  const tables: ExcelEmbeddedTableMetadata[] = []
  for (const table of input.tables) {
    if (
      !isRecord(table) ||
      typeof table.messageName !== 'string' ||
      !Array.isArray(table.memoColumns)
    ) {
      return { success: false, issue: 'corrupt' }
    }
    const memoColumns: ExcelMemoColumnPlan[] = []
    for (const memo of table.memoColumns) {
      if (!isRecord(memo) || typeof memo.id !== 'string' || typeof memo.name !== 'string') {
        return { success: false, issue: 'corrupt' }
      }
      memoColumns.push({ id: memo.id, name: memo.name })
    }
    tables.push({ messageName: table.messageName, memoColumns })
  }
  return {
    success: true,
    metadata: {
      magic: EXCEL_METADATA_MAGIC,
      version: EXCEL_METADATA_VERSION,
      sourceFile: input.sourceFile,
      fingerprint: input.fingerprint,
      tables
    }
  }
}

export function hasExcelErrors(result: ExcelValidationResult): boolean {
  return result.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
}

function columnPlan(workspace: ProtoWorkspace, field: ProtoFieldDeclaration): ExcelColumnPlan {
  const enumDeclaration = workspace.enums.find(
    (entry) => entry.name === unqualifiedType(field.type)
  )
  const message = workspace.messages.find((entry) => entry.name === unqualifiedType(field.type))
  const keyField = message
    ? (message.fields.find((entry) => entry.isGroupKey) ??
      message.fields.find((entry) => entry.isPrimaryKey))
    : undefined
  return {
    name: field.name,
    type: field.type,
    fieldNumber: field.fieldNumber,
    label: field.label,
    keyMode: field.isPrimaryKey ? 'primary' : field.isGroupKey ? 'group' : 'none',
    enumValues:
      enumDeclaration?.values
        .filter((value) => !value.name.endsWith('_MAX'))
        .map((value) => value.name) ?? null,
    reference:
      message && keyField
        ? {
            messageName: message.name,
            sourceFile: message.sourceFile,
            keyFieldName: keyField.name,
            keyFieldType: keyField.type
          }
        : null
  }
}

function validateCellType(
  workspace: ProtoWorkspace,
  field: ProtoFieldDeclaration,
  value: Exclude<ExcelDomainValue, null>
): string | null {
  const type = unqualifiedType(field.type)
  if (numericTypes.has(type)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return `must be a ${type} number.`
    if (integerTypes.has(type) && !Number.isInteger(value)) return `must be an integer.`
    return null
  }
  if (type === 'bool') return typeof value === 'boolean' ? null : 'must be a boolean.'
  if (type === 'string' || type === 'bytes') {
    return typeof value === 'string' ? null : `must be a ${type} value.`
  }
  const enumDeclaration = workspace.enums.find((entry) => entry.name === type)
  if (enumDeclaration) {
    if (typeof value !== 'string') return `must use an Enum name from '${type}'.`
    const allowed = enumDeclaration.values
      .filter((entry) => !entry.name.endsWith('_MAX'))
      .some((entry) => entry.name === value)
    return allowed ? null : `contains unknown Enum value '${value}'.`
  }
  const reference = workspace.messages.find((entry) => entry.name === type)
  const keyField = reference
    ? (reference.fields.find((entry) => entry.isGroupKey) ??
      reference.fields.find((entry) => entry.isPrimaryKey))
    : undefined
  if (keyField) return validateCellType(workspace, keyField, value)
  return null
}

function isBlank(value: ExcelDomainValue | undefined): value is null | undefined | '' {
  return value === null || value === undefined || value === ''
}

function excelDiagnostic(
  code: string,
  message: string,
  sourceFile: string,
  sheetName: string,
  row: number,
  column: number,
  severity: ExcelDiagnosticSeverity,
  header?: string
): ExcelDiagnostic {
  return {
    code,
    message,
    sourceFile,
    sheetName,
    row,
    column,
    severity,
    ...(header ? { header } : {})
  }
}

function unqualifiedType(type: string): string {
  return type.replace(/^\./, '').split('.').at(-1) ?? type
}

function orderedMemoColumns(memoColumns: readonly MemoColumn[]): ExcelMemoColumnPlan[] {
  return [...memoColumns]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id, 'en'))
    .map(({ id, name }) => ({ id, name }))
}

function memoColumnsForMessage(
  message: ProtoMessageDeclaration,
  legacyMemoColumns: readonly MemoColumn[]
): ExcelMemoColumnPlan[] {
  if (message.memos.length > 0) {
    return [...message.memos]
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id, 'en'))
      .map(({ id, name }) => ({ id, name }))
  }
  return orderedMemoColumns(legacyMemoColumns)
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function memoSchemaChanges(
  current: readonly ExcelMemoColumnPlan[],
  embedded: readonly ExcelMemoColumnPlan[]
): string[] {
  const currentById = new Map(current.map((memo) => [memo.id, memo]))
  const embeddedById = new Map(embedded.map((memo) => [memo.id, memo]))
  const changes: string[] = []
  for (const memo of current) {
    const previous = embeddedById.get(memo.id)
    if (!previous) changes.push(`추가: ${memo.name}`)
    else if (previous.name !== memo.name) changes.push(`이름 변경: ${previous.name} → ${memo.name}`)
  }
  for (const memo of embedded) {
    if (!currentById.has(memo.id)) changes.push(`삭제: ${memo.name}`)
  }
  return changes.length > 0 ? changes : ['workbook 메타데이터 불일치']
}
import type { DiagnosticLike } from './diagnostics'
