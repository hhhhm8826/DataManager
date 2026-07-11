import type { ExcelDomainRow, ExcelDomainValue, ExcelReadResult } from './excel'
import type { ProtoMessageDeclaration, ProtoWorkspace } from './proto/model'

export type JsonScalar = string | number | boolean | null
export type JsonValue = JsonScalar | JsonObject | JsonValue[]
export interface JsonObject {
  [key: string]: JsonValue
}

export interface JsonExportDiagnostic extends DiagnosticLike {
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

export const JSON_REFERENCE_EXPANSION_LIMIT = 100_000

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
          .filter((type) => type !== message.name && messages.has(type))
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
    const rows = resolveMessageRows(
      workspace,
      message,
      result.rows,
      rowsByName,
      resolvedRows,
      diagnostics
    )
    resolvedRows.set(messageName, rows)
    if (diagnostics.length > 0) break
  }

  if (diagnostics.length > 0) {
    return { order: dependency.order, files: [], diagnostics: deduplicateDiagnostics(diagnostics) }
  }
  const files: JsonExportFile[] = []
  for (const messageName of dependency.order) {
    const rows = resolvedRows.get(messageName) ?? []
    const expandedObjects = countExpandedObjects(rows, JSON_REFERENCE_EXPANSION_LIMIT)
    if (expandedObjects > JSON_REFERENCE_EXPANSION_LIMIT) {
      const message = messageByName.get(messageName)!
      diagnostics.push({
        ...jsonDiagnostic(
          'JSON_REFERENCE_EXPANSION_LIMIT',
          `JSON reference expansion exceeded ${JSON_REFERENCE_EXPANSION_LIMIT} row objects.`,
          message.sourceFile,
          messageName,
          0
        ),
        params: { limit: JSON_REFERENCE_EXPANSION_LIMIT, count: expandedObjects }
      })
      break
    }
    files.push({
      messageName,
      fileName: `${messageName}.json`,
      contents: stringifyJson(rows)
    })
  }
  if (diagnostics.length > 0) {
    return { order: dependency.order, files: [], diagnostics: deduplicateDiagnostics(diagnostics) }
  }
  return { order: dependency.order, files, diagnostics: [] }
}

interface PendingSelfReference {
  fieldName: string
  matchIndexes: number[]
  matchCursor: number
  matches: JsonObject[]
  returnsArray: boolean
}

interface RowResolutionFrame {
  rowIndex: number
  fieldIndex: number
  result: JsonObject
  pending?: PendingSelfReference
}

