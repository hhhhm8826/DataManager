import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  formatDiagnosticMessage,
  buildExcelWorkbookPlans,
  collectJsonExportDependencies,
  exportResolvedJson,
  hasExcelErrors,
  toNativeError,
  validatePrimaryKeyTypePolicy,
  validateExcelSheets,
  type ExcelDiagnostic,
  type ExcelWorkbookPlan,
  type JsonExportDiagnostic,
  type PrimaryKeyPolicyViolation,
  type RawExcelSheet,
  type WorkspaceMetadata
} from '@datamanager/core'
import {
  Ban,
  FileCheck2,
  FolderOpen,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  X
} from 'lucide-react'
import {
  generateExcelWorkbooksInWorker,
  inspectExcelWorkbookInWorker,
  readExcelWorkbookInWorker,
  type ExcelWorkerOptions,
  type GeneratedExcelFile
} from '../../adapters/excel/ExcelProductWorkerClient'
import type { ExcelMetadataInspection } from '../../adapters/excel/excelWorkbook'
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
type InspectWorkbook = (binary: Uint8Array) => Promise<ExcelMetadataInspection>

interface ExcelScreenProps {
  nativePort?: NativePort
  generateWorkbooks?: GenerateWorkbooks
  readWorkbook?: ReadWorkbook
  inspectWorkbook?: InspectWorkbook
  onOpenSettings?: () => void
}

type CollisionMode = 'overwrite' | 'backup'
type ExcelView = 'excel' | 'json'

