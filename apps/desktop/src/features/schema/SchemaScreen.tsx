import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addEnum,
  addMessage,
  createProtoDocument,
  deleteDeclaration,
  findReferenceImpacts,
  findWorkspaceDocument,
  isEnumFileName,
  isMessageFileName,
  toNativeError,
  updateEnum,
  updateMessage,
  type ProtoDiagnostic,
  type ProtoEnumDraft,
  type ProtoFieldDraft,
  type ProtoMessageDraft,
  type ProtoReferenceImpact
} from '@datamanager/core'
import {
  ArrowDown,
  ArrowUp,
  CircleHelp,
  FilePlus2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Trash2,
  X
} from 'lucide-react'
import { createNativePort } from '../../adapters/native/createNativePort'
import type { NativePort } from '../../adapters/native/NativePort'
import {
  encodeProtoSource,
  loadProtoWorkspace,
  protoPath,
  type LoadedProtoWorkspace
} from './protoWorkspaceService'

const primitiveTypes = [
  'bool',
  'bytes',
  'double',
  'fixed32',
  'fixed64',
  'float',
  'int32',
  'int64',
  'sfixed32',
  'sfixed64',
  'sint32',
  'sint64',
  'string',
  'uint32',
  'uint64'
]

interface SchemaScreenProps {
  nativePort?: NativePort
  onOpenSettings?: () => void
  focusKind?: 'message' | 'enum'
}

type EditorState = MessageEditorState | EnumEditorState

interface MessageEditorState {
  kind: 'message'
  sourceFile: string
  originalName?: string
  readOnly: boolean
  draft: ProtoMessageDraft
}

interface EnumEditorState {
  kind: 'enum'
  sourceFile: string
  originalName?: string
  readOnly: boolean
  draft: ProtoEnumDraft
}

interface PendingMutation {
  title: string
  sourceFile: string
  path: string
  source: string
  nextSelection: { kind: 'message' | 'enum'; name: string } | null
  impacts: ProtoReferenceImpact[]
}

