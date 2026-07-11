// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  applyWorkspaceMetadataSectionUpdate,
  defaultAppSettings,
  defaultWorkspaceMetadata,
  type AppSettings,
  type LegacyImportPreview
} from '@datamanager/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CodegenEnvironment,
  NativePort,
  ProtocRunResult
} from '../src/adapters/native/NativePort'
import { CodegenScreen } from '../src/features/codegen/CodegenScreen'

const protoRoot = 'D:\\Workspace\\PROTO'
const protoSource = `syntax = "proto3";
message Item {
  int32 id = 1;
  string label = 2;
}
`

afterEach(cleanup)

function codegenFixture(
  outputs: AppSettings['codegenOutputs'],
  options: {
    environment?: CodegenEnvironment
    primaryKeyTypePolicy?: 'numeric-or-enum' | 'string' | 'unrestricted'
    protoSource?: string
    runProtocLanguage?: NativePort['runProtocLanguage']
    writeUnrealFiles?: NativePort['writeUnrealFiles']
  } = {}
): {
  nativePort: NativePort
  runProtocLanguage: ReturnType<typeof vi.fn<NativePort['runProtocLanguage']>>
  writeUnrealFiles: ReturnType<typeof vi.fn<NativePort['writeUnrealFiles']>>
} {
  let metadata = defaultWorkspaceMetadata()
  metadata.primaryKeyTypePolicy = options.primaryKeyTypePolicy ?? 'unrestricted'
  const settings: AppSettings = {
    ...defaultAppSettings,
    protoRoot,
    protocExecutable: 'D:\\Tools\\protoc.exe',
    codegenOutputs: outputs
  }
  const environment = options.environment ?? {
    protocExecutable: settings.protocExecutable,
    protocVersion: 'libprotoc 30.2',
    plugins: [
      {
        language: 'go',
        executable: 'protoc-gen-go',
        available: true,
        path: 'D:\\Tools\\protoc-gen-go.exe'
      }
    ]
  }
  const runProtocLanguage = vi.fn<NativePort['runProtocLanguage']>(
    options.runProtocLanguage ??
      (async (language): Promise<ProtocRunResult> => ({
        language,
        executable: settings.protocExecutable,
        args: [`--${language}_out=D:\\Generated\\${language}`, 'ItemTable.proto'],
        cwd: protoRoot,
        outputDirectory: `D:\\Generated\\${language}`,
        stdout: `${language} generated`,
        stderr: '',
        exitCode: 0
      }))
  )
  const writeUnrealFiles = vi.fn<NativePort['writeUnrealFiles']>(
    options.writeUnrealFiles ??
      (async (files) => files.map(({ fileName }) => `D:\\Generated\\Unreal\\${fileName}`))
  )
  const nativePort: NativePort = {
    loadSettings: async () => settings,
    saveSettings: async (value) => value,
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
    importLegacySettings: async () => settings,
    listProtoFiles: async () => [
      { path: `${protoRoot}\\ItemTable.proto`, fileName: 'ItemTable.proto' }
    ],
    listExcelFiles: async () => [],
    checkCodegenEnvironment: async () => environment,
    runProtocLanguage,
    writeUnrealFiles,
    readFile: async () => new TextEncoder().encode(options.protoSource ?? protoSource),
    writeFile: async (path) => path,
    backupFile: async (path) => `${path}.backup`,
    openPath: async () => undefined
  }
  return { nativePort, runProtocLanguage, writeUnrealFiles }
}