export function ExcelScreen({
  nativePort: providedNativePort,
  generateWorkbooks = generateExcelWorkbooksInWorker,
  readWorkbook: readWorkbookInWorker = readExcelWorkbookInWorker,
  inspectWorkbook = inspectExcelWorkbookInWorker,
  onOpenSettings
}: ExcelScreenProps): React.JSX.Element {
  const nativePort = useMemo(() => providedNativePort ?? createNativePort(), [providedNativePort])
  const [loaded, setLoaded] = useState<LoadedProtoWorkspace | null>(null)
  const [workspaceMetadata, setWorkspaceMetadata] = useState<WorkspaceMetadata | null>(null)
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
  const [policyViolations, setPolicyViolations] = useState<PrimaryKeyPolicyViolation[]>([])
  const [readingFile, setReadingFile] = useState<string | null>(null)
  const [workbookMemoStatus, setWorkbookMemoStatus] = useState<Record<string, string>>({})
  const [activeView, setActiveView] = useState<ExcelView>('excel')
  const [searchQuery, setSearchQuery] = useState('')
  const abortController = useRef<AbortController | null>(null)
  const selectionRoot = useRef<string | null>(null)
  const excelSelectionInitialized = useRef(false)
  const jsonSelectionInitialized = useRef(false)
  const memoInspectionRevision = useRef(0)

  const reload = useCallback(async (): Promise<void> => {
    const inspectionRevision = ++memoInspectionRevision.current
    setError(null)
    try {
      const next = await loadProtoWorkspace(nativePort)
      const metadata = await nativePort.loadWorkspaceMetadata()
      const nextPolicyViolations = validatePrimaryKeyTypePolicy(
        next.workspace,
        metadata.primaryKeyTypePolicy
      )
      const nextPlans = buildExcelWorkbookPlans(next.workspace, undefined, metadata.tables)
      const nextExisting = next.settings.excelRoot ? await nativePort.listExcelFiles() : []
      const nextRoot = next.settings.protoRoot
      const sameWorkspace = selectionRoot.current === nextRoot
      if (!sameWorkspace) {
        selectionRoot.current = nextRoot
        excelSelectionInitialized.current = false
        jsonSelectionInitialized.current = false
        setWorkbookMemoStatus({})
      }
      setLoaded(next)
      setWorkspaceMetadata(metadata)
      setPlans(nextPlans)
      setExistingFiles(nextExisting)
      setWorkbookMemoStatus({})
      setPolicyViolations(nextPolicyViolations)
      setSelected((current) => {
        if (!excelSelectionInitialized.current) {
          excelSelectionInitialized.current = true
          return new Set()
        }
        return new Set(
          [...current].filter((sourceFile) =>
            nextPlans.some((plan) => plan.sourceFile === sourceFile)
          )
        )
      })
      setSelectedMessages((current) => {
        if (!jsonSelectionInitialized.current) {
          jsonSelectionInitialized.current = true
          return new Set()
        }
        const existingNames = new Set(
          nextExisting.map(({ fileName }) => fileName.toLocaleLowerCase())
        )
        return new Set(
          [...current].filter((messageName) => {
            const message = next.workspace.messages.find((entry) => entry.name === messageName)
            return (
              message !== undefined &&
              existingNames.has(message.sourceFile.replace(/\.proto$/, '.xlsx').toLocaleLowerCase())
            )
          })
        )
      })
      if (typeof Worker !== 'undefined' || inspectWorkbook !== inspectExcelWorkbookInWorker) {
        void (async () => {
          const entries: Array<readonly [string, string]> = []
          for (const plan of nextPlans) {
            const entry = nextExisting.find(
              ({ fileName }) => fileName.toLocaleLowerCase() === plan.fileName.toLocaleLowerCase()
            )
            if (!entry) {
              entries.push([plan.fileName, 'Excel 생성 필요'])
              continue
            }
            try {
              const binary = await nativePort.readFile(entry.path)
              const inspection = await inspectWorkbook(binary)
              entries.push([plan.fileName, inspectionMemoStatus(plan, inspection)])
            } catch {
              entries.push([plan.fileName, '메모 정보 확인 실패'])
            }
          }
          if (memoInspectionRevision.current === inspectionRevision) {
            setWorkbookMemoStatus(Object.fromEntries(entries))
          }
        })()
      }
    } catch (cause) {
      setError(formatDiagnosticMessage(toNativeError(cause)))
    }
  }, [inspectWorkbook, nativePort])

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
    if (policyViolations.length > 0) {
      setError(primaryKeyPolicyError(policyViolations))
      return
    }
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
      setError(formatDiagnosticMessage(nativeError))
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
      const validation = validateExcelSheets(
        loaded.workspace,
        sourceFile,
        sheets,
        workspaceMetadata?.tables
      )
      setReadDiagnostics(validation.diagnostics)
      setWorkbookMemoStatus((current) => ({
        ...current,
        [entry.fileName]: memoStatus(validation.diagnostics)
      }))
      if (hasExcelErrors(validation)) {
        setError(
          `${entry.fileName} 입력 오류 ${validation.diagnostics.filter(({ severity }) => severity === 'error').length}개`
        )
      } else {
        const rows = validation.results.reduce((sum, result) => sum + result.rows.length, 0)
        setSuccess(`${entry.fileName}: ${validation.results.length}개 sheet, ${rows}개 행 확인`)
      }
    } catch (cause) {
      setError(formatDiagnosticMessage(toNativeError(cause)))
    } finally {
      abortController.current = null
      setReadingFile(null)
    }
  }

  const exportJson = async (): Promise<void> => {
    if (!loaded) return
    setError(null)
    setSuccess(null)
    if (policyViolations.length > 0) {
      setError(primaryKeyPolicyError(policyViolations))
      return
    }
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
        const validation = validateExcelSheets(
          loaded.workspace,
          sourceFile,
          sheets,
          workspaceMetadata?.tables
        )
        if (hasExcelErrors(validation)) {
          setWorkbookMemoStatus((current) => ({
            ...current,
            [workbookName]: memoStatus(validation.diagnostics)
          }))
          setReadDiagnostics(validation.diagnostics)
          setError(
            `${workbookName} 입력 오류 ${validation.diagnostics.filter(({ severity }) => severity === 'error').length}개`
          )
          return
        }
        setWorkbookMemoStatus((current) => ({
          ...current,
          [workbookName]: memoStatus(validation.diagnostics)
        }))
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
      const automatic = dependency.order.filter(
        (messageName) => !selectedMessages.has(messageName)
      ).length
      setSuccess(
        `${exported.files.length}개 JSON 파일 내보내기 완료 · 직접 선택 ${selectedMessages.size}개 · 자동 포함 ${automatic}개`
      )
    } catch (cause) {
      setError(formatDiagnosticMessage(toNativeError(cause)))
    } finally {
      abortController.current = null
      setRunning(false)
    }
  }

  const dependencyPreview = loaded
    ? collectJsonExportDependencies(loaded.workspace, [...selectedMessages])
    : { order: [], diagnostics: [] }
  const automaticDependencyCount = dependencyPreview.order.filter(
    (messageName) => !selectedMessages.has(messageName)
  ).length
  const allExcelSelected = plans.length > 0 && selected.size === plans.length
  const someExcelSelected = selected.size > 0 && !allExcelSelected
  const selectableJsonMessages = plans.flatMap((plan) => {
    const existing = existingByName.has(plan.fileName.toLocaleLowerCase())
    return existing ? plan.sheets.map(({ name }) => name) : []
  })
  const allJsonSelected =
    selectableJsonMessages.length > 0 && selectedMessages.size === selectableJsonMessages.length
  const someJsonSelected = selectedMessages.size > 0 && !allJsonSelected
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const visiblePlans = plans.filter((plan) => {
    if (!normalizedSearchQuery) return true
    return [plan.fileName, plan.sourceFile, ...plan.sheets.map(({ name }) => name)].some((value) =>
      value.toLocaleLowerCase().includes(normalizedSearchQuery)
    )
  })

  const openExcelRoot = async (): Promise<void> => {
    if (!loaded?.settings.excelRoot) return
    setError(null)
    try {
      await nativePort.openPath(loaded.settings.excelRoot)
    } catch (cause) {
      setError(formatDiagnosticMessage(toNativeError(cause)))
    }
  }

  const setWorkbookJsonSelection = (messageNames: readonly string[], checked: boolean): void => {
    setSelectedMessages((current) => {
      const next = new Set(current)
      for (const messageName of messageNames) {
        if (checked) next.add(messageName)
        else next.delete(messageName)
      }
      return next
    })
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
            disabled={running || !loaded?.settings.excelRoot}
            onClick={() => void openExcelRoot()}
          >
            <FolderOpen aria-hidden="true" size={16} /> Excel 폴더 열기
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
          <div className="excel-view-controls">
            <div aria-label="Excel 작업" className="excel-tabs" role="tablist">
              <button
                aria-controls="excel-generation-panel"
                aria-selected={activeView === 'excel'}
                id="excel-generation-tab"
                onClick={() => setActiveView('excel')}
                role="tab"
                type="button"
              >
                Excel 생성
              </button>
              <button
                aria-controls="json-generation-panel"
                aria-selected={activeView === 'json'}
                id="json-generation-tab"
                onClick={() => setActiveView('json')}
                role="tab"
                type="button"
              >
                JSON 생성
              </button>
            </div>
            <label className="excel-search">
              <Search aria-hidden="true" size={15} />
              <input
                aria-label="Excel과 테이블 검색"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Excel 또는 테이블 검색"
                type="search"
                value={searchQuery}
              />
            </label>
          </div>

          {activeView === 'excel' ? (
            <section
              aria-labelledby="excel-generation-tab"
              className="excel-selection-section"
              id="excel-generation-panel"
              role="tabpanel"
            >
              <div className="excel-list-heading">
                <div>
                  <h3 id="excel-generation-title">Excel 생성</h3>
                  <span>workbook 단위로 생성합니다.</span>
                </div>
                <div className="excel-heading-selection">
                  <strong>{selected.size}개 workbook</strong>
                  <label>
                    <TriStateCheckbox
                      ariaLabel="Excel 생성 전체"
                      checked={allExcelSelected}
                      indeterminate={someExcelSelected}
                      onChange={(checked) =>
                        setSelected(
                          checked ? new Set(plans.map((plan) => plan.sourceFile)) : new Set()
                        )
                      }
                    />
                    전체 선택
                  </label>
                </div>
              </div>
              <div className="excel-generation-list">
                {visiblePlans.map((plan) => (
                  <label className="excel-generation-row" key={plan.sourceFile}>
                    <input
                      aria-label={`${plan.fileName} Excel 생성`}
                      checked={selected.has(plan.sourceFile)}
                      onChange={(event) =>
                        setSelected((current) =>
                          toggleSet(current, plan.sourceFile, event.target.checked)
                        )
                      }
                      type="checkbox"
                    />
                    <span className="excel-workbook-identity">
                      <strong>{plan.fileName}</strong>
                      <small>{plan.sheets.length}개 table</small>
                    </span>
                    <span
                      className="excel-included-tables"
                      title={plan.sheets.map(({ name }) => name).join(', ')}
                    >
                      {plan.sheets.map(({ name }) => name).join(', ')}
                    </span>
                  </label>
                ))}
                {visiblePlans.length === 0 ? (
                  <p className="excel-empty">검색 결과가 없습니다.</p>
                ) : null}
              </div>
              <div className="excel-section-actions">
                <span id="excel-generate-reason">
                  {selectedPlans.length === 0
                    ? '생성할 workbook을 선택하세요.'
                    : `${selectedPlans.length}개 생성 준비`}
                </span>
                <button
                  aria-describedby="excel-generate-reason"
                  className="button button-primary icon-text-button"
                  disabled={running || !rootsReady || selectedPlans.length === 0}
                  onClick={requestGenerate}
                >
                  <Play aria-hidden="true" size={16} /> 선택 생성
                </button>
              </div>
            </section>
          ) : (
            <section
              aria-labelledby="json-generation-tab"
              className="excel-selection-section"
              id="json-generation-panel"
              role="tabpanel"
            >
              <div className="excel-list-heading">
                <div>
                  <h3 id="json-export-title">JSON 생성</h3>
                  <span>workbook 아래 table을 선택합니다.</span>
                </div>
                <div className="excel-heading-selection">
                  <strong>{selectedMessages.size}개 table</strong>
                  <label>
                    <TriStateCheckbox
                      ariaLabel="JSON 테이블 전체"
                      checked={allJsonSelected}
                      disabled={selectableJsonMessages.length === 0}
                      indeterminate={someJsonSelected}
                      onChange={(checked) =>
                        setSelectedMessages(checked ? new Set(selectableJsonMessages) : new Set())
                      }
                    />
                    전체 선택
                  </label>
                </div>
              </div>
              <div className="excel-workbook-groups">
                {visiblePlans.map((plan) => {
                  const existing = existingByName.get(plan.fileName.toLocaleLowerCase())
                  const messageNames = plan.sheets.map(({ name }) => name)
                  const selectedCount = messageNames.filter((name) =>
                    selectedMessages.has(name)
                  ).length
                  return (
                    <div className="excel-json-row" key={plan.sourceFile}>
                      <TriStateCheckbox
                        ariaLabel={`${plan.fileName} JSON 테이블 전체`}
                        checked={selectedCount === messageNames.length && messageNames.length > 0}
                        disabled={!existing}
                        indeterminate={selectedCount > 0 && selectedCount < messageNames.length}
                        onChange={(checked) => setWorkbookJsonSelection(messageNames, checked)}
                      />
                      <div className="excel-json-workbook">
                        <strong>{plan.fileName}</strong>
                        <span>
                          {selectedCount}/{messageNames.length}개 선택
                        </span>
                      </div>
                      <div
                        className="excel-json-tables"
                        aria-label={`${plan.fileName} 포함 테이블`}
                      >
                        {plan.sheets.map((sheet) => (
                          <label key={sheet.name}>
                            <input
                              aria-label={`${plan.fileName} ${sheet.name} JSON 테이블`}
                              checked={selectedMessages.has(sheet.name)}
                              disabled={!existing}
                              onChange={(event) =>
                                setSelectedMessages((current) =>
                                  toggleSet(current, sheet.name, event.target.checked)
                                )
                              }
                              type="checkbox"
                            />
                            <span>{sheet.name}</span>
                          </label>
                        ))}
                      </div>
                      <span className={existing ? 'excel-status-existing' : 'excel-status-new'}>
                        {existing
                          ? (workbookMemoStatus[plan.fileName] ?? '기존 파일')
                          : 'Excel 생성 필요'}
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
                {visiblePlans.length === 0 ? (
                  <p className="excel-empty">
                    {plans.length === 0
                      ? '생성할 테이블 Proto가 없습니다.'
                      : '검색 결과가 없습니다.'}
                  </p>
                ) : null}
              </div>
              <div className="excel-section-actions">
                <span id="json-export-reason">
                  {selectedMessages.size === 0
                    ? '출력할 table을 선택하세요.'
                    : `직접 선택 ${selectedMessages.size}개 · 자동 포함 ${automaticDependencyCount}개`}
                </span>
                <button
                  aria-describedby="json-export-reason"
                  className="button button-secondary icon-text-button"
                  disabled={running || !loaded?.settings.jsonRoot || selectedMessages.size === 0}
                  onClick={() => void exportJson()}
                >
                  <FileCheck2 aria-hidden="true" size={16} /> JSON 생성
                </button>
              </div>
            </section>
          )}

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
                  <p>{formatDiagnosticMessage(diagnostic)}</p>
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
                  <p>{formatDiagnosticMessage(diagnostic)}</p>
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
              <p className="collision-warning">
                workbook을 다시 생성하면 기존 데이터와 Excel 메모 값이 덮어쓰여집니다. 필요한 값을
                확인하고 백업 여부를 선택하세요.
              </p>
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

function primaryKeyPolicyError(violations: readonly PrimaryKeyPolicyViolation[]): string {
  const fields = violations
    .map(({ messageName, fieldName, fieldType }) => `${messageName}.${fieldName}(${fieldType})`)
    .join(', ')
  return `기본키 타입이 프로젝트 정책에 맞지 않습니다: ${fields}`
}

interface TriStateCheckboxProps {
  ariaLabel: string
  checked: boolean
  disabled?: boolean
  indeterminate: boolean
  onChange: (checked: boolean) => void
}

function TriStateCheckbox({
  ariaLabel,
  checked,
  disabled = false,
  indeterminate,
  onChange
}: TriStateCheckboxProps): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      ref={ref}
      type="checkbox"
    />
  )
}

function toggleSet(current: ReadonlySet<string>, value: string, checked: boolean): Set<string> {
  const next = new Set(current)
  if (checked) next.add(value)
  else next.delete(value)
  return next
}

function memoStatus(diagnostics: readonly ExcelDiagnostic[]): string {
  if (
    diagnostics.some(({ code }) =>
      ['EXCEL_MEMO_METADATA_CORRUPT', 'EXCEL_MEMO_METADATA_UNSUPPORTED'].includes(code)
    )
  ) {
    return '메모 정보 확인 필요'
  }
  if (diagnostics.some(({ code }) => code === 'EXCEL_MEMO_SCHEMA_STALE')) {
    const stale = diagnostics.find(({ code }) => code === 'EXCEL_MEMO_SCHEMA_STALE')
    const changes = typeof stale?.context?.changes === 'string' ? stale.context.changes : ''
    return `메모 변경 적용 필요${changes ? ` · ${changes}` : ''}`
  }
  return '기존 파일'
}

function inspectionMemoStatus(
  plan: ExcelWorkbookPlan,
  inspection: ExcelMetadataInspection
): string {
  if (inspection.issue) return '메모 정보 확인 필요'
  const embedded = inspection.metadata
  if (!embedded) return '기존 파일'
  if (
    embedded.sourceFile === plan.sourceFile &&
    embedded.fingerprint === plan.embeddedMetadata.fingerprint
  ) {
    return '기존 파일'
  }

  const changes: string[] = []
  const currentTables = new Map(
    plan.embeddedMetadata.tables.map((table) => [table.messageName, table.memoColumns])
  )
  const embeddedTables = new Map(
    embedded.tables.map((table) => [table.messageName, table.memoColumns])
  )
  for (const [messageName, currentMemos] of currentTables) {
    const previousMemos = embeddedTables.get(messageName) ?? []
    const previousById = new Map(previousMemos.map((memo) => [memo.id, memo]))
    const currentIds = new Set(currentMemos.map(({ id }) => id))
    for (const memo of currentMemos) {
      const previous = previousById.get(memo.id)
      if (!previous) changes.push(`${messageName} 추가: ${memo.name}`)
      else if (previous.name !== memo.name) {
        changes.push(`${messageName} 이름 변경: ${previous.name} → ${memo.name}`)
      }
    }
    for (const memo of previousMemos) {
      if (!currentIds.has(memo.id)) changes.push(`${messageName} 삭제: ${memo.name}`)
    }
  }
  for (const [messageName, previousMemos] of embeddedTables) {
    if (!currentTables.has(messageName)) {
      changes.push(...previousMemos.map((memo) => `${messageName} 삭제: ${memo.name}`))
    }
  }
  return `메모 변경 적용 필요${changes.length > 0 ? ` · ${changes.join(', ')}` : ''}`
}
