import type { ProtoDiagnostic, SourceSpan } from './model'

export type ProtoTokenKind =
  'identifier' | 'number' | 'string' | 'symbol' | 'whitespace' | 'lineComment' | 'blockComment'

export interface ProtoToken extends SourceSpan {
  kind: ProtoTokenKind
  value: string
}

export interface ProtoLexResult {
  tokens: ProtoToken[]
  diagnostics: ProtoDiagnostic[]
}

const identifierStart = /[A-Za-z_]/
const identifierPart = /[A-Za-z0-9_]/
const digit = /[0-9]/

export function lexProto(source: string): ProtoLexResult {
  const tokens: ProtoToken[] = []
  const diagnostics: ProtoDiagnostic[] = []
  let offset = 0

  const push = (kind: ProtoTokenKind, start: number, end: number): void => {
    tokens.push({ kind, value: source.slice(start, end), start, end })
  }

  while (offset < source.length) {
    const start = offset
    const current = source.charAt(offset)

    if (/\s/.test(current)) {
      offset += 1
      while (offset < source.length && /\s/.test(source.charAt(offset))) offset += 1
      push('whitespace', start, offset)
      continue
    }

    if (current === '/' && source.charAt(offset + 1) === '/') {
      offset += 2
      while (offset < source.length && source.charAt(offset) !== '\n') offset += 1
      push('lineComment', start, offset)
      continue
    }

    if (current === '/' && source.charAt(offset + 1) === '*') {
      offset += 2
      while (
        offset < source.length &&
        !(source.charAt(offset) === '*' && source.charAt(offset + 1) === '/')
      ) {
        offset += 1
      }
      if (offset >= source.length) {
        push('blockComment', start, source.length)
        diagnostics.push({
          code: 'PROTO_UNTERMINATED_BLOCK_COMMENT',
          message: 'Block comment is not terminated.',
          severity: 'error',
          span: { start, end: source.length }
        })
        break
      }
      offset += 2
      push('blockComment', start, offset)
      continue
    }

    if (current === '"' || current === "'") {
      const quote = current
      offset += 1
      let escaped = false
      while (offset < source.length) {
        const character = source.charAt(offset)
        offset += 1
        if (escaped) {
          escaped = false
        } else if (character === '\\') {
          escaped = true
        } else if (character === quote) {
          break
        }
      }
      push('string', start, offset)
      if (source.charAt(offset - 1) !== quote) {
        diagnostics.push({
          code: 'PROTO_UNTERMINATED_STRING',
          message: 'String literal is not terminated.',
          severity: 'error',
          span: { start, end: offset }
        })
      }
      continue
    }

    if (identifierStart.test(current)) {
      offset += 1
      while (offset < source.length && identifierPart.test(source.charAt(offset))) offset += 1
      push('identifier', start, offset)
      continue
    }

    if (digit.test(current)) {
      offset += 1
      while (offset < source.length && /[0-9A-Fa-f_xX.]/.test(source.charAt(offset))) {
        offset += 1
      }
      push('number', start, offset)
      continue
    }

    offset += 1
    push('symbol', start, offset)
  }

  return { tokens, diagnostics }
}

export function significantTokens(tokens: ProtoToken[]): ProtoToken[] {
  return tokens.filter(
    (token) =>
      token.kind !== 'whitespace' && token.kind !== 'lineComment' && token.kind !== 'blockComment'
  )
}
