import {
  defaultAppSettings,
  parseAppSettings,
  toNativeError,
  type AppSettings,
  type LegacyImportPreview,
  type UnrealGeneratedFile
} from '@datamanager/core'
import type { NativePort, ProtoFileEntry } from './NativePort'

const SETTINGS_STORAGE_KEY = 'datamanager.settings.v2'
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
}
