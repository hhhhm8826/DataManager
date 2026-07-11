// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import {
  applyWorkspaceMetadataSectionUpdate,
  EXCEL_METADATA_MAGIC,
  EXCEL_METADATA_VERSION,
  defaultAppSettings,
  defaultWorkspaceMetadata,
  type LegacyImportPreview
} from '@datamanager/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GeneratedExcelFile } from '../src/adapters/excel/ExcelProductWorkerClient'
import type { NativePort, ProtoFileEntry } from '../src/adapters/native/NativePort'
import { ExcelScreen } from '../src/features/excel/ExcelScreen'

type GenerateWorkbooks = NonNullable<ComponentProps<typeof ExcelScreen>['generateWorkbooks']>
type ReadWorkbook = NonNullable<ComponentProps<typeof ExcelScreen>['readWorkbook']>
type InspectWorkbook = NonNullable<ComponentProps<typeof ExcelScreen>['inspectWorkbook']>

const protoSource = `syntax = "proto3";
message Item {
  // @PK
  int32 id = 1;
  string label = 2;
}
`

afterEach(cleanup)

async function openJsonTab(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(await screen.findByRole('tab', { name: 'JSON 생성' }))
}

function excelFixture(existing: boolean): {
  nativePort: NativePort
  generateWorkbooks: GenerateWorkbooks
  writeFile: ReturnType<typeof vi.fn>
  backupFile: ReturnType<typeof vi.fn>
} {
  let metadata = defaultWorkspaceMetadata()
  const protoRoot = 'D:\\PROTO'
  const excelRoot = 'D:\\EXCEL'
  const jsonRoot = 'D:\\JSON'
  const excelEntries: ProtoFileEntry[] = existing
    ? [{ path: `${excelRoot}\\ItemTable.xlsx`, fileName: 'ItemTable.xlsx' }]
    : []
  const writeFile = vi.fn(async (path: string, contents: Uint8Array): Promise<string> => {
    void contents
    if (!excelEntries.some((entry) => entry.path === path)) {
      excelEntries.push({ path, fileName: path.split('\\').at(-1) ?? path })
    }
    return path
  })
  const backupFile = vi.fn(async (path: string): Promise<string> => `${path}.backup`)
  const generated: GeneratedExcelFile[] = [
    {
      sourceFile: 'ItemTable.proto',
      fileName: 'ItemTable.xlsx',
      binary: Uint8Array.from([1, 2, 3])
    }
  ]
  const generateWorkbooks = vi.fn<GenerateWorkbooks>(async (_plans, options) => {
    options?.onProgress?.({
      completed: 1,
      total: 1,
      label: 'Item',
      itemIndex: 0,
      itemCount: 1
    })
    return generated
  })
  const nativePort: NativePort = {
    loadSettings: async () => ({ ...defaultAppSettings, protoRoot, excelRoot, jsonRoot }),
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
      { path: `${protoRoot}\\ItemTable.proto`, fileName: 'ItemTable.proto' }
    ],
    listExcelFiles: async () => [...excelEntries],
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
    readFile: async (path) =>
      path.endsWith('.proto') ? new TextEncoder().encode(protoSource) : Uint8Array.from([]),
    writeFile,
    backupFile,
    openPath: async () => undefined
  }
  return { nativePort, generateWorkbooks, writeFile, backupFile }
}

