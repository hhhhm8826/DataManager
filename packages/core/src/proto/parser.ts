import { lexProto, significantTokens, type ProtoToken } from './lexer'
import type {
  ProtoDiagnostic,
  ProtoDocument,
  ProtoEnumDeclaration,
  ProtoEnumValueDeclaration,
  ProtoFieldDeclaration,
  ProtoImport,
  ProtoMessageDeclaration
} from './model'

const unsupportedMessageKeywords = new Set([
  'enum',
  'extensions',
  'group',
  'map',
  'message',
  'oneof',
  'required',
  'reserved'
])
const maximumFieldNumber = 536_870_911

interface TokenList {
  readonly length: number
  readonly [index: number]: ProtoToken
}

export function parseProtoDocument(source: string, sourceFile = ''): ProtoDocument {
  const lexed = lexProto(source)
  const tokens = significantTokens(lexed.tokens) as TokenList
  const diagnostics = [...lexed.diagnostics]
  const imports: ProtoImport[] = []
  const messages: ProtoMessageDeclaration[] = []
  const enums: ProtoEnumDeclaration[] = []
  let syntax: string | null = null
  let packageName: string | null = null
  let goPackage: string | null = null
  let readOnly = diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  let index = 0

  while (index < tokens.length) {
    const token = tokens[index]!

    if (token.value === 'syntax') {
      const parsed = parseAssignment(tokens, index)
      if (!parsed) {
        diagnostics.push(
          error('PROTO_SYNTAX_DECLARATION_INVALID', token, 'Invalid syntax declaration.')
        )
        readOnly = true
        index += 1
      } else {
        syntax = unquote(parsed.value.value)
        index = parsed.nextIndex
      }
      continue
    }

    if (token.value === 'package') {
      const parsed = parseQualifiedStatement(source, tokens, index + 1)
      if (!parsed) {
        diagnostics.push(
          error('PROTO_PACKAGE_DECLARATION_INVALID', token, 'Invalid package declaration.')
        )
        readOnly = true
        index += 1
      } else {
        packageName = parsed.value
        index = parsed.nextIndex
      }
      continue
    }

    if (token.value === 'option') {
      const name = tokens[index + 1]!
      const parsed = parseAssignment(tokens, index)
      if (!parsed) {
        diagnostics.push(
          error('PROTO_OPTION_DECLARATION_INVALID', token, 'Invalid option declaration.')
        )
        readOnly = true
        index += 1
      } else {
        if (name?.value === 'go_package') goPackage = unquote(parsed.value.value)
        index = parsed.nextIndex
      }
      continue
    }

    if (token.value === 'import') {
      const parsed = parseImport(tokens, index)
      if (!parsed) {
        diagnostics.push(
          error('PROTO_IMPORT_DECLARATION_INVALID', token, 'Invalid import declaration.')
        )
        readOnly = true
        index += 1
      } else {
        imports.push(parsed.value)
        index = parsed.nextIndex
      }
      continue
    }

    if (token.value === 'message') {
      const parsed = parseMessage(source, sourceFile, tokens, index)
      messages.push(parsed.value)
      diagnostics.push(...parsed.value.diagnostics)
      readOnly ||= parsed.value.readOnly
      index = parsed.nextIndex
      continue
    }

    if (token.value === 'enum') {
      const parsed = parseEnum(source, sourceFile, tokens, index)
      enums.push(parsed.value)
      diagnostics.push(...parsed.value.diagnostics)
      readOnly ||= parsed.value.readOnly
      index = parsed.nextIndex
      continue
    }

    if (token.value === ';') {
      index += 1
      continue
    }

    const nextIndex = skipDeclaration(tokens, index)
    diagnostics.push(
      error(
        'PROTO_TOP_LEVEL_DECLARATION_UNSUPPORTED',
        token,
        `Top-level declaration '${token.value}' is not supported for editing.`
      )
    )
    readOnly = true
    index = nextIndex
  }

  if (syntax !== 'proto3') {
    diagnostics.push({
      code: 'PROTO3_SYNTAX_REQUIRED',
      message: 'Editable DataManager files must declare syntax = "proto3".',
      severity: 'error',
      span: { start: 0, end: Math.min(source.length, 1) }
    })
    readOnly = true
  }

  return {
    source,
    sourceFile,
    lineEnding: source.includes('\r\n') ? '\r\n' : '\n',
    syntax,
    packageName,
    goPackage,
    imports,
    messages,
    enums,
    diagnostics,
    readOnly
  }
}

