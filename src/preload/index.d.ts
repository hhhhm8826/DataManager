import { ElectronAPI } from '@electron-toolkit/preload'
import type { IPC } from '../shared/ipc-channels'

type IpcChannel = (typeof IPC)[keyof typeof IPC]

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      invoke: (channel: IpcChannel, ...args: unknown[]) => Promise<unknown>
    }
  }
}
