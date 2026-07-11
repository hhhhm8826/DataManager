import { describe, expect, it } from 'vitest'
import {
  FIRST_PARTY_DIAGNOSTIC_PREFIXES,
  formatDiagnostic,
  formatDiagnosticMessage,
  isFirstPartyDiagnosticCode
} from '../src'

describe('diagnostic catalog', () => {
  it('formats the mixed key-mode error in Korean', () => {
    const message = formatDiagnosticMessage({
      code: 'PROTO_MESSAGE_KEY_MODE_CONFLICT',
      message: 'Primary keys and group keys cannot be mixed.'
    })

    expect(message).toContain('기본키와 합성키를 함께 사용할 수 없습니다')
    expect(message).not.toContain('Primary keys')
  })

  it('keeps an unknown raw error only in technical details', () => {
    const formatted = formatDiagnostic({
      code: 'THIRD_PARTY_FAILURE',
      message: 'External tool failed for ItemTable.proto'
    })

    expect(formatted.title).toMatch(/[가-힣]/)
    expect(formatted.message).not.toContain('External tool')
    expect(formatted.technicalDetails).toContain('External tool failed for ItemTable.proto')
  })

  it('keeps path and identifier context in the Korean user message', () => {
    const formatted = formatDiagnostic({
      code: 'FILE_READ_FAILED',
      message: 'Access denied while reading the file.',
      context: { path: 'D:\\한글 경로\\ItemTable.proto', operation: 'read' }
    })

    expect(formatted.message).toContain('D:\\한글 경로\\ItemTable.proto')
    expect(formatted.message).not.toContain('Access denied')
  })

  it('provides a safe Korean fallback for every first-party family', () => {
    for (const prefix of FIRST_PARTY_DIAGNOSTIC_PREFIXES) {
      const code = `${prefix}CATALOG_TEST`
      expect(isFirstPartyDiagnosticCode(code)).toBe(true)
      const formatted = formatDiagnostic({ code, message: 'raw English details' })
      expect(`${formatted.title} ${formatted.message}`).toMatch(/[가-힣]/)
      expect(formatted.message).not.toContain('raw English details')
    }
  })

  it('formats external runtime failures without exposing raw details', () => {
    for (const code of [
      'NATIVE_OPERATION_ABORTED',
      'NATIVE_OPERATION_TIMED_OUT',
      'NATIVE_VALIDATION_FAILED'
    ]) {
      const formatted = formatDiagnostic({ code, message: 'third-party details' })
      expect(`${formatted.title} ${formatted.message}`).toMatch(/[\uAC00-\uD7A3]/)
      expect(formatted.message).not.toContain('third-party details')
      expect(formatted.technicalDetails).toContain('third-party details')
    }
  })
})
