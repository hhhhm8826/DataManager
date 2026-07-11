import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CODEGEN_DEFINITIONS,
  configuredCodegenSelections,
  formatDiagnostic,
  formatDiagnosticMessage,
  generateUnrealFiles,
  toNativeError,
  validatePrimaryKeyTypePolicy,
  type CodegenLanguage,
  type NativeError,
  type PrimaryKeyPolicyViolation
} from '@datamanager/core'
import {
  Ban,
  CheckCircle2,
  CircleAlert,
  FolderOpen,
  Play,
  RefreshCw,
  Settings,
  TerminalSquare,
  XCircle
} from 'lucide-react'
import { createNativePort } from '../../adapters/native/createNativePort'
import type {
  CodegenEnvironment,
  NativePort,
  ProtocRunResult
} from '../../adapters/native/NativePort'
import { loadProtoWorkspace, type LoadedProtoWorkspace } from '../schema/protoWorkspaceService'

type GeneratorId = CodegenLanguage | 'unreal'
type RunStatus = 'success' | 'error'

interface GeneratorRow {
  id: GeneratorId
  label: string
  outputDirectory: string
  pluginExecutable: string | null
}

interface RunLog {
  id: GeneratorId
  label: string
  status: RunStatus
  message: string
  stdout: string
  stderr: string
  exitCode: number | null
  args: string[]
  technicalDetails: string
}

interface CodegenScreenProps {
  nativePort?: NativePort
  onOpenSettings?: () => void
}

