import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import { App } from './app/App'
import './styles.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Application root is unavailable.')

async function startApplication(container: HTMLElement): Promise<void> {
  if (import.meta.env.VITE_WDIO === '1') await import('@wdio/tauri-plugin')
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void startApplication(rootElement)
