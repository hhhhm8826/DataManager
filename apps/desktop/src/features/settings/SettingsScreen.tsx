import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CODEGEN_DEFINITIONS,
  defaultAppSettings,
  formatDiagnosticMessage,
  normalizeCodegenLanguage,
  toNativeError,
  validatePrimaryKeyTypePolicy,
  type AppSettings,
  type LegacyPathCheck,
  type LegacyImportPreview,
  type PrimaryKeyPolicyViolation,
  type PrimaryKeyTypePolicy
} from '@datamanager/core'
import { createNativePort } from '../../adapters/native/createNativePort'
import type { NativePort } from '../../adapters/native/NativePort'
import { useWorkspaceMetadataStore } from '../projectMetadata/workspaceMetadataStore'
import { loadProtoWorkspace, type LoadedProtoWorkspace } from '../schema/protoWorkspaceService'

type RootField = 'protoRoot' | 'excelRoot' | 'jsonRoot'

const rootFields: Array<{ field: RootField; label: string }> = [
  { field: 'protoRoot', label: 'Proto 루트' },
  { field: 'excelRoot', label: 'Excel 루트' },
  { field: 'jsonRoot', label: 'JSON 루트' }
]

const codegenLanguageOptions = [
  ...CODEGEN_DEFINITIONS.map(({ id, label }) => ({ id, label })),
  { id: 'unreal', label: 'Unreal C++' }
] as const

function errorMessage(error: unknown): string {
  return formatDiagnosticMessage(toNativeError(error))
}

interface SettingsScreenProps {
  nativePort?: NativePort
}

