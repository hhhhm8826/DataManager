import { executeExcelWorkbookSpike } from '../adapters/excel/excelWorkbookSpike'

self.addEventListener('message', () => {
  void executeExcelWorkbookSpike()
    .then((result) => self.postMessage({ ok: true, result }))
    .catch((error: unknown) =>
      self.postMessage({
        ok: false,
        message: error instanceof Error ? error.message : String(error)
      })
    )
})