function parseMessage(
  source: string,
  sourceFile: string,
  tokens: TokenList,
  startIndex: number
): { value: ProtoMessageDeclaration; nextIndex: number } {
  const keyword = tokens[startIndex]!
  const name = tokens[startIndex + 1]!
  const open = tokens[startIndex + 2]!
  const diagnostics: ProtoDiagnostic[] = []
  if (name?.kind !== 'identifier' || open?.value !== '{') {
    const diagnostic = error(
      'PROTO_MESSAGE_DECLARATION_INVALID',
      keyword,
      'Invalid message declaration.'
    )
    return {
      value: {
        kind: 'message',
        name: name?.value ?? '',
        fields: [],
        sourceFile,
        span: { start: keyword.start, end: keyword.end },
        bodySpan: { start: keyword.end, end: keyword.end },
        bodyTrailingTrivia: '',
        readOnly: true,
        diagnostics: [diagnostic]
      },
      nextIndex: startIndex + 1
    }
  }

  const closeIndex = findMatchingBrace(tokens, startIndex + 2)
  if (closeIndex === -1) {
    const diagnostic = error(
      'PROTO_MESSAGE_UNTERMINATED',
      open,
      `Message '${name.value}' is not terminated.`
    )
    return {
      value: {
        kind: 'message',
        name: name.value,
        fields: [],
        sourceFile,
        span: { start: keyword.start, end: source.length },
        bodySpan: { start: open.end, end: source.length },
        bodyTrailingTrivia: '',
        readOnly: true,
        diagnostics: [diagnostic]
      },
      nextIndex: tokens.length
    }
  }

  const fields: ProtoFieldDeclaration[] = []
  let cursor = open.end
  let index = startIndex + 3
  let readOnly = false
  while (index < closeIndex) {
    const parsed = parseField(source, tokens, index, closeIndex, cursor)
    if (!parsed) {
      const token = tokens[index]!
      const keywordName = token.value
      diagnostics.push(
        error(
          'PROTO_MESSAGE_MEMBER_UNSUPPORTED',
          token,
          `Message member '${keywordName}' is not supported for editing.`
        )
      )
      readOnly = true
      index = skipDeclaration(tokens, index, closeIndex)
      cursor = tokens[Math.max(index - 1, 0)]?.end ?? cursor
      continue
    }
    fields.push(parsed.value)
    if (parsed.value.isPrimaryKey && parsed.value.isGroupKey) {
      diagnostics.push(
        error(
          'PROTO_FIELD_KEY_MODE_CONFLICT',
          tokens[index]!,
          `Field '${parsed.value.name}' cannot use both @PK and @Key.`
        )
      )
      readOnly = true
    }
    cursor = parsed.value.span.end
    index = parsed.nextIndex
  }

  if (fields.some((field) => field.isPrimaryKey) && fields.some((field) => field.isGroupKey)) {
    diagnostics.push(
      error(
        'PROTO_MESSAGE_KEY_MODE_CONFLICT',
        name,
        `Message '${name.value}' cannot combine primary-key and group-key fields.`
      )
    )
    readOnly = true
  }

  const fieldDiagnostics = validateParsedFields(fields)
  diagnostics.push(...fieldDiagnostics)
  readOnly ||= fieldDiagnostics.length > 0

  const close = tokens[closeIndex]!
  return {
    value: {
      kind: 'message',
      name: name.value,
      fields,
      sourceFile,
      span: { start: keyword.start, end: close.end },
      bodySpan: { start: open.end, end: close.start },
      bodyTrailingTrivia: source.slice(cursor, close.start),
      readOnly,
      diagnostics
    },
    nextIndex: closeIndex + 1
  }
}

