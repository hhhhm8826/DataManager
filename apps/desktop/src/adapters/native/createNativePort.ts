import { BrowserMockNativePort } from './BrowserMockNativePort'
import type { NativePort } from './NativePort'
import { TauriNativePort } from './TauriNativePort'

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window
}

export function createNativePort(): NativePort {
  return isTauriRuntime() ? new TauriNativePort() : new BrowserMockNativePort()
}