export function SchemaScreen({
  nativePort: providedNativePort,
  onOpenSettings,
  focusKind
}: SchemaScreenProps): React.JSX.Element {
  const nativePort = useMemo(() => providedNativePort ?? createNativePort(), [providedNativePort])
  const [loaded, setLoaded] = useState<LoadedProtoWorkspace | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<ProtoDiagnostic[]>([])
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(null)

  const reload = useCallback(
    async (selection?: { kind: 'message' | 'enum'; name: string } | null): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const next = await loadProtoWorkspace(nativePort)
        setLoaded(next)
        if (selection) {
          if (selection.kind === 'message') {
            const declaration = next.workspace.messages.find(({ name }) => name === selection.name)
            const document = declaration
              ? findWorkspaceDocument(next.workspace, declaration.sourceFile)
              : undefined
            setEditor(declaration ? messageEditor(declaration, document?.readOnly ?? false) : null)
          } else {
            const declaration = next.workspace.enums.find(({ name }) => name === selection.name)
            const document = declaration
              ? findWorkspaceDocument(next.workspace, declaration.sourceFile)
              : undefined
            setEditor(declaration ? enumEditor(declaration, document?.readOnly ?? false) : null)
          }
        }
      } catch (cause) {
        setError(toNativeError(cause).message)
      } finally {
        setLoading(false)
      }
    },
    [nativePort]
  )

  useEffect(() => {
    void reload(null)
  }, [reload])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const messages =
    loaded?.workspace.messages
      .filter(({ name, sourceFile }) =>
        `${name} ${sourceFile}`.toLocaleLowerCase().includes(normalizedQuery)
      )
      .map((declaration) => ({
        ...declaration,
        readOnly:
          declaration.readOnly ||
          (findWorkspaceDocument(loaded.workspace, declaration.sourceFile)?.readOnly ?? false)
      })) ?? []
  const enums =
    loaded?.workspace.enums
      .filter(({ name, sourceFile }) =>
        `${name} ${sourceFile}`.toLocaleLowerCase().includes(normalizedQuery)
      )
      .map((declaration) => ({
        ...declaration,
        readOnly:
          declaration.readOnly ||
          (findWorkspaceDocument(loaded.workspace, declaration.sourceFile)?.readOnly ?? false)
      })) ?? []
  const knownTypes = [
    ...primitiveTypes,
    ...(loaded ? [...loaded.workspace.typeSources.keys()] : [])
  ].sort()

  const selectMessage = (name: string): void => {
    const declaration = loaded?.workspace.messages.find((message) => message.name === name)
    const document = declaration
      ? findWorkspaceDocument(loaded!.workspace, declaration.sourceFile)
      : undefined
    if (declaration) setEditor(messageEditor(declaration, document?.readOnly ?? false))
    setDiagnostics([])
    setSuccess(null)
  }

  const selectEnum = (name: string): void => {
    const declaration = loaded?.workspace.enums.find((entry) => entry.name === name)
    const document = declaration
      ? findWorkspaceDocument(loaded!.workspace, declaration.sourceFile)
      : undefined
    if (declaration) setEditor(enumEditor(declaration, document?.readOnly ?? false))
    setDiagnostics([])
    setSuccess(null)
  }

  const startNewMessage = (): void => {
    setEditor({
      kind: 'message',
      sourceFile: '',
      readOnly: false,
      draft: {
        name: '',
        fields: [{ name: 'id', type: 'int32', isPrimaryKey: true }]
      }
    })
    setDiagnostics([])
    setSuccess(null)
  }

  const startNewEnum = (): void => {
    setEditor({
      kind: 'enum',
      sourceFile: '',
      readOnly: false,
      draft: { name: '', values: [] }
    })
    setDiagnostics([])
    setSuccess(null)
  }

  const requestSave = (): void => {
    if (!loaded || !editor) return
    setError(null)
    setSuccess(null)
    setDiagnostics([])

    if (editor.readOnly) {
      setDiagnostics([
        diagnostic(
          'PROTO_DOCUMENT_READ_ONLY',
          '지원하지 않는 Proto 문법이 포함된 파일은 읽기 전용입니다.'
        )
      ])
      return
    }

    const duplicate = [
      ...loaded.workspace.messages.map((declaration) => ({
        ...declaration,
        kind: 'message' as const
      })),
      ...loaded.workspace.enums.map((declaration) => ({ ...declaration, kind: 'enum' as const }))
    ].find(
      (declaration) =>
        declaration.name === editor.draft.name &&
        !(
          declaration.kind === editor.kind &&
          declaration.sourceFile === editor.sourceFile &&
          declaration.name === editor.originalName
        )
    )
    if (duplicate) {
      setDiagnostics([
        diagnostic(
          'PROTO_SYMBOL_NAME_DUPLICATE',
          `'${editor.draft.name}' 이름이 이미 사용 중입니다.`
        )
      ])
      return
    }

    const sourceFile = editor.sourceFile || defaultFileName(editor)
    const validFileName =
      editor.kind === 'message' ? isMessageFileName(sourceFile) : isEnumFileName(sourceFile)
    if (!validFileName) {
      setDiagnostics([
        diagnostic(
          'PROTO_FILE_NAME_INVALID',
          editor.kind === 'message'
            ? '테이블 파일명은 {Name}Table.proto 형식이어야 합니다.'
            : 'Enum 파일명은 {Name}EnumType.proto 형식이어야 합니다.'
        )
      ])
      return
    }

    const existingDocument = findWorkspaceDocument(loaded.workspace, sourceFile)
    const document =
      existingDocument ??
      createProtoDocument(
        sourceFile,
        loaded.workspace.documents[0]?.packageName ?? undefined,
        loaded.workspace.documents[0]?.goPackage ?? undefined
      )
    const result =
      editor.kind === 'message'
        ? editor.originalName
          ? updateMessage(document, editor.originalName, editor.draft, loaded.workspace.typeSources)
          : addMessage(document, editor.draft, loaded.workspace.typeSources)
        : editor.originalName
          ? updateEnum(document, editor.originalName, editor.draft)
          : addEnum(document, editor.draft)
    if (!result.success) {
      setDiagnostics(result.diagnostics)
      return
    }

    const impacts =
      editor.originalName && editor.originalName !== editor.draft.name
        ? findReferenceImpacts(loaded.workspace.documents, editor.originalName)
        : []
    const mutation: PendingMutation = {
      title: editor.originalName ? '변경 저장' : '새 선언 저장',
      sourceFile,
      path:
        loaded.pathsBySourceFile.get(sourceFile) ??
        protoPath(loaded.settings.protoRoot, sourceFile),
      source: result.value.source,
      nextSelection: { kind: editor.kind, name: editor.draft.name },
      impacts
    }
    if (impacts.length > 0) setPendingMutation(mutation)
    else void commitMutation(mutation)
  }

  const requestDelete = (): void => {
    if (!loaded || !editor?.originalName) return
    const document = findWorkspaceDocument(loaded.workspace, editor.sourceFile)
    if (!document) return
    const result = deleteDeclaration(document, editor.kind, editor.originalName)
    if (!result.success) {
      setDiagnostics(result.diagnostics)
      return
    }
    setPendingMutation({
      title: `${editor.originalName} 삭제`,
      sourceFile: editor.sourceFile,
      path: loaded.pathsBySourceFile.get(editor.sourceFile) ?? '',
      source: result.value,
      nextSelection: null,
      impacts: findReferenceImpacts(loaded.workspace.documents, editor.originalName)
    })
  }

  const commitMutation = async (requestedMutation?: PendingMutation): Promise<void> => {
    const mutation = requestedMutation ?? pendingMutation
    if (!mutation) return
    setSaving(true)
    setError(null)
    try {
      await nativePort.writeFile(mutation.path, encodeProtoSource(mutation.source))
      const selection = mutation.nextSelection
      const message = `${mutation.sourceFile} 저장 완료`
      setPendingMutation(null)
      setEditor(null)
      await reload(selection)
      setSuccess(message)
    } catch (cause) {
      setError(toNativeError(cause).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="schema-page">
      <div className="schema-toolbar">
        <div>
          <p className="section-eyebrow">Proto workspace</p>
          <h2>{focusKind === 'message' ? '테이블' : focusKind === 'enum' ? 'Enum' : '스키마'}</h2>
        </div>
        <div className="schema-toolbar-actions">
          {focusKind !== 'enum' ? (
            <button className="button button-secondary icon-text-button" onClick={startNewMessage}>
              <FilePlus2 aria-hidden="true" size={16} /> 테이블 추가
            </button>
          ) : null}
          {focusKind !== 'message' ? (
            <button className="button button-secondary icon-text-button" onClick={startNewEnum}>
              <FilePlus2 aria-hidden="true" size={16} /> Enum 추가
            </button>
          ) : null}
          <button
            aria-label="Proto 새로고침"
            className="icon-button"
            disabled={loading}
            onClick={() => void reload(null)}
            title="Proto 새로고침"
          >
            <RefreshCw aria-hidden="true" size={17} />
          </button>
        </div>
      </div>

      {error ? <div className="notice notice-error">{error}</div> : null}
      {success ? <div className="notice notice-success">{success}</div> : null}
      {!loaded?.settings.protoRoot && !loading ? (
        <div className="empty-workspace">
          <p>Proto 루트가 설정되지 않았습니다.</p>
          <button className="button button-primary icon-text-button" onClick={onOpenSettings}>
            <Settings aria-hidden="true" size={16} /> 설정 열기
          </button>
        </div>
      ) : (
        <div className="schema-workbench" aria-busy={loading}>
          <aside className="schema-sidebar" aria-label="Proto 선언 목록">
            <label className="search-control">
              <Search aria-hidden="true" size={16} />
              <input
                aria-label="스키마 검색"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이름 또는 파일 검색"
                value={query}
              />
            </label>
            {focusKind !== 'enum' ? (
              <DeclarationList
                heading="테이블"
                items={messages}
                onSelect={selectMessage}
                selected={editor?.kind === 'message' ? editor.originalName : undefined}
              />
            ) : null}
            {focusKind !== 'message' ? (
              <DeclarationList
                heading="Enum"
                items={enums}
                onSelect={selectEnum}
                selected={editor?.kind === 'enum' ? editor.originalName : undefined}
              />
            ) : null}
            {loaded?.workspace.diagnostics.length ? (
              <div className="workspace-diagnostics">
                <strong>진단 {loaded.workspace.diagnostics.length}</strong>
                {loaded.workspace.diagnostics
                  .slice(0, 5)
                  .map(({ sourceFile, diagnostic }, index) => (
                    <p key={`${sourceFile}-${diagnostic.code}-${index}`}>
                      {sourceFile}: {diagnostic.message}
                    </p>
                  ))}
              </div>
            ) : null}
          </aside>

          <section className="schema-editor" aria-label="Proto 편집기">
            {!editor ? (
              <div className="editor-empty">편집할 테이블 또는 Enum을 선택하세요.</div>
            ) : (
              <fieldset className="schema-editor-fields" disabled={editor.readOnly}>
                {editor.kind === 'message' ? (
                  <MessageEditor editor={editor} knownTypes={knownTypes} onChange={setEditor} />
                ) : (
                  <EnumEditor editor={editor} onChange={setEditor} />
                )}
              </fieldset>
            )}

            {editor?.readOnly ? (
              <div className="notice notice-readonly">
                지원하지 않는 Proto 문법이 포함되어 이 파일은 읽기 전용입니다.
              </div>
            ) : null}

            {diagnostics.length > 0 ? (
              <div className="editor-diagnostics" role="alert">
                {diagnostics.map((entry, index) => (
                  <p key={`${entry.code}-${index}`}>{entry.message}</p>
                ))}
              </div>
            ) : null}

            {editor ? (
              <div className="editor-actions">
                {editor.originalName ? (
                  <button
                    className="button button-danger icon-text-button"
                    disabled={editor.readOnly}
                    onClick={requestDelete}
                  >
                    <Trash2 aria-hidden="true" size={16} /> 삭제
                  </button>
                ) : (
                  <span />
                )}
                <button
                  className="button button-primary icon-text-button"
                  disabled={editor.readOnly || saving}
                  onClick={requestSave}
                >
                  <Save aria-hidden="true" size={16} /> 저장
                </button>
              </div>
            ) : null}
          </section>
        </div>
      )}

      {pendingMutation ? (
        <div className="modal-backdrop" role="presentation">
          <div
            aria-labelledby="impact-title"
            aria-modal="true"
            className="impact-dialog"
            role="dialog"
          >
            <div className="dialog-heading">
              <h3 id="impact-title">{pendingMutation.title}</h3>
              <button
                aria-label="확인 창 닫기"
                className="icon-button"
                onClick={() => setPendingMutation(null)}
                title="닫기"
              >
                <X aria-hidden="true" size={17} />
              </button>
            </div>
            {pendingMutation.impacts.length > 0 ? (
              <div className="impact-list">
                <p>참조 중인 필드 {pendingMutation.impacts.length}개가 영향을 받습니다.</p>
                {pendingMutation.impacts.map((impact) => (
                  <div key={`${impact.sourceFile}-${impact.messageName}-${impact.fieldName}`}>
                    <strong>
                      {impact.messageName}.{impact.fieldName}
                    </strong>
                    <span>{impact.sourceFile}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dialog-copy">참조 영향이 없습니다.</p>
            )}
            <div className="dialog-actions">
              <button className="button button-secondary" onClick={() => setPendingMutation(null)}>
                취소
              </button>
              <button
                className="button button-primary"
                disabled={saving}
                onClick={() => void commitMutation()}
              >
                {saving ? '저장 중' : '계속'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <datalist id="proto-known-types">
        {knownTypes.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
    </main>
  )
}

interface DeclarationListProps {
  heading: string
  items: Array<{ name: string; sourceFile: string; readOnly: boolean }>
  selected?: string
  onSelect: (name: string) => void
}

function DeclarationList({
  heading,
  items,
  selected,
  onSelect
}: DeclarationListProps): React.JSX.Element {
  return (
    <section className="declaration-group">
      <div className="declaration-group-heading">
        <h3>{heading}</h3>
        <span>{items.length}</span>
      </div>
      {items.map((item) => (
        <button
          aria-label={`${item.name} (${item.sourceFile})`}
          className={`declaration-item${selected === item.name ? ' declaration-item-selected' : ''}`}
          key={`${item.sourceFile}-${item.name}`}
          onClick={() => onSelect(item.name)}
        >
          <span>{item.name}</span>
          <small>{item.readOnly ? '읽기 전용' : item.sourceFile}</small>
        </button>
      ))}
      {items.length === 0 ? <p className="empty-row">항목 없음</p> : null}
    </section>
  )
}

function MessageEditor({
  editor,
  knownTypes,
  onChange
}: {
  editor: MessageEditorState
  knownTypes: string[]
  onChange: (editor: EditorState) => void
}): React.JSX.Element {
  const setDraft = (draft: ProtoMessageDraft): void => onChange({ ...editor, draft })
  const updateField = (index: number, patch: Partial<ProtoFieldDraft>): void =>
    setDraft({
      ...editor.draft,
      fields: editor.draft.fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field
      )
    })
  const moveField = (index: number, direction: -1 | 1): void => {
    const target = index + direction
    if (target < 0 || target >= editor.draft.fields.length) return
    const fields = [...editor.draft.fields]
    const [field] = fields.splice(index, 1)
    fields.splice(target, 0, field!)
    setDraft({ ...editor.draft, fields })
  }

  return (
    <>
      <EditorHeader kind="테이블" name={editor.originalName} sourceFile={editor.sourceFile} />
      <div className="editor-metadata">
        <label>
          <span>Message 이름</span>
          <input
            aria-label="Message 이름"
            onChange={(event) => setDraft({ ...editor.draft, name: event.target.value })}
            value={editor.draft.name}
          />
        </label>
        <FileNameField editor={editor} onChange={onChange} />
      </div>
      <div className="field-table" role="table" aria-label="필드 목록">
        <div className="field-table-header" role="row">
          <span>번호</span>
          <span>이름</span>
          <span>타입</span>
          <span>형태</span>
          <span className="key-column-heading">
            키
            <span
              aria-label="키 규칙 도움말"
              className="inline-help"
              title="기본키(@PK)는 참조 행 식별에 사용합니다. 합성키(@Key)는 같은 값의 행들을 배열로 인라인하며 복합 고유키가 아닙니다."
            >
              <CircleHelp aria-hidden="true" size={13} />
            </span>
          </span>
          <span />
        </div>
        {editor.draft.fields.map((field, index) => (
          <div
            className="field-table-row"
            key={`${field.originalName ?? 'new'}-${index}`}
            role="row"
          >
            <span className="field-number">{field.fieldNumber ?? '자동'}</span>
            <input
              aria-label={`필드 ${index + 1} 이름`}
              onChange={(event) => updateField(index, { name: event.target.value })}
              value={field.name}
            />
            <input
              aria-label={`필드 ${index + 1} 타입`}
              list="proto-known-types"
              onChange={(event) => updateField(index, { type: event.target.value })}
              value={field.type}
            />
            <select
              aria-label={`필드 ${index + 1} 형태`}
              onChange={(event) =>
                updateField(index, {
                  label: event.target.value as 'singular' | 'optional' | 'repeated'
                })
              }
              value={field.label ?? 'singular'}
            >
              <option value="singular">단일</option>
              <option value="optional">선택</option>
              <option value="repeated">반복</option>
            </select>
            <select
              aria-label={`필드 ${index + 1} 키`}
              onChange={(event) =>
                updateField(index, {
                  isPrimaryKey: event.target.value === 'primary',
                  isGroupKey: event.target.value === 'group'
                })
              }
              value={field.isPrimaryKey ? 'primary' : field.isGroupKey ? 'group' : 'none'}
            >
              <option value="none">없음</option>
              <option value="primary">기본키</option>
              <option value="group">합성키</option>
            </select>
            <div className="row-tools">
              <IconButton label="필드 위로 이동" onClick={() => moveField(index, -1)}>
                <ArrowUp aria-hidden="true" size={15} />
              </IconButton>
              <IconButton label="필드 아래로 이동" onClick={() => moveField(index, 1)}>
                <ArrowDown aria-hidden="true" size={15} />
              </IconButton>
              <IconButton
                label="필드 삭제"
                onClick={() =>
                  setDraft({
                    ...editor.draft,
                    fields: editor.draft.fields.filter((_, fieldIndex) => fieldIndex !== index)
                  })
                }
              >
                <Trash2 aria-hidden="true" size={15} />
              </IconButton>
            </div>
          </div>
        ))}
      </div>
      <button
        className="button button-secondary icon-text-button add-row-button"
        onClick={() =>
          setDraft({
            ...editor.draft,
            fields: [...editor.draft.fields, { name: '', type: 'string' }]
          })
        }
      >
        <Plus aria-hidden="true" size={16} /> 필드 추가
      </button>
      <datalist id="message-known-types">
        {knownTypes.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
    </>
  )
}

function EnumEditor({
  editor,
  onChange
}: {
  editor: EnumEditorState
  onChange: (editor: EditorState) => void
}): React.JSX.Element {
  const setDraft = (draft: ProtoEnumDraft): void => onChange({ ...editor, draft })
  return (
    <>
      <EditorHeader kind="Enum" name={editor.originalName} sourceFile={editor.sourceFile} />
      <div className="editor-metadata">
        <label>
          <span>Enum 이름</span>
          <input
            aria-label="Enum 이름"
            onChange={(event) => setDraft({ ...editor.draft, name: event.target.value })}
            value={editor.draft.name}
          />
        </label>
        <FileNameField editor={editor} onChange={onChange} />
      </div>
      <div className="enum-auto-values">
        <span>{editor.draft.name || 'Enum'}_NONE = 0</span>
        <span>{editor.draft.name || 'Enum'}_MAX = 자동</span>
      </div>
      <div className="enum-table" role="table" aria-label="Enum 값 목록">
        <div className="enum-table-header" role="row">
          <span>이름</span>
          <span>번호</span>
          <span />
        </div>
        {editor.draft.values.map((value, index) => (
          <div className="enum-table-row" key={index} role="row">
            <input
              aria-label={`Enum 값 ${index + 1} 이름`}
              onChange={(event) =>
                setDraft({
                  ...editor.draft,
                  values: editor.draft.values.map((entry, valueIndex) =>
                    valueIndex === index ? { ...entry, name: event.target.value } : entry
                  )
                })
              }
              value={value.name}
            />
            <input
              aria-label={`Enum 값 ${index + 1} 번호`}
              onChange={(event) =>
                setDraft({
                  ...editor.draft,
                  values: editor.draft.values.map((entry, valueIndex) =>
                    valueIndex === index
                      ? {
                          ...entry,
                          number:
                            event.target.value === '' ? Number.NaN : event.target.valueAsNumber
                        }
                      : entry
                  )
                })
              }
              type="number"
              value={Number.isNaN(value.number) ? '' : value.number}
            />
            <IconButton
              label="Enum 값 삭제"
              onClick={() =>
                setDraft({
                  ...editor.draft,
                  values: editor.draft.values.filter((_, valueIndex) => valueIndex !== index)
                })
              }
            >
              <Trash2 aria-hidden="true" size={15} />
            </IconButton>
          </div>
        ))}
      </div>
      <button
        className="button button-secondary icon-text-button add-row-button"
        onClick={() =>
          setDraft({
            ...editor.draft,
            values: [
              ...editor.draft.values,
              {
                name: `${editor.draft.name || 'VALUE'}_VALUE`,
                number: nextEnumNumber(editor.draft)
              }
            ]
          })
        }
      >
        <Plus aria-hidden="true" size={16} /> 값 추가
      </button>
    </>
  )
}

function FileNameField({
  editor,
  onChange
}: {
  editor: EditorState
  onChange: (editor: EditorState) => void
}): React.JSX.Element {
  return (
    <label>
      <span>파일명</span>
      <input
        aria-label="Proto 파일명"
        onChange={(event) => onChange({ ...editor, sourceFile: event.target.value })}
        placeholder={defaultFileName(editor)}
        readOnly={Boolean(editor.originalName)}
        value={editor.sourceFile}
      />
    </label>
  )
}

function EditorHeader({
  kind,
  name,
  sourceFile
}: {
  kind: string
  name?: string
  sourceFile: string
}): React.JSX.Element {
  return (
    <div className="editor-heading">
      <div>
        <p className="section-eyebrow">{kind}</p>
        <h3>{name ?? `새 ${kind}`}</h3>
      </div>
      {sourceFile ? <span>{sourceFile}</span> : null}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      aria-label={label}
      className="icon-button icon-button-compact"
      onClick={onClick}
      title={label}
    >
      {children}
    </button>
  )
}

function messageEditor(
  declaration: LoadedProtoWorkspace['workspace']['messages'][number],
  readOnly: boolean
): MessageEditorState {
  return {
    kind: 'message',
    sourceFile: declaration.sourceFile,
    originalName: declaration.name,
    readOnly,
    draft: {
      name: declaration.name,
      fields: declaration.fields.map((field) => ({
        originalName: field.name,
        name: field.name,
        type: field.type,
        label: field.label,
        fieldNumber: field.fieldNumber,
        isPrimaryKey: field.isPrimaryKey,
        isGroupKey: field.isGroupKey,
        optionsText: field.optionsText
      }))
    }
  }
}

function enumEditor(
  declaration: LoadedProtoWorkspace['workspace']['enums'][number],
  readOnly: boolean
): EnumEditorState {
  const sentinelNames = new Set([`${declaration.name}_NONE`, `${declaration.name}_MAX`])
  return {
    kind: 'enum',
    sourceFile: declaration.sourceFile,
    originalName: declaration.name,
    readOnly,
    draft: {
      name: declaration.name,
      values: declaration.values
        .filter((value) => !sentinelNames.has(value.name))
        .map(({ name, number }) => ({ name, number }))
    }
  }
}

function defaultFileName(editor: EditorState): string {
  const name = editor.draft.name || (editor.kind === 'message' ? 'New' : 'New')
  return editor.kind === 'message' ? `${name}Table.proto` : `${name}EnumType.proto`
}

function nextEnumNumber(draft: ProtoEnumDraft): number {
  return (
    Math.max(
      0,
      ...draft.values.filter(({ number }) => Number.isFinite(number)).map(({ number }) => number)
    ) + 1
  )
}

function diagnostic(code: string, message: string): ProtoDiagnostic {
  return { code, message, severity: 'error', span: { start: 0, end: 0 } }
}