export function SettingsScreen({
  nativePort: providedNativePort
}: SettingsScreenProps): React.JSX.Element {
  const nativePort = useMemo<NativePort>(
    () => providedNativePort ?? createNativePort(),
    [providedNativePort]
  )
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings)
  const [legacyConfigPath, setLegacyConfigPath] = useState<string | null>(null)
  const [migrationPreview, setMigrationPreview] = useState<LegacyImportPreview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [policyWorkspace, setPolicyWorkspace] = useState<LoadedProtoWorkspace | null>(null)
  const [policyViolations, setPolicyViolations] = useState<PrimaryKeyPolicyViolation[]>([])
  const metadata = useWorkspaceMetadataStore((state) => state.metadata)
  const metadataLoading = useWorkspaceMetadataStore((state) => state.loading)

  const reloadSettings = useCallback(async () => {
    setIsLoading(true)
    try {
      const loaded = await nativePort.loadSettings()
      setSettings(loaded)
      if (loaded.protoRoot) {
        const workspace = await loadProtoWorkspace(nativePort)
        setPolicyWorkspace(workspace)
        await useWorkspaceMetadataStore.getState().load(nativePort, loaded.protoRoot)
      } else {
        setPolicyWorkspace(null)
        useWorkspaceMetadataStore.getState().reset()
      }
      setPolicyViolations([])
      if (loaded.legacyImport) {
        setLegacyConfigPath(null)
        setMigrationPreview(null)
      } else {
        setLegacyConfigPath(await nativePort.findLegacyConfig())
      }
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [nativePort])

  useEffect(() => {
    void reloadSettings()
  }, [reloadSettings])

  const chooseDirectory = async (field: RootField): Promise<void> => {
    try {
      const selected = await nativePort.selectDirectory(settings[field] || undefined)
      if (selected) setSettings((current) => ({ ...current, [field]: selected }))
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const chooseProtoc = async (): Promise<void> => {
    try {
      const selected = await nativePort.selectFile(settings.protocExecutable || undefined)
      if (selected) setSettings((current) => ({ ...current, protocExecutable: selected }))
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const saveSettings = async (): Promise<void> => {
    setIsSaving(true)
    try {
      const saved = await nativePort.saveSettings(settings)
      setSettings(saved)
      toast.success('설정을 저장했습니다.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const previewMigration = async (): Promise<void> => {
    if (!legacyConfigPath) return
    setIsMigrating(true)
    try {
      setMigrationPreview(await nativePort.previewLegacyImport(legacyConfigPath))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setIsMigrating(false)
    }
  }

  const importLegacy = async (): Promise<void> => {
    if (!migrationPreview) return
    setIsMigrating(true)
    try {
      const imported = await nativePort.importLegacySettings(migrationPreview.sourcePath)
      setSettings(imported)
      setLegacyConfigPath(null)
      setMigrationPreview(null)
      toast.success('기존 설정을 가져왔습니다.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setIsMigrating(false)
    }
  }

  const updatePrimaryKeyPolicy = async (policy: PrimaryKeyTypePolicy): Promise<void> => {
    if (!settings.protoRoot || !policyWorkspace || policy === metadata.primaryKeyTypePolicy) return
    const violations = validatePrimaryKeyTypePolicy(policyWorkspace.workspace, policy)
    if (violations.length > 0) {
      setPolicyViolations(violations)
      return
    }
    setPolicyViolations([])
    try {
      await useWorkspaceMetadataStore
        .getState()
        .updateSection(nativePort, settings.protoRoot, 'primaryKeyTypePolicy', policy)
      toast.success('프로젝트 기본키 정책을 저장했습니다.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <main className="settings-page">
      <section className="settings-heading">
        <div>
          <p className="section-eyebrow">Workspace</p>
          <h2>설정</h2>
        </div>
        <div className="settings-actions">
          <button
            className="button button-secondary"
            disabled={isLoading || isSaving || isMigrating}
            onClick={() => void reloadSettings()}
            type="button"
          >
            다시 읽기
          </button>
          <button
            className="button button-primary"
            disabled={isLoading || isSaving || isMigrating}
            onClick={() => void saveSettings()}
            type="button"
          >
            {isSaving ? '저장 중' : '저장'}
          </button>
        </div>
      </section>

      {legacyConfigPath && !settings.legacyImport ? (
        <LegacyMigration
          busy={isMigrating}
          configPath={legacyConfigPath}
          onCancel={() => setMigrationPreview(null)}
          onImport={() => void importLegacy()}
          onPreview={() => void previewMigration()}
          preview={migrationPreview}
        />
      ) : null}

      <section aria-busy={isLoading} className="settings-surface">
        <div className="settings-group">
          <div className="settings-group-header">
            <h3>작업 경로</h3>
          </div>
          {rootFields.map(({ field, label }) => (
            <PathInput
              key={field}
              label={label}
              onChange={(value) => setSettings((current) => ({ ...current, [field]: value }))}
              onSelect={() => void chooseDirectory(field)}
              value={settings[field]}
            />
          ))}
          <PathInput
            label="protoc 실행 파일"
            onChange={(protocExecutable) =>
              setSettings((current) => ({ ...current, protocExecutable }))
            }
            onSelect={() => void chooseProtoc()}
            value={settings.protocExecutable}
          />
        </div>

        <CodegenOutputs nativePort={nativePort} onChange={setSettings} settings={settings} />

        <div className="settings-group project-policy-group">
          <div className="settings-group-header">
            <h3>프로젝트 기본키 타입</h3>
          </div>
          {!settings.protoRoot ? (
            <p className="empty-row">Proto 루트를 설정하면 프로젝트 정책을 선택할 수 있습니다.</p>
          ) : (
            <div className="policy-options" role="radiogroup" aria-label="기본키 타입 정책">
              <PolicyOption
                checked={metadata.primaryKeyTypePolicy === 'numeric-or-enum'}
                description="숫자 ID와 Enum만 허용합니다. 예: ItemId = 1001, Grade = LEGENDARY"
                disabled={metadataLoading}
                label="숫자 또는 Enum"
                onSelect={() => void updatePrimaryKeyPolicy('numeric-or-enum')}
                value="numeric-or-enum"
              />
              <PolicyOption
                checked={metadata.primaryKeyTypePolicy === 'string'}
                description={'문자열 코드만 허용합니다. 예: ItemCode = "SWORD_001"'}
                disabled={metadataLoading}
                label="문자열"
                onSelect={() => void updatePrimaryKeyPolicy('string')}
                value="string"
              />
              <PolicyOption
                checked={metadata.primaryKeyTypePolicy === 'unrestricted'}
                description="기존 프로젝트 호환을 위해 기본키 타입을 제한하지 않습니다."
                disabled={metadataLoading}
                label="자율"
                onSelect={() => void updatePrimaryKeyPolicy('unrestricted')}
                value="unrestricted"
              />
            </div>
          )}
          {policyViolations.length > 0 ? (
            <div className="policy-violations" role="alert">
              <strong>정책을 바꾸기 전에 다음 기본키 타입을 수정하세요.</strong>
              {policyViolations.map((violation) => (
                <p key={`${violation.sourceFile}-${violation.messageName}-${violation.fieldName}`}>
                  {violation.messageName}.{violation.fieldName}: {violation.fieldType} (
                  {violation.sourceFile})
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="settings-group">
          <div className="settings-group-header settings-group-header-actions">
            <h3>파일 색상</h3>
            <button
              className="button button-secondary"
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  diagram: {
                    ...current.diagram,
                    fileColors: { ...current.diagram.fileColors, '새 파일.proto': '#007d74' }
                  }
                }))
              }
              type="button"
            >
              색상 추가
            </button>
          </div>
          {Object.entries(settings.diagram.fileColors).length === 0 ? (
            <p className="empty-row">설정된 파일 색상이 없습니다.</p>
          ) : (
            Object.entries(settings.diagram.fileColors).map(([fileName, color]) => (
              <div className="color-row" key={fileName}>
                <input
                  aria-label={`${fileName} 색상`}
                  onChange={(event) => updateFileColor(setSettings, fileName, event.target.value)}
                  type="color"
                  value={color}
                />
                <input
                  aria-label="Proto 파일명"
                  onChange={(event) => renameFileColor(setSettings, fileName, event.target.value)}
                  type="text"
                  value={fileName}
                />
                <button
                  aria-label={`${fileName} 색상 삭제`}
                  className="button button-secondary"
                  onClick={() => removeFileColor(setSettings, fileName)}
                  type="button"
                >
                  삭제
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}

function PolicyOption({
  checked,
  description,
  disabled,
  label,
  onSelect,
  value
}: {
  checked: boolean
  description: string
  disabled: boolean
  label: string
  onSelect: () => void
  value: PrimaryKeyTypePolicy
}): React.JSX.Element {
  return (
    <label className="policy-option">
      <input
        checked={checked}
        disabled={disabled}
        name="primary-key-type-policy"
        onChange={onSelect}
        type="radio"
        value={value}
      />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </label>
  )
}

interface CodegenOutputsProps {
  nativePort: NativePort
  onChange: React.Dispatch<React.SetStateAction<AppSettings>>
  settings: AppSettings
}

function CodegenOutputs({
  nativePort,
  onChange,
  settings
}: CodegenOutputsProps): React.JSX.Element {
  const configuredLanguages = new Set(
    settings.codegenOutputs.map(({ language }) => normalizedOutputLanguage(language))
  )
  const nextLanguage = codegenLanguageOptions.find(({ id }) => !configuredLanguages.has(id))?.id
  const choose = async (index: number): Promise<void> => {
    const output = settings.codegenOutputs[index]
    try {
      const selected = await nativePort.selectDirectory(output?.directory || undefined)
      if (!selected) return
      onChange((current) => ({
        ...current,
        codegenOutputs: current.codegenOutputs.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, directory: selected } : entry
        )
      }))
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="settings-group">
      <div className="settings-group-header settings-group-header-actions">
        <h3>코드 생성 출력</h3>
        <button
          className="button button-secondary"
          disabled={!nextLanguage}
          onClick={() =>
            onChange((current) => ({
              ...current,
              codegenOutputs: [
                ...current.codegenOutputs,
                { language: nextLanguage ?? 'cpp', directory: '' }
              ]
            }))
          }
          type="button"
        >
          출력 추가
        </button>
      </div>
      {settings.codegenOutputs.length === 0 ? (
        <p className="empty-row">설정된 코드 출력이 없습니다.</p>
      ) : (
        settings.codegenOutputs.map((output, index) => (
          <div className="output-row" key={`${output.language}-${index}`}>
            <select
              aria-label={`출력 ${index + 1} 언어`}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  codegenOutputs: current.codegenOutputs.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, language: event.target.value } : entry
                  )
                }))
              }
              value={output.language}
            >
              {!codegenLanguageOptions.some(({ id }) => id === output.language) ? (
                <option value={output.language}>{output.language} (legacy)</option>
              ) : null}
              {codegenLanguageOptions.map(({ id, label }) => (
                <option
                  disabled={
                    normalizedOutputLanguage(output.language) !== id && configuredLanguages.has(id)
                  }
                  key={id}
                  value={id}
                >
                  {label}
                </option>
              ))}
            </select>
            <input
              aria-label={`${output.language} 출력 디렉터리`}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  codegenOutputs: current.codegenOutputs.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, directory: event.target.value } : entry
                  )
                }))
              }
              type="text"
              value={output.directory}
            />
            <button
              aria-label={`${output.language} 출력 디렉터리 선택`}
              className="button button-select"
              onClick={() => void choose(index)}
              type="button"
            >
              찾아보기
            </button>
            <button
              aria-label={`${output.language} 출력 삭제`}
              className="button button-secondary"
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  codegenOutputs: current.codegenOutputs.filter(
                    (_entry, entryIndex) => entryIndex !== index
                  )
                }))
              }
              type="button"
            >
              삭제
            </button>
          </div>
        ))
      )}
    </div>
  )
}

