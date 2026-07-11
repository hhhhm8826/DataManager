import { describe, expect, it } from 'vitest'
import {
  AppSettingsSchema,
  LegacyImportPreviewSchema,
  SETTINGS_VERSION,
  defaultAppSettings,
  toNativeError
} from '../src/settings'

describe('AppSettingsSchema', () => {
  it('accepts the versioned M2 default settings', () => {
    expect(AppSettingsSchema.parse(defaultAppSettings)).toEqual(defaultAppSettings)
  })

  it('rejects an unknown settings version and invalid diagram limit', () => {
    expect(() =>
      AppSettingsSchema.parse({
        ...defaultAppSettings,
        version: SETTINGS_VERSION + 1
      })
    ).toThrow()

    expect(() =>
      AppSettingsSchema.parse({
        ...defaultAppSettings,
        diagram: { ...defaultAppSettings.diagram, maxNodesPerColumn: 0 }
      })
    ).toThrow()
  })

  it('preserves deprecated maxNodesPerColumn for settings v2 compatibility', () => {
    const existing = {
      ...defaultAppSettings,
      diagram: { fileColors: { 'ItemTable.proto': '#2457a6' }, maxNodesPerColumn: 17 }
    }

    expect(AppSettingsSchema.parse(JSON.parse(JSON.stringify(existing)))).toEqual(existing)
  })

  it('requires non-empty languages for code generation outputs', () => {
    expect(() =>
      AppSettingsSchema.parse({
        ...defaultAppSettings,
        codegenOutputs: [{ language: ' ', directory: 'D:\\Generated' }]
      })
    ).toThrow()
  })
})

describe('LegacyImportPreviewSchema', () => {
  it('preserves resolved path diagnostics for a dry-run', () => {
    const preview = {
      sourcePath: 'D:\\DataManager\\config.json',
      baseDirectory: 'D:\\DataManager',
      settings: defaultAppSettings,
      paths: [
        {
          field: 'protoDir',
          inputPath: './examples/PROTO',
          resolvedPath: 'D:\\DataManager\\examples\\PROTO',
          kind: 'directory',
          status: 'ready',
          message: 'Directory is available.'
        }
      ]
    }

    expect(LegacyImportPreviewSchema.parse(preview)).toEqual(preview)
  })
})

describe('toNativeError', () => {
  it('normalizes non-DTO values into a structured native error', () => {
    expect(toNativeError('native failed')).toEqual({
      code: 'NATIVE_UNKNOWN',
      message: 'native failed',
      context: {}
    })
  })

  it.each([
    ['AbortError', 'NATIVE_OPERATION_ABORTED'],
    ['TimeoutError', 'NATIVE_OPERATION_TIMED_OUT'],
    ['ZodError', 'NATIVE_VALIDATION_FAILED']
  ])('maps external %s instances to a stable product code', (name, code) => {
    const error = new Error('third-party details')
    error.name = name

    expect(toNativeError(error)).toEqual({
      code,
      message: 'third-party details',
      context: {}
    })
  })

  it('preserves a structured DTO serialized by the native boundary', () => {
    const nativeError = {
      code: 'SETTINGS_READ_FAILED',
      message: 'Unable to read settings.',
      context: { path: 'D:\\DataManager\\settings.v2.json' }
    }

    expect(toNativeError(JSON.stringify(nativeError))).toEqual(nativeError)
    expect(toNativeError(new Error(JSON.stringify(nativeError)))).toEqual(nativeError)
  })
})
