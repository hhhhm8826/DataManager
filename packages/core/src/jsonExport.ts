import type { ExcelDomainRow, ExcelDomainValue, ExcelReadResult } from './excel'
import type { ProtoMessageDeclaration, ProtoWorkspace } from './proto/model'

export type JsonScalar = string | number | boolean | null
export type JsonValue = JsonScalar | JsonObject | JsonValue[]
export interface JsonObject {
  [key: string]: JsonValue
}

export interface JsonExportDiagnostic {
  code: string
  message: string
  sourceFile: string
  messageName: string
  fieldName?: string
  row: number
}

export interface JsonExportFile {
  messageName: string
  fileName: string
  contents: string
}

export interface JsonExportResult {
  order: string[]
  files: JsonExportFile[]
  diagnostics: JsonExportDiagnostic[]
}

interface DependencyResult {
  order: string[]
  diagnostics: JsonExportDiagnostic[]
}

export function collectJsonExportDependencies(
  workspace: ProtoWorkspace,
  selectedMessageNames: readonly string[]
): DependencyResult {
  const messages = new Map(workspace.messages.map((message) => [message.name, message]))
  const diagnostics: JsonExportDiagnostic[] = []
  const state = new Map<string, 'visiting' | 'visited'>()
  const order: string[] = []
  const stack: string[] = []

  const visit = (name: string): void => {
    const message = messages.get(name)
    if (!message) {
      diagnostics.push(
        jsonDiagnostic('JSON_MESSAGE_NOT_FOUND', `Message '${name}' was not found.`, '', name, 0)
      )
      return
    }
    if (state.get(name) === 'visited') return
    if (state.get(name) === 'visiting') {
      const start = stack.indexOf(name)
      const cycle = [...stack.slice(start), name]
      diagnostics.push(
        jsonDiagnostic(
          'JSON_REFERENCE_CYCLE',
          `Reference cycle detected: ${cycle.join(' -> ')}.`,
          message.sourceFile,
          name,
          0
        )
      )
      return
    }
    state.set(name, 'visiting')
    stack.push(name)
    const dependencies = [
      ...new Set(
        message.fields
          .map((field) => unqualifiedType(field.type))
          .filter((type) => messages.has(type))
      )
    ].sort((left, right) => left.localeCompare(right, 'en'))
    dependencies.forEach(visit)
    stack.pop()
    state.set(name, 'visited')
    order.push(name)
  }

  ;[...new Set(selectedMessageNames)]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .forEach(visit)
  return { order, diagnostics: deduplicateDiagnostics(diagnostics) }
}

export function exportResolvedJson(
  workspace: ProtoWorkspace,
  excelResults: readonly ExcelReadResult[],
  selectedMessageNames: readonly string[]
): JsonExportResult {
  const dependency = collectJsonExportDependencies(workspace, selectedMessageNames)
  const diagnostics = [...dependency.diagnostics]
  const messageByName = new Map(workspace.messages.map((message) => [message.name, message]))
  const rowsByName = new Map(excelResults.map((result) => [result.messageName, result]))

  for (const messageName of dependency.order) {
    const message = messageByName.get(messageName)!
    const result = rowsByName.get(messageName)
    if (!result) {
      diagnostics.push(
        jsonDiagnostic(
          'JSON_DEPENDENCY_DATA_MISSING',
          `Excel rows for dependency '${messageName}' are missing.`,
          message.sourceFile,
          messageName,
          0
        )
      )
      continue
    }
    diagnostics.push(...validateMessageKeys(message, result.rows))
  }

  if (diagnostics.length > 0) {
    return { order: dependency.order, files: [], diagnostics: deduplicateDiagnostics(diagnostics) }
  }

  const resolvedRows = new Map<string, JsonObject[]>()
  for (const messageName of dependency.order) {
    const message = messageByName.get(messageName)!
    const result = rowsByName.get(messageName)!
    const rows = result.rows.map((row, index) =>
      resolveRow(workspace, message, row, index + 2, rowsByName, resolvedRows, diagnostics)
    )
    resolvedRows.set(messageName, rows)
  }

  if (diagnostics.length > 0) {
    return { order: dependency.order, files: [], diagnostics: deduplicateDiagnostics(diagnostics) }
  }
  const files = dependency.order.map((messageName) => ({
    messageName,
    fileName: `${messageName}.json`,
    contents: `${JSON.stringify(resolvedRows.get(messageName) ?? [], null, 2)}\n`
  }))
  return { order: dependency.order, files, diagnostics: [] }
}