function normalizedOutputLanguage(value: string): string {
  if (value.trim().toLowerCase() === 'unreal') return 'unreal'
  return normalizeCodegenLanguage(value) ?? value.trim().toLowerCase()
}

interface LegacyMigrationProps {
  busy: boolean
  configPath: string
  onCancel(): void
  onImport(): void
  onPreview(): void
  preview: LegacyImportPreview | null
}

function LegacyMigration({
  busy,
  configPath,
  onCancel,
  onImport,
  onPreview,
  preview
}: LegacyMigrationProps): React.JSX.Element {
  return (
    <section className="migration-band">
      <div className="migration-header">
        <div>
          <h3>기존 설정 발견</h3>
          <p>{configPath}</p>
        </div>
        {!preview ? (
          <button
            className="button button-primary"
            disabled={busy}
            onClick={onPreview}
            type="button"
          >
            가져오기 검토
          </button>
        ) : null}
      </div>
      {preview ? (
        <>
          <div className="migration-table" role="table" aria-label="기존 설정 경로 검사">
            {preview.paths.map((path) => (
              <div className="migration-row" key={path.field} role="row">
                <strong>{path.field}</strong>
                <span className="path-value">{path.resolvedPath || '미설정'}</span>
                <span className={`status status-${path.status}`}>{legacyPathMessage(path)}</span>
              </div>
            ))}
          </div>
          <div className="migration-actions">
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={onCancel}
              type="button"
            >
              취소
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={onImport}
              type="button"
            >
              {busy ? '가져오는 중' : '이 설정 가져오기'}
            </button>
          </div>
        </>
      ) : null}
    </section>
  )
}

