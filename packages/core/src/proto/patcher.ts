import type {
  ProtoDiagnostic,
  ProtoDocument,
  ProtoEditResult,
  ProtoEnumDeclaration,
  ProtoEnumDraft,
  ProtoFieldDeclaration,
  ProtoFieldDraft,
  ProtoMessageDeclaration,
  ProtoMessageDraft,
  ProtoMemoDeclaration,
  ProtoReferenceImpact
} from './model'
import { parseProtoDocument } from './parser'
import { prepareEnumDraft, prepareMessageDraft } from './validation'

const primitiveTypes = new Set([
  'bool',
  'bytes',
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
  'string',
  'uint32',
  'uint64'
])

export interface ProtoPatchValue<T> {
  source: string
  declaration: T
}

export function updateMessage(
  document: ProtoDocument,
  existingName: string,
  draft: ProtoMessageDraft,
  typeSources: ReadonlyMap<string, string> = new Map()
): ProtoEditResult<ProtoPatchValue<ProtoMessageDeclaration>> {
  const existing = document.messages.find((message) => message.name === existingName)
  const blocked = editableTarget(document, existing, 'message', existingName)
  if (blocked) return blocked
  const prepared = prepareMessageDraft(existing ?? null, draft)
  if (!prepared.success) return prepared
  const replacement = renderMessage(document, existing!, prepared.value, draft.fields)
  let source = replaceSpan(document.source, existing!.span, replacement)
  let reparsed = parseProtoDocument(source, document.sourceFile)
  source = ensureImports(reparsed, dependenciesForMessage(draft, document.sourceFile, typeSources))
  reparsed = parseProtoDocument(source, document.sourceFile)
  const declaration = reparsed.messages.find((message) => message.name === draft.name)
  if (!declaration) return internalPatchFailure('PROTO_MESSAGE_REPARSE_FAILED', existing!.span)
  return { success: true, value: { source, declaration } }
}

export function updateEnum(
  document: ProtoDocument,
  existingName: string,
  draft: ProtoEnumDraft
): ProtoEditResult<ProtoPatchValue<ProtoEnumDeclaration>> {
  const existing = document.enums.find((entry) => entry.name === existingName)
  const blocked = editableTarget(document, existing, 'enum', existingName)
  if (blocked) return blocked
  const prepared = prepareEnumDraft(existing ?? null, draft)
  if (!prepared.success) return prepared
  const replacement = renderEnum(document, existing!, prepared.value)
  const source = replaceSpan(document.source, existing!.span, replacement)
  const reparsed = parseProtoDocument(source, document.sourceFile)
  const declaration = reparsed.enums.find((entry) => entry.name === draft.name)
  if (!declaration) return internalPatchFailure('PROTO_ENUM_REPARSE_FAILED', existing!.span)
  return { success: true, value: { source, declaration } }
}

export function addMessage(
  document: ProtoDocument,
  draft: ProtoMessageDraft,
  typeSources: ReadonlyMap<string, string> = new Map()
): ProtoEditResult<ProtoPatchValue<ProtoMessageDeclaration>> {
  if (document.readOnly) return documentReadOnly(document)
  if (document.messages.some((message) => message.name === draft.name)) {
    return editFailure('PROTO_MESSAGE_NAME_DUPLICATE', `Message '${draft.name}' already exists.`)
  }
  const prepared = prepareMessageDraft(null, draft)
  if (!prepared.success) return prepared
  let source = ensureImports(
    document,
    dependenciesForMessage(draft, document.sourceFile, typeSources)
  )
  const reparsedAfterImports = parseProtoDocument(source, document.sourceFile)
  const separator = source.endsWith(reparsedAfterImports.lineEnding)
    ? reparsedAfterImports.lineEnding
    : reparsedAfterImports.lineEnding.repeat(2)
  source +=
    separator +
    renderNewMessage(reparsedAfterImports, prepared.value) +
    reparsedAfterImports.lineEnding
  const reparsed = parseProtoDocument(source, document.sourceFile)
  const declaration = reparsed.messages.find((message) => message.name === draft.name)
  if (!declaration)
    return internalPatchFailure('PROTO_MESSAGE_REPARSE_FAILED', { start: 0, end: 0 })
  return { success: true, value: { source, declaration } }
}

