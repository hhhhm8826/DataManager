// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { defaultAppSettings, type LegacyImportPreview } from '@datamanager/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativePort } from '../src/adapters/native/NativePort'
import { DiagramScreen } from '../src/features/diagram/DiagramScreen'

const files = {
  'TargetTable.proto': `syntax = "proto3";\nmessage Target { int32 id = 1; }\n`,
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

function diagramPort(): NativePort {
  const root = 'D:\\PROTO'
  return {
    loadSettings: async () => ({
      ...defaultAppSettings,
      protoRoot: root,
      diagram: {
        fileColors: { 'TargetTable.proto': '#2457a6' },
        maxNodesPerColumn: 2
      }
    }),
    saveSettings: async (settings) => settings,
    selectDirectory: async () => null,
    selectFile: async () => null,
    findLegacyConfig: async () => null,
    previewLegacyImport: async (): Promise<LegacyImportPreview> => {
      throw new Error('not available')
    },
    importLegacySettings: async () => defaultAppSettings,
    listProtoFiles: async () =>
      Object.keys(files).map((fileName) => ({ path: `${root}\\${fileName}`, fileName })),
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
      const fileName = path.split('\\').at(-1) as keyof typeof files
      return new TextEncoder().encode(files[fileName])
    },
    writeFile: async (path) => path,
    backupFile: async (path) => `${path}.backup`,
    openPath: async () => undefined
  }
}

describe('DiagramScreen', () => {
  it('renders message and Enum details and dims nonmatching search results', async () => {
    const user = userEvent.setup()
    render(<DiagramScreen nativePort={diagramPort()} />)

    const targetTitle = await screen.findByText('Target', { selector: 'strong' })
    const otherTitle = screen.getByText('Other', { selector: 'strong' })
    expect(targetTitle).toBeTruthy()
    expect(otherTitle).toBeTruthy()
    expect(screen.getByText('Status_ACTIVE')).toBeTruthy()
    expect(screen.getByRole('button', { name: '자동 배치' })).toBeTruthy()

    await user.type(screen.getByRole('textbox', { name: '관계도 검색' }), 'TargetTable.proto')
    await waitFor(() =>
      expect(otherTitle.closest('.diagram-node')?.className).toContain('diagram-node-dimmed')
    )
    expect(targetTitle.closest('.diagram-node')?.className).not.toContain('diagram-node-dimmed')
  })
})
