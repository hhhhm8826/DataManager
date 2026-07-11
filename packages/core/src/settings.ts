import { z } from 'zod'

export const SETTINGS_VERSION = 2

export const CodegenOutputSchema = z.object({
  language: z.string().trim().min(1),
  directory: z.string()
})

export const DiagramSettingsSchema = z.object({
  fileColors: z.record(z.string(), z.string()),
  maxNodesPerColumn: z.number().int().min(1).max(50)
})

export const LegacyImportRecordSchema = z.object({
  sourcePath: z.string().min(1),
  importedAtEpochMs: z.number().int().nonnegative()
})

export const AppSettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  protoRoot: z.string(),
  excelRoot: z.string(),
  jsonRoot: z.string(),
  codegenOutputs: z.array(CodegenOutputSchema),
  protocExecutable: z.string(),
  diagram: DiagramSettingsSchema,
  legacyImport: LegacyImportRecordSchema.nullable()
})

export const LegacyPathCheckSchema = z.object({
  field: z.string().min(1),
  inputPath: z.string(),
  resolvedPath: z.string(),
  kind: z.enum(['directory', 'file']),
  status: z.enum(['ready', 'missing', 'wrongType', 'readOnly']),
  message: z.string()
})

export const LegacyImportPreviewSchema = z.object({
  sourcePath: z.string().min(1),
  baseDirectory: z.string().min(1),
  settings: AppSettingsSchema,
  paths: z.array(LegacyPathCheckSchema)
})

export type CodegenOutput = z.infer<typeof CodegenOutputSchema>
export type AppSettings = z.infer<typeof AppSettingsSchema>
export type LegacyPathCheck = z.infer<typeof LegacyPathCheckSchema>
export type LegacyImportPreview = z.infer<typeof LegacyImportPreviewSchema>

export const defaultAppSettings: AppSettings = {
  version: SETTINGS_VERSION,
  protoRoot: '',
  excelRoot: '',
  jsonRoot: '',
  codegenOutputs: [],
  protocExecutable: '',
  diagram: {
    fileColors: {},
    maxNodesPerColumn: 8
  },
  legacyImport: null
}

export const NativeErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  context: z.record(z.string(), z.unknown())
})

export type NativeError = z.infer<typeof NativeErrorSchema>

export function parseAppSettings(input: unknown): AppSettings {
  return AppSettingsSchema.parse(input)
}

export function parseLegacyImportPreview(input: unknown): LegacyImportPreview {
  return LegacyImportPreviewSchema.parse(input)
}

function parseSerializedNativeError(input: unknown): NativeError | undefined {
  const direct = NativeErrorSchema.safeParse(input)
  if (direct.success) return direct.data

  if (typeof input !== 'string') return undefined

  try {
    const serialized = NativeErrorSchema.safeParse(JSON.parse(input))
    return serialized.success ? serialized.data : undefined
  } catch {
    return undefined
  }
}

export function toNativeError(input: unknown): NativeError {
  const parsed = parseSerializedNativeError(input)
  if (parsed) return parsed

  if (input instanceof Error) {
    const serialized = parseSerializedNativeError(input.message)
    if (serialized) return serialized

    const externalCode = externalErrorCode(input.name)
    if (externalCode) {
      return {
        code: externalCode,
        message: input.message,
        context: {}
      }
    }
  }

  return {
    code: 'NATIVE_UNKNOWN',
    message: input instanceof Error ? input.message : String(input),
    context: {}
  }
}

function externalErrorCode(name: string): string | undefined {
  switch (name) {
    case 'AbortError':
      return 'NATIVE_OPERATION_ABORTED'
    case 'TimeoutError':
      return 'NATIVE_OPERATION_TIMED_OUT'
    case 'ZodError':
      return 'NATIVE_VALIDATION_FAILED'
    default:
      return undefined
  }
}