export function addEnum(
  document: ProtoDocument,
  draft: ProtoEnumDraft
): ProtoEditResult<ProtoPatchValue<ProtoEnumDeclaration>> {
  if (document.readOnly) return documentReadOnly(document)
  if (document.enums.some((entry) => entry.name === draft.name)) {
    return editFailure('PROTO_ENUM_NAME_DUPLICATE', `Enum '${draft.name}' already exists.`)
  }
  const prepared = prepareEnumDraft(null, draft)
  if (!prepared.success) return prepared
  const separator = document.source.endsWith(document.lineEnding)
    ? document.lineEnding
    : document.lineEnding.repeat(2)
  const source =
    document.source + separator + renderNewEnum(document, prepared.value) + document.lineEnding
  const reparsed = parseProtoDocument(source, document.sourceFile)
  const declaration = reparsed.enums.find((entry) => entry.name === draft.name)
  if (!declaration) return internalPatchFailure('PROTO_ENUM_REPARSE_FAILED', { start: 0, end: 0 })
  return { success: true, value: { source, declaration } }
}

export function deleteDeclaration(
  document: ProtoDocument,
  kind: 'message' | 'enum',
  name: string
): ProtoEditResult<string> {
  const declaration =
    kind === 'message'
      ? document.messages.find((message) => message.name === name)
      : document.enums.find((entry) => entry.name === name)
  const blocked = editableTarget(document, declaration, kind, name)
  if (blocked) return blocked
  return { success: true, value: replaceSpan(document.source, declaration!.span, '') }
}

export function createProtoDocument(
  sourceFile: string,
  packageName = 'DATA_MANAGER_TABLE',
  goPackage = './DATA_MANAGER_TABLE'
): ProtoDocument {
  const source = `syntax = "proto3";\n\npackage ${packageName};\noption go_package = "${goPackage}";\n`
  return parseProtoDocument(source, sourceFile)
}

export function isMessageFileName(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*Table\.proto$/.test(value)
}

export function isEnumFileName(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*EnumType\.proto$/.test(value)
}

export type ProtoFileKind = 'message' | 'enum'

export function normalizeProtoFileStem(value: string): string {
  return value.replace(/\.proto$/i, '')
}

export function defaultProtoFileStem(kind: ProtoFileKind, declarationName: string): string {
  const name = declarationName || 'New'
  return kind === 'message' ? `${name}Table` : `${name}EnumType`
}

export function buildProtoFileName(
  kind: ProtoFileKind,
  inputStem: string
): ProtoEditResult<string> {
  const stem = inputStem
  const fileName = `${stem}.proto`
  const valid = kind === 'message' ? isMessageFileName(fileName) : isEnumFileName(fileName)
  if (
    !valid ||
    stem !== stem.trim() ||
    /[\\/]/.test(stem) ||
    /[. ]$/.test(stem) ||
    /\.proto$/i.test(stem)
  ) {
    return editFailure(
      'PROTO_FILE_NAME_INVALID',
      kind === 'message'
        ? 'Message file stem must use the {Name}Table form.'
        : 'Enum file stem must use the {Name}EnumType form.'
    )
  }
  return { success: true, value: fileName }
}

export function findReferenceImpacts(
  documents: readonly ProtoDocument[],
  symbolName: string
): ProtoReferenceImpact[] {
  return documents.flatMap((document) =>
    document.messages.flatMap((message) =>
      message.fields
        .filter((field) => unqualifiedType(field.type) === symbolName)
        .map((field) => ({
          sourceFile: document.sourceFile,
          messageName: message.name,
          fieldName: field.name,
          referencedType: field.type
        }))
    )
  )
}

