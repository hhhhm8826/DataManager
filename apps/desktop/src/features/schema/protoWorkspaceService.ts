import { parseProtoWorkspace, type AppSettings, type ProtoWorkspace } from '@datamanager/core'
import type { NativePort } from '../../adapters/native/NativePort'

export interface LoadedProtoWorkspace {
  settings: AppSettings
  workspace: ProtoWorkspace
  pathsBySourceFile: ReadonlyMap<string, string>
}

export async function loadProtoWorkspace(nativePort: NativePort): Promise<LoadedProtoWorkspace> {
  const settings = await nativePort.loadSettings()
  if (!settings.protoRoot) {
    return {
      settings,
      workspace: parseProtoWorkspace([]),
      pathsBySourceFile: new Map()
    }
  }

  const entries = await nativePort.listProtoFiles()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const files = await Promise.all(
    entries.map(async (entry) => ({
      sourceFile: entry.fileName,
      source: decoder.decode(await nativePort.readFile(entry.path))
    }))
  )
  return {
    settings,
    workspace: parseProtoWorkspace(files),
    pathsBySourceFile: new Map(entries.map((entry) => [entry.fileName, entry.path]))
  }
}

export function workspacePath(root: string, fileName: string): string {
  const separator = root.includes('\\') ? '\\' : '/'
  return `${root.replace(/[\\/]+$/, '')}${separator}${fileName}`
}

export const protoPath = workspacePath

export function encodeProtoSource(source: string): Uint8Array {
  return new TextEncoder().encode(source)
}
