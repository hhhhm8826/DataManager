import type { ExcelWorkbookPlan, RawExcelSheet } from '@datamanager/core'
import type { ExcelProgress } from './excelWorkbook'

export interface GeneratedExcelFile {
  sourceFile: string
  fileName: string
  binary: Uint8Array
}

export interface ExcelWorkerOptions {
  signal?: AbortSignal
  onProgress?: (progress: ExcelProgress & { itemIndex: number; itemCount: number }) => void
}

type WorkerResponse =
  | { id: string; type: 'progress'; itemIndex: number; itemCount: number; progress: ExcelProgress }
  | { id: string; type: 'generated'; files: GeneratedExcelFile[] }
  | { id: string; type: 'read'; sourceFile: string; sheets: RawExcelSheet[] }
  | { id: string; type: 'error'; message: string }

export function generateExcelWorkbooksInWorker(
  plans: ExcelWorkbookPlan[],
  options: ExcelWorkerOptions = {}
): Promise<GeneratedExcelFile[]> {
  return runWorker<GeneratedExcelFile[]>(
    { type: 'generate', plans },
    (response) => (response.type === 'generated' ? response.files : undefined),
    options
  )
}

export function readExcelWorkbookInWorker(
  sourceFile: string,
  binary: Uint8Array,
  options: ExcelWorkerOptions = {}
): Promise<RawExcelSheet[]> {
  return runWorker<RawExcelSheet[]>(
    { type: 'read', sourceFile, binary },
    (response) => (response.type === 'read' ? response.sheets : undefined),
    options
  )
}

function runWorker<T>(
  request: Record<string, unknown>,
  resultFrom: (response: WorkerResponse) => T | undefined,
  options: ExcelWorkerOptions
): Promise<T> {
  const worker = new Worker(new URL('../../workers/excelProduct.worker.ts', import.meta.url), {
    type: 'module'
  })
  const id = crypto.randomUUID()
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => {
      worker.terminate()
      reject(new DOMException('Excel operation was cancelled.', 'AbortError'))
    }
    if (options.signal?.aborted) {
      abort()
      return
    }
    options.signal?.addEventListener('abort', abort, { once: true })
    const finish = (): void => {
      options.signal?.removeEventListener('abort', abort)
      worker.terminate()
    }
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const response = event.data
      if (response.id !== id) return
      if (response.type === 'progress') {
        options.onProgress?.({
          ...response.progress,
          itemIndex: response.itemIndex,
          itemCount: response.itemCount
        })
        return
      }
      if (response.type === 'error') {
        finish()
        reject(new Error(response.message))
        return
      }
      const result = resultFrom(response)
      if (result !== undefined) {
        finish()
        resolve(result)
      }
    })
    worker.addEventListener('error', (event) => {
      finish()
      reject(event.error ?? new Error(event.message))
    })
    worker.postMessage({ id, ...request })
  })
}
