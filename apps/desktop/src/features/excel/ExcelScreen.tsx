import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildExcelWorkbookPlans,
  collectJsonExportDependencies,
  exportResolvedJson,
  hasExcelErrors,
  toNativeError,
  validateExcelSheets,
  type ExcelDiagnostic,
  type ExcelWorkbookPlan,
  type JsonExportDiagnostic,
  type RawExcelSheet
} from '@datamanager/core'
import {
  Ban,
  FileCheck2,
  FolderOpen,
  Play,
  RefreshCw,
  Settings,
  ShieldCheck,
  X
} from 'lucide-react'
import {
  generateExcelWorkbooksInWorker,
  readExcelWorkbookInWorker,
  type ExcelWorkerOptions,
  type GeneratedExcelFile
} from '../../adapters/excel/ExcelProductWorkerClient'
import { createNativePort } from '../../adapters/native/createNativePort'
import type { NativePort, ProtoFileEntry } from '../../adapters/native/NativePort'
import {
  loadProtoWorkspace,
  workspacePath,
  type LoadedProtoWorkspace
} from '../schema/protoWorkspaceService'

type GenerateWorkbooks = (
  plans: ExcelWorkbookPlan[],
  options?: ExcelWorkerOptions
) => Promise<GeneratedExcelFile[]>
type ReadWorkbook = (
  sourceFile: string,
  binary: Uint8Array,
  options?: ExcelWorkerOptions
) => Promise<RawExcelSheet[]>

interface ExcelScreenProps {
  nativePort?: NativePort
  generateWorkbooks?: GenerateWorkbooks
  readWorkbook?: ReadWorkbook
  onOpenSettings?: () => void
}

type CollisionMode = 'overwrite' | 'backup'