function resolveMessageRows(
  workspace: ProtoWorkspace,
  message: ProtoMessageDeclaration,
  rows: readonly ExcelDomainRow[],
  rawRows: ReadonlyMap<string, ExcelReadResult>,
  resolvedRows: ReadonlyMap<string, JsonObject[]>,
  diagnostics: JsonExportDiagnostic[]
): JsonObject[] {
  const memo = new Map<number, JsonObject>()
  const visiting = new Set<number>()
  const frames: RowResolutionFrame[] = []
  const path: number[] = []
  const lookupIndexes = new Map<string, Map<string, number[]>>()

  const matchIndexesFor = (
    targetName: string,
    targetRows: readonly ExcelDomainRow[],
    keyFieldName: string,
    value: ExcelDomainValue
  ): number[] => {
    const cacheKey = `${targetName}\u0000${keyFieldName}`
    let index = lookupIndexes.get(cacheKey)
    if (!index) {
      index = new Map<string, number[]>()
      for (const [rowIndex, candidate] of targetRows.entries()) {
        const key = lookupScalar(candidate[keyFieldName])
        const matches = index.get(key) ?? []
        matches.push(rowIndex)
        index.set(key, matches)
      }
      lookupIndexes.set(cacheKey, index)
    }
    return index.get(lookupScalar(value)) ?? []
  }

  const pushFrame = (rowIndex: number): void => {
    visiting.add(rowIndex)
    path.push(rowIndex)
    frames.push({ rowIndex, fieldIndex: 0, result: {} })
  }

  for (let rootIndex = 0; rootIndex < rows.length; rootIndex += 1) {
    if (memo.has(rootIndex)) continue
    pushFrame(rootIndex)
    while (frames.length > 0 && diagnostics.length === 0) {
      const frame = frames.at(-1)!
      const row = rows[frame.rowIndex]!

      if (frame.pending) {
        const pending = frame.pending
        if (pending.matchCursor < pending.matchIndexes.length) {
          const targetIndex = pending.matchIndexes[pending.matchCursor]!
          const resolved = memo.get(targetIndex)
          if (resolved) {
            pending.matches.push(resolved)
            pending.matchCursor += 1
            continue
          }
          if (visiting.has(targetIndex)) {
            const cycleStart = path.indexOf(targetIndex)
            const cycle = [...path.slice(cycleStart), targetIndex]
            const cyclePath = cycle
              .map((index) => rowIdentity(message, rows[index]!, index))
              .join(' -> ')
            diagnostics.push({
              ...jsonDiagnostic(
                'JSON_REFERENCE_ROW_CYCLE',
                `Self-reference row cycle detected: ${cyclePath}.`,
                message.sourceFile,
                message.name,
                frame.rowIndex + 2,
                pending.fieldName
              ),
              context: { path: cyclePath }
            })
            break
          }
          pushFrame(targetIndex)
          continue
        }
        frame.result[pending.fieldName] = pending.returnsArray
          ? pending.matches
          : pending.matches[0]!
        delete frame.pending
        frame.fieldIndex += 1
        continue
      }

      if (frame.fieldIndex >= message.fields.length) {
        memo.set(frame.rowIndex, frame.result)
        visiting.delete(frame.rowIndex)
        frames.pop()
        path.pop()
        continue
      }

      const field = message.fields[frame.fieldIndex]!
      if (!Object.hasOwn(row, field.name)) {
        frame.fieldIndex += 1
        continue
      }
      const rawValue = row[field.name] ?? null
      const targetName = unqualifiedType(field.type)
      const target = workspace.messages.find((candidate) => candidate.name === targetName)
      if (!target || rawValue === null || rawValue === '') {
        frame.result[field.name] = rawValue
        frame.fieldIndex += 1
        continue
      }

      const targetRaw = rawRows.get(targetName)
      const targetResolved = targetName === message.name ? undefined : resolvedRows.get(targetName)
      if (!targetRaw || (targetName !== message.name && !targetResolved)) {
        diagnostics.push(
          jsonDiagnostic(
            'JSON_REFERENCE_DEPENDENCY_UNRESOLVED',
            `Reference target '${targetName}' was not resolved before '${message.name}'.`,
            message.sourceFile,
            message.name,
            frame.rowIndex + 2,
            field.name
          )
        )
        break
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
            frame.rowIndex + 2,
            field.name
          )
        )
        break
      }
      const matchIndexes = matchIndexesFor(targetName, targetRaw.rows, keyField.name, rawValue)
      if (matchIndexes.length === 0) {
        diagnostics.push(
          jsonDiagnostic(
            'JSON_REFERENCE_TARGET_MISSING',
            `No '${targetName}' row matches ${keyField.name}=${String(rawValue)}.`,
            message.sourceFile,
            message.name,
            frame.rowIndex + 2,
            field.name
          )
        )
        break
      }
      const returnsArray = groupKeys.length > 0 || primaryKeys.length > 1
      if (!returnsArray && matchIndexes.length > 1) {
        diagnostics.push(
          jsonDiagnostic(
            'JSON_REFERENCE_TARGET_DUPLICATE',
            `Reference target '${targetName}' has multiple rows for ${keyField.name}=${String(rawValue)}.`,
            message.sourceFile,
            message.name,
            frame.rowIndex + 2,
            field.name
          )
        )
        break
      }

      if (targetName === message.name) {
        frame.pending = {
          fieldName: field.name,
          matchIndexes,
          matchCursor: 0,
          matches: [],
          returnsArray
        }
      } else {
        const matches = matchIndexes.map((index) => targetResolved![index]!)
        frame.result[field.name] = returnsArray ? matches : matches[0]!
        frame.fieldIndex += 1
      }
    }
    if (diagnostics.length > 0) break
  }

  return rows.map((_, index) => memo.get(index) ?? {})
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

