import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAppSettings, defaultWorkspaceMetadata } from '@datamanager/core'
import { BrowserMockNativePort } from '../src/adapters/native/BrowserMockNativePort'

let storage: Map<string, string>
let promptResult: string | null

beforeEach(() => {
  storage = new Map<string, string>()
  promptResult = null
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value)
    },
    prompt: () => promptResult
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BrowserMockNativePort', () => {
  it('persists validated versioned settings and trims a selected directory', async () => {
    const port = new BrowserMockNativePort()
    const saved = await port.saveSettings({
      ...defaultAppSettings,
      protoRoot: 'D:\\Workspace\\PROTO',
      diagram: {
        fileColors: { 'ItemTable.proto': '#2457a6' },
        maxNodesPerColumn: 12
      }
    })

    expect(await new BrowserMockNativePort().loadSettings()).toEqual(saved)

    promptResult = '  D:\\Workspace\\EXCEL  '
    await expect(port.selectDirectory()).resolves.toBe('D:\\Workspace\\EXCEL')
  })

  it('normalizes malformed persisted settings into a structured error', async () => {
    storage.set('datamanager.settings.v2', '{"version":99}')
    const port = new BrowserMockNativePort()

    await expect(port.loadSettings()).rejects.toMatchObject({
      code: 'NATIVE_VALIDATION_FAILED',
      context: {}
    })
  })

  it('keeps project metadata separate per Proto root and defaults missing projects', async () => {
    const port = new BrowserMockNativePort()
    await port.saveSettings({ ...defaultAppSettings, protoRoot: 'D:\\Workspace\\A' })

    expect(await port.loadWorkspaceMetadata()).toEqual(defaultWorkspaceMetadata())
    await port.updateWorkspaceMetadata({
      expectedRevision: 0,
      section: 'primaryKeyTypePolicy',
      value: 'string'
    })

    await port.saveSettings({ ...defaultAppSettings, protoRoot: 'D:\\Workspace\\B' })
    expect(await port.loadWorkspaceMetadata()).toEqual(defaultWorkspaceMetadata())

    await port.saveSettings({ ...defaultAppSettings, protoRoot: 'D:\\Workspace\\A' })
    await expect(port.loadWorkspaceMetadata()).resolves.toMatchObject({
      revision: 1,
      primaryKeyTypePolicy: 'string'
    })
  })

  it('rejects stale metadata and preserves another section after reload', async () => {
    const firstScreen = new BrowserMockNativePort()
    const secondScreen = new BrowserMockNativePort()
    const firstSnapshot = await firstScreen.loadWorkspaceMetadata()
    const secondSnapshot = await secondScreen.loadWorkspaceMetadata()

    await firstScreen.updateWorkspaceMetadata({
      expectedRevision: firstSnapshot.revision,
      section: 'tables',
      value: {
        'ItemTable.proto#Item': {
          memoColumns: [{ id: 'memo-plan', name: '기획 메모', order: 0 }]
        }
      }
    })

    await expect(
      secondScreen.updateWorkspaceMetadata({
        expectedRevision: secondSnapshot.revision,
        section: 'diagram',
        value: { hubThreshold: 7, savedLayout: null }
      })
    ).rejects.toMatchObject({
      code: 'WORKSPACE_METADATA_REVISION_CONFLICT',
      context: { expectedRevision: 0, actualRevision: 1 }
    })

    const reloaded = await secondScreen.loadWorkspaceMetadata()
    const merged = await secondScreen.updateWorkspaceMetadata({
      expectedRevision: reloaded.revision,
      section: 'diagram',
      value: { hubThreshold: 7, savedLayout: null }
    })

    expect(merged.tables).toEqual({
      'ItemTable.proto#Item': {
        memoColumns: [{ id: 'memo-plan', name: '기획 메모', order: 0 }]
      }
    })
    expect(merged.diagram.hubThreshold).toBe(7)
    expect(merged.revision).toBe(2)
  })
})