export function ExcelScreen({
  nativePort: providedNativePort,
  generateWorkbooks = generateExcelWorkbooksInWorker,
  readWorkbook: readWorkbookInWorker = readExcelWorkbookInWorker,
  onOpenSettings
}: ExcelScreenProps): React.JSX.Element {
  const nativePort = useMemo(() => providedNativePort ?? createNativePort(), [providedNativePort])
  const [loaded, setLoaded] = useState<LoadedProtoWorkspace | null>(null)
  const [plans, setPlans] = useState<ExcelWorkbookPlan[]>([])
  const [existingFiles, setExistingFiles] = useState<ProtoFileEntry[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [collisions, setCollisions] = useState<ProtoFileEntry[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 1, label: '' })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [readDiagnostics, setReadDiagnostics] = useState<ExcelDiagnostic[]>([])
  const [jsonDiagnostics, setJsonDiagnostics] = useState<JsonExportDiagnostic[]>([])
  const [readingFile, setReadingFile] = useState<string | null>(null)
  const abortController = useRef<AbortController | null>(null)

  const reload = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      const next = await loadProtoWorkspace(nativePort)
      const nextPlans = buildExcelWorkbookPlans(next.workspace)
      const nextExisting = next.settings.excelRoot ? await nativePort.listExcelFiles() : []
      setLoaded(next)
      setPlans(nextPlans)
      setExistingFiles(nextExisting)
      setSelected((current) =>
        current.size > 0
          ? new Set(
              [...current].filter((sourceFile) =>
                nextPlans.some((plan) => plan.sourceFile === sourceFile)
              )
            )
          : new Set(nextPlans.map((plan) => plan.sourceFile))
      )
      setSelectedMessages((current) =>
        current.size > 0
          ? new Set(
              [...current].filter((messageName) =>
                next.workspace.messages.some((message) => message.name === messageName)
              )
            )
          : new Set(next.workspace.messages.map((message) => message.name))
      )
    } catch (cause) {
      setError(toNativeError(cause).message)
    }
  }, [nativePort])

  useEffect(() => {
    void reload()
  }, [reload])

  const existingByName = new Map(
    existingFiles.map((entry) => [entry.fileName.toLocaleLowerCase(), entry])
  )
  const selectedPlans = plans.filter((plan) => selected.has(plan.sourceFile))

  const requestGenerate = (): void => {
    setError(null)
    setSuccess(null)
    setReadDiagnostics([])
    setJsonDiagnostics([])
    if (selectedPlans.length === 0) {
      setError('생성할 Proto 파일을 선택하세요.')
      return
    }
    const conflicts = selectedPlans
      .map((plan) => existingByName.get(plan.fileName.toLocaleLowerCase()))
      .filter((entry): entry is ProtoFileEntry => Boolean(entry))
    if (conflicts.length > 0) setCollisions(conflicts)
    else void generateAndWrite(selectedPlans, 'overwrite')
  }

  const generateAndWrite = async (
    requestedPlans: ExcelWorkbookPlan[],
    mode: CollisionMode
  ): Promise<void> => {
    if (!loaded) return
    const controller = new AbortController()
    abortController.current = controller
    setCollisions([])
    setRunning(true)
    setProgress({ completed: 0, total: Math.max(1, requestedPlans.length), label: '' })
    try {
      const files = await generateWorkbooks(requestedPlans, {
        signal: controller.signal,
        onProgress: ({ completed, total, label, itemIndex, itemCount }) =>
          setProgress({
            completed: itemIndex + completed / Math.max(1, total),
            total: Math.max(1, itemCount),
            label
          })
      })
      let backups = 0
      for (const file of files) {
        const existing = existingByName.get(file.fileName.toLocaleLowerCase())
        if (mode === 'backup' && existing) {
          await nativePort.backupFile(existing.path)
          backups += 1
        }
        const path = existing?.path ?? workspacePath(loaded.settings.excelRoot, file.fileName)
        await nativePort.writeFile(path, file.binary)
      }
      setSuccess(`${files.length}개 workbook 생성 완료${backups > 0 ? `, ${backups}개 백업` : ''}`)
      await reload()
    } catch (cause) {
      const nativeError = toNativeError(cause)
      setError(nativeError.message)
    } finally {
      abortController.current = null
      setRunning(false)
    }
  }

  const readWorkbook = async (entry: ProtoFileEntry, sourceFile: string): Promise<void> => {
    if (!loaded) return
    const controller = new AbortController()
    abortController.current = controller
    setReadingFile(entry.fileName)
    setError(null)
    setSuccess(null)
    setReadDiagnostics([])
    try {
      const binary = await nativePort.readFile(entry.path)
      const sheets = await readWorkbookInWorker(sourceFile, binary, {
        signal: controller.signal,
        onProgress: ({ completed, total, label }) => setProgress({ completed, total, label })
      })
      const validation = validateExcelSheets(loaded.workspace, sourceFile, sheets)
      setReadDiagnostics(validation.diagnostics)
      if (hasExcelErrors(validation)) {
        setError(
          `${entry.fileName} 입력 오류 ${validation.diagnostics.filter(({ severity }) => severity === 'error').length}개`
        )
      } else {
        const rows = validation.results.reduce((sum, result) => sum + result.rows.length, 0)
        setSuccess(`${entry.fileName}: ${validation.results.length}개 sheet, ${rows}개 행 확인`)
      }
    } catch (cause) {
      setError(toNativeError(cause).message)
    } finally {
      abortController.current = null
      setReadingFile(null)
    }
  }

  const exportJson = async (): Promise<void> => {
    if (!loaded) return
    setError(null)
    setSuccess(null)
    setReadDiagnostics([])
    setJsonDiagnostics([])
    if (!loaded.settings.jsonRoot) {
      setError('JSON 루트를 설정하세요.')
      return
    }
    if (selectedMessages.size === 0) {
      setError('내보낼 Message를 선택하세요.')
      return
    }
    const dependency = collectJsonExportDependencies(loaded.workspace, [...selectedMessages])
    if (dependency.diagnostics.length > 0) {
      setJsonDiagnostics(dependency.diagnostics)
      setError(`JSON 의존성 오류 ${dependency.diagnostics.length}개`)
      return
    }
    const controller = new AbortController()
    abortController.current = controller
    setRunning(true)
    try {
      const requiredSources = [
        ...new Set(
          dependency.order.map(
            (messageName) =>
              loaded.workspace.messages.find((message) => message.name === messageName)!.sourceFile
          )
        )
      ].sort((left, right) => left.localeCompare(right, 'en'))
      const allResults = []
      for (const [sourceIndex, sourceFile] of requiredSources.entries()) {
        const workbookName = sourceFile.replace(/\.proto$/, '.xlsx')
        const entry = existingByName.get(workbookName.toLocaleLowerCase())
        if (!entry) {
          setError(`${workbookName} 파일이 없습니다.`)
          return
        }
        const binary = await nativePort.readFile(entry.path)
        const sheets = await readWorkbookInWorker(sourceFile, binary, {
          signal: controller.signal,
          onProgress: ({ completed, total, label }) =>
            setProgress({
              completed: sourceIndex + completed / Math.max(1, total),
              total: requiredSources.length,
              label
            })
        })
        const validation = validateExcelSheets(loaded.workspace, sourceFile, sheets)
        if (hasExcelErrors(validation)) {
          setReadDiagnostics(validation.diagnostics)
          setError(
            `${workbookName} 입력 오류 ${validation.diagnostics.filter(({ severity }) => severity === 'error').length}개`
          )
          return
        }
        allResults.push(...validation.results)
      }
      const exported = exportResolvedJson(loaded.workspace, allResults, [...selectedMessages])
      if (exported.diagnostics.length > 0) {
        setJsonDiagnostics(exported.diagnostics)
        setError(`JSON 참조 오류 ${exported.diagnostics.length}개`)
        return
      }
      for (const file of exported.files) {
        await nativePort.writeFile(
          workspacePath(loaded.settings.jsonRoot, file.fileName),
          new TextEncoder().encode(file.contents)
        )
      }
      setSuccess(`${exported.files.length}개 JSON 파일 내보내기 완료`)
    } catch (cause) {
      setError(toNativeError(cause).message)
    } finally {
      abortController.current = null
      setRunning(false)
    }
  }

  const rootsReady = Boolean(loaded?.settings.protoRoot && loaded.settings.excelRoot)
  return (
    <main className="excel-page">
      <div className="excel-toolbar">
        <div>
          <p className="section-eyebrow">Workbook</p>
          <h2>Excel</h2>
        </div>
        <div className="excel-toolbar-actions">
          <button
            aria-label="Excel 목록 새로고침"
            className="icon-button"
            disabled={running}
            onClick={() => void reload()}
            title="Excel 목록 새로고침"
          >
            <RefreshCw aria-hidden="true" size={17} />
          </button>
          <button
            className="button button-secondary icon-text-button"
            disabled={running || !loaded?.settings.jsonRoot}
            onClick={() => void exportJson()}
          >
            <FileCheck2 aria-hidden="true" size={16} /> 선택 JSON
          </button>
          <button
            className="button button-primary icon-text-button"
            disabled={running || !rootsReady}
            onClick={requestGenerate}
          >
            <Play aria-hidden="true" size={16} /> 선택 생성
          </button>
        </div>
      </div>

      {error ? <div className="notice notice-error">{error}</div> : null}
      {success ? <div className="notice notice-success">{success}</div> : null}
      {!rootsReady && loaded ? (
        <div className="empty-workspace">
          <p>Proto 루트와 Excel 루트를 설정하세요.</p>
          <button className="button button-primary icon-text-button" onClick={onOpenSettings}>
            <Settings aria-hidden="true" size={16} /> 설정 열기
          </button>
        </div>
      ) : (
        <section className="excel-surface" aria-busy={running || Boolean(readingFile)}>
          <div className="excel-list-heading">
            <label>
              <input
                checked={plans.length > 0 && selected.size === plans.length}
                onChange={(event) =>
                  setSelected(
                    event.target.checked ? new Set(plans.map((plan) => plan.sourceFile)) : new Set()
                  )
                }
                type="checkbox"
              />
              전체 선택
            </label>
            <span>{selected.size}개 선택</span>
          </div>
          <div className="excel-file-list">
            {plans.map((plan) => {
              const existing = existingByName.get(plan.fileName.toLocaleLowerCase())
              return (
                <div className="excel-file-row" key={plan.sourceFile}>
                  <input
                    aria-label={`${plan.sourceFile} 선택`}
                    checked={selected.has(plan.sourceFile)}
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = new Set(current)
                        if (event.target.checked) next.add(plan.sourceFile)
                        else next.delete(plan.sourceFile)
                        return next
                      })
                    }
                    type="checkbox"
                  />
                  <div>
                    <strong>{plan.fileName}</strong>
                    <span>{plan.sheets.map(({ name }) => name).join(', ')}</span>
                    <div className="excel-sheet-toggles">
                      {plan.sheets.map((sheet) => (
                        <label key={sheet.name}>
                          <input
                            aria-label={`${sheet.name} JSON 선택`}
                            checked={selectedMessages.has(sheet.name)}
                            onChange={(event) =>
                              setSelectedMessages((current) => {
                                const next = new Set(current)
                                if (event.target.checked) next.add(sheet.name)
                                else next.delete(sheet.name)
                                return next
                              })
                            }
                            type="checkbox"
                          />
                          {sheet.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <span className={existing ? 'excel-status-existing' : 'excel-status-new'}>
                    {existing ? '기존 파일' : '신규'}
                  </span>
                  <div className="excel-row-actions">
                    {existing ? (
                      <>
                        <button
                          aria-label={`${plan.fileName} 읽기 검사`}
                          className="icon-button icon-button-compact"
                          disabled={Boolean(readingFile)}
                          onClick={() => void readWorkbook(existing, plan.sourceFile)}
                          title="읽기 검사"
                        >
                          <FileCheck2 aria-hidden="true" size={15} />
                        </button>
                        <button
                          aria-label={`${plan.fileName} 열기`}
                          className="icon-button icon-button-compact"
                          onClick={() => void nativePort.openPath(existing.path)}
                          title="파일 열기"
                        >
                          <FolderOpen aria-hidden="true" size={15} />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
            {plans.length === 0 ? (
              <p className="excel-empty">생성할 테이블 Proto가 없습니다.</p>
            ) : null}
          </div>

          {running || readingFile ? (
            <div className="excel-progress">
              <div>
                <span>{readingFile ? `${readingFile} 읽는 중` : '데이터 처리 중'}</span>
                <strong>{progress.label}</strong>
              </div>
              <progress max={progress.total} value={progress.completed} />
              <button
                className="button button-secondary icon-text-button"
                onClick={() => abortController.current?.abort()}
              >
                <Ban aria-hidden="true" size={16} /> 취소
              </button>
            </div>
          ) : null}

          {readDiagnostics.length > 0 ? (
            <div className="excel-diagnostics" role="alert">
              {readDiagnostics.map((diagnostic, index) => (
                <div key={`${diagnostic.code}-${diagnostic.sheetName}-${diagnostic.row}-${index}`}>
                  <strong>{diagnostic.code}</strong>
                  <span>
                    {diagnostic.sheetName}
                    {diagnostic.row > 0 ? ` R${diagnostic.row}C${diagnostic.column}` : ''}
                  </span>
                  <p>{diagnostic.message}</p>
                </div>
              ))}
            </div>
          ) : null}
          {jsonDiagnostics.length > 0 ? (
            <div className="excel-diagnostics" role="alert">
              {jsonDiagnostics.map((diagnostic, index) => (
                <div
                  key={`${diagnostic.code}-${diagnostic.messageName}-${diagnostic.row}-${index}`}
                >
                  <strong>{diagnostic.code}</strong>
                  <span>
                    {diagnostic.messageName}
                    {diagnostic.row > 0 ? ` R${diagnostic.row}` : ''}
                    {diagnostic.fieldName ? ` ${diagnostic.fieldName}` : ''}
                  </span>
                  <p>{diagnostic.message}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {collisions.length > 0 ? (
        <div className="modal-backdrop" role="presentation">
          <div
            aria-labelledby="collision-title"
            aria-modal="true"
            className="impact-dialog"
            role="dialog"
          >
            <div className="dialog-heading">
              <h3 id="collision-title">기존 Excel 파일</h3>
              <button
                aria-label="충돌 확인 창 닫기"
                className="icon-button"
                onClick={() => setCollisions([])}
                title="닫기"
              >
                <X aria-hidden="true" size={17} />
              </button>
            </div>
            <div className="collision-list">
              {collisions.map((entry) => (
                <p key={entry.path}>{entry.fileName}</p>
              ))}
            </div>
            <div className="collision-actions">
              <button className="button button-secondary" onClick={() => setCollisions([])}>
                생성 취소
              </button>
              <button
                className="button button-secondary"
                onClick={() => void generateAndWrite(selectedPlans, 'overwrite')}
              >
                백업 없이 덮어쓰기
              </button>
              <button
                className="button button-primary icon-text-button"
                onClick={() => void generateAndWrite(selectedPlans, 'backup')}
              >
                <ShieldCheck aria-hidden="true" size={16} /> 백업 후 생성
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
