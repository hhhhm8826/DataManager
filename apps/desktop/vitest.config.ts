import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@datamanager/core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url)
      ),
      '@tauri-apps/api/core': fileURLToPath(
        new URL('./src/adapters/native/TauriCoreStub.ts', import.meta.url)
      ),
      '@tauri-apps/plugin-dialog': fileURLToPath(
        new URL('./src/adapters/native/TauriDialogStub.ts', import.meta.url)
      )
    }
  }
})