function validateParsedFields(fields: readonly ProtoFieldDeclaration[]): ProtoDiagnostic[] {
  const diagnostics: ProtoDiagnostic[] = []
  const names = new Set<string>()
  const numbers = new Set<number>()
  for (const field of fields) {
    if (names.has(field.name)) {
      diagnostics.push({
        code: 'PROTO_FIELD_NAME_DUPLICATE',
        message: `Duplicate field name '${field.name}'.`,
        severity: 'error',
        span: field.span
      })
    }
    names.add(field.name)
    if (numbers.has(field.fieldNumber)) {
      diagnostics.push({
        code: 'PROTO_FIELD_NUMBER_DUPLICATE',
        message: `Duplicate field number ${field.fieldNumber}.`,
        severity: 'error',
        span: field.span
      })
    }
    numbers.add(field.fieldNumber)
    if (
      field.fieldNumber < 1 ||
      field.fieldNumber > maximumFieldNumber ||
      (field.fieldNumber >= 19_000 && field.fieldNumber <= 19_999)
    ) {
      diagnostics.push({
        code: 'PROTO_FIELD_NUMBER_INVALID',
        message: `Field '${field.name}' has invalid number ${field.fieldNumber}.`,
        severity: 'error',
        span: field.span
      })
    }
  }
  return diagnostics
}

function validateParsedEnumValues(
  enumName: string,
  values: readonly ProtoEnumValueDeclaration[]
): ProtoDiagnostic[] {
  const diagnostics: ProtoDiagnostic[] = []
  const names = new Set<string>()
  const numbers = new Set<number>()
  for (const value of values) {
    if (names.has(value.name)) {
      diagnostics.push({
        code: 'PROTO_ENUM_VALUE_NAME_DUPLICATE',
        message: `Duplicate enum value '${value.name}'.`,
        severity: 'error',
        span: value.span
      })
    }
    names.add(value.name)
    if (numbers.has(value.number)) {
      diagnostics.push({
        code: 'PROTO_ENUM_VALUE_NUMBER_DUPLICATE',
        message: `Duplicate enum value number ${value.number}.`,
        severity: 'error',
        span: value.span
      })
    }
    numbers.add(value.number)
  }

  const none = values.find((value) => value.name === `${enumName}_NONE`)
  if (!none || none.number !== 0) {
    diagnostics.push({
      code: 'PROTO_ENUM_NONE_MISSING',
      message: `Enum '${enumName}' will add ${enumName}_NONE = 0 when edited.`,
      severity: 'warning',
      span: values[0]?.span ?? { start: 0, end: 0 }
    })
  }
  const max = values.find((value) => value.name === `${enumName}_MAX`)
  if (!max) {
    diagnostics.push({
      code: 'PROTO_ENUM_MAX_MISSING',
      message: `Enum '${enumName}' will add ${enumName}_MAX when edited.`,
      severity: 'warning',
      span: values.at(-1)?.span ?? { start: 0, end: 0 }
    })
  }
  return diagnostics
}

function parseField(
  source: string,
  tokens: TokenList,
  startIndex: number,
  endIndex: number,
  triviaStart: number
): { value: ProtoFieldDeclaration; nextIndex: number } | null {
  let index = startIndex
  let label: ProtoFieldDeclaration['label'] = 'singular'
  if (tokens[index]?.value === 'repeated' || tokens[index]?.value === 'optional') {
    label = tokens[index]!.value as 'repeated' | 'optional'
    index += 1
  }
  const memberKeyword = tokens[index]?.value
  if (memberKeyword && unsupportedMessageKeywords.has(memberKeyword)) return null

  const typeStart = tokens[index]!
  if (!typeStart || (typeStart.kind !== 'identifier' && typeStart.value !== '.')) return null
  let nameIndex = -1
  for (let candidate = index + 1; candidate + 1 < endIndex; candidate += 1) {
    if (tokens[candidate]!.kind === 'identifier' && tokens[candidate + 1]!.value === '=') {
      nameIndex = candidate
      break
    }
    if (!['identifier', 'symbol'].includes(tokens[candidate]!.kind)) return null
  }
  if (nameIndex === -1) return null
  const fieldName = tokens[nameIndex]!
  const numberToken = tokens[nameIndex + 2]!
  if (numberToken?.kind !== 'number') return null
  const fieldNumber = Number.parseInt(numberToken.value, 10)
  if (!Number.isSafeInteger(fieldNumber)) return null

  let semicolonIndex = nameIndex + 3
  let bracketDepth = 0
  while (semicolonIndex < endIndex) {
    const value = tokens[semicolonIndex]!.value
    if (value === '[') bracketDepth += 1
    if (value === ']') bracketDepth -= 1
    if (value === ';' && bracketDepth === 0) break
    if (value === '{' || value === '}') return null
    semicolonIndex += 1
  }
  if (tokens[semicolonIndex]?.value !== ';') return null

  const declarationStart = tokens[startIndex]!.start
  const declarationEnd = tokens[semicolonIndex]!.end
  const leadingTrivia = source.slice(triviaStart, declarationStart)
  const type = source.slice(typeStart.start, fieldName.start).trim()
  return {
    value: {
      name: fieldName.value,
      type,
      fieldNumber,
      label,
      isPrimaryKey: annotationPresent(leadingTrivia, '@PK'),
      isGroupKey: annotationPresent(leadingTrivia, '@Key'),
      leadingTrivia,
      rawDeclaration: source.slice(declarationStart, declarationEnd),
      optionsText: source.slice(numberToken.end, tokens[semicolonIndex]!.start).trim(),
      span: { start: declarationStart, end: declarationEnd }
    },
    nextIndex: semicolonIndex + 1
  }
}

