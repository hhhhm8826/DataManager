import { create } from 'zustand'
import type { ParsedProto, AppSettings } from '../../../shared/types'
import { IPC } from '../../../shared/ipc-channels'
import { ipcInvoke } from '../hooks/useIpc'

interface AppState {
  // Proto 파싱 결과
  parsed: ParsedProto | null
  parseErrors: string[]
  isLoadingProto: boolean

  // 설정
  settings: AppSettings | null

  // 액션
  loadProto: () => Promise<void>
  loadSettings: () => Promise<void>
  saveSettings: (partial: Partial<AppSettings>) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  parsed: null,
  parseErrors: [],
  isLoadingProto: false,
  settings: null,

  loadProto: async () => {
    set({ isLoadingProto: true })
    const result = await ipcInvoke<ParsedProto>(IPC.PROTO_LOAD)
    if (result.success && result.data) {
      set({ parsed: result.data, parseErrors: result.data.errors, isLoadingProto: false })
    } else {
      set({ parseErrors: [result.error ?? '알 수 없는 오류'], isLoadingProto: false })
    }
  },

  loadSettings: async () => {
    const result = await ipcInvoke<AppSettings>(IPC.SETTINGS_GET)
    if (result.success && result.data) {
      set({ settings: result.data })
    }
  },

  saveSettings: async (partial) => {
    await ipcInvoke(IPC.SETTINGS_SET, partial)
    // 저장 후 다시 로드
    await get().loadSettings()
  }
}))
