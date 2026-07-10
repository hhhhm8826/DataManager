// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { defaultAppSettings, type LegacyImportPreview } from '@datamanager/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GeneratedExcelFile } from '../src/adapters/excel/ExcelProductWorkerClient'
import type { NativePort, ProtoFileEntry } from '../src/adapters/native/NativePort'
import { ExcelScreen } from '../src/features/excel/ExcelScreen'

type GenerateWorkbooks = NonNullable<ComponentProps<typeof ExcelScreen>['generateWorkbooks']>
type ReadWorkbook = NonNullable<ComponentProps<typeof ExcelScreen>['readWorkbook']>

const protoSource = `syntax = "proto3";
message Item {
  // @PK
  int32 id = 1;
  string label = 2;
}
`

afterEach(cleanup)

function excelFixture(existing: boolean): {
  nativePort: NativePort
  generateWorkbooks: GenerateWorkbooks
  writeFile: ReturnType<typeof vi.fn>
  backupFile: ReturnType<typeof vi.fn>
} {
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
  it('cancels without generating, backing up, or writing', async () => {
    const fixture = excelFixture(true)
    const user = userEvent.setup()
    render(
      <ExcelScreen generateWorkbooks={fixture.generateWorkbooks} nativePort={fixture.nativePort} />
    )

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

    await user.click(await screen.findByRole('button', { name: '선택 JSON' }))

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

    await user.click(await screen.findByRole('button', { name: '선택 JSON' }))

    expect(await screen.findByText('EXCEL_REQUIRED_KEY_EMPTY')).toBeTruthy()
    expect(fixture.writeFile).not.toHaveBeenCalled()
  })
})
