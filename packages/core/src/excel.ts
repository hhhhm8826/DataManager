import type { ProtoFieldDeclaration, ProtoMessageDeclaration, ProtoWorkspace } from './proto/model'

export const EXCEL_MAX_DATA_ROWS = 10_000
export const EXCEL_DROPDOWN_SHEET = '_DropDown'

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

export interface ExcelSheetPlan {
  name: string
  columns: ExcelColumnPlan[]
}

export interface ExcelWorkbookPlan {
  sourceFile: string
  fileName: string
  sheets: ExcelSheetPlan[]
}

export interface RawExcelSheet {
  name: string
  headers: string[]
  rows: ExcelDomainValue[][]
}

export interface ExcelReadResult {
  sourceFile: string
  messageName: string
  rows: ExcelDomainRow[]
}

export type ExcelDiagnosticSeverity = 'warning' | 'error'

export interface ExcelDiagnostic {
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
  selectedSourceFiles?: readonly string[]
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
    .map(([sourceFile, messages]) => ({
      sourceFile,
      fileName: sourceFile.replace(/\.proto$/, '') + '.xlsx',
      sheets: messages.map((message) => ({
        name: message.name,
        columns: message.fields.map((field) => columnPlan(workspace, field))
      }))
    }))
}

export function validateExcelSheets(
  workspace: ProtoWorkspace,
  sourceFile: string,
  sheets: readonly RawExcelSheet[]
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
    const headerIndexes = new Map<string, number>()
    for (const [index, header] of sheet.headers.entries()) {
      const column = index + 1
      if (!fieldByName.has(header)) {
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

    const rows: ExcelDomainRow[] = []
    for (const [rowIndex, values] of sheet.rows.entries()) {
      if (values.every(isBlank)) continue
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
