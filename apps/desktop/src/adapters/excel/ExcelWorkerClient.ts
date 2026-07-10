import type { ExcelSpikeResult } from './excelWorkbookSpike'

interface WorkerSuccess {
  ok: true
  result: ExcelSpikeResult
}

interface WorkerFailure {
  ok: false
  message: string
}

type WorkerResponse = WorkerSuccess | WorkerFailure

export function runExcelSpikeInWorker(): Promise<ExcelSpikeResult> {
  const worker = new Worker(new URL('../../workers/excelWorkbook.worker.ts', import.meta.url), {
    type: 'module'
  })

  return new Promise((resolve, reject) => {
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      worker.terminate()
      if (event.data.ok) {
        resolve(event.data.result)
      } else {
        reject(new Error(event.data.message))
      }
    })
    worker.addEventListener('error', (event) => {
      worker.terminate()
      reject(event.error ?? new Error(event.message))
    })
    worker.postMessage(null)
  })
}