function parseEnum(
  source: string,
  sourceFile: string,
  tokens: TokenList,
  startIndex: number
): { value: ProtoEnumDeclaration; nextIndex: number } {
  const keyword = tokens[startIndex]!
  const name = tokens[startIndex + 1]!
  const open = tokens[startIndex + 2]!
  const diagnostics: ProtoDiagnostic[] = []
  if (name?.kind !== 'identifier' || open?.value !== '{') {
    const diagnostic = error('PROTO_ENUM_DECLARATION_INVALID', keyword, 'Invalid enum declaration.')
    return {
      value: {
        kind: 'enum',
        name: name?.value ?? '',
        values: [],
        sourceFile,
        span: { start: keyword.start, end: keyword.end },
        bodySpan: { start: keyword.end, end: keyword.end },
        bodyTrailingTrivia: '',
        readOnly: true,
        diagnostics: [diagnostic]
      },
      nextIndex: startIndex + 1
    }
  }
  const closeIndex = findMatchingBrace(tokens, startIndex + 2)
  if (closeIndex === -1) {
    const diagnostic = error(
      'PROTO_ENUM_UNTERMINATED',
      open,
      `Enum '${name.value}' is not terminated.`
    )
    return {
      value: {
        kind: 'enum',
        name: name.value,
        values: [],
        sourceFile,
        span: { start: keyword.start, end: source.length },
        bodySpan: { start: open.end, end: source.length },
        bodyTrailingTrivia: '',
        readOnly: true,
        diagnostics: [diagnostic]
      },
      nextIndex: tokens.length
    }
  }

  const values: ProtoEnumValueDeclaration[] = []
  let cursor = open.end
  let index = startIndex + 3
  let readOnly = false
  while (index < closeIndex) {
    const valueName = tokens[index]!
    const equals = tokens[index + 1]!
    let numberIndex = index + 2
    let sign = 1
    if (tokens[numberIndex]?.value === '-') {
      sign = -1
      numberIndex += 1
    }
    const number = tokens[numberIndex]!
    let semicolonIndex = numberIndex + 1
    while (semicolonIndex < closeIndex && tokens[semicolonIndex]!.value !== ';') {
      semicolonIndex += 1
    }
    if (
      valueName?.kind !== 'identifier' ||
      equals?.value !== '=' ||
      number?.kind !== 'number' ||
      tokens[semicolonIndex]?.value !== ';'
    ) {
      diagnostics.push(
        error(
          'PROTO_ENUM_MEMBER_UNSUPPORTED',
          valueName,
          `Enum member '${valueName?.value ?? ''}' is not supported for editing.`
        )
      )
      readOnly = true
      index = skipDeclaration(tokens, index, closeIndex)
      cursor = tokens[Math.max(index - 1, 0)]?.end ?? cursor
      continue
    }
    const numericValue = sign * Number.parseInt(number.value, 10)
    const declarationEnd = tokens[semicolonIndex]!.end
    values.push({
      name: valueName.value,
      number: numericValue,
      leadingTrivia: source.slice(cursor, valueName.start),
      rawDeclaration: source.slice(valueName.start, declarationEnd),
      span: { start: valueName.start, end: declarationEnd }
    })
    cursor = declarationEnd
    index = semicolonIndex + 1
  }

  const close = tokens[closeIndex]!
  const valueDiagnostics = validateParsedEnumValues(name.value, values)
  diagnostics.push(...valueDiagnostics)
  readOnly ||= valueDiagnostics.some((diagnostic) => diagnostic.severity === 'error')
  return {
    value: {
      kind: 'enum',
      name: name.value,
      values,
      sourceFile,
      span: { start: keyword.start, end: close.end },
      bodySpan: { start: open.end, end: close.start },
      bodyTrailingTrivia: source.slice(cursor, close.start),
      readOnly,
      diagnostics
    },
    nextIndex: closeIndex + 1
  }
}

