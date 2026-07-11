import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import {
  parseAppSettings,
  parseLegacyImportPreview,
  parseWorkspaceMetadata,
  toNativeError,
  type AppSettings,
  type LegacyImportPreview,
  type UnrealGeneratedFile,
  type WorkspaceMetadata,
  type WorkspaceMetadataSection,
  type WorkspaceMetadataSectionUpdate
} from '@datamanager/core'
import type {
  CodegenEnvironment,
  CodegenPluginStatus,
  NativePort,
  ProtoMetadataTransactionRequest,
  ProtocRunResult,
  ProtoFileEntry
} from './NativePort'

export class TauriNativePort implements NativePort {
  async loadSettings(): Promise<AppSettings> {
    try {
      return parseAppSettings(await invoke<unknown>('load_settings'))
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    try {
      const validated = parseAppSettings(settings)
      return parseAppSettings(await invoke<unknown>('save_settings', { settings: validated }))
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async loadWorkspaceMetadata(): Promise<WorkspaceMetadata> {
    try {
      return parseWorkspaceMetadata(await invoke<unknown>('load_workspace_metadata'))
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async updateWorkspaceMetadata<S extends WorkspaceMetadataSection>(
    update: WorkspaceMetadataSectionUpdate<S>
  ): Promise<WorkspaceMetadata> {
    try {
      return parseWorkspaceMetadata(
        await invoke<unknown>('update_workspace_metadata', { request: update })
      )
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async writeProtoWithMetadata(
    request: ProtoMetadataTransactionRequest
  ): Promise<WorkspaceMetadata> {
    try {
      return parseWorkspaceMetadata(
        await invoke<unknown>('write_proto_with_metadata', {
          request: { ...request, contents: Array.from(request.contents) }
        })
      )
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async selectDirectory(initialPath?: string): Promise<string | null> {
    try {
      const options = {
        directory: true,
        multiple: false,
        title: '폴더 선택'
      }
      const selected = await open(initialPath ? { ...options, defaultPath: initialPath } : options)
      return typeof selected === 'string' ? selected : null
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async selectFile(initialPath?: string): Promise<string | null> {
    try {
      const options = {
        directory: false,
        multiple: false,
        title: '파일 선택'
      }
      const selected = await open(initialPath ? { ...options, defaultPath: initialPath } : options)
      return typeof selected === 'string' ? selected : null
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async findLegacyConfig(): Promise<string | null> {
    try {
      const path = await invoke<unknown>('find_legacy_config')
      return typeof path === 'string' ? path : null
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async previewLegacyImport(sourcePath: string): Promise<LegacyImportPreview> {
    try {
      return parseLegacyImportPreview(
        await invoke<unknown>('preview_legacy_import', { sourcePath })
      )
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async importLegacySettings(sourcePath: string): Promise<AppSettings> {
    try {
      return parseAppSettings(await invoke<unknown>('import_legacy_settings', { sourcePath }))
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async listProtoFiles(): Promise<ProtoFileEntry[]> {
    try {
      const entries = await invoke<unknown>('list_proto_files')
      if (!Array.isArray(entries)) throw new Error('Native Proto listing was not an array.')
      return entries.map((entry) => {
        if (
          typeof entry !== 'object' ||
          entry === null ||
          !('path' in entry) ||
          typeof entry.path !== 'string' ||
          !('fileName' in entry) ||
          typeof entry.fileName !== 'string'
        ) {
          throw new Error('Native Proto listing contained an invalid entry.')
        }
        return { path: entry.path, fileName: entry.fileName }
      })
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async listExcelFiles(): Promise<ProtoFileEntry[]> {
    try {
      return parseFileEntries(await invoke<unknown>('list_excel_files'), 'Excel')
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async checkCodegenEnvironment(): Promise<CodegenEnvironment> {
    try {
      const value = await invoke<unknown>('check_codegen_environment')
      if (!isRecord(value)) throw new Error('Native codegen environment was invalid.')
      return {
        protocExecutable: requiredString(value, 'protocExecutable'),
        protocVersion: requiredString(value, 'protocVersion'),
        plugins: requiredArray(value, 'plugins').map(parsePluginStatus)
      }
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async runProtocLanguage(language: string): Promise<ProtocRunResult> {
    try {
      const value = await invoke<unknown>('run_protoc_language', { language })
      if (!isRecord(value)) throw new Error('Native protoc result was invalid.')
      return {
        language: requiredString(value, 'language'),
        executable: requiredString(value, 'executable'),
        args: requiredArray(value, 'args').map((entry) => {
          if (typeof entry !== 'string') throw new Error('Native protoc arg was invalid.')
          return entry
        }),
        cwd: requiredString(value, 'cwd'),
        outputDirectory: requiredString(value, 'outputDirectory'),
        stdout: requiredString(value, 'stdout', true),
        stderr: requiredString(value, 'stderr', true),
        exitCode: requiredNumber(value, 'exitCode')
      }
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async writeUnrealFiles(files: UnrealGeneratedFile[]): Promise<string[]> {
    try {
      const paths = await invoke<unknown>('write_unreal_files', {
        files: files.map((file) => ({
          fileName: file.fileName,
          contents: Array.from(new TextEncoder().encode(file.contents))
        }))
      })
      if (!Array.isArray(paths) || paths.some((path) => typeof path !== 'string' || !path)) {
        throw new Error('Native Unreal write returned invalid paths.')
      }
      return paths as string[]
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async readFile(path: string): Promise<Uint8Array> {
    try {
      const bytes = await invoke<unknown>('read_file', { path })
      if (!Array.isArray(bytes) || bytes.some((value) => !Number.isInteger(value))) {
        throw new Error('Native file response was not a byte array.')
      }
      return Uint8Array.from(bytes as number[])
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async writeFile(path: string, contents: Uint8Array): Promise<string> {
    try {
      const writtenPath = await invoke<unknown>('write_file', {
        path,
        contents: Array.from(contents)
      })
      if (typeof writtenPath !== 'string') throw new Error('Native write returned no path.')
      return writtenPath
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async backupFile(path: string): Promise<string> {
    try {
      const backupPath = await invoke<unknown>('backup_file', { path })
      if (typeof backupPath !== 'string') throw new Error('Native backup returned no path.')
      return backupPath
    } catch (error) {
      throw toNativeError(error)
    }
  }

  async openPath(path: string): Promise<void> {
    try {
      await invoke('open_path', { path })
    } catch (error) {
      throw toNativeError(error)
    }
  }
}

function parseFileEntries(value: unknown, kind: string): ProtoFileEntry[] {
  if (!Array.isArray(value)) throw new Error(`Native ${kind} listing was not an array.`)
  return value.map((entry) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !('path' in entry) ||
      typeof entry.path !== 'string' ||
      !('fileName' in entry) ||
      typeof entry.fileName !== 'string'
    ) {
      throw new Error(`Native ${kind} listing contained an invalid entry.`)
    }
    return { path: entry.path, fileName: entry.fileName }
  })
}

function parsePluginStatus(value: unknown): CodegenPluginStatus {
  if (!isRecord(value)) throw new Error('Native plugin status was invalid.')
  const path = value.path
  if (path !== null && typeof path !== 'string') throw new Error('Native plugin path was invalid.')
  if (typeof value.available !== 'boolean') throw new Error('Native plugin state was invalid.')
  return {
    language: requiredString(value, 'language'),
    executable: requiredString(value, 'executable'),
    available: value.available,
    path
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requiredString(value: Record<string, unknown>, key: string, allowEmpty = false): string {
  const field = value[key]
  if (typeof field !== 'string' || (!allowEmpty && field.length === 0)) {
    throw new Error(`Native field '${key}' was invalid.`)
  }
  return field
}

function requiredNumber(value: Record<string, unknown>, key: string): number {
  const field = value[key]
  if (typeof field !== 'number' || !Number.isInteger(field)) {
    throw new Error(`Native field '${key}' was invalid.`)
  }
  return field
}

function requiredArray(value: Record<string, unknown>, key: string): unknown[] {
  const field = value[key]
  if (!Array.isArray(field)) throw new Error(`Native field '${key}' was invalid.`)
  return field
}
