// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  applyWorkspaceMetadataSectionUpdate,
  defaultAppSettings,
  defaultWorkspaceMetadata,
  type DiagramProjection,
  type LegacyImportPreview,
  type SavedDiagramLayout
} from '@datamanager/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativePort } from '../src/adapters/native/NativePort'
import { DiagramScreen } from '../src/features/diagram/DiagramScreen'
import { fallbackDiagramLayout } from '../src/features/diagram/diagramLayout'

const files = {
  'TargetTable.proto': `syntax = "proto3";\nmessage Target { int32 id = 1; Status status = 2; }\n`,
  'OtherTable.proto': `syntax = "proto3";\nmessage Other { Target target = 1; }\n`,
  'StatusEnumType.proto': `syntax = "proto3";\nenum Status { Status_NONE = 0; Status_ACTIVE = 1; Status_MAX = 2; }\n`
}

beforeEach(() => {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function diagramFixture(
  sourceFiles: Record<string, string> = files,
  hubThreshold = 5,
  savedLayout: SavedDiagramLayout | null = null
): {
  nativePort: NativePort
  updateWorkspaceMetadata: ReturnType<typeof vi.fn<NativePort['updateWorkspaceMetadata']>>
} {
  const root = 'D:\\PROTO'
  let metadata = {
    ...defaultWorkspaceMetadata(),
    diagram: { hubThreshold, savedLayout }
  }
  const updateWorkspaceMetadata = vi.fn<NativePort['updateWorkspaceMetadata']>(async (update) => {
    metadata = applyWorkspaceMetadataSectionUpdate(metadata, update)
    return metadata
  })
  const nativePort: NativePort = {
    loadSettings: async () => ({
      ...defaultAppSettings,
      protoRoot: root,
      diagram: {
        fileColors: { 'TargetTable.proto': '#2457a6' },
        maxNodesPerColumn: 2
      }
    }),
    saveSettings: async (settings) => settings,
    loadWorkspaceMetadata: async () => metadata,
    updateWorkspaceMetadata,
    writeProtoWithMetadata: async () => metadata,
    selectDirectory: async () => null,
    selectFile: async () => null,
    findLegacyConfig: async () => null,
    previewLegacyImport: async (): Promise<LegacyImportPreview> => {
      throw new Error('not available')
    },
    importLegacySettings: async () => defaultAppSettings,
    listProtoFiles: async () =>
      Object.keys(sourceFiles).map((fileName) => ({ path: `${root}\\${fileName}`, fileName })),
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
    readFile: async (path) => {
      const fileName = path.split('\\').at(-1) ?? ''
      return new TextEncoder().encode(sourceFiles[fileName])
    },
    writeFile: async (path) => path,
    backupFile: async (path) => `${path}.backup`,
    openPath: async () => undefined
  }
  return { nativePort, updateWorkspaceMetadata }
}

describe('DiagramScreen', () => {
  it('projects only Message nodes, opens Enum values, and dims nonmatching search results', async () => {
    const user = userEvent.setup()
    const fixture = diagramFixture()
    render(
      <DiagramScreen
        layoutRunner={async (projection) => fallbackDiagramLayout(projection)}
        nativePort={fixture.nativePort}
      />
    )

    const targetTitle = await screen.findByText('Target', { selector: 'strong' })
    const otherTitle = screen.getByText('Other', { selector: 'strong' })
    expect(targetTitle).toBeTruthy()
    expect(otherTitle).toBeTruthy()
    expect(document.querySelector('.diagram-node-enum')).toBeNull()
    expect(screen.queryByText('Status_ACTIVE')).toBeNull()
    expect(screen.getByRole('button', { name: '자동 배치' })).toBeTruthy()
    expect(targetTitle.closest('.diagram-node')?.textContent).toContain('Status')

    const enumButton = screen.getByText('Status', { selector: 'button' })
    await user.click(enumButton)
    expect(screen.getByRole('dialog', { name: 'Status' })).toBeTruthy()
    expect(screen.getByText('Status_ACTIVE')).toBeTruthy()
    expect(screen.getByText('Status_MAX')).toBeTruthy()
    expect(screen.getByText('참조: Target.status')).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(enumButton))

    const search = screen.getByRole('textbox', { name: '관계도 검색' })
    await user.type(search, 'Status_ACTIVE')
    await user.click(screen.getByRole('button', { name: /Enum Status/ }))
    expect(screen.getByRole('dialog', { name: 'Status' })).toBeTruthy()
    await user.keyboard('{Escape}')
    await user.clear(search)

    await user.type(search, 'TargetTable.proto')
    await waitFor(() =>
      expect(otherTitle.closest('.diagram-node')?.className).toContain('diagram-node-dimmed')
    )
    expect(targetTitle.closest('.diagram-node')?.className).not.toContain('diagram-node-dimmed')
  })

  it('persists valid thresholds and leaves metadata unchanged for invalid values', async () => {
    const fixture = diagramFixture()
    const user = userEvent.setup()
    const layoutRunner = vi.fn(async (projection: DiagramProjection) =>
      fallbackDiagramLayout(projection)
    )
    render(<DiagramScreen layoutRunner={layoutRunner} nativePort={fixture.nativePort} />)

    const threshold = await screen.findByRole('spinbutton', { name: '연결 모달 기준' })
    await waitFor(() => expect(layoutRunner).toHaveBeenCalledTimes(1))
    await user.clear(threshold)
    await user.type(threshold, '3')
    await user.tab()
    await waitFor(() => expect(fixture.updateWorkspaceMetadata).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(layoutRunner).toHaveBeenCalledTimes(2))
    expect(fixture.updateWorkspaceMetadata).toHaveBeenLastCalledWith({
      expectedRevision: 0,
      section: 'diagram',
      value: { hubThreshold: 3, savedLayout: null }
    })

    await user.clear(threshold)
    await user.type(threshold, '51')
    await user.tab()
    expect(await screen.findByText(/1부터 50 사이의 정수/)).toBeTruthy()
    expect(fixture.updateWorkspaceMetadata).toHaveBeenCalledTimes(1)
    expect((threshold as HTMLInputElement).value).toBe('3')
    await user.click(screen.getByRole('button', { name: '관계도 새로고침' }))
    await waitFor(() => expect(layoutRunner).toHaveBeenCalledTimes(3))
    expect((threshold as HTMLInputElement).value).toBe('3')
  })

  it('opens incoming-threshold modal tables from their referencing field type buttons', async () => {
    const fixture = diagramFixture(
      {
        'HubTable.proto': `syntax = "proto3";
message NameTest { StringData Name = 1; }
message Monster { StringData label = 1; }
message StringData { int32 id = 1; }
`
      },
      2
    )
    const user = userEvent.setup()
    render(
      <DiagramScreen
        layoutRunner={async (projection) => fallbackDiagramLayout(projection)}
        nativePort={fixture.nativePort}
      />
    )

    const nameTest = await screen.findByText('NameTest', { selector: 'strong' })
    expect(screen.queryByText('StringData', { selector: '.diagram-node strong' })).toBeNull()
    const nameTypeButton = within(nameTest.closest('.diagram-node') as HTMLElement).getByText(
      'StringData',
      { selector: '.diagram-type-button' }
    )
    await user.click(nameTypeButton)
    expect(screen.getByRole('dialog', { name: 'StringData' })).toBeTruthy()
    expect(screen.getByText('참조: NameTest.Name')).toBeTruthy()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: '모달 테이블 1개' }))
    expect(screen.getByRole('dialog', { name: '모달 테이블' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /StringData\s*HubTable\.proto/ })).toBeTruthy()
  })

  it('saves and deletes normalized layout without resetting the hub threshold', async () => {
    const fixture = diagramFixture()
    const user = userEvent.setup()
    render(
      <DiagramScreen
        layoutRunner={async (projection) => fallbackDiagramLayout(projection)}
        nativePort={fixture.nativePort}
      />
    )

    await user.click(await screen.findByRole('button', { name: '배치 저장' }))
    await waitFor(() => expect(fixture.updateWorkspaceMetadata).toHaveBeenCalledTimes(1))
    const saveUpdate = fixture.updateWorkspaceMetadata.mock.calls[0]?.[0]
    expect(saveUpdate?.section).toBe('diagram')
    if (saveUpdate?.section !== 'diagram') throw new Error('diagram update expected')
    const savedDiagram = saveUpdate.value as {
      hubThreshold: number
      savedLayout: SavedDiagramLayout | null
    }
    expect(savedDiagram.hubThreshold).toBe(5)
    expect(Object.keys(savedDiagram.savedLayout?.positions ?? {})).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: '저장 배치 삭제' }))
    await waitFor(() => expect(fixture.updateWorkspaceMetadata).toHaveBeenCalledTimes(2))
    const deleteUpdate = fixture.updateWorkspaceMetadata.mock.calls[1]?.[0]
    expect(deleteUpdate?.section).toBe('diagram')
    if (deleteUpdate?.section !== 'diagram') throw new Error('diagram update expected')
    expect(
      deleteUpdate.value as { hubThreshold: number; savedLayout: SavedDiagramLayout | null }
    ).toEqual({
      hubThreshold: 5,
      savedLayout: null
    })
  })

  it('restores saved positions without dirty state and confirms discarding an auto layout', async () => {
    const fixture = diagramFixture(files, 5, {
      positions: {
        'message:TargetTable.proto:Target': { x: 120.1, y: 220.2 },
        'message:OtherTable.proto:Other': { x: 520.3, y: 220.2 }
      },
      viewport: { x: 10.1, y: 20.2, zoom: 0.875 }
    })
    const user = userEvent.setup()
    render(
      <DiagramScreen
        layoutRunner={async (projection) => fallbackDiagramLayout(projection)}
        nativePort={fixture.nativePort}
      />
    )

    await screen.findByText('Target', { selector: 'strong' })
    await waitFor(() => expect(screen.queryByText('저장되지 않은 배치')).toBeNull())
    await user.click(screen.getByRole('button', { name: '자동 배치' }))
    expect(await screen.findByText('저장되지 않은 배치')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '저장 배치 불러오기' }))
    expect(screen.getByRole('dialog', { name: '저장되지 않은 배치가 있습니다' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '계속' }))
    await waitFor(() => expect(screen.queryByText('저장되지 않은 배치')).toBeNull())
  })

  it('keeps saved coordinates for currently hidden Messages and prunes Enum coordinates on save', async () => {
    const denseFiles = {
      'HubTable.proto': `syntax = "proto3";
enum State { State_NONE = 0; State_MAX = 1; }
message Hub { A a = 1; B b = 2; C c = 3; State state = 4; }
message A { int32 id = 1; }
message B { C peer = 1; }
message C { int32 id = 1; }
`
    }
    const fixture = diagramFixture(denseFiles, 2, {
      positions: {
        'message:HubTable.proto:Hub': { x: 0, y: 0 },
        'message:HubTable.proto:A': { x: 100, y: 400 },
        'message:HubTable.proto:B': { x: 400, y: 0 },
        'message:HubTable.proto:C': { x: 800, y: 0 },
        'enum:HubTable.proto:State': { x: 1200, y: 0 }
      },
      viewport: { x: 0, y: 0, zoom: 1 }
    })
    const user = userEvent.setup()
    render(
      <DiagramScreen
        layoutRunner={async (projection) => fallbackDiagramLayout(projection)}
        nativePort={fixture.nativePort}
      />
    )

    await user.click(await screen.findByRole('button', { name: '배치 저장' }))
    await waitFor(() => expect(fixture.updateWorkspaceMetadata).toHaveBeenCalledTimes(1))
    const update = fixture.updateWorkspaceMetadata.mock.calls[0]?.[0]
    if (update?.section !== 'diagram') throw new Error('diagram update expected')
    const diagram = update.value as { savedLayout: SavedDiagramLayout | null }
    expect(diagram.savedLayout?.positions).toHaveProperty('message:HubTable.proto:C')
    expect(diagram.savedLayout?.positions).not.toHaveProperty('enum:HubTable.proto:State')
  })
})
