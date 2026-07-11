import {
  applyWorkspaceMetadataSectionUpdate,
  defaultAppSettings,
  defaultWorkspaceMetadata,
  parseAppSettings,
  parseWorkspaceMetadata,
  toNativeError,
  type AppSettings,
  type LegacyImportPreview,
  type UnrealGeneratedFile,
  type WorkspaceMetadata,
  type WorkspaceMetadataSection,
  type WorkspaceMetadataSectionUpdate,
  WorkspaceMetadataRevisionConflictError
} from '@datamanager/core'
import type { NativePort, ProtoFileEntry, ProtoMetadataTransactionRequest } from './NativePort'

const SETTINGS_STORAGE_KEY = 'datamanager.settings.v2'
const WORKSPACE_METADATA_STORAGE_PREFIX = 'datamanager.workspace-metadata.v1:'
const mockFiles = new Map<string, Uint8Array>()

export class BrowserMockNativePort implements NativePort {
  async loadSettings(): Promise<AppSettings> {
    const serialized = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!serialized) return defaultAppSettings

    try {
      return parseAppSettings(JSON.parse(serialized))
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    const parsed = parseAppSettings(settings)
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(parsed))
    return parsed
  }

  async loadWorkspaceMetadata(): Promise<WorkspaceMetadata> {
    const key = await this.workspaceMetadataStorageKey()
    const serialized = window.localStorage.getItem(key)
    if (!serialized) return defaultWorkspaceMetadata()

    try {
      return parseWorkspaceMetadata(JSON.parse(serialized))
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async updateWorkspaceMetadata<S extends WorkspaceMetadataSection>(
    update: WorkspaceMetadataSectionUpdate<S>
  ): Promise<WorkspaceMetadata> {
    try {
      const current = await this.loadWorkspaceMetadata()
      const next = applyWorkspaceMetadataSectionUpdate(current, update)
      window.localStorage.setItem(await this.workspaceMetadataStorageKey(), JSON.stringify(next))
      return next
    } catch (error) {
      if (error instanceof WorkspaceMetadataRevisionConflictError) {
        throw toNativeError({
          code: error.code,
          message: error.message,
          context: {
            expectedRevision: error.expectedRevision,
            actualRevision: error.actualRevision
          }
        })
      }
      throw toNativeError(error)
    }
  }

  async writeProtoWithMetadata(
    request: ProtoMetadataTransactionRequest
  ): Promise<WorkspaceMetadata> {
    try {
      const current = await this.loadWorkspaceMetadata()
      if (current.revision !== request.expectedRevision) {
        throw new WorkspaceMetadataRevisionConflictError(request.expectedRevision, current.revision)
      }
      const tables = { ...current.tables }
      const moved = tables[request.mutation.oldKey]
      delete tables[request.mutation.oldKey]
      if (request.mutation.newKey && moved) tables[request.mutation.newKey] = moved
      const next = applyWorkspaceMetadataSectionUpdate(current, {
        expectedRevision: request.expectedRevision,
        section: 'tables',
        value: tables
      })
      const settings = await this.loadSettings()
      const separator = settings.protoRoot.includes('\\') ? '\\' : '/'
      const path = `${settings.protoRoot.replace(/[\\/]$/, '')}${separator}${request.sourceFile}`
      mockFiles.set(path, request.contents.slice())
      window.localStorage.setItem(await this.workspaceMetadataStorageKey(), JSON.stringify(next))
      return next
    } catch (error) {
      if (error instanceof WorkspaceMetadataRevisionConflictError) {
        throw toNativeError({
          code: error.code,
          message: error.message,
          context: {
            expectedRevision: error.expectedRevision,
            actualRevision: error.actualRevision
          }
        })
      }
      throw toNativeError(error)
    }
  }

  async selectDirectory(initialPath?: string): Promise<string | null> {
    const result = window.prompt('폴더 경로', initialPath ?? '')
    const normalized = result?.trim()
    return normalized ? normalized : null
  }

  async selectFile(initialPath?: string): Promise<string | null> {
    const result = window.prompt('파일 경로', initialPath ?? '')
    const normalized = result?.trim()
    return normalized ? normalized : null
  }

  async findLegacyConfig(): Promise<string | null> {
    return null
  }

  async previewLegacyImport(sourcePath: string): Promise<LegacyImportPreview> {
    void sourcePath
    throw toNativeError('Legacy import preview is available in the Tauri application.')
  }

  async importLegacySettings(sourcePath: string): Promise<AppSettings> {
    void sourcePath
    throw toNativeError('Legacy import is available in the Tauri application.')
  }

  async listProtoFiles(): Promise<ProtoFileEntry[]> {
    return [...mockFiles.keys()]
      .map((path) => ({ path, fileName: path.split(/[\\/]/).at(-1) ?? path }))
      .filter(
        ({ fileName }) =>
          /^[A-Za-z_][A-Za-z0-9_]*Table\.proto$/.test(fileName) ||
          /^[A-Za-z_][A-Za-z0-9_]*EnumType\.proto$/.test(fileName)
      )
      .sort((left, right) => left.fileName.localeCompare(right.fileName, 'en'))
  }

  async listExcelFiles(): Promise<ProtoFileEntry[]> {
    return [...mockFiles.keys()]
      .map((path) => ({ path, fileName: path.split(/[\\/]/).at(-1) ?? path }))
      .filter(({ fileName }) => fileName.toLocaleLowerCase().endsWith('.xlsx'))
      .sort((left, right) => left.fileName.localeCompare(right.fileName, 'en'))
  }

  async checkCodegenEnvironment(): Promise<never> {
    throw toNativeError('Code generation environment checks require the Tauri application.')
  }

  async runProtocLanguage(language: string): Promise<never> {
    void language
    throw toNativeError('protoc execution requires the Tauri application.')
  }

  async writeUnrealFiles(files: UnrealGeneratedFile[]): Promise<never> {
    void files
    throw toNativeError('Transactional Unreal output requires the Tauri application.')
  }

  async readFile(path: string): Promise<Uint8Array> {
    const contents = mockFiles.get(path)
    if (!contents) throw toNativeError(`File not found: ${path}`)
    return contents.slice()
  }

  async writeFile(path: string, contents: Uint8Array): Promise<string> {
    mockFiles.set(path, contents.slice())
    return path
  }

  async backupFile(path: string): Promise<string> {
    const contents = await this.readFile(path)
    const backupPath = `${path}.backup`
    mockFiles.set(backupPath, contents)
    return backupPath
  }

  async openPath(path: string): Promise<void> {
    void path
  }

  private async workspaceMetadataStorageKey(): Promise<string> {
    const { protoRoot } = await this.loadSettings()
    return `${WORKSPACE_METADATA_STORAGE_PREFIX}${protoRoot}`
  }
}