function resolveRow(
  workspace: ProtoWorkspace,
  message: ProtoMessageDeclaration,
  row: ExcelDomainRow,
  excelRow: number,
  rawRows: ReadonlyMap<string, ExcelReadResult>,
  resolvedRows: ReadonlyMap<string, JsonObject[]>,
  diagnostics: JsonExportDiagnostic[]
): JsonObject {
  const result: JsonObject = {}
  for (const field of message.fields) {
    if (!Object.hasOwn(row, field.name)) continue
    const rawValue = row[field.name] ?? null
    const targetName = unqualifiedType(field.type)
    const target = workspace.messages.find((candidate) => candidate.name === targetName)
    if (!target || rawValue === null || rawValue === '') {
      result[field.name] = rawValue
      continue
    }
    const targetRaw = rawRows.get(targetName)
    const targetResolved = resolvedRows.get(targetName)
    if (!targetRaw || !targetResolved) {
      diagnostics.push(
        jsonDiagnostic(
          'JSON_REFERENCE_DEPENDENCY_UNRESOLVED',
          `Reference target '${targetName}' was not resolved before '${message.name}'.`,
          message.sourceFile,
          message.name,
          excelRow,
          field.name
        )
      )
      result[field.name] = rawValue
      continue
    }
    const groupKeys = target.fields.filter((candidate) => candidate.isGroupKey)
    const primaryKeys = target.fields.filter((candidate) => candidate.isPrimaryKey)
    const keyField = groupKeys[0] ?? primaryKeys[0]
    if (!keyField) {
      diagnostics.push(
        jsonDiagnostic(
          'JSON_REFERENCE_TARGET_HAS_NO_KEY',
          `Reference target '${targetName}' has no primary or group key.`,
          message.sourceFile,
          message.name,
          excelRow,
          field.name
        )
      )
      result[field.name] = rawValue
      continue
    }
    const matchIndexes = targetRaw.rows
      .map((candidate, index) => (valuesEqual(candidate[keyField.name], rawValue) ? index : -1))
      .filter((index) => index >= 0)
    if (matchIndexes.length === 0) {
      diagnostics.push(
        jsonDiagnostic(
          'JSON_REFERENCE_TARGET_MISSING',
          `No '${targetName}' row matches ${keyField.name}=${String(rawValue)}.`,
          message.sourceFile,
          message.name,
          excelRow,
          field.name
        )
      )
      result[field.name] = rawValue
      continue
    }
    const matches = matchIndexes.map((index) => cloneJsonObject(targetResolved[index]!))
    if (groupKeys.length > 0 || primaryKeys.length > 1) {
      result[field.name] = matches
    } else if (matches.length === 1) {
      result[field.name] = matches[0]!
    } else {
      diagnostics.push(
        jsonDiagnostic(
          'JSON_REFERENCE_TARGET_DUPLICATE',
          `Reference target '${targetName}' has multiple rows for ${keyField.name}=${String(rawValue)}.`,
          message.sourceFile,
          message.name,
          excelRow,
          field.name
        )
      )
      result[field.name] = rawValue
    }
  }
  return result
}

function validateMessageKeys(
  message: ProtoMessageDeclaration,
  rows: readonly ExcelDomainRow[]
): JsonExportDiagnostic[] {
  const diagnostics: JsonExportDiagnostic[] = []
  const primaryKeys = message.fields.filter((field) => field.isPrimaryKey)
  const groupKeys = message.fields.filter((field) => field.isGroupKey)
  const requiredKeys = primaryKeys.length > 0 ? primaryKeys : groupKeys
  const tuples = new Set<string>()
  for (const [index, row] of rows.entries()) {
    for (const field of requiredKeys) {
      const value = row[field.name]
      if (value === null || value === undefined || value === '') {
        diagnostics.push(
          jsonDiagnostic(
            'JSON_REQUIRED_KEY_EMPTY',
            `Key field '${field.name}' cannot be empty.`,
            message.sourceFile,
            message.name,
            index + 2,
            field.name
          )
        )
      }
    }
    if (primaryKeys.length > 0 && primaryKeys.every((field) => !isBlank(row[field.name]))) {
      const tuple = primaryKeys.map((field) => stableScalar(row[field.name]!)).join('\u0000')
      if (tuples.has(tuple)) {
        diagnostics.push(
          jsonDiagnostic(
            'JSON_PRIMARY_KEY_DUPLICATE',
            `Primary key tuple is duplicated.`,
            message.sourceFile,
            message.name,
            index + 2
          )
        )
      }
      tuples.add(tuple)
    }
  }
  return diagnostics
}

function valuesEqual(left: ExcelDomainValue | undefined, right: ExcelDomainValue): boolean {
  if (left === right) return true
  if (left === null || left === undefined || right === null) return false
  if (typeof left === 'boolean' || typeof right === 'boolean') return false
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber
}

function stableScalar(value: Exclude<ExcelDomainValue, null>): string {
  return `${typeof value}:${String(value)}`
}

function isBlank(value: ExcelDomainValue | undefined): value is null | undefined | '' {
  return value === null || value === undefined || value === ''
}

function cloneJsonObject(value: JsonObject): JsonObject {
  return structuredClone(value)
}

function jsonDiagnostic(
  code: string,
  message: string,
  sourceFile: string,
  messageName: string,
  row: number,
  fieldName?: string
): JsonExportDiagnostic {
  return { code, message, sourceFile, messageName, row, ...(fieldName ? { fieldName } : {}) }
}

function deduplicateDiagnostics(
  diagnostics: readonly JsonExportDiagnostic[]
): JsonExportDiagnostic[] {
  const seen = new Set<string>()
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.code}:${diagnostic.sourceFile}:${diagnostic.messageName}:${diagnostic.fieldName ?? ''}:${diagnostic.row}:${diagnostic.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function unqualifiedType(type: string): string {
  return type.replace(/^\./, '').split('.').at(-1) ?? type
}