function renderMessage(
  document: ProtoDocument,
  existing: ProtoMessageDeclaration,
  prepared: ProtoMessageDeclaration,
  drafts: ProtoFieldDraft[]
): string {
  const existingByName = new Map(existing.fields.map((field) => [field.name, field]))
  const draftByName = new Map(drafts.map((draft) => [draft.name, draft]))
  const chunks = messageMembers(prepared).map((member) => {
    if (member.kind === 'memo') return renderMemo(document.lineEnding, member.value)
    const field = member.value
    const draft = draftByName.get(field.name) ?? drafts.find(({ order }) => order === field.order)
    const previous = existingByName.get(draft?.originalName ?? field.name)
    if (previous && fieldUnchanged(previous, field)) {
      return previous.leadingTrivia + previous.rawDeclaration
    }
    return renderField(document.lineEnding, previous, field)
  })
  return `message ${prepared.name} {${chunks.join('')}${existing.bodyTrailingTrivia}}`
}

function renderNewMessage(document: ProtoDocument, message: ProtoMessageDeclaration): string {
  const fields = messageMembers(message)
    .map((member) =>
      member.kind === 'memo'
        ? renderMemo(document.lineEnding, member.value)
        : renderField(document.lineEnding, undefined, member.value)
    )
    .join('')
  return `message ${message.name} {${fields}${document.lineEnding}}`
}

function messageMembers(
  message: ProtoMessageDeclaration
): Array<
  { kind: 'field'; value: ProtoFieldDeclaration } | { kind: 'memo'; value: ProtoMemoDeclaration }
> {
  return [
    ...message.fields.map((value) => ({ kind: 'field' as const, value })),
    ...message.memos.map((value) => ({ kind: 'memo' as const, value }))
  ].sort((left, right) => left.value.order - right.value.order)
}

function renderMemo(lineEnding: string, memo: ProtoMemoDeclaration): string {
  return `${lineEnding}  // @Memo(${memo.id}) ${memo.name}${lineEnding}`
}

function renderField(
  lineEnding: string,
  previous: ProtoFieldDeclaration | undefined,
  field: ProtoFieldDeclaration
): string {
  const indent = detectIndent(previous?.leadingTrivia) ?? '  '
  const generalTrivia = removeAnnotationComments(previous?.leadingTrivia ?? lineEnding).replace(
    /[ \t]+$/,
    ''
  )
  const annotations = [
    field.isPrimaryKey ? `${indent}// @PK${lineEnding}` : '',
    field.isGroupKey ? `${indent}// @Key${lineEnding}` : ''
  ].join('')
  const label = field.label === 'singular' ? '' : `${field.label} `
  const options = field.optionsText ? ` ${field.optionsText}` : ''
  return `${generalTrivia}${annotations}${indent}${label}${field.type} ${field.name} = ${field.fieldNumber}${options};`
}

function renderEnum(
  document: ProtoDocument,
  existing: ProtoEnumDeclaration,
  prepared: ProtoEnumDeclaration
): string {
  const existingByName = new Map(existing.values.map((value) => [value.name, value]))
  const values = prepared.values
    .map((value) => {
      const previous = existingByName.get(value.name)
      if (previous && previous.number === value.number) {
        return previous.leadingTrivia + previous.rawDeclaration
      }
      const indent = detectIndent(previous?.leadingTrivia) ?? '  '
      const trivia = previous?.leadingTrivia ?? document.lineEnding
      return `${trivia}${indent}${value.name} = ${value.number};`
    })
    .join('')
  return `enum ${prepared.name} {${values}${existing.bodyTrailingTrivia}}`
}

function renderNewEnum(document: ProtoDocument, value: ProtoEnumDeclaration): string {
  const values = value.values
    .map((entry) => `${document.lineEnding}  ${entry.name} = ${entry.number};`)
    .join('')
  return `enum ${value.name} {${values}${document.lineEnding}}`
}

function fieldUnchanged(previous: ProtoFieldDeclaration, next: ProtoFieldDeclaration): boolean {
  return (
    previous.name === next.name &&
    previous.type === next.type &&
    previous.fieldNumber === next.fieldNumber &&
    previous.label === next.label &&
    previous.isPrimaryKey === next.isPrimaryKey &&
    previous.isGroupKey === next.isGroupKey &&
    previous.optionsText === next.optionsText
  )
}

