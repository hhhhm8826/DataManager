import {
  defaultWorkspaceMetadata,
  type WorkspaceMetadata,
  type WorkspaceMetadataSection,
  type WorkspaceMetadataSectionValue
} from '@datamanager/core'
import { create } from 'zustand'
import type { NativePort } from '../../adapters/native/NativePort'

type WorkspaceMetadataPort = Pick<NativePort, 'loadWorkspaceMetadata' | 'updateWorkspaceMetadata'>

interface WorkspaceMetadataStoreState {
  protoRoot: string | null
  metadata: WorkspaceMetadata
  loading: boolean
  error: unknown | null
  load(port: WorkspaceMetadataPort, protoRoot: string): Promise<WorkspaceMetadata>
  updateSection<S extends WorkspaceMetadataSection>(
    port: WorkspaceMetadataPort,
    protoRoot: string,
    section: S,
    value: WorkspaceMetadataSectionValue<S>
  ): Promise<WorkspaceMetadata>
  reset(): void
}

const initialState = {
  protoRoot: null,
  metadata: defaultWorkspaceMetadata(),
  loading: false,
  error: null
} as const

export const useWorkspaceMetadataStore = create<WorkspaceMetadataStoreState>((set, get) => ({
  ...initialState,

  async load(port, protoRoot) {
    set({ loading: true, error: null })
    try {
      const metadata = await port.loadWorkspaceMetadata()
      set({ protoRoot, metadata, loading: false })
      return metadata
    } catch (error) {
      set({ error, loading: false })
      throw error
    }
  },

  async updateSection(port, protoRoot, section, value) {
    set({ loading: true, error: null })
    try {
      const snapshot =
        get().protoRoot === protoRoot ? get().metadata : await get().load(port, protoRoot)
      let metadata: WorkspaceMetadata
      try {
        metadata = await port.updateWorkspaceMetadata({
          expectedRevision: snapshot.revision,
          section,
          value
        })
      } catch (error) {
        if (!isRevisionConflict(error)) throw error
        const latest = await port.loadWorkspaceMetadata()
        metadata = await port.updateWorkspaceMetadata({
          expectedRevision: latest.revision,
          section,
          value
        })
      }
      set({ protoRoot, metadata, loading: false })
      return metadata
    } catch (error) {
      set({ error, loading: false })
      throw error
    }
  },

  reset() {
    set({
      protoRoot: initialState.protoRoot,
      metadata: defaultWorkspaceMetadata(),
      loading: initialState.loading,
      error: initialState.error
    })
  }
}))

function isRevisionConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'WORKSPACE_METADATA_REVISION_CONFLICT'
  )
}
