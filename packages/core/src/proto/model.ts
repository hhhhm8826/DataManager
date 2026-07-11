export interface SourceSpan {
  start: number
  end: number
}

export type ProtoDiagnosticSeverity = 'warning' | 'error'

export interface ProtoDiagnostic extends DiagnosticLike {
  code: string
  message: string
  severity: ProtoDiagnosticSeverity
  span: SourceSpan
}

export interface ProtoImport {
  path: string
  modifier: 'normal' | 'public' | 'weak'
  span: SourceSpan
}

export interface ProtoFieldDeclaration {
  name: string
  type: string
  fieldNumber: number
  label: 'singular' | 'optional' | 'repeated'
  isPrimaryKey: boolean
  isGroupKey: boolean
  leadingTrivia: string
  rawDeclaration: string
  optionsText: string
  order: number
  span: SourceSpan
}

export interface ProtoMemoDeclaration {
  id: string
  name: string
  order: number
  span: SourceSpan
}

export interface ProtoMessageDeclaration {
  kind: 'message'
  name: string
  fields: ProtoFieldDeclaration[]
  memos: ProtoMemoDeclaration[]
  sourceFile: string
  span: SourceSpan
  bodySpan: SourceSpan
  bodyTrailingTrivia: string
  readOnly: boolean
  diagnostics: ProtoDiagnostic[]
}

export interface ProtoEnumValueDeclaration {
  name: string
  number: number
  leadingTrivia: string
  rawDeclaration: string
  span: SourceSpan
}

export interface ProtoEnumDeclaration {
  kind: 'enum'
  name: string
  values: ProtoEnumValueDeclaration[]
  sourceFile: string
  span: SourceSpan
  bodySpan: SourceSpan
  bodyTrailingTrivia: string
  readOnly: boolean
  diagnostics: ProtoDiagnostic[]
}

export interface ProtoDocument {
  source: string
  sourceFile: string
  lineEnding: '\n' | '\r\n'
  syntax: string | null
  packageName: string | null
  goPackage: string | null
  imports: ProtoImport[]
  messages: ProtoMessageDeclaration[]
  enums: ProtoEnumDeclaration[]
  diagnostics: ProtoDiagnostic[]
  readOnly: boolean
}

export interface ProtoReferenceImpact {
  sourceFile: string
  messageName: string
  fieldName: string
  referencedType: string
}

export interface ProtoSourceFile {
  sourceFile: string
  source: string
}

export interface ProtoWorkspaceDiagnostic {
  sourceFile: string
  diagnostic: ProtoDiagnostic
}

export interface ProtoWorkspace {
  documents: ProtoDocument[]
  messages: ProtoMessageDeclaration[]
  enums: ProtoEnumDeclaration[]
  diagnostics: ProtoWorkspaceDiagnostic[]
  typeSources: ReadonlyMap<string, string>
}

export interface ProtoFieldDraft {
  originalName?: string
  name: string
  type: string
  label?: 'singular' | 'optional' | 'repeated'
  fieldNumber?: number
  isPrimaryKey?: boolean
  isGroupKey?: boolean
  optionsText?: string
  order?: number
}

export interface ProtoMemoDraft {
  id: string
  name: string
  order: number
}

export interface ProtoMessageDraft {
  name: string
  fields: ProtoFieldDraft[]
  memos?: ProtoMemoDraft[]
}

export interface ProtoEnumValueDraft {
  name: string
  number: number
}

export interface ProtoEnumDraft {
  name: string
  values: ProtoEnumValueDraft[]
}

export type ProtoEditResult<T> =
  { success: true; value: T } | { success: false; diagnostics: ProtoDiagnostic[] }
import type { DiagnosticLike } from '../diagnostics'