function ensureImports(document: ProtoDocument, dependencies: readonly string[]): string {
  const missing = dependencies.filter(
    (dependency) => !document.imports.some((entry) => entry.path === dependency)
  )
  if (missing.length === 0) return document.source
  const insertionOffset = importInsertionOffset(document)
  const lines = missing.map((dependency) => `import "${dependency}";`).join(document.lineEnding)
  return replaceSpan(
    document.source,
    { start: insertionOffset, end: insertionOffset },
    `${document.lineEnding}${lines}`
  )
}

function importInsertionOffset(document: ProtoDocument): number {
  const lastImport = document.imports.at(-1)
  if (lastImport) return lastImport.span.end
  const goPackage = /option\s+go_package\s*=\s*(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*')\s*;/g.exec(
    document.source
  )
  if (goPackage) return goPackage.index + goPackage[0].length
  const packageDeclaration = /package\s+[A-Za-z_][A-Za-z0-9_.]*\s*;/g.exec(document.source)
  return packageDeclaration ? packageDeclaration.index + packageDeclaration[0].length : 0
}

function dependenciesForMessage(
  draft: ProtoMessageDraft,
  sourceFile: string,
  typeSources: ReadonlyMap<string, string>
): string[] {
  return [
    ...new Set(
      draft.fields
        .map((field) => unqualifiedType(field.type))
        .filter((type) => !primitiveTypes.has(type))
        .map((type) => typeSources.get(type))
        .filter((dependency): dependency is string =>
          Boolean(dependency && dependency !== sourceFile)
        )
    )
  ].sort()
}

function editableTarget<T extends { readOnly: boolean; span: { start: number; end: number } }>(
  document: ProtoDocument,
  target: T | undefined,
  kind: string,
  name: string
): { success: false; diagnostics: ProtoDiagnostic[] } | null {
  if (document.readOnly) return documentReadOnly(document)
  if (!target) return editFailure('PROTO_DECLARATION_NOT_FOUND', `${kind} '${name}' was not found.`)
  if (target.readOnly) {
    return editFailure(
      'PROTO_DECLARATION_READ_ONLY',
      `${kind} '${name}' uses unsupported grammar.`,
      target.span
    )
  }
  return null
}

function documentReadOnly(document: ProtoDocument): {
  success: false
  diagnostics: ProtoDiagnostic[]
} {
  return {
    success: false,
    diagnostics:
      document.diagnostics.length > 0
        ? document.diagnostics
        : [diagnostic('PROTO_DOCUMENT_READ_ONLY', 'Document is read-only.', { start: 0, end: 0 })]
  }
}

function editFailure(
  code: string,
  message: string,
  span = { start: 0, end: 0 }
): { success: false; diagnostics: ProtoDiagnostic[] } {
  return { success: false, diagnostics: [diagnostic(code, message, span)] }
}

function internalPatchFailure(
  code: string,
  span: { start: number; end: number }
): { success: false; diagnostics: ProtoDiagnostic[] } {
  return editFailure(code, 'Patched declaration could not be parsed.', span)
}

function diagnostic(
  code: string,
  message: string,
  span: { start: number; end: number }
): ProtoDiagnostic {
  return { code, message, severity: 'error', span }
}

function replaceSpan(
  source: string,
  span: { start: number; end: number },
  replacement: string
): string {
  return source.slice(0, span.start) + replacement + source.slice(span.end)
}

function removeAnnotationComments(trivia: string): string {
  return trivia
    .replace(/^[ \t]*\/\/[^\r\n]*@(?:PK|Key)\b[^\r\n]*(?:\r?\n|$)/gm, '')
    .replace(/\/\*[\s\S]*?@(?:PK|Key)\b[\s\S]*?\*\//g, '')
}

function detectIndent(trivia: string | undefined): string | null {
  if (!trivia) return null
  return /(?:^|\r?\n)([ \t]*)$/.exec(trivia)?.[1] ?? null
}

function unqualifiedType(type: string): string {
  return type.replace(/^\./, '').split('.').at(-1) ?? type
}
