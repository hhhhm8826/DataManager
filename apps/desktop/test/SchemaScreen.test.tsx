// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { defaultAppSettings, type AppSettings, type LegacyImportPreview } from '@datamanager/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NativePort, ProtoFileEntry } from '../src/adapters/native/NativePort'
import { SchemaScreen } from '../src/features/schema/SchemaScreen'

const header = `syntax = "proto3";
package sample;
option go_package = "./sample";
`

afterEach(cleanup)

function createProtoPort(initialFiles: Record<string, string>): {
  nativePort: NativePort
  writeFile: ReturnType<typeof vi.fn<(path: string, contents: Uint8Array) => Promise<string>>>
  files: Map<string, string>
} {
  const root = 'D:\\Proto Workspace'
  const files = new Map(
    Object.entries(initialFiles).map(([fileName, source]) => [`${root}\\${fileName}`, source])
  )
  const settings: AppSettings = { ...defaultAppSettings, protoRoot: root }
  const writeFile = vi.fn(async (path: string, contents: Uint8Array): Promise<string> => {
    files.set(path, new TextDecoder().decode(contents))
    return path
  })
  const nativePort: NativePort = {
    loadSettings: async () => settings,
    saveSettings: async (next) => next,
    selectDirectory: async () => null,
    selectFile: async () => null,
    findLegacyConfig: async () => null,
    previewLegacyImport: async (): Promise<LegacyImportPreview> => {
      throw new Error('not available')
    },
    importLegacySettings: async () => settings,
    listProtoFiles: async (): Promise<ProtoFileEntry[]> =>
      [...files.keys()]
        .map((path) => ({ path, fileName: path.split('\\').at(-1) ?? path }))
        .sort((left, right) => left.fileName.localeCompare(right.fileName)),
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
    readFile: async (path) => new TextEncoder().encode(files.get(path) ?? ''),
    writeFile,
    backupFile: async (path) => `${path}.backup`,
    openPath: async () => undefined
  }
  return { nativePort, writeFile, files }
}

describe('SchemaScreen', () => {
  it('shows rename impacts and persists a source-preserving message update', async () => {
    const { nativePort, writeFile, files } = createProtoPort({
      'TargetTable.proto': `${header}\nmessage Target {\n  // @PK\n  int32 id = 7;\n}\n`,
      'ConsumerTable.proto': `${header}\nimport "TargetTable.proto";\n\nmessage Consumer {\n  Target target = 3;\n}\n`
    })
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Target (TargetTable.proto)' }))
    const name = screen.getByRole('textbox', { name: 'Message 이름' })
    await user.clear(name)
    await user.type(name, 'RenamedTarget')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('Consumer.target')).toBeTruthy()
    expect(screen.getAllByText('ConsumerTable.proto')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: '계속' }))

    await waitFor(() => expect(writeFile).toHaveBeenCalledTimes(1))
    const saved = files.get('D:\\Proto Workspace\\TargetTable.proto') ?? ''
    expect(saved).toContain('message RenamedTarget')
    expect(saved).toContain('int32 id = 7;')
    expect(saved).toContain('// @PK')
  })

  it('creates an enum file with normalized NONE and MAX sentinels', async () => {
    const { nativePort, writeFile, files } = createProtoPort({})
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Enum 추가' }))
    await user.type(screen.getByRole('textbox', { name: 'Enum 이름' }), 'Status')
    await user.click(screen.getByRole('button', { name: '값 추가' }))
    const valueName = screen.getByRole('textbox', { name: 'Enum 값 1 이름' })
    await user.clear(valueName)
    await user.type(valueName, 'Status_ACTIVE')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(writeFile).toHaveBeenCalledTimes(1))
    const saved = files.get('D:\\Proto Workspace\\StatusEnumType.proto') ?? ''
    expect(saved).toContain('Status_NONE = 0;')
    expect(saved).toContain('Status_ACTIVE = 1;')
    expect(saved).toContain('Status_MAX = 2;')
  })

  it('uses one key-mode control and writes the matching legacy annotation', async () => {
    const { nativePort, writeFile, files } = createProtoPort({
      'KeyedTable.proto': `${header}\nmessage Keyed {\n  // @PK\n  int32 id = 4;\n}\n`
    })
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Keyed (KeyedTable.proto)' }))
    const keyMode = screen.getByRole('combobox', { name: '필드 1 키' })
    await user.selectOptions(keyMode, 'group')
    expect((keyMode as HTMLSelectElement).value).toBe('group')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(writeFile).toHaveBeenCalledTimes(1))
    const saved = files.get('D:\\Proto Workspace\\KeyedTable.proto') ?? ''
    expect(saved).toContain('// @Key')
    expect(saved).not.toContain('// @PK')
    expect(saved).toContain('int32 id = 4;')
  })

  it('shows reference impacts before deleting a table declaration', async () => {
    const { nativePort, writeFile, files } = createProtoPort({
      'TargetTable.proto': `${header}\nmessage Target { int32 id = 1; }\n`,
      'ConsumerTable.proto': `${header}\nmessage Consumer { Target target = 1; }\n`
    })
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Target (TargetTable.proto)' }))
    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(await screen.findByText('Consumer.target')).toBeTruthy()
    expect(writeFile).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '계속' }))

    await waitFor(() => expect(writeFile).toHaveBeenCalledTimes(1))
    expect(files.get('D:\\Proto Workspace\\TargetTable.proto')).not.toContain('message Target')
  })

  it('exposes unsupported Proto grammar as a disabled read-only editor', async () => {
    const { nativePort, writeFile } = createProtoPort({
      'UnsafeTable.proto': `${header}\nmessage Unsafe {\n  oneof choice { string name = 1; }\n}\n`
    })
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Unsafe (UnsafeTable.proto)' }))

    expect(screen.getByRole('textbox', { name: 'Message 이름' }).matches(':disabled')).toBe(true)
    expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/이 파일은 읽기 전용입니다/)).toBeTruthy()
    expect(writeFile).not.toHaveBeenCalled()
  })
})
