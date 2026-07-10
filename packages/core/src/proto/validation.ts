import type {
  ProtoDiagnostic,
  ProtoEditResult,
  ProtoEnumDeclaration,
  ProtoEnumDraft,
  ProtoEnumValueDraft,
  ProtoFieldDeclaration,
  ProtoMessageDeclaration,
  ProtoMessageDraft,
  SourceSpan
} from './model'

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const typePattern = /^\.?[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/
const maximumFieldNumber = 536_870_911

export function isValidProtoIdentifier(value: string): boolean {
  return identifierPattern.test(value)
}

export function prepareMessageDraft(
  existing: ProtoMessageDeclaration | null,
  draft: ProtoMessageDraft
): ProtoEditResult<ProtoMessageDeclaration> {
  const diagnostics: ProtoDiagnostic[] = []
  const span = existing?.span ?? { start: 0, end: 0 }
  if (!isValidProtoIdentifier(draft.name)) {
    diagnostics.push(
      validationError('PROTO_MESSAGE_NAME_INVALID', `Invalid message name '${draft.name}'.`, span)
    )
  }
  if (draft.fields.length === 0) {
    diagnostics.push(
      validationError(
        'PROTO_MESSAGE_FIELDS_EMPTY',
        'A message must contain at least one field.',
        span
      )
    )
  }

  const names = new Set<string>()
  const existingByName = new Map(existing?.fields.map((field) => [field.name, field]) ?? [])
  const assignedNumbers = new Set<number>()
  let nextFieldNumber =
    Math.max(0, ...(existing?.fields.map((field) => field.fieldNumber) ?? [])) + 1
  let hasPrimaryKey = false
  let hasGroupKey = false

  const fields = draft.fields.map((field, index): ProtoFieldDeclaration => {
    const fieldSpan = existing?.fields[index]?.span ?? span
    if (!isValidProtoIdentifier(field.name)) {
      diagnostics.push(
        validationError(
          'PROTO_FIELD_NAME_INVALID',
          `Invalid field name '${field.name}'.`,
          fieldSpan
        )
      )
    }
    if (names.has(field.name)) {
      diagnostics.push(
        validationError(
          'PROTO_FIELD_NAME_DUPLICATE',
          `Duplicate field name '${field.name}'.`,
          fieldSpan
        )
      )
    }
    names.add(field.name)
    if (!typePattern.test(field.type)) {
      diagnostics.push(
        validationError(
          'PROTO_FIELD_TYPE_INVALID',
          `Invalid field type '${field.type}'.`,
          fieldSpan
        )
      )
    }

    const previous = existingByName.get(field.originalName ?? field.name)
    const fieldNumber = previous?.fieldNumber ?? nextFieldNumber++
    if (
      fieldNumber < 1 ||
      fieldNumber > maximumFieldNumber ||
      (fieldNumber >= 19_000 && fieldNumber <= 19_999)
    ) {
      diagnostics.push(
        validationError(
          'PROTO_FIELD_NUMBER_INVALID',
          `Field '${field.name}' has invalid number ${fieldNumber}.`,
          fieldSpan
        )
      )
    }
    if (assignedNumbers.has(fieldNumber)) {
      diagnostics.push(
        validationError(
          'PROTO_FIELD_NUMBER_DUPLICATE',
          `Duplicate field number ${fieldNumber}.`,
          fieldSpan
        )
      )
    }
    assignedNumbers.add(fieldNumber)

    const isPrimaryKey = field.isPrimaryKey ?? false
    const isGroupKey = field.isGroupKey ?? false
    hasPrimaryKey ||= isPrimaryKey
    hasGroupKey ||= isGroupKey
    if (isPrimaryKey && isGroupKey) {
      diagnostics.push(
        validationError(
          'PROTO_FIELD_KEY_MODE_CONFLICT',
          `Field '${field.name}' cannot use both primary-key and group-key modes.`,
          fieldSpan
        )
      )
    }

    return {
      name: field.name,
      type: field.type,
      fieldNumber,
      label: field.label ?? 'singular',
      isPrimaryKey,
      isGroupKey,
      leadingTrivia: previous?.leadingTrivia ?? '',
      rawDeclaration: previous?.rawDeclaration ?? '',
      optionsText: field.optionsText ?? previous?.optionsText ?? '',
      span: previous?.span ?? { start: 0, end: 0 }
    }
  })

  if (hasPrimaryKey && hasGroupKey) {
    diagnostics.push(
      validationError(
        'PROTO_MESSAGE_KEY_MODE_CONFLICT',
        `Message '${draft.name}' cannot combine primary-key and group-key fields.`,
        span
      )
    )
  }

  if (diagnostics.length > 0) return { success: false, diagnostics }
  return {
    success: true,
    value: {
      kind: 'message',
      name: draft.name,
      fields,
      sourceFile: existing?.sourceFile ?? '',
      span,
      bodySpan: existing?.bodySpan ?? span,
      bodyTrailingTrivia: existing?.bodyTrailingTrivia ?? '',
      readOnly: false,
      diagnostics: []
    }
  }
}

export function prepareEnumDraft(
  existing: ProtoEnumDeclaration | null,
  draft: ProtoEnumDraft
): ProtoEditResult<ProtoEnumDeclaration> {
  const diagnostics: ProtoDiagnostic[] = []
  const span = existing?.span ?? { start: 0, end: 0 }
  if (!isValidProtoIdentifier(draft.name)) {
    diagnostics.push(
      validationError('PROTO_ENUM_NAME_INVALID', `Invalid enum name '${draft.name}'.`, span)
    )
  }

  const noneName = `${draft.name}_NONE`
  const maxName = `${draft.name}_MAX`
  const userValues = draft.values.filter(
    (value) =>
      value.name !== noneName &&
      value.name !== maxName &&
      value.name !== `${existing?.name ?? ''}_NONE` &&
      value.name !== `${existing?.name ?? ''}_MAX`
  )
  const names = new Set<string>([noneName, maxName])
  const numbers = new Set<number>([0])
  for (const value of userValues) {
    if (!isValidProtoIdentifier(value.name)) {
      diagnostics.push(
        validationError(
          'PROTO_ENUM_VALUE_NAME_INVALID',
          `Invalid enum value '${value.name}'.`,
          span
        )
      )
    }
    if (names.has(value.name)) {
      diagnostics.push(
        validationError(
          'PROTO_ENUM_VALUE_NAME_DUPLICATE',
          `Duplicate enum value '${value.name}'.`,
          span
        )
      )
    }
    names.add(value.name)
    if (!Number.isSafeInteger(value.number)) {
      diagnostics.push(
        validationError(
          'PROTO_ENUM_VALUE_NUMBER_INVALID',
          `Enum value '${value.name}' must use an integer.`,
          span
        )
      )
    }
    if (numbers.has(value.number)) {
      diagnostics.push(
        validationError(
          'PROTO_ENUM_VALUE_NUMBER_DUPLICATE',
          `Duplicate enum value number ${value.number}.`,
          span
        )
      )
    }
    numbers.add(value.number)
  }

  if (diagnostics.length > 0) return { success: false, diagnostics }
  const maximum = Math.max(0, ...userValues.map((value) => value.number)) + 1
  const normalizedValues: ProtoEnumValueDraft[] = [
    { name: noneName, number: 0 },
    ...userValues,
    { name: maxName, number: maximum }
  ]
  const existingByName = new Map(existing?.values.map((value) => [value.name, value]) ?? [])
  return {
    success: true,
    value: {
      kind: 'enum',
      name: draft.name,
      values: normalizedValues.map((value) => {
        const previous = existingByName.get(value.name)
        return {
          ...value,
          leadingTrivia: previous?.leadingTrivia ?? '',
          rawDeclaration: previous?.rawDeclaration ?? '',
          span: previous?.span ?? { start: 0, end: 0 }
        }
      }),
      sourceFile: existing?.sourceFile ?? '',
      span,
      bodySpan: existing?.bodySpan ?? span,
      bodyTrailingTrivia: existing?.bodyTrailingTrivia ?? '',
      readOnly: false,
      diagnostics: []
    }
  }
}

function validationError(code: string, message: string, span: SourceSpan): ProtoDiagnostic {
  return { code, message, severity: 'error', span }
}
