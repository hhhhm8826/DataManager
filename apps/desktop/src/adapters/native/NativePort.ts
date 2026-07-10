import type { AppSettings, LegacyImportPreview, UnrealGeneratedFile } from '@datamanager/core'

export interface ProtoFileEntry {
  path: string
  fileName: string
}

export interface CodegenPluginStatus {
  language: string
  executable: string
  available: boolean
  path: string | null
}

export interface CodegenEnvironment {
  protocExecutable: string
  protocVersion: string
  plugins: CodegenPluginStatus[]
}

export interface ProtocRunResult {
  language: string
  executable: string
  args: string[]
  cwd: string
  outputDirectory: string
  stdout: string
  stderr: string
  exitCode: number
}

export interface NativePort {
  loadSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<AppSettings>
  selectDirectory(initialPath?: string): Promise<string | null>
  selectFile(initialPath?: string): Promise<string | null>
  findLegacyConfig(): Promise<string | null>
  previewLegacyImport(sourcePath: string): Promise<LegacyImportPreview>
  importLegacySettings(sourcePath: string): Promise<AppSettings>
  listProtoFiles(): Promise<ProtoFileEntry[]>
  listExcelFiles(): Promise<ProtoFileEntry[]>
  checkCodegenEnvironment(): Promise<CodegenEnvironment>
  runProtocLanguage(language: string): Promise<ProtocRunResult>
  writeUnrealFiles(files: UnrealGeneratedFile[]): Promise<string[]>
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, contents: Uint8Array): Promise<string>
  backupFile(path: string): Promise<string>
  openPath(path: string): Promise<void>
}
