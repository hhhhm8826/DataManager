import type { ExcelWorkbookPlan } from '@datamanager/core'
import {
  extractRawExcelSheets,
  generateExcelWorkbook,
  type ExcelProgress
} from '../adapters/excel/excelWorkbook'

interface GenerateRequest {
  id: string
  type: 'generate'
  plans: ExcelWorkbookPlan[]
}

interface ReadRequest {
  id: string
  type: 'read'
  sourceFile: string
  binary: Uint8Array
}

type WorkerRequest = GenerateRequest | ReadRequest

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (request.type === 'generate') void generate(request)
  else void read(request)
})

async function generate(request: GenerateRequest): Promise<void> {
  try {
    const files: Array<{ sourceFile: string; fileName: string; binary: Uint8Array }> = []
    for (const [index, plan] of request.plans.entries()) {
      const binary = await generateExcelWorkbook(plan, (progress) =>
        postProgress(request.id, index, request.plans.length, progress)
      )
      files.push({ sourceFile: plan.sourceFile, fileName: plan.fileName, binary })
    }
    const transfer = files.map(({ binary }) => binary.buffer as ArrayBuffer)
    self.postMessage({ id: request.id, type: 'generated', files }, { transfer })
  } catch (error) {
    postFailure(request.id, error)
  }
}

async function read(request: ReadRequest): Promise<void> {
  try {
    const sheets = await extractRawExcelSheets(request.binary, {
      onProgress: (progress) => postProgress(request.id, 0, 1, progress)
    })
    self.postMessage({ id: request.id, type: 'read', sourceFile: request.sourceFile, sheets })
  } catch (error) {
    postFailure(request.id, error)
  }
}

function postProgress(
  id: string,
  itemIndex: number,
  itemCount: number,
  progress: ExcelProgress
): void {
  self.postMessage({ id, type: 'progress', itemIndex, itemCount, progress })
}

function postFailure(id: string, error: unknown): void {
  self.postMessage({
    id,
    type: 'error',
    message: error instanceof Error ? error.message : String(error)
  })
}