describe('ExcelScreen collision policy', () => {
  it('starts both purposes at zero and preserves an explicit zero selection on reload', async () => {
    const fixture = excelFixture(true)
    const user = userEvent.setup()
    render(
      <ExcelScreen generateWorkbooks={fixture.generateWorkbooks} nativePort={fixture.nativePort} />
    )

    const excel = await screen.findByRole('checkbox', { name: 'ItemTable.xlsx Excel 생성' })
    expect((excel as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('button', { name: '선택 생성' }) as HTMLButtonElement).disabled).toBe(
      true
    )

    await openJsonTab(user)
    const json = screen.getByRole('checkbox', { name: 'ItemTable.xlsx Item JSON 테이블' })
    expect((json as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('button', { name: 'JSON 생성' }) as HTMLButtonElement).disabled).toBe(
      true
    )

    await user.click(screen.getByRole('button', { name: 'Excel 목록 새로고침' }))
    await waitFor(() =>
      expect(
        (
          screen.getByRole('checkbox', {
            name: 'ItemTable.xlsx Item JSON 테이블'
          }) as HTMLInputElement
        ).checked
      ).toBe(false)
    )

    await user.click(screen.getByRole('tab', { name: 'Excel 생성' }))
    expect(
      (screen.getByRole('checkbox', { name: 'ItemTable.xlsx Excel 생성' }) as HTMLInputElement)
        .checked
    ).toBe(false)
  })

  it('provides parent mixed selection and disables JSON children without a workbook', async () => {
    const fixture = excelFixture(true)
    fixture.nativePort.readFile = async (path) =>
      path.endsWith('.proto')
        ? new TextEncoder().encode(`${protoSource}\nmessage Detail { string name = 1; }\n`)
        : Uint8Array.from([])
    const user = userEvent.setup()
    const { unmount } = render(
      <ExcelScreen generateWorkbooks={fixture.generateWorkbooks} nativePort={fixture.nativePort} />
    )

    await openJsonTab(user)

    const item = await screen.findByRole('checkbox', {
      name: 'ItemTable.xlsx Item JSON 테이블'
    })
    const detail = screen.getByRole('checkbox', {
      name: 'ItemTable.xlsx Detail JSON 테이블'
    })
    const parent = screen.getByRole('checkbox', {
      name: 'ItemTable.xlsx JSON 테이블 전체'
    }) as HTMLInputElement
    await user.click(item)
    expect(parent.indeterminate).toBe(true)
    expect(parent.getAttribute('aria-checked')).toBe('mixed')
    await user.click(parent)
    expect((item as HTMLInputElement).checked).toBe(true)
    expect((detail as HTMLInputElement).checked).toBe(true)
    unmount()

    const missing = excelFixture(false)
    render(
      <ExcelScreen generateWorkbooks={missing.generateWorkbooks} nativePort={missing.nativePort} />
    )
    await openJsonTab(user)
    expect(
      (await screen.findByRole('checkbox', {
        name: 'ItemTable.xlsx Item JSON 테이블'
      })) as HTMLInputElement
    ).toHaveProperty('disabled', true)
    expect(screen.getAllByText('Excel 생성 필요').length).toBeGreaterThan(0)
  })

  it('opens the configured output roots and keeps refresh as the last toolbar action', async () => {
    const fixture = excelFixture(true)
    const openPath = vi.fn(async (): Promise<void> => undefined)
    fixture.nativePort.openPath = openPath
    const user = userEvent.setup()
    render(
      <ExcelScreen generateWorkbooks={fixture.generateWorkbooks} nativePort={fixture.nativePort} />
    )

    const excelButton = await screen.findByRole('button', { name: 'Excel 폴더 열기' })
    const jsonButton = screen.getByRole('button', { name: 'JSON 폴더 열기' })
    const refreshButton = screen.getByRole('button', { name: 'Excel 목록 새로고침' })
    const toolbarActions = excelButton.parentElement

    expect(Array.from(toolbarActions?.querySelectorAll('button') ?? []).at(-1)).toBe(refreshButton)
    await user.click(excelButton)
    expect(openPath).toHaveBeenCalledWith('D:\\EXCEL')
    await user.click(jsonButton)
    expect(openPath).toHaveBeenLastCalledWith('D:\\JSON')
  })

  it('separates Excel and JSON work into tabs and searches file and table names', async () => {
    const fixture = excelFixture(true)
    fixture.nativePort.readFile = async (path) =>
      path.endsWith('.proto')
        ? new TextEncoder().encode(`${protoSource}\nmessage Detail { string name = 1; }\n`)
        : Uint8Array.from([])
    const user = userEvent.setup()
    render(
      <ExcelScreen generateWorkbooks={fixture.generateWorkbooks} nativePort={fixture.nativePort} />
    )

    const excelTab = await screen.findByRole('tab', { name: 'Excel 생성' })
    const jsonTab = screen.getByRole('tab', { name: 'JSON 생성' })
    expect(excelTab.getAttribute('aria-selected')).toBe('true')
    expect(jsonTab.getAttribute('aria-selected')).toBe('false')

    const workbookCheckbox = screen.getByRole('checkbox', {
      name: 'ItemTable.xlsx Excel 생성'
    })
    const workbookRow = workbookCheckbox.closest('.excel-generation-row')
    expect(workbookRow?.textContent).toContain('2개 table')
    expect(workbookRow?.textContent).toContain('Item, Detail')

    const search = screen.getByRole('searchbox', { name: 'Excel과 테이블 검색' })
    await user.type(search, 'detail')
    expect(screen.getByRole('checkbox', { name: 'ItemTable.xlsx Excel 생성' })).toBeTruthy()
    await user.clear(search)
    await user.type(search, 'missing')
    expect(screen.getByText('검색 결과가 없습니다.')).toBeTruthy()

    await user.clear(search)
    await user.click(jsonTab)
    expect(jsonTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('button', { name: 'JSON 생성' })).toBeTruthy()
    expect(screen.getByLabelText('ItemTable.xlsx 포함 테이블').textContent).toContain('Detail')
  })

  it('opens Excel files from Excel generation and JSON files by double-clicking their names', async () => {
    const fixture = excelFixture(true)
    const openPath = vi.fn(async (): Promise<void> => undefined)
    fixture.nativePort.openPath = openPath
    const user = userEvent.setup()
    render(
      <ExcelScreen generateWorkbooks={fixture.generateWorkbooks} nativePort={fixture.nativePort} />
    )

    await user.click(await screen.findByRole('button', { name: 'ItemTable.xlsx 열기' }))
    expect(openPath).toHaveBeenLastCalledWith('D:\\EXCEL\\ItemTable.xlsx')

    await openJsonTab(user)
    expect(screen.queryByRole('button', { name: 'ItemTable.xlsx 열기' })).toBeNull()
    const jsonFile = screen.getByText('Item.json')
    const jsonCheckbox = screen.getByRole('checkbox', {
      name: 'ItemTable.xlsx Item JSON 테이블'
    }) as HTMLInputElement
    expect(jsonFile.classList.contains('excel-json-file-name')).toBe(true)
    expect(jsonFile.getAttribute('title')).toBe('더블클릭하여 JSON 파일 열기')
    await user.click(jsonFile)
    expect(jsonCheckbox.checked).toBe(false)
    await user.dblClick(jsonFile)
    expect(jsonCheckbox.checked).toBe(false)
    expect(openPath).toHaveBeenLastCalledWith('D:\\JSON\\Item.json')
  })

  it('validates every existing workbook from the JSON generation tab', async () => {
    const fixture = excelFixture(true)
    const readWorkbook = vi.fn<ReadWorkbook>(async () => [
      {
        name: 'Item',
        headers: ['id', 'label'],
        rows: [[1, 'valid']]
      }
    ])
    const user = userEvent.setup()
    render(
      <ExcelScreen
        generateWorkbooks={fixture.generateWorkbooks}
        nativePort={fixture.nativePort}
        readWorkbook={readWorkbook}
      />
    )

    await openJsonTab(user)
    await user.click(await screen.findByRole('button', { name: '전체 읽기 검사' }))

    expect(await screen.findByText(/1개 workbook 전체 읽기 검사 완료/)).toBeTruthy()
    expect(readWorkbook).toHaveBeenCalledTimes(1)
    expect(readWorkbook.mock.calls[0]?.[0]).toBe('ItemTable.proto')
  })

  it('inspects embedded memo metadata and shows stale changes on the workbook row', async () => {
    const fixture = excelFixture(true)
    const user = userEvent.setup()
    fixture.nativePort.loadWorkspaceMetadata = async () => ({
      ...defaultWorkspaceMetadata(),
      tables: {
        'ItemTable.proto#Item': {
          memoColumns: [{ id: 'memo-current', name: '현재 메모', order: 0 }]
        }
      }
    })
    const inspectWorkbook = vi.fn<InspectWorkbook>(async () => ({
      metadata: {
        magic: EXCEL_METADATA_MAGIC,
        version: EXCEL_METADATA_VERSION,
        sourceFile: 'ItemTable.proto',
        fingerprint: 'dm1-stale',
        tables: [
          {
            messageName: 'Item',
            memoColumns: [{ id: 'memo-old', name: '이전 메모' }]
          }
        ]
      }
    }))
    render(
      <ExcelScreen
        generateWorkbooks={fixture.generateWorkbooks}
        inspectWorkbook={inspectWorkbook}
        nativePort={fixture.nativePort}
      />
    )

    await openJsonTab(user)

    expect(await screen.findByText(/메모 변경 적용 필요/)).toBeTruthy()
    expect(screen.getByText(/추가: 현재 메모/)).toBeTruthy()
    expect(screen.getByText(/삭제: 이전 메모/)).toBeTruthy()
    expect(inspectWorkbook).toHaveBeenCalledTimes(1)
  })

  it('blocks workbook generation before worker/native writes when key policy is violated', async () => {
    const fixture = excelFixture(false)
    fixture.nativePort.loadWorkspaceMetadata = async () => ({
      ...defaultWorkspaceMetadata(),
      primaryKeyTypePolicy: 'string'
    })
    const user = userEvent.setup()
    render(
      <ExcelScreen generateWorkbooks={fixture.generateWorkbooks} nativePort={fixture.nativePort} />
    )

    await user.click(await screen.findByRole('checkbox', { name: 'ItemTable.xlsx Excel 생성' }))
    await user.click(await screen.findByRole('button', { name: '선택 생성' }))
    expect(await screen.findByText(/Item\.id\(int32\)/)).toBeTruthy()
    expect(fixture.generateWorkbooks).not.toHaveBeenCalled()
    expect(fixture.writeFile).not.toHaveBeenCalled()
  })

  it('cancels without generating, backing up, or writing', async () => {
    const fixture = excelFixture(true)
    const user = userEvent.setup()
    render(
      <ExcelScreen generateWorkbooks={fixture.generateWorkbooks} nativePort={fixture.nativePort} />
    )

    await user.click(await screen.findByRole('checkbox', { name: 'ItemTable.xlsx Excel 생성' }))
    await user.click(await screen.findByRole('button', { name: '선택 생성' }))
    expect(await screen.findByRole('dialog', { name: '기존 Excel 파일' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '생성 취소' }))

    expect(fixture.generateWorkbooks).not.toHaveBeenCalled()
    expect(fixture.backupFile).not.toHaveBeenCalled()
    expect(fixture.writeFile).not.toHaveBeenCalled()
  })

  it.each([
    ['백업 없이 덮어쓰기', 0],
    ['백업 후 생성', 1]
  ])('%s 경로를 원자 쓰기에 연결한다', async (action, expectedBackups) => {
    const fixture = excelFixture(true)
    const user = userEvent.setup()
    render(
      <ExcelScreen generateWorkbooks={fixture.generateWorkbooks} nativePort={fixture.nativePort} />
    )

    await user.click(await screen.findByRole('checkbox', { name: 'ItemTable.xlsx Excel 생성' }))
    await user.click(await screen.findByRole('button', { name: '선택 생성' }))
    await user.click(await screen.findByRole('button', { name: action }))

    await waitFor(() => expect(fixture.writeFile).toHaveBeenCalledTimes(1))
    expect(fixture.generateWorkbooks).toHaveBeenCalledTimes(1)
    expect(fixture.backupFile).toHaveBeenCalledTimes(expectedBackups)
    expect(fixture.writeFile).toHaveBeenCalledWith(
      'D:\\EXCEL\\ItemTable.xlsx',
      Uint8Array.from([1, 2, 3])
    )
    if (expectedBackups > 0) {
      expect(fixture.backupFile.mock.invocationCallOrder[0]).toBeLessThan(
        fixture.writeFile.mock.invocationCallOrder[0]!
      )
    }
  })

  it('aborts an in-flight worker operation without writing partial output', async () => {
    const fixture = excelFixture(false)
    let observedSignal: AbortSignal | undefined
    const generateWorkbooks = vi.fn<GenerateWorkbooks>(
      async (_plans, options): Promise<GeneratedExcelFile[]> =>
        new Promise((_, reject) => {
          observedSignal = options?.signal
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('cancelled', 'AbortError'))
          )
        })
    )
    const user = userEvent.setup()
    render(<ExcelScreen generateWorkbooks={generateWorkbooks} nativePort={fixture.nativePort} />)

    await user.click(await screen.findByRole('checkbox', { name: 'ItemTable.xlsx Excel 생성' }))
    await user.click(await screen.findByRole('button', { name: '선택 생성' }))
    await user.click(await screen.findByRole('button', { name: '취소' }))

    await waitFor(() => expect(observedSignal?.aborted).toBe(true))
    expect(fixture.writeFile).not.toHaveBeenCalled()
  })

  it('writes deterministic JSON only after workbook validation succeeds', async () => {
    const fixture = excelFixture(true)
    const readWorkbook = vi.fn<ReadWorkbook>(async () => [
      {
        name: 'Item',
        headers: ['id', 'label'],
        rows: [[1, 'valid']]
      }
    ])
    const user = userEvent.setup()
    render(
      <ExcelScreen
        generateWorkbooks={fixture.generateWorkbooks}
        nativePort={fixture.nativePort}
        readWorkbook={readWorkbook}
      />
    )

    await openJsonTab(user)

    await user.click(
      await screen.findByRole('checkbox', { name: 'ItemTable.xlsx Item JSON 테이블' })
    )
    await user.click(await screen.findByRole('button', { name: 'JSON 생성' }))

    await waitFor(() => expect(fixture.writeFile).toHaveBeenCalledTimes(1))
    const [path, bytes] = fixture.writeFile.mock.calls[0]!
    expect(path).toBe('D:\\JSON\\Item.json')
    expect(new TextDecoder().decode(bytes)).toBe(
      '[\n  {\n    "id": 1,\n    "label": "valid"\n  }\n]\n'
    )
  })

  it('does not write JSON when workbook input contains an empty required key', async () => {
    const fixture = excelFixture(true)
    const readWorkbook = vi.fn<ReadWorkbook>(async () => [
      {
        name: 'Item',
        headers: ['id', 'label'],
        rows: [[null, 'invalid']]
      }
    ])
    const user = userEvent.setup()
    render(
      <ExcelScreen
        generateWorkbooks={fixture.generateWorkbooks}
        nativePort={fixture.nativePort}
        readWorkbook={readWorkbook}
      />
    )

    await openJsonTab(user)

    await user.click(
      await screen.findByRole('checkbox', { name: 'ItemTable.xlsx Item JSON 테이블' })
    )
    await user.click(await screen.findByRole('button', { name: 'JSON 생성' }))

    expect(await screen.findByText('EXCEL_REQUIRED_KEY_EMPTY')).toBeTruthy()
    expect(fixture.writeFile).not.toHaveBeenCalled()
  })

  it('blocks self-reference row cycles before the first JSON write with a Korean path diagnostic', async () => {
    const fixture = excelFixture(true)
    fixture.nativePort.readFile = async (path) =>
      path.endsWith('.proto')
        ? new TextEncoder().encode(`syntax = "proto3";
message Category {
  // @PK
  int32 id = 1;
  string name = 2;
  Category parent = 3;
}
`)
        : Uint8Array.from([])
    const readWorkbook = vi.fn<ReadWorkbook>(async () => [
      {
        name: 'Category',
        headers: ['id', 'name', 'parent'],
        rows: [[1, 'Self', 1]]
      }
    ])
    const user = userEvent.setup()
    render(
      <ExcelScreen
        generateWorkbooks={fixture.generateWorkbooks}
        nativePort={fixture.nativePort}
        readWorkbook={readWorkbook}
      />
    )

    await openJsonTab(user)

    await user.click(
      await screen.findByRole('checkbox', {
        name: 'ItemTable.xlsx Category JSON 테이블'
      })
    )
    await user.click(screen.getByRole('button', { name: 'JSON 생성' }))

    expect(await screen.findByText('JSON_REFERENCE_ROW_CYCLE')).toBeTruthy()
    expect(screen.getByText(/Excel 행의 자기 참조가 순환합니다/)).toBeTruthy()
    expect(screen.getByText(/Category R2 \(id=1\)/)).toBeTruthy()
    expect(fixture.writeFile).not.toHaveBeenCalled()
  })
})
