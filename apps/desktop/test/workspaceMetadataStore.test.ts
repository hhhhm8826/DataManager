import {
  applyWorkspaceMetadataSectionUpdate,
  defaultWorkspaceMetadata,
  type WorkspaceMetadata,
  type WorkspaceMetadataSection,
  type WorkspaceMetadataSectionUpdate
} from '@datamanager/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceMetadataStore } from '../src/features/projectMetadata/workspaceMetadataStore'

class MetadataPortStub {
  metadata: WorkspaceMetadata = defaultWorkspaceMetadata()
  conflictOnce = false
  readonly loadWorkspaceMetadata = vi.fn(async () => this.metadata)
  readonly updateWorkspaceMetadata = vi.fn(
    async <S extends WorkspaceMetadataSection>(update: WorkspaceMetadataSectionUpdate<S>) => {
      if (this.conflictOnce) {
        this.conflictOnce = false
        this.metadata = applyWorkspaceMetadataSectionUpdate(this.metadata, {
          expectedRevision: this.metadata.revision,
          section: 'tables',
          value: {
            'ItemTable.proto#Item': {
              memoColumns: [{ id: 'memo-plan', name: '기획 메모', order: 0 }]
            }
          }
        })
        throw {
          code: 'WORKSPACE_METADATA_REVISION_CONFLICT',
          message: 'stale',
          context: {}
        }
      }
      this.metadata = applyWorkspaceMetadataSectionUpdate(this.metadata, update)
      return this.metadata
    }
  )
}

beforeEach(() => {
  useWorkspaceMetadataStore.getState().reset()
})

describe('G0 workspace metadata store', () => {
  it('scopes metadata by Proto root instead of reusing another project snapshot', async () => {
    const first = new MetadataPortStub()
    const second = new MetadataPortStub()
    second.metadata = { ...defaultWorkspaceMetadata(), revision: 4 }

    await useWorkspaceMetadataStore.getState().load(first, 'D:\\ProjectA')
    await useWorkspaceMetadataStore.getState().updateSection(second, 'D:\\ProjectB', 'diagram', {
      hubThreshold: 9,
      savedLayout: null
    })

    expect(second.loadWorkspaceMetadata).toHaveBeenCalledTimes(1)
    expect(second.updateWorkspaceMetadata).toHaveBeenCalledWith({
      expectedRevision: 4,
      section: 'diagram',
      value: { hubThreshold: 9, savedLayout: null }
    })
    expect(useWorkspaceMetadataStore.getState()).toMatchObject({
      protoRoot: 'D:\\ProjectB',
      metadata: { revision: 5 }
    })
  })

  it('reloads one stale snapshot and reapplies only its section without losing another update', async () => {
    const port = new MetadataPortStub()
    await useWorkspaceMetadataStore.getState().load(port, 'D:\\Project')
    port.conflictOnce = true

    const result = await useWorkspaceMetadataStore
      .getState()
      .updateSection(port, 'D:\\Project', 'diagram', {
        hubThreshold: 7,
        savedLayout: null
      })

    expect(port.loadWorkspaceMetadata).toHaveBeenCalledTimes(2)
    expect(port.updateWorkspaceMetadata).toHaveBeenCalledTimes(2)
    expect(result.revision).toBe(2)
    expect(result.diagram.hubThreshold).toBe(7)
    expect(result.tables).toHaveProperty('ItemTable.proto#Item')
  })
})