function parseAssignment(
  tokens: TokenList,
  startIndex: number
): { value: ProtoToken; nextIndex: number } | null {
  let equalsIndex = startIndex + 1
  while (equalsIndex < tokens.length && tokens[equalsIndex]!.value !== '=') equalsIndex += 1
  const value = tokens[equalsIndex + 1]!
  const semicolon = tokens[equalsIndex + 2]!
  if (!value || semicolon?.value !== ';') return null
  return { value, nextIndex: equalsIndex + 3 }
}

function parseQualifiedStatement(
  source: string,
  tokens: TokenList,
  startIndex: number
): { value: string; nextIndex: number } | null {
  let semicolonIndex = startIndex
  while (semicolonIndex < tokens.length && tokens[semicolonIndex]!.value !== ';') {
    semicolonIndex += 1
  }
  if (semicolonIndex === tokens.length || semicolonIndex === startIndex) return null
  return {
    value: source.slice(tokens[startIndex]!.start, tokens[semicolonIndex]!.start).trim(),
    nextIndex: semicolonIndex + 1
  }
}

function parseImport(
  tokens: TokenList,
  startIndex: number
): { value: ProtoImport; nextIndex: number } | null {
  const keyword = tokens[startIndex]!
  let index = startIndex + 1
  let modifier: ProtoImport['modifier'] = 'normal'
  if (tokens[index]?.value === 'public' || tokens[index]?.value === 'weak') {
    modifier = tokens[index]!.value as 'public' | 'weak'
    index += 1
  }
  const path = tokens[index]!
  const semicolon = tokens[index + 1]!
  if (path?.kind !== 'string' || semicolon?.value !== ';') return null
  return {
    value: {
      path: unquote(path.value),
      modifier,
      span: { start: keyword.start, end: semicolon.end }
    },
    nextIndex: index + 2
  }
}

function findMatchingBrace(tokens: TokenList, openIndex: number): number {
  let depth = 0
  for (let index = openIndex; index < tokens.length; index += 1) {
    if (tokens[index]!.value === '{') depth += 1
    if (tokens[index]!.value === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

function skipDeclaration(tokens: TokenList, startIndex: number, limit = tokens.length): number {
  let index = startIndex
  while (index < limit) {
    if (tokens[index]!.value === ';') return index + 1
    if (tokens[index]!.value === '{') {
      const close = findMatchingBrace(tokens, index)
      return close === -1 ? limit : close + 1
    }
    index += 1
  }
  return Math.min(index + 1, limit)
}

function annotationPresent(trivia: string, annotation: '@PK' | '@Key'): boolean {
  const comments = trivia.match(/\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g) ?? []
  return comments.some((comment) => new RegExp(`${annotation}\\b`).test(comment))
}

function unquote(value: string): string {
  if (value.length >= 2 && (value.charAt(0) === '"' || value.charAt(0) === "'")) {
    return value.slice(1, -1)
  }
  return value
}

function error(code: string, token: ProtoToken, message: string): ProtoDiagnostic {
  return {
    code,
    message,
    severity: 'error',
    span: { start: token.start, end: token.end }
  }
}
