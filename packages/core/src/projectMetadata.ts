import { z } from 'zod'

export const WORKSPACE_METADATA_VERSION = 1
export const DEFAULT_HUB_THRESHOLD = 5
export const MAX_WORKSPACE_METADATA_ENTRIES = 10_000

const MAX_IDENTIFIER_LENGTH = 256
export const MAX_MEMO_NAME_LENGTH = 128
const MAX_COORDINATE_MAGNITUDE = 10_000_000

export const PrimaryKeyTypePolicySchema = z.enum(['numeric-or-enum', 'string', 'unrestricted'])

export const MemoColumnSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(MAX_IDENTIFIER_LENGTH)
      .regex(/^memo-[A-Za-z0-9-]+$/),
    name: z
      .string()
      .trim()
      .refine((value) => [...value].length >= 1 && [...value].length <= MAX_MEMO_NAME_LENGTH)
      .refine((value) => !hasControlCharacter(value)),
    order: z.number().int().nonnegative()
  })
  .strict()

export const TableMetadataSchema = z
  .object({
    memoColumns: z.array(MemoColumnSchema).max(100)
  })
  .strict()
  .superRefine(({ memoColumns }, context) => {
    const ids = new Set<string>()
    const orders = new Set<number>()
    const names = new Set<string>()
    for (const [index, column] of memoColumns.entries()) {
      if (ids.has(column.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate memo column id: ${column.id}`,
          path: ['memoColumns', index, 'id']
        })
      }
      if (orders.has(column.order)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate memo column order: ${column.order}`,
          path: ['memoColumns', index, 'order']
        })
      }
      const normalizedName = column.name.toLocaleLowerCase()
      if (names.has(normalizedName)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate memo column name: ${column.name}`,
          path: ['memoColumns', index, 'name']
        })
      }
      ids.add(column.id)
      orders.add(column.order)
      names.add(normalizedName)
    }
  })

export const DiagramPositionSchema = z
  .object({
    x: z.number().finite().min(-MAX_COORDINATE_MAGNITUDE).max(MAX_COORDINATE_MAGNITUDE),
    y: z.number().finite().min(-MAX_COORDINATE_MAGNITUDE).max(MAX_COORDINATE_MAGNITUDE)
  })
  .strict()

export const DiagramViewportSchema = z
  .object({
    x: z.number().finite().min(-MAX_COORDINATE_MAGNITUDE).max(MAX_COORDINATE_MAGNITUDE),
    y: z.number().finite().min(-MAX_COORDINATE_MAGNITUDE).max(MAX_COORDINATE_MAGNITUDE),
    zoom: z.number().finite().min(0.01).max(16)
  })
  .strict()

export const SavedDiagramLayoutSchema = z
  .object({
    positions: z.record(z.string().min(1).max(MAX_IDENTIFIER_LENGTH), DiagramPositionSchema),
    viewport: DiagramViewportSchema
  })
  .strict()

export const WorkspaceDiagramMetadataSchema = z
  .object({
    hubThreshold: z.number().int().min(1).max(50),
    savedLayout: SavedDiagramLayoutSchema.nullable()
  })
  .strict()

export const WorkspaceMetadataSchema = z
  .object({
    version: z.literal(WORKSPACE_METADATA_VERSION),
    revision: z.number().int().nonnegative(),
    primaryKeyTypePolicy: PrimaryKeyTypePolicySchema,
    tables: z.record(z.string().min(1).max(MAX_IDENTIFIER_LENGTH), TableMetadataSchema),
    diagram: WorkspaceDiagramMetadataSchema
  })
  .strict()
  .superRefine((metadata, context) => {
    const tableKeys = Object.keys(metadata.tables)
    const positionKeys = Object.keys(metadata.diagram.savedLayout?.positions ?? {})
    if (tableKeys.length + positionKeys.length > MAX_WORKSPACE_METADATA_ENTRIES) {
      context.addIssue({
        code: 'custom',
        message: `Workspace metadata cannot exceed ${MAX_WORKSPACE_METADATA_ENTRIES} entries.`
      })
    }
    for (const key of tableKeys) {
      if (!isNormalizedTableMetadataKey(key)) {
        context.addIssue({
          code: 'custom',
          message: `Invalid table metadata key: ${key}`,
          path: ['tables', key]
        })
      }
    }
  })

export type PrimaryKeyTypePolicy = z.infer<typeof PrimaryKeyTypePolicySchema>
export type MemoColumn = z.infer<typeof MemoColumnSchema>
export type TableMetadata = z.infer<typeof TableMetadataSchema>
export type SavedDiagramLayout = z.infer<typeof SavedDiagramLayoutSchema>
export type WorkspaceDiagramMetadata = z.infer<typeof WorkspaceDiagramMetadataSchema>
export type WorkspaceMetadata = z.infer<typeof WorkspaceMetadataSchema>

export type WorkspaceMetadataSection = 'primaryKeyTypePolicy' | 'tables' | 'diagram'

export type MemoColumnNameValidation =
  | { success: true; name: string }
  | { success: false; code: 'WORKSPACE_METADATA_MEMO_INVALID'; message: string }

export function validateMemoColumnName(
  input: string,
  fieldNames: readonly string[],
  memoColumns: readonly MemoColumn[],
  currentId?: string
): MemoColumnNameValidation {
  const name = input.trim()
  if (
    [...name].length < 1 ||
    [...name].length > MAX_MEMO_NAME_LENGTH ||
    hasControlCharacter(name)
  ) {
    return {
      success: false,
      code: 'WORKSPACE_METADATA_MEMO_INVALID',
      message: 'Memo column name must be 1-128 characters without control characters.'
    }
  }
  const normalized = name.toLocaleLowerCase()
  const duplicateField = fieldNames.some(
    (fieldName) => fieldName.trim().toLocaleLowerCase() === normalized
  )
  const duplicateMemo = memoColumns.some(
    (column) => column.id !== currentId && column.name.trim().toLocaleLowerCase() === normalized
  )
  if (duplicateField || duplicateMemo) {
    return {
      success: false,
      code: 'WORKSPACE_METADATA_MEMO_INVALID',
      message: `Memo column name '${name}' is already used.`
    }
  }
  return { success: true, name }
}

export function createMemoColumnId(): string {
  return `memo-${globalThis.crypto.randomUUID()}`
}

export type WorkspaceMetadataSectionValue<S extends WorkspaceMetadataSection> = WorkspaceMetadata[S]

export interface WorkspaceMetadataSectionUpdate<S extends WorkspaceMetadataSection> {
  expectedRevision: number
  section: S
  value: WorkspaceMetadataSectionValue<S>
}

export class WorkspaceMetadataRevisionConflictError extends Error {
  readonly code = 'WORKSPACE_METADATA_REVISION_CONFLICT'

  constructor(
    readonly expectedRevision: number,
    readonly actualRevision: number
  ) {
    super(
      `Workspace metadata revision conflict: expected ${expectedRevision}, actual ${actualRevision}.`
    )
    this.name = 'WorkspaceMetadataRevisionConflictError'
  }
}

export function defaultWorkspaceMetadata(): WorkspaceMetadata {
  return {
    version: WORKSPACE_METADATA_VERSION,
    revision: 0,
    primaryKeyTypePolicy: 'unrestricted',
    tables: {},
    diagram: {
      hubThreshold: DEFAULT_HUB_THRESHOLD,
      savedLayout: null
    }
  }
}

export function parseWorkspaceMetadata(input: unknown): WorkspaceMetadata {
  return WorkspaceMetadataSchema.parse(input)
}

export function normalizeTableMetadataKey(sourceFile: string, messageName: string): string {
  const normalizedFile = sourceFile.replaceAll('\\', '/').replace(/^\.\//, '')
  const key = `${normalizedFile}#${messageName}`
  if (!isNormalizedTableMetadataKey(key)) {
    throw new Error(`Invalid table metadata key: ${key}`)
  }
  return key
}

export function applyWorkspaceMetadataSectionUpdate<S extends WorkspaceMetadataSection>(
  current: WorkspaceMetadata,
  update: WorkspaceMetadataSectionUpdate<S>
): WorkspaceMetadata {
  const parsedCurrent = parseWorkspaceMetadata(current)
  if (parsedCurrent.revision !== update.expectedRevision) {
    throw new WorkspaceMetadataRevisionConflictError(
      update.expectedRevision,
      parsedCurrent.revision
    )
  }

  const candidate = {
    ...parsedCurrent,
    revision: parsedCurrent.revision + 1,
    [update.section]: update.value
  }
  return parseWorkspaceMetadata(candidate)
}

function isNormalizedTableMetadataKey(key: string): boolean {
  const separator = key.lastIndexOf('#')
  if (separator <= 0 || separator === key.length - 1) return false
  const sourceFile = key.slice(0, separator)
  const messageName = key.slice(separator + 1)
  return (
    !sourceFile.startsWith('/') &&
    !/^[A-Za-z]:\//.test(sourceFile) &&
    !sourceFile.includes('\\') &&
    !sourceFile.split('/').some((segment) => !segment || segment === '.' || segment === '..') &&
    sourceFile.endsWith('.proto') &&
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(messageName)
  )
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || (codePoint >= 127 && codePoint <= 159)
  })
}
