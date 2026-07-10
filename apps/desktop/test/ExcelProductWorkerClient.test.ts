import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateExcelWorkbooksInWorker } from '../src/adapters/excel/ExcelProductWorkerClient'

class WorkerStub {
  static instances: WorkerStub[] = []
  terminated = false
  private listeners = new Map<string, Set<(event: Event) => void>>()

  constructor() {
    WorkerStub.instances.push(this)
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  postMessage(): void {}

  terminate(): void {
    this.terminated = true
  }
}

afterEach(() => {
  WorkerStub.instances = []
  vi.unstubAllGlobals()
})

describe('ExcelProductWorkerClient', () => {
  it('terminates the worker immediately when an operation is cancelled', async () => {
    vi.stubGlobal('Worker', WorkerStub)
    const controller = new AbortController()
    const operation = generateExcelWorkbooksInWorker([], { signal: controller.signal })
    controller.abort()

    await expect(operation).rejects.toMatchObject({ name: 'AbortError' })
    expect(WorkerStub.instances).toHaveLength(1)
    expect(WorkerStub.instances[0]?.terminated).toBe(true)
  })
})