export function CodegenScreen({
  nativePort: providedNativePort,
  onOpenSettings
}: CodegenScreenProps): React.JSX.Element {
  const nativePort = useMemo(() => providedNativePort ?? createNativePort(), [providedNativePort])
  const [loaded, setLoaded] = useState<LoadedProtoWorkspace | null>(null)
  const [environment, setEnvironment] = useState<CodegenEnvironment | null>(null)
  const [environmentError, setEnvironmentError] = useState<NativeError | null>(null)
  const [policyViolations, setPolicyViolations] = useState<PrimaryKeyPolicyViolation[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [running, setRunning] = useState(false)
  const [cancelPending, setCancelPending] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 1, label: '' })
  const [logs, setLogs] = useState<RunLog[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const cancelRequested = useRef(false)

  const checkEnvironment = useCallback(async (): Promise<CodegenEnvironment | null> => {
    setChecking(true)
    setEnvironmentError(null)
    try {
      const checked = await nativePort.checkCodegenEnvironment()
      setEnvironment(checked)
      return checked
    } catch (cause) {
      const error = toNativeError(cause)
      setEnvironment(null)
      setEnvironmentError(error)
      return null
    } finally {
      setChecking(false)
    }
  }, [nativePort])

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true)
    setSummary(null)
    try {
      const next = await loadProtoWorkspace(nativePort)
      const metadata = await nativePort.loadWorkspaceMetadata()
      setLoaded(next)
      setPolicyViolations(
        validatePrimaryKeyTypePolicy(next.workspace, metadata.primaryKeyTypePolicy)
      )
      if (next.settings.protocExecutable) await checkEnvironment()
      else {
        setEnvironment(null)
        setEnvironmentError(null)
      }
    } catch (cause) {
      setLoaded(null)
      setEnvironment(null)
      setEnvironmentError(toNativeError(cause))
      setPolicyViolations([])
    } finally {
      setLoading(false)
    }
  }, [checkEnvironment, nativePort])

  useEffect(() => {
    void reload()
  }, [reload])

  const rows = useMemo<GeneratorRow[]>(() => {
    const protocOutputs = new Map(
      loaded
        ? configuredCodegenSelections(loaded.settings).map((selection) => [
            selection.language,
            selection.outputDirectory
          ])
        : []
    )
    const unrealOutput =
      loaded?.settings.codegenOutputs
        .filter(
          ({ language, directory }) => language.trim().toLowerCase() === 'unreal' && directory
        )
        .at(-1)?.directory ?? ''
    return [
      ...CODEGEN_DEFINITIONS.map((definition) => ({
        id: definition.id,
        label: definition.label,
        outputDirectory: protocOutputs.get(definition.id) ?? '',
        pluginExecutable: definition.pluginExecutable
      })),
      {
        id: 'unreal' as const,
        label: 'Unreal C++',
        outputDirectory: unrealOutput,
        pluginExecutable: null
      }
    ]
  }, [loaded])

  const pluginAvailable = (row: GeneratorRow): boolean => {
    if (!row.pluginExecutable) return true
    return Boolean(
      environment?.plugins.some(({ language, available }) => language === row.id && available)
    )
  }
  const rowReady = (row: GeneratorRow): boolean =>
    Boolean(
      policyViolations.length === 0 &&
      row.outputDirectory &&
      (row.id === 'unreal' || (environment !== null && pluginAvailable(row)))
    )
  const configuredRows = rows.filter(({ outputDirectory }) => outputDirectory)
  const allReady = configuredRows.length > 0 && configuredRows.every(rowReady)

  const runGenerators = async (requestedRows: GeneratorRow[]): Promise<void> => {
    if (!loaded || running || requestedRows.length === 0 || policyViolations.length > 0) return
    cancelRequested.current = false
    setCancelPending(false)
    setRunning(true)
    setLogs([])
    setSummary(null)
    setProgress({ completed: 0, total: requestedRows.length, label: requestedRows[0]!.label })
    let succeeded = 0
    let failed = 0
    let completed = 0
    try {
      for (const row of requestedRows) {
        if (cancelRequested.current) break
        setProgress({ completed, total: requestedRows.length, label: row.label })
        try {
          const log =
            row.id === 'unreal'
              ? await runUnreal(nativePort, loaded)
              : successLog(row, await nativePort.runProtocLanguage(row.id))
          succeeded += 1
          setLogs((current) => [...current, log])
        } catch (cause) {
          failed += 1
          setLogs((current) => [...current, errorLog(row, toNativeError(cause))])
        }
        completed += 1
        setProgress({ completed, total: requestedRows.length, label: row.label })
      }
      const cancelled = requestedRows.length - completed
      setSummary(
        cancelled > 0
          ? `${succeeded}개 성공, ${failed}개 실패, ${cancelled}개 중단`
          : `${succeeded}개 성공${failed > 0 ? `, ${failed}개 실패` : ''}`
      )
    } finally {
      cancelRequested.current = false
      setCancelPending(false)
      setRunning(false)
    }
  }

  const requestCancel = (): void => {
    cancelRequested.current = true
    setCancelPending(true)
  }

  const rootsReady = Boolean(loaded?.settings.protoRoot)
  return (
    <main className="codegen-page">
      <div className="codegen-toolbar">
        <div>
          <p className="section-eyebrow">Generation</p>
          <h2>코드 생성</h2>
        </div>
        <div className="codegen-toolbar-actions">
          <button
            aria-label="코드 생성 환경 새로고침"
            className="icon-button"
            disabled={loading || checking || running}
            onClick={() => void reload()}
            title="환경 새로고침"
          >
            <RefreshCw aria-hidden="true" size={17} />
          </button>
          {running ? (
            <button
              className="button button-secondary icon-text-button"
              disabled={cancelPending}
              onClick={requestCancel}
            >
              <Ban aria-hidden="true" size={16} />{' '}
              {cancelPending ? '중단 대기 중' : '현재 작업 후 중단'}
            </button>
          ) : (
            <button
              className="button button-primary icon-text-button"
              disabled={!allReady || loading || checking}
              onClick={() => void runGenerators(configuredRows)}
            >
              <Play aria-hidden="true" size={16} /> 전체 생성
            </button>
          )}
        </div>
      </div>

      {!rootsReady && loaded ? (
        <div className="empty-workspace">
          <p>Proto 루트를 설정하세요.</p>
          <button className="button button-primary icon-text-button" onClick={onOpenSettings}>
            <Settings aria-hidden="true" size={16} /> 설정 열기
          </button>
        </div>
      ) : (
        <>
          <section className="codegen-environment" aria-busy={checking || loading}>
            <div>
              <TerminalSquare aria-hidden="true" size={18} />
              <div>
                <strong>{environment?.protocVersion ?? 'protoc 환경 미확인'}</strong>
                <span>
                  {environment?.protocExecutable ??
                    (environmentError ? formatDiagnosticMessage(environmentError) : null) ??
                    '설정에서 protoc 실행 파일을 선택하세요.'}
                </span>
              </div>
            </div>
            <div className="codegen-plugin-list">
              {CODEGEN_DEFINITIONS.filter(({ pluginExecutable }) => pluginExecutable).map(
                ({ id, pluginExecutable }) => {
                  const status = environment?.plugins.find((plugin) => plugin.language === id)
                  return (
                    <span
                      className={status?.available ? 'status-ready' : 'status-missing'}
                      key={id}
                    >
                      {status?.available ? (
                        <CheckCircle2 aria-hidden="true" size={13} />
                      ) : (
                        <CircleAlert aria-hidden="true" size={13} />
                      )}
                      {status?.executable ?? pluginExecutable}{' '}
                      {status?.available ? '준비됨' : '없음'}
                    </span>
                  )
                }
              )}
            </div>
          </section>

          {environmentError ? (
            <div className="notice notice-error" role="alert">
              {formatDiagnosticMessage(environmentError)}
              <details className="technical-details">
                <summary>기술 상세</summary>
                <pre>{formatDiagnostic(environmentError).technicalDetails}</pre>
              </details>
            </div>
          ) : null}
          {policyViolations.length > 0 ? (
            <div className="notice notice-error" role="alert">
              기본키 타입이 프로젝트 정책에 맞지 않습니다:{' '}
              {policyViolations
                .map(
                  ({ messageName, fieldName, fieldType }) =>
                    `${messageName}.${fieldName}(${fieldType})`
                )
                .join(', ')}
            </div>
          ) : null}
          {summary ? (
            <div className="notice notice-success" aria-live="polite">
              {summary}
            </div>
          ) : null}

          <section className="codegen-surface" aria-busy={running}>
            <div className="codegen-list-heading">
              <span>대상</span>
              <span>{configuredRows.length}개 출력 설정됨</span>
            </div>
            {rows.map((row) => {
              const ready = rowReady(row)
              const status = rowStatus(row, environment)
              return (
                <div className="codegen-row" key={row.id}>
                  <div className="codegen-language">
                    <strong>{row.label}</strong>
                    <span>
                      {row.id === 'unreal' ? 'DataTables / JSON loader' : `protoc --${row.id}_out`}
                    </span>
                  </div>
                  <code>{row.outputDirectory || '출력 경로 미설정'}</code>
                  <span className={ready ? 'status-ready' : 'status-missing'}>{status}</span>
                  <div className="codegen-row-actions">
                    <button
                      aria-label={`${row.label} 출력 열기`}
                      className="icon-button icon-button-compact"
                      disabled={!row.outputDirectory || running}
                      onClick={() => void nativePort.openPath(row.outputDirectory)}
                      title="출력 폴더 열기"
                    >
                      <FolderOpen aria-hidden="true" size={15} />
                    </button>
                    <button
                      aria-label={`${row.label} 생성`}
                      className="icon-button icon-button-compact"
                      disabled={!ready || running}
                      onClick={() => void runGenerators([row])}
                      title="생성"
                    >
                      <Play aria-hidden="true" size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
            {running ? (
              <div className="codegen-progress">
                <div>
                  <span>{cancelPending ? '현재 작업 완료 후 중단' : '생성 중'}</span>
                  <strong>{progress.label}</strong>
                </div>
                <progress max={progress.total} value={progress.completed} />
              </div>
            ) : null}
          </section>

          {logs.length > 0 ? (
            <section className="codegen-results" aria-label="코드 생성 결과">
              {logs.map((log, index) => (
                <article
                  className={`codegen-result codegen-result-${log.status}`}
                  key={`${log.id}-${index}`}
                >
                  <div>
                    {log.status === 'success' ? (
                      <CheckCircle2 aria-hidden="true" size={16} />
                    ) : (
                      <XCircle aria-hidden="true" size={16} />
                    )}
                    <strong>{log.label}</strong>
                    <span>{log.message}</span>
                    {log.exitCode !== null ? <code>exit {log.exitCode}</code> : null}
                  </div>
                  {log.args.length > 0 || log.stdout || log.stderr || log.technicalDetails ? (
                    <details className="technical-details" open={log.status === 'error'}>
                      <summary>기술 상세</summary>
                      {log.args.length > 0 ? <pre>{log.args.join(' ')}</pre> : null}
                      {log.stdout ? <pre>{log.stdout}</pre> : null}
                      {log.stderr ? <pre className="codegen-stderr">{log.stderr}</pre> : null}
                      {log.technicalDetails ? <pre>{log.technicalDetails}</pre> : null}
                    </details>
                  ) : null}
                </article>
              ))}
            </section>
          ) : null}
        </>
      )}
    </main>
  )
}

async function runUnreal(nativePort: NativePort, loaded: LoadedProtoWorkspace): Promise<RunLog> {
  const generated = generateUnrealFiles(loaded.workspace)
  if (generated.files.length === 0) {
    const first = generated.diagnostics[0]
    throw {
      code: first?.code ?? 'UNREAL_OUTPUT_EMPTY',
      message: first?.message ?? '생성할 Unreal 선언이 없습니다.',
      context: { diagnostics: generated.diagnostics }
    } satisfies NativeError
  }
  const paths = await nativePort.writeUnrealFiles(generated.files)
  return {
    id: 'unreal',
    label: 'Unreal C++',
    status: 'success',
    message: `${paths.length}개 파일 생성 완료`,
    stdout: paths.join('\n'),
    stderr: generated.diagnostics.map(formatDiagnosticMessage).join('\n'),
    exitCode: 0,
    args: [],
    technicalDetails: ''
  }
}

function successLog(row: GeneratorRow, result: ProtocRunResult): RunLog {
  return {
    id: row.id,
    label: row.label,
    status: 'success',
    message: result.outputDirectory,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    args: [result.executable, ...result.args],
    technicalDetails: ''
  }
}

function errorLog(row: GeneratorRow, error: NativeError): RunLog {
  const stdout = typeof error.context.stdout === 'string' ? error.context.stdout : ''
  const stderr = typeof error.context.stderr === 'string' ? error.context.stderr : ''
  const exitCode = typeof error.context.exitCode === 'number' ? error.context.exitCode : null
  const args = Array.isArray(error.context.args)
    ? error.context.args.filter((value): value is string => typeof value === 'string')
    : []
  return {
    id: row.id,
    label: row.label,
    status: 'error',
    message: formatDiagnosticMessage(error),
    stdout,
    stderr,
    exitCode,
    args,
    technicalDetails: `code=${error.code}`
  }
}

function rowStatus(row: GeneratorRow, environment: CodegenEnvironment | null): string {
  if (!row.outputDirectory) return '미설정'
  if (row.id === 'unreal') return '준비됨'
  if (!environment) return '환경 미확인'
  if (row.pluginExecutable) {
    const plugin = environment.plugins.find(({ language }) => language === row.id)
    if (!plugin?.available) return `${row.pluginExecutable} 없음`
  }
  return '준비됨'
}
