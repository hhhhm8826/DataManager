import { describe, expect, it } from 'vitest'
import {
  applyWorkspaceMetadataSectionUpdate,
  defaultAppSettings,
  defaultWorkspaceMetadata,
  type LegacyImportPreview
} from '@datamanager/core'
import type { NativePort } from '../src/adapters/native/NativePort'
import { loadProtoWorkspace, protoPath } from '../src/features/schema/protoWorkspaceService'

function portWithBytes(bytes: Uint8Array): NativePort {
  let metadata = defaultWorkspaceMetadata()
  return {
    loadSettings: async () => ({ ...defaultAppSettings, protoRoot: 'D:\\PROTO' }),
    saveSettings: async (settings) => settings,
    loadWorkspaceMetadata: async () => metadata,
    updateWorkspaceMetadata: async (update) => {
      metadata = applyWorkspaceMetadataSectionUpdate(metadata, update)
      return metadata
    },
    writeProtoWithMetadata: async () => metadata,
    selectDirectory: async () => null,
    selectFile: async () => null,
    findLegacyConfig: async () => null,
    previewLegacyImport: async (): Promise<LegacyImportPreview> => {
      throw new Error('not available')
    },
    importLegacySettings: async () => defaultAppSettings,
    listProtoFiles: async () => [
      { path: 'D:\\PROTO\\ItemTable.proto', fileName: 'ItemTable.proto' }
    ],
    listExcelFiles: async () => [],
    checkCodegenEnvironment: async () => ({
      protocExecutable: 'protoc',
      protocVersion: 'libprotoc 30.2',
      plugins: []
    }),
    runProtocLanguage: async (language) => ({
      language,
      executable: 'protoc',
      args: [],
      cwd: '',
      outputDirectory: '',
      stdout: '',
      stderr: '',
      exitCode: 0
    }),
    writeUnrealFiles: async () => [],
    readFile: async () => bytes,
    writeFile: async (path) => path,
    backupFile: async (path) => `${path}.backup`,
    openPath: async () => undefined
  }
}

describe('Proto workspace adapter', () => {
  it('decodes UTF-8 files and keeps native paths outside the core model', async () => {
    const source = `syntax = "proto3";\npackage sample;\nmessage 한글 { string name = 1; }\n`
    const loaded = await loadProtoWorkspace(portWithBytes(new TextEncoder().encode(source)))

    expect(loaded.workspace.documents[0]?.source).toBe(source)
    expect(loaded.pathsBySourceFile.get('ItemTable.proto')).toBe('D:\\PROTO\\ItemTable.proto')
    expect(protoPath('D:\\PROTO\\', 'NewTable.proto')).toBe('D:\\PROTO\\NewTable.proto')
  })

  it('rejects invalid UTF-8 instead of silently replacing source bytes', async () => {
    await expect(loadProtoWorkspace(portWithBytes(Uint8Array.from([0xc3, 0x28])))).rejects.toThrow()
  })
})
