import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const useTauriStubs = process.env.DATAMANAGER_USE_TAURI_STUBS === '1'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: {
      '@datamanager/core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url)
      ),
      ...(useTauriStubs
        ? {
            '@tauri-apps/api/core': fileURLToPath(
              new URL('./src/adapters/native/TauriCoreStub.ts', import.meta.url)
            ),
            '@tauri-apps/plugin-dialog': fileURLToPath(
              new URL('./src/adapters/native/TauriDialogStub.ts', import.meta.url)
            )
          }
        : {})
    }
  },
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true
  }
})
