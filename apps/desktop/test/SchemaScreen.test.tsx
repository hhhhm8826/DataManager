// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  applyWorkspaceMetadataSectionUpdate,
  defaultAppSettings,
  defaultWorkspaceMetadata,
  type AppSettings,
  type LegacyImportPreview
} from '@datamanager/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NativePort, ProtoFileEntry } from '../src/adapters/native/NativePort'
import { SchemaScreen } from '../src/features/schema/SchemaScreen'

const header = `syntax = "proto3";
package sample;
option go_package = "./sample";
`

afterEach(cleanup)

function createProtoPort(
  initialFiles: Record<string, string>,
  primaryKeyTypePolicy: 'numeric-or-enum' | 'string' | 'unrestricted' = 'unrestricted'
): {
  nativePort: NativePort
  writeFile: ReturnType<typeof vi.fn<(path: string, contents: Uint8Array) => Promise<string>>>
  writeProtoWithMetadata: ReturnType<typeof vi.fn<NativePort['writeProtoWithMetadata']>>
  updateWorkspaceMetadata: ReturnType<typeof vi.fn<NativePort['updateWorkspaceMetadata']>>
  files: Map<string, string>
} {
  const root = 'D:\\Proto Workspace'
  const files = new Map(
    Object.entries(initialFiles).map(([fileName, source]) => [`${root}\\${fileName}`, source])
  )
  const settings: AppSettings = { ...defaultAppSettings, protoRoot: root }
  let metadata = { ...defaultWorkspaceMetadata(), primaryKeyTypePolicy }
  const writeFile = vi.fn(async (path: string, contents: Uint8Array): Promise<string> => {
    files.set(path, new TextDecoder().decode(contents))
    return path
  })
  const writeProtoWithMetadata = vi.fn<NativePort['writeProtoWithMetadata']>(async (request) => {
    files.set(`${root}\\${request.sourceFile}`, new TextDecoder().decode(request.contents))
    const tables = { ...metadata.tables }
    const moved = tables[request.mutation.oldKey]
    delete tables[request.mutation.oldKey]
    if (request.mutation.newKey && moved) tables[request.mutation.newKey] = moved
    metadata = applyWorkspaceMetadataSectionUpdate(metadata, {
      expectedRevision: request.expectedRevision,
      section: 'tables',
      value: tables
    })
    return metadata
  })
  const updateWorkspaceMetadata = vi.fn<NativePort['updateWorkspaceMetadata']>(async (update) => {
    metadata = applyWorkspaceMetadataSectionUpdate(metadata, update)
    return metadata
  })
  const nativePort: NativePort = {
    loadSettings: async () => settings,
    saveSettings: async (next) => next,
    loadWorkspaceMetadata: async () => metadata,
    updateWorkspaceMetadata,
    writeProtoWithMetadata,
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
  return { nativePort, writeFile, writeProtoWithMetadata, updateWorkspaceMetadata, files }
}

describe('SchemaScreen', () => {
  it('uses the editable name and filename fields without a duplicate declaration header', async () => {
    const { nativePort } = createProtoPort({
      'ItemTable.proto': `${header}\nmessage Item { int32 id = 1; }\n`
    })
    const user = userEvent.setup()
    render(<SchemaScreen focusKind="message" nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Item (ItemTable.proto)' }))
    expect(screen.getByRole('textbox', { name: 'Message 이름' })).toHaveProperty('value', 'Item')
    expect(screen.getByRole('textbox', { name: 'Proto 파일명' })).toHaveProperty(
      'value',
      'ItemTable'
    )
    expect(screen.queryByText(/저장 파일:/)).toBeNull()
    expect(document.querySelector('.editor-heading')).toBeNull()
  })

  it('shows rename impacts and persists a source-preserving message update', async () => {
    const { nativePort, writeFile, writeProtoWithMetadata, files } = createProtoPort({
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

    await waitFor(() => expect(writeProtoWithMetadata).toHaveBeenCalledTimes(1))
    expect(writeFile).not.toHaveBeenCalled()
    expect(writeProtoWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceFile: 'TargetTable.proto',
        expectedRevision: 0,
        mutation: {
          oldKey: 'TargetTable.proto#Target',
          newKey: null
        }
      })
    )
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

  it('edits only the filename stem and appends .proto once after paste', async () => {
    const { nativePort, writeFile, files } = createProtoPort({})
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: '테이블 추가' }))
    await user.type(screen.getByRole('textbox', { name: 'Message 이름' }), 'Custom')
    const fileName = screen.getByRole('textbox', { name: 'Proto 파일명' })
    expect((fileName as HTMLInputElement).value).toBe('CustomTable')
    expect((fileName as HTMLInputElement).placeholder).not.toContain('.proto')
    await user.clear(fileName)
    await user.type(fileName, 'CustomTable.proto')
    expect((fileName as HTMLInputElement).value).toBe('CustomTable')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(writeFile).toHaveBeenCalledTimes(1))
    expect(files.has('D:\\Proto Workspace\\CustomTable.proto')).toBe(true)
    expect([...files.keys()].some((path) => path.endsWith('.proto.proto'))).toBe(false)
  })

  it('rejects repeated extensions and Windows case-insensitive filename collisions', async () => {
    const { nativePort, writeFile } = createProtoPort({
      'customTable.proto': `${header}\nmessage Existing { int32 id = 1; }\n`
    })
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: '테이블 추가' }))
    await user.type(screen.getByRole('textbox', { name: 'Message 이름' }), 'Custom')
    const fileName = screen.getByRole('textbox', { name: 'Proto 파일명' })
    await user.clear(fileName)
    fireEvent.change(fileName, { target: { value: 'CustomTable.proto.proto' } })
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText(/Proto 파일명이 올바르지 않습니다/)).toBeTruthy()
    expect(writeFile).not.toHaveBeenCalled()

    await user.clear(fileName)
    await user.type(fileName, 'CustomTable')
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText(/대소문자만 다른 Proto 파일이 이미 있습니다/)).toBeTruthy()
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('opens key help as a dialog and restores focus after Escape', async () => {
    const { nativePort } = createProtoPort({
      'KeyedTable.proto': `${header}\nmessage Keyed { int32 id = 1; }\n`
    })
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Keyed (KeyedTable.proto)' }))
    const help = screen.getByRole('button', { name: '키 규칙 도움말' })
    await user.click(help)
    expect(screen.getByRole('dialog', { name: '테이블 키 사용 기준' })).toBeTruthy()
    expect(screen.getByText(/일반 데이터베이스의 여러 칼럼/)).toBeTruthy()
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(help))
  })

  it('hides field shape controls while preserving optional and repeated labels', async () => {
    const { nativePort, writeProtoWithMetadata, files } = createProtoPort({
      'ShapeTable.proto': `${header}\nmessage Shape {\n  optional string note = 1;\n  repeated int32 values = 2;\n}\n`
    })
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Shape (ShapeTable.proto)' }))
    expect(screen.queryByRole('combobox', { name: /형태/ })).toBeNull()
    const firstName = screen.getByRole('textbox', { name: '필드 1 이름' })
    await user.clear(firstName)
    await user.type(firstName, 'memo')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(writeProtoWithMetadata).toHaveBeenCalledTimes(1))
    const saved = files.get('D:\\Proto Workspace\\ShapeTable.proto') ?? ''
    expect(saved).toContain('optional string memo = 1;')
    expect(saved).toContain('repeated int32 values = 2;')
  })

  it('marks the current Message type and saves self-reference without a self import', async () => {
    const { nativePort, writeProtoWithMetadata, files } = createProtoPort({
      'CategoryTable.proto': `${header}\nmessage Category {\n  int32 id = 1;\n  string parent = 2;\n}\n`
    })
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Category (CategoryTable.proto)' }))
    const currentOption = document.querySelector(
      '#message-known-types option[label="현재 테이블"]'
    ) as HTMLOptionElement | null
    expect(currentOption?.value).toBe('Category')
    const parentType = screen.getByRole('combobox', { name: '필드 2 타입' })
    await user.clear(parentType)
    await user.type(parentType, 'Category')
    expect(screen.getByText('현재 테이블 참조')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(writeProtoWithMetadata).toHaveBeenCalledTimes(1))
    const saved = files.get('D:\\Proto Workspace\\CategoryTable.proto') ?? ''
    expect(saved).toContain('Category parent = 2;')
    expect(saved).not.toContain('import "CategoryTable.proto";')
  })

  it('stores ordered Excel memo columns as Message-local @Memo directives', async () => {
    const { nativePort, updateWorkspaceMetadata, writeProtoWithMetadata, files } = createProtoPort({
      'ItemTable.proto': `${header}\nmessage Item { int32 id = 1; }\n`
    })
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Item (ItemTable.proto)' }))
    expect(screen.queryByRole('region', { name: 'Excel 메모 칼럼' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Excel 메모 칼럼 추가' }))
    const memoName = await screen.findByRole('textbox', { name: '메모 1 이름' })
    await user.clear(memoName)
    await user.type(memoName, '기획 검토')
    await user.click(screen.getByRole('button', { name: '메모 위로 이동' }))
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(writeProtoWithMetadata).toHaveBeenCalledTimes(1))
    const saved = files.get('D:\\Proto Workspace\\ItemTable.proto') ?? ''
    expect(saved).toMatch(/@Memo\(memo-[A-Za-z0-9-]+\) 기획 검토/)
    expect(saved.indexOf('@Memo')).toBeLessThan(saved.indexOf('int32 id'))
    expect(updateWorkspaceMetadata).not.toHaveBeenCalled()
  })

  it('migrates legacy metadata memos into Proto on the next Message save', async () => {
    const fixture = createProtoPort({
      'ItemTable.proto': `${header}\nmessage Item { int32 id = 1; }\n`
    })
    fixture.nativePort.loadWorkspaceMetadata = async () => ({
      ...defaultWorkspaceMetadata(),
      tables: {
        'ItemTable.proto#Item': {
          memoColumns: [{ id: 'memo-legacy', name: '이전 메모', order: 0 }]
        }
      }
    })
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={fixture.nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Item (ItemTable.proto)' }))
    expect(screen.getByRole('textbox', { name: '메모 1 이름' })).toHaveProperty(
      'value',
      '이전 메모'
    )
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(fixture.writeProtoWithMetadata).toHaveBeenCalledTimes(1))
    expect(fixture.writeProtoWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: { oldKey: 'ItemTable.proto#Item', newKey: null }
      })
    )
    expect(fixture.files.get('D:\\Proto Workspace\\ItemTable.proto')).toMatch(
      /@Memo\(memo-legacy\) 이전 메모/
    )
  })

  it('uses one key-mode control and writes the matching legacy annotation', async () => {
    const { nativePort, writeProtoWithMetadata, files } = createProtoPort({
      'KeyedTable.proto': `${header}\nmessage Keyed {\n  // @PK\n  int32 id = 4;\n}\n`
    })
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Keyed (KeyedTable.proto)' }))
    const keyMode = screen.getByRole('combobox', { name: '필드 1 키' })
    await user.selectOptions(keyMode, 'group')
    expect((keyMode as HTMLSelectElement).value).toBe('group')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(writeProtoWithMetadata).toHaveBeenCalledTimes(1))
    const saved = files.get('D:\\Proto Workspace\\KeyedTable.proto') ?? ''
    expect(saved).toContain('// @Key')
    expect(saved).not.toContain('// @PK')
    expect(saved).toContain('int32 id = 4;')
  })

  it('shows a policy violation inline and blocks the Proto write', async () => {
    const { nativePort, writeFile } = createProtoPort(
      {
        'KeyedTable.proto': `${header}\nmessage Keyed {\n  // @PK\n  int32 id = 1;\n}\n`
      },
      'numeric-or-enum'
    )
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Keyed (KeyedTable.proto)' }))
    const type = screen.getByRole('combobox', { name: '필드 1 타입' })
    await user.clear(type)
    await user.type(type, 'string')
    expect(screen.getByText(/id의 string은 현재 기본키 정책에 맞지 않습니다/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText(/기본키 타입이 프로젝트 정책에 맞지 않습니다/)).toBeTruthy()
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('shows reference impacts before deleting a table declaration', async () => {
    const { nativePort, writeFile, writeProtoWithMetadata, files } = createProtoPort({
      'TargetTable.proto': `${header}\nmessage Target { int32 id = 1; }\n`,
      'ConsumerTable.proto': `${header}\nmessage Consumer { Target target = 1; }\n`
    })
    const user = userEvent.setup()
    render(<SchemaScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'Target (TargetTable.proto)' }))
    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(await screen.findByText('Consumer.target')).toBeTruthy()
    expect(writeFile).not.toHaveBeenCalled()
    expect(writeProtoWithMetadata).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '계속' }))

    await waitFor(() => expect(writeProtoWithMetadata).toHaveBeenCalledTimes(1))
    expect(writeFile).not.toHaveBeenCalled()
    expect(writeProtoWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceFile: 'TargetTable.proto',
        expectedRevision: 0,
        mutation: { oldKey: 'TargetTable.proto#Target', newKey: null }
      })
    )
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
