import type { IpcChannel } from '../../../shared/ipc-channels'
import type { IpcResult } from '../../../shared/types'

/**
 * window.api.invoke 를 타입-세이프하게 감싸는 헬퍼입니다.
 */
export async function ipcInvoke<T = void>(
  channel: IpcChannel,
  ...args: unknown[]
): Promise<IpcResult<T>> {
  return window.api.invoke(channel, ...args) as Promise<IpcResult<T>>
}