function legacyPathMessage(path: LegacyPathCheck): string {
  const target = path.kind === 'directory' ? '폴더' : '파일'
  switch (path.status) {
    case 'ready':
      return `${target}를 사용할 수 있습니다.`
    case 'missing':
      return `${target}을 찾을 수 없습니다.`
    case 'wrongType':
      return `경로의 대상 종류가 ${target}과 다릅니다.`
    case 'readOnly':
      return `${target}에 쓸 수 없습니다.`
  }
}

interface PathInputProps {
  label: string
  onChange(value: string): void
  onSelect(): void
  value: string
}

function PathInput({ label, onChange, onSelect, value }: PathInputProps): React.JSX.Element {
  return (
    <label className="field-row">
      <span>{label}</span>
      <div className="directory-control">
        <input
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
          type="text"
          value={value}
        />
        <button
          aria-label={label + ' 선택'}
          className="button button-select"
          onClick={onSelect}
          type="button"
        >
          찾아보기
        </button>
      </div>
    </label>
  )
}

function updateFileColor(
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>,
  fileName: string,
  color: string
): void {
  setSettings((current) => ({
    ...current,
    diagram: {
      ...current.diagram,
      fileColors: { ...current.diagram.fileColors, [fileName]: color }
    }
  }))
}

function renameFileColor(
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>,
  oldName: string,
  newName: string
): void {
  setSettings((current) => {
    const fileColors = { ...current.diagram.fileColors }
    const color = fileColors[oldName]
    delete fileColors[oldName]
    fileColors[newName] = color
    return { ...current, diagram: { ...current.diagram, fileColors } }
  })
}

function removeFileColor(
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>,
  fileName: string
): void {
  setSettings((current) => {
    const fileColors = { ...current.diagram.fileColors }
    delete fileColors[fileName]
    return { ...current, diagram: { ...current.diagram, fileColors } }
  })
}