function lookupScalar(value: ExcelDomainValue | undefined): string {
  if (value === null || value === undefined) return 'null:'
  if (typeof value === 'boolean') return `boolean:${String(value)}`
  const numeric = Number(value)
  return Number.isFinite(numeric) ? `number:${String(numeric)}` : `${typeof value}:${String(value)}`
}

function stableScalar(value: Exclude<ExcelDomainValue, null>): string {
  return `${typeof value}:${String(value)}`
}

function isBlank(value: ExcelDomainValue | undefined): value is null | undefined | '' {
  return value === null || value === undefined || value === ''
}

function rowIdentity(
  message: ProtoMessageDeclaration,
  row: ExcelDomainRow,
  rowIndex: number
): string {
  const keys = message.fields.filter((field) => field.isPrimaryKey || field.isGroupKey)
  const keyText = keys.map((field) => `${field.name}=${String(row[field.name] ?? '')}`).join(', ')
  return `${message.name} R${rowIndex + 2}${keyText ? ` (${keyText})` : ''}`
}

function countExpandedObjects(value: JsonValue, limit: number): number {
  let count = 0
  const stack: JsonValue[] = [value]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (Array.isArray(current)) {
      for (const entry of current) stack.push(entry)
    } else if (typeof current === 'object' && current !== null) {
      count += 1
      if (count > limit) return count
      for (const entry of Object.values(current)) stack.push(entry)
    }
  }
  return count
}

type StringifyTask =
  { type: 'text'; text: string } | { type: 'value'; value: JsonValue; depth: number }

function stringifyJson(value: JsonValue): string {
  const chunks: string[] = []
  const tasks: StringifyTask[] = [{ type: 'value', value, depth: 0 }]
  while (tasks.length > 0) {
    const task = tasks.pop()!
    if (task.type === 'text') {
      chunks.push(task.text)
      continue
    }
    const current = task.value
    if (current === null || typeof current !== 'object') {
      chunks.push(JSON.stringify(current))
      continue
    }
    const indent = '  '.repeat(task.depth + 1)
    const closingIndent = '  '.repeat(task.depth)
    if (Array.isArray(current)) {
      if (current.length === 0) {
        chunks.push('[]')
        continue
      }
      chunks.push('[\n')
      tasks.push({ type: 'text', text: `\n${closingIndent}]` })
      for (let index = current.length - 1; index >= 0; index -= 1) {
        tasks.push({ type: 'text', text: index < current.length - 1 ? ',\n' : '' })
        tasks.push({ type: 'value', value: current[index]!, depth: task.depth + 1 })
        tasks.push({ type: 'text', text: indent })
      }
      continue
    }
    const entries = Object.entries(current)
    if (entries.length === 0) {
      chunks.push('{}')
      continue
    }
    chunks.push('{\n')
    tasks.push({ type: 'text', text: `\n${closingIndent}}` })
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const [key, entry] = entries[index]!
      tasks.push({ type: 'text', text: index < entries.length - 1 ? ',\n' : '' })
      tasks.push({ type: 'value', value: entry, depth: task.depth + 1 })
      tasks.push({ type: 'text', text: `${indent}${JSON.stringify(key)}: ` })
    }
  }
  return `${chunks.join('')}\n`
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
import type { DiagnosticLike } from './diagnostics'
