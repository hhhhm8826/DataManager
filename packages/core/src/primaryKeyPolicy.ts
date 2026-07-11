import type { DiagnosticLike } from './diagnostics'
import type { PrimaryKeyTypePolicy } from './projectMetadata'
import type { ProtoFieldDraft, ProtoWorkspace } from './proto/model'

export interface PrimaryKeyPolicyViolation extends DiagnosticLike {
  code: 'PROTO_PRIMARY_KEY_TYPE_POLICY_VIOLATION'
  message: string
  sourceFile: string
  messageName: string
  fieldName: string
  fieldType: string
  policy: PrimaryKeyTypePolicy
}

export function validatePrimaryKeyTypePolicy(
  workspace: ProtoWorkspace,
  policy: PrimaryKeyTypePolicy
): PrimaryKeyPolicyViolation[] {
  if (policy === 'unrestricted') return []
  return workspace.messages.flatMap((message) =>
    validateFields(workspace, policy, message.sourceFile, message.name, message.fields)
  )
}

export function validatePrimaryKeyDraftPolicy(
  workspace: ProtoWorkspace,
  policy: PrimaryKeyTypePolicy,
  sourceFile: string,
  messageName: string,
  fields: readonly ProtoFieldDraft[]
): PrimaryKeyPolicyViolation[] {
  if (policy === 'unrestricted') return []
  return validateFields(workspace, policy, sourceFile, messageName, fields)
}

function validateFields(
  workspace: ProtoWorkspace,
  policy: PrimaryKeyTypePolicy,
  sourceFile: string,
  messageName: string,
  fields: ReadonlyArray<{
    name: string
    type: string
    isPrimaryKey?: boolean
    isGroupKey?: boolean
  }>
): PrimaryKeyPolicyViolation[] {
  return fields
    .filter((field) => field.isPrimaryKey)
    .filter((field) => !typeAllowed(workspace, policy, field.type))
    .map((field) => ({
      code: 'PROTO_PRIMARY_KEY_TYPE_POLICY_VIOLATION',
      message: `Primary key '${messageName}.${field.name}' type '${field.type}' violates '${policy}'.`,
      params: {
        sourceFile,
        messageName,
        fieldName: field.name,
        fieldType: field.type,
        policy
      },
      sourceFile,
      messageName,
      fieldName: field.name,
      fieldType: field.type,
      policy
    }))
}

function typeAllowed(
  workspace: ProtoWorkspace,
  policy: PrimaryKeyTypePolicy,
  fieldType: string
): boolean {
  if (policy === 'unrestricted') return true
  if (policy === 'string') return fieldType === 'string'
  if (fieldType === 'int32' || fieldType === 'int64') return true
  return resolvesToOneEnum(workspace, fieldType)
}

function resolvesToOneEnum(workspace: ProtoWorkspace, fieldType: string): boolean {
  const normalized = fieldType.replace(/^\./, '')
  const qualified = normalized.includes('.')
  const matches = workspace.enums.filter((declaration) => {
    if (!qualified) return declaration.name === normalized
    const packageName = workspace.documents.find(
      (document) => document.sourceFile === declaration.sourceFile
    )?.packageName
    return `${packageName ? `${packageName}.` : ''}${declaration.name}` === normalized
  })
  return matches.length === 1
}