describe('CodegenScreen', () => {
  it('blocks protoc before native execution when the project key policy is violated', async () => {
    const fixture = codegenFixture([{ language: 'cpp', directory: 'D:\\Generated\\cpp' }], {
      primaryKeyTypePolicy: 'string',
      protoSource: `syntax = "proto3";
message Item {
  // @PK
  int32 id = 1;
}
`
    })
    render(<CodegenScreen nativePort={fixture.nativePort} />)

    expect(await screen.findByText(/Item\.id\(int32\)/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'C++ 생성' }) as HTMLButtonElement).disabled).toBe(
      true
    )
    expect(fixture.runProtocLanguage).not.toHaveBeenCalled()
  })

  it('runs an individual configured language and shows the structured process result', async () => {
    const fixture = codegenFixture([{ language: 'cpp', directory: 'D:\\Generated\\cpp' }])
    const user = userEvent.setup()
    render(<CodegenScreen nativePort={fixture.nativePort} />)

    await user.click(await screen.findByRole('button', { name: 'C++ 생성' }))

    await waitFor(() => expect(fixture.runProtocLanguage).toHaveBeenCalledWith('cpp'))
    expect(await screen.findByText('cpp generated')).toBeTruthy()
    expect(screen.getByText('exit 0')).toBeTruthy()
    expect(screen.getByText(/--cpp_out=D:\\Generated\\cpp/)).toBeTruthy()
  })

  it('runs all configured protoc and Unreal outputs in order', async () => {
    const order: string[] = []
    const fixture = codegenFixture(
      [
        { language: 'cpp', directory: 'D:\\Generated\\cpp' },
        { language: 'csharp', directory: 'D:\\Generated\\csharp' },
        { language: 'unreal', directory: 'D:\\Generated\\Unreal' }
      ],
      {
        runProtocLanguage: async (language) => {
          order.push(language)
          return {
            language,
            executable: 'protoc.exe',
            args: [],
            cwd: protoRoot,
            outputDirectory: `D:\\Generated\\${language}`,
            stdout: '',
            stderr: '',
            exitCode: 0
          }
        },
        writeUnrealFiles: async (files) => {
          order.push('unreal')
          return files.map(({ fileName }) => `D:\\Generated\\Unreal\\${fileName}`)
        }
      }
    )
    const user = userEvent.setup()
    render(<CodegenScreen nativePort={fixture.nativePort} />)

    await user.click(await screen.findByRole('button', { name: '전체 생성' }))

    expect(await screen.findByText('3개 성공')).toBeTruthy()
    expect(order).toEqual(['cpp', 'csharp', 'unreal'])
    expect(fixture.writeUnrealFiles).toHaveBeenCalledTimes(1)
    expect(fixture.writeUnrealFiles.mock.calls[0]![0].map(({ fileName }) => fileName)).toEqual([
      'DataTables.h',
      'DataTableLoader.h',
      'DataTableLoader.cpp'
    ])
  })

  it('cancels an all-language run after the active process finishes', async () => {
    let finishCpp: ((result: ProtocRunResult) => void) | undefined
    const fixture = codegenFixture(
      [
        { language: 'cpp', directory: 'D:\\Generated\\cpp' },
        { language: 'csharp', directory: 'D:\\Generated\\csharp' }
      ],
      {
        runProtocLanguage: async (language) =>
          new Promise<ProtocRunResult>((resolve) => {
            if (language === 'cpp') finishCpp = resolve
          })
      }
    )
    const user = userEvent.setup()
    render(<CodegenScreen nativePort={fixture.nativePort} />)

    await user.click(await screen.findByRole('button', { name: '전체 생성' }))
    await waitFor(() => expect(fixture.runProtocLanguage).toHaveBeenCalledWith('cpp'))
    await user.click(screen.getByRole('button', { name: '현재 작업 후 중단' }))
    finishCpp?.({
      language: 'cpp',
      executable: 'protoc.exe',
      args: [],
      cwd: protoRoot,
      outputDirectory: 'D:\\Generated\\cpp',
      stdout: '',
      stderr: '',
      exitCode: 0
    })

    expect(await screen.findByText('1개 성공, 0개 실패, 1개 중단')).toBeTruthy()
    expect(fixture.runProtocLanguage).toHaveBeenCalledTimes(1)
  })

  it('shows plugin and structured process failures without hiding stderr', async () => {
    const environment: CodegenEnvironment = {
      protocExecutable: 'D:\\Tools\\protoc.exe',
      protocVersion: 'libprotoc 30.2',
      plugins: [
        {
          language: 'go',
          executable: 'protoc-gen-go',
          available: false,
          path: null
        }
      ]
    }
    const fixture = codegenFixture(
      [
        { language: 'cpp', directory: 'D:\\Generated\\cpp' },
        { language: 'go', directory: 'D:\\Generated\\go' },
        { language: 'rust', directory: 'D:\\Generated\\rust' }
      ],
      {
        environment,
        runProtocLanguage: async () => {
          throw {
            code: 'PROTOC_EXECUTION_FAILED',
            message: 'protoc generation failed for cpp.',
            context: {
              exitCode: 7,
              stderr: 'compiler failure',
              stdout: 'partial output',
              args: ['--cpp_out=staging', 'ItemTable.proto']
            }
          }
        }
      }
    )
    const user = userEvent.setup()
    render(<CodegenScreen nativePort={fixture.nativePort} />)

    const goButton = await screen.findByRole('button', { name: 'Go 생성' })
    expect((goButton as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByText('protoc-gen-go 없음').length).toBeGreaterThan(0)
    expect((screen.getByRole('button', { name: 'Rust 생성' }) as HTMLButtonElement).disabled).toBe(
      false
    )
    await user.click(screen.getByRole('button', { name: 'C++ 생성' }))

    expect(await screen.findByText(/protoc 실행을 완료할 수 없습니다/)).toBeTruthy()
    expect(screen.queryByText(/protoc generation failed for cpp/)).toBeNull()
    expect(screen.getByText('code=PROTOC_EXECUTION_FAILED')).toBeTruthy()
    expect(screen.getByText('compiler failure')).toBeTruthy()
    expect(screen.getByText('partial output')).toBeTruthy()
    expect(screen.getByText('exit 7')).toBeTruthy()
  })
})
