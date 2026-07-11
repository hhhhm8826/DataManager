import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addEnum,
  addMessage,
  buildProtoFileName,
  createMemoColumnId,
  createProtoDocument,
  defaultProtoFileStem,
  deleteDeclaration,
  findReferenceImpacts,
  findWorkspaceDocument,
  formatDiagnosticMessage,
  normalizeTableMetadataKey,
  normalizeProtoFileStem,
  toNativeError,
  updateEnum,
  updateMessage,
  validateMemoColumnName,
  validatePrimaryKeyDraftPolicy,
  type MemoColumn,
  type PrimaryKeyTypePolicy,
  type ProtoDiagnostic,
  type ProtoEnumDraft,
  type ProtoFieldDraft,
  type ProtoMessageDraft,
  type ProtoMemoDraft,
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
import type { ProtoMetadataMutation } from '../../adapters/native/NativePort'
import { useWorkspaceMetadataStore } from '../projectMetadata/workspaceMetadataStore'
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
  fileStem: string
  fileStemEdited: boolean
  originalName?: string
  readOnly: boolean
  draft: ProtoMessageDraft
}

interface EnumEditorState {
  kind: 'enum'
  sourceFile: string
  fileStem: string
  fileStemEdited: boolean
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
  metadataMutation?: ProtoMetadataMutation
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
  const metadata = useWorkspaceMetadataStore((state) => state.metadata)

  const reload = useCallback(
    async (selection?: { kind: 'message' | 'enum'; name: string } | null): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const next = await loadProtoWorkspace(nativePort)
        if (next.settings.protoRoot) {
          await useWorkspaceMetadataStore.getState().load(nativePort, next.settings.protoRoot)
        }
        setLoaded(next)
        if (selection) {
          if (selection.kind === 'message') {
            const declaration = next.workspace.messages.find(({ name }) => name === selection.name)
            const document = declaration
              ? findWorkspaceDocument(next.workspace, declaration.sourceFile)
              : undefined
            const currentMetadata = useWorkspaceMetadataStore.getState().metadata
            setEditor(
              declaration
                ? messageEditor(
                    declaration,
                    document?.readOnly ?? false,
                    legacyMemoColumnsForDeclaration(currentMetadata.tables, declaration)
                  )
                : null
            )
          } else {
            const declaration = next.workspace.enums.find(({ name }) => name === selection.name)
            const document = declaration
              ? findWorkspaceDocument(next.workspace, declaration.sourceFile)
              : undefined
            setEditor(declaration ? enumEditor(declaration, document?.readOnly ?? false) : null)
          }
        }
      } catch (cause) {
        setError(formatDiagnosticMessage(toNativeError(cause)))
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
    if (declaration) {
      setEditor(
        messageEditor(
          declaration,
          document?.readOnly ?? false,
          legacyMemoColumnsForDeclaration(metadata.tables, declaration)
        )
      )
    }
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
      fileStem: '',
      fileStemEdited: false,
      readOnly: false,
      draft: {
        name: '',
        fields: [{ name: 'id', type: 'int32', isPrimaryKey: true, order: 0 }],
        memos: []
      }
    })
    setDiagnostics([])
    setSuccess(null)
  }

  const startNewEnum = (): void => {
    setEditor({
      kind: 'enum',
      sourceFile: '',
      fileStem: '',
      fileStemEdited: false,
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

    if (editor.kind === 'message') {
      const policyViolations = validatePrimaryKeyDraftPolicy(
        loaded.workspace,
        metadata.primaryKeyTypePolicy,
        editor.sourceFile || `${currentFileStem(editor)}.proto`,
        editor.draft.name,
        editor.draft.fields
      )
      if (policyViolations.length > 0) {
        setDiagnostics(
          policyViolations.map((violation) => ({
            ...violation,
            severity: 'error' as const,
            span: { start: 0, end: 0 }
          }))
        )
        return
      }
    }

    const fileNameResult = editor.originalName
      ? { success: true as const, value: editor.sourceFile }
      : buildProtoFileName(editor.kind, currentFileStem(editor))
    if (!fileNameResult.success) {
      setDiagnostics(fileNameResult.diagnostics)
      return
    }
    let sourceFile = fileNameResult.value
    const caseInsensitiveDocument = loaded.workspace.documents.find(
      (document) => document.sourceFile.toLocaleLowerCase() === sourceFile.toLocaleLowerCase()
    )
    if (caseInsensitiveDocument && caseInsensitiveDocument.sourceFile !== sourceFile) {
      setDiagnostics([
        diagnostic(
          'PROTO_FILE_NAME_CASE_CONFLICT',
          `File '${sourceFile}' conflicts with '${caseInsensitiveDocument.sourceFile}'.`
        )
      ])
      return
    }
    if (caseInsensitiveDocument) sourceFile = caseInsensitiveDocument.sourceFile

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
    if (editor.kind === 'message' && editor.originalName) {
      mutation.metadataMutation = {
        oldKey: normalizeTableMetadataKey(editor.sourceFile, editor.originalName),
        newKey: null
      }
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
    const mutation: PendingMutation = {
      title: `${editor.originalName} 삭제`,
      sourceFile: editor.sourceFile,
      path: loaded.pathsBySourceFile.get(editor.sourceFile) ?? '',
      source: result.value,
      nextSelection: null,
      impacts: findReferenceImpacts(loaded.workspace.documents, editor.originalName)
    }
    if (editor.kind === 'message') {
      mutation.metadataMutation = {
        oldKey: normalizeTableMetadataKey(editor.sourceFile, editor.originalName),
        newKey: null
      }
    }
    setPendingMutation(mutation)
  }

  const commitMutation = async (requestedMutation?: PendingMutation): Promise<void> => {
    const mutation = requestedMutation ?? pendingMutation
    if (!mutation) return
    setSaving(true)
    setError(null)
    try {
      const contents = encodeProtoSource(mutation.source)
      if (mutation.metadataMutation && loaded) {
        const metadata = await nativePort.loadWorkspaceMetadata()
        await nativePort.writeProtoWithMetadata({
          sourceFile: mutation.sourceFile,
          contents,
          expectedRevision: metadata.revision,
          mutation: mutation.metadataMutation
        })
        await useWorkspaceMetadataStore.getState().load(nativePort, loaded.settings.protoRoot)
      } else {
        await nativePort.writeFile(mutation.path, contents)
      }
      const selection = mutation.nextSelection
      const message = `${mutation.sourceFile} 저장 완료`
      setPendingMutation(null)
      setEditor(null)
      await reload(selection)
      setSuccess(message)
    } catch (cause) {
      setError(formatDiagnosticMessage(toNativeError(cause)))
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
                      {sourceFile}: {formatDiagnosticMessage(diagnostic)}
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
                  <MessageEditor
                    editor={editor}
                    knownTypes={knownTypes}
                    onChange={setEditor}
                    policy={metadata.primaryKeyTypePolicy}
                    workspace={loaded!.workspace}
                  />
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
                  <p key={`${entry.code}-${index}`}>{formatDiagnosticMessage(entry)}</p>
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
  onChange,
  policy,
  workspace
}: {
  editor: MessageEditorState
  knownTypes: string[]
  onChange: (editor: EditorState) => void
  policy: PrimaryKeyTypePolicy
  workspace: LoadedProtoWorkspace['workspace']
}): React.JSX.Element {
  const [keyHelpOpen, setKeyHelpOpen] = useState(false)
  const keyHelpButton = useRef<HTMLButtonElement>(null)
  const keyHelpDialog = useRef<HTMLDivElement>(null)
  const setDraft = (draft: ProtoMessageDraft): void => onChange({ ...editor, draft })
  const updateField = (index: number, patch: Partial<ProtoFieldDraft>): void =>
    setDraft({
      ...editor.draft,
      fields: editor.draft.fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field
      )
    })
  const draftMemos: ProtoMemoDraft[] = editor.draft.memos ?? []
  const members = [
    ...editor.draft.fields.map((field, index) => ({
      kind: 'field' as const,
      index,
      order: field.order ?? index
    })),
    ...draftMemos.map((memo, index) => ({ kind: 'memo' as const, index, order: memo.order }))
  ].sort((left, right) => left.order - right.order)
  const nextMemberOrder = Math.max(-1, ...members.map(({ order }) => order)) + 1
  const applyMemberOrder = (ordered: Array<{ kind: 'field' | 'memo'; index: number }>): void => {
    const fieldOrders = new Map<number, number>()
    const memoOrders = new Map<number, number>()
    ordered.forEach((member, order) =>
      member.kind === 'field'
        ? fieldOrders.set(member.index, order)
        : memoOrders.set(member.index, order)
    )
    setDraft({
      ...editor.draft,
      fields: editor.draft.fields.map((field, index) => ({
        ...field,
        order: fieldOrders.get(index)!
      })),
      memos: draftMemos.map((memo, index) => ({ ...memo, order: memoOrders.get(index)! }))
    })
  }
  const moveMember = (memberIndex: number, direction: -1 | 1): void => {
    const target = memberIndex + direction
    if (target < 0 || target >= members.length) return
    const ordered = members.map(({ kind, index }) => ({ kind, index }))
    const [member] = ordered.splice(memberIndex, 1)
    ordered.splice(target, 0, member!)
    applyMemberOrder(ordered)
  }
  const closeKeyHelp = useCallback((): void => {
    setKeyHelpOpen(false)
    window.setTimeout(() => keyHelpButton.current?.focus(), 0)
  }, [])
  useEffect(() => {
    if (!keyHelpOpen) return
    keyHelpDialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeKeyHelp()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [closeKeyHelp, keyHelpOpen])

  const policyViolations = validatePrimaryKeyDraftPolicy(
    workspace,
    policy,
    editor.sourceFile || `${currentFileStem(editor)}.proto`,
    editor.draft.name,
    editor.draft.fields
  )
  const violationByField = new Map(
    policyViolations.map((violation) => [violation.fieldName, violation])
  )
  const hasSelfReference = editor.draft.fields.some(
    (field) => unqualifiedTypeName(field.type) === editor.draft.name && editor.draft.name.length > 0
  )
  const addMemo = (): void => {
    let suffix = 1
    let candidate = '메모'
    while (
      !validateMemoColumnName(
        candidate,
        editor.draft.fields.map(({ name }) => name),
        draftMemos
      ).success
    ) {
      suffix += 1
      candidate = `메모 ${suffix}`
    }
    setDraft({
      ...editor.draft,
      fields: editor.draft.fields.map((field, index) => ({
        ...field,
        order: field.order ?? index
      })),
      memos: [...draftMemos, { id: createMemoColumnId(), name: candidate, order: nextMemberOrder }]
    })
  }

  return (
    <>
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
          <span className="key-column-heading">
            키
            <button
              aria-label="키 규칙 도움말"
              aria-haspopup="dialog"
              className="key-help-button"
              onClick={() => setKeyHelpOpen(true)}
              ref={keyHelpButton}
              title="키 규칙 도움말"
              type="button"
            >
              <CircleHelp aria-hidden="true" size={19} />
            </button>
          </span>
          <span />
        </div>
        {members.map((member, memberIndex) => {
          if (member.kind === 'memo') {
            const memo = draftMemos[member.index]!
            return (
              <div className="field-table-row memo-field-row" key={memo.id} role="row">
                <span className="field-number">메모</span>
                <input
                  aria-label={`메모 ${member.index + 1} 이름`}
                  onChange={(event) =>
                    setDraft({
                      ...editor.draft,
                      memos: draftMemos.map((entry, index) =>
                        index === member.index ? { ...entry, name: event.target.value } : entry
                      )
                    })
                  }
                  value={memo.name}
                />
                <span className="memo-badge">Excel 전용</span>
                <span className="memo-not-applicable">JSON·코드 제외</span>
                <div className="row-tools">
                  <IconButton label="메모 위로 이동" onClick={() => moveMember(memberIndex, -1)}>
                    <ArrowUp aria-hidden="true" size={15} />
                  </IconButton>
                  <IconButton label="메모 아래로 이동" onClick={() => moveMember(memberIndex, 1)}>
                    <ArrowDown aria-hidden="true" size={15} />
                  </IconButton>
                  <IconButton
                    label="메모 삭제"
                    onClick={() =>
                      setDraft({
                        ...editor.draft,
                        memos: draftMemos.filter((_, index) => index !== member.index)
                      })
                    }
                  >
                    <Trash2 aria-hidden="true" size={15} />
                  </IconButton>
                </div>
              </div>
            )
          }
          const field = editor.draft.fields[member.index]!
          return (
            <div
              className="field-table-row"
              key={`${field.originalName ?? 'new'}-${member.index}`}
              role="row"
            >
              <span className="field-number">{field.fieldNumber ?? '자동'}</span>
              <input
                aria-label={`필드 ${member.index + 1} 이름`}
                onChange={(event) => updateField(member.index, { name: event.target.value })}
                value={field.name}
              />
              <input
                aria-label={`필드 ${member.index + 1} 타입`}
                list="message-known-types"
                onChange={(event) => updateField(member.index, { type: event.target.value })}
                value={field.type}
              />
              <select
                aria-label={`필드 ${member.index + 1} 키`}
                aria-invalid={violationByField.has(field.name)}
                onChange={(event) =>
                  updateField(member.index, {
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
                <IconButton label="필드 위로 이동" onClick={() => moveMember(memberIndex, -1)}>
                  <ArrowUp aria-hidden="true" size={15} />
                </IconButton>
                <IconButton label="필드 아래로 이동" onClick={() => moveMember(memberIndex, 1)}>
                  <ArrowDown aria-hidden="true" size={15} />
                </IconButton>
                <IconButton
                  label="필드 삭제"
                  onClick={() =>
                    setDraft({
                      ...editor.draft,
                      fields: editor.draft.fields.filter(
                        (_, fieldIndex) => fieldIndex !== member.index
                      )
                    })
                  }
                >
                  <Trash2 aria-hidden="true" size={15} />
                </IconButton>
              </div>
              {violationByField.has(field.name) ? (
                <p className="field-inline-error">
                  {field.name || `필드 ${member.index + 1}`}의 {field.type || '빈 타입'}은 현재
                  기본키 정책에 맞지 않습니다.
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="add-row-actions">
        <button
          className="button button-secondary icon-text-button add-row-button"
          onClick={() =>
            setDraft({
              ...editor.draft,
              fields: [
                ...editor.draft.fields,
                { name: '', type: 'string', order: nextMemberOrder }
              ],
              memos: draftMemos
            })
          }
        >
          <Plus aria-hidden="true" size={16} /> 데이터 칼럼 추가
        </button>
        <button
          className="button button-secondary icon-text-button add-row-button"
          onClick={addMemo}
          type="button"
        >
          <Plus aria-hidden="true" size={16} /> Excel 메모 칼럼 추가
        </button>
      </div>
      {hasSelfReference ? (
        <div className="self-reference-help">
          <strong>현재 테이블 참조</strong>
          <p>
            조직도 상위 구성원이나 카테고리 부모처럼 같은 Excel 시트의 키 값을 입력합니다. 빈 값은
            최상위 항목으로 사용할 수 있고, 실제 행 순환이 생기면 JSON 생성이 중단됩니다.
          </p>
        </div>
      ) : null}
      <datalist id="message-known-types">
        {editor.draft.name ? <option label="현재 테이블" value={editor.draft.name} /> : null}
        {knownTypes
          .filter((type) => type !== editor.draft.name)
          .map((type) => (
            <option key={type} value={type} />
          ))}
      </datalist>
      {keyHelpOpen ? <KeyHelpDialog dialogRef={keyHelpDialog} onClose={closeKeyHelp} /> : null}
    </>
  )
}

function KeyHelpDialog({
  dialogRef,
  onClose
}: {
  dialogRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
}): React.JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="key-help-title"
        aria-modal="true"
        className="impact-dialog key-help-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <div className="dialog-heading">
          <h3 id="key-help-title">테이블 키 사용 기준</h3>
          <button
            aria-label="키 규칙 도움말 닫기"
            className="icon-button"
            onClick={onClose}
            title="닫기"
            type="button"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </div>
        <div className="key-help-content">
          <section>
            <h4>기본키</h4>
            <p>한 행을 구분하는 값이며 비워 둘 수 없습니다.</p>
            <pre>{`Excel: ItemId = 1001\nJSON: { "ItemId": 1001 }`}</pre>
          </section>
          <section>
            <h4>여러 기본키</h4>
            <p>여러 칼럼 값의 조합으로 행 중복을 검사합니다.</p>
            <pre>{`Excel: Region = 1, ItemId = 1001\nJSON: { "Region": 1, "ItemId": 1001 }`}</pre>
          </section>
          <section>
            <h4>합성키</h4>
            <p>
              같은 키 값을 가진 여러 행을 한 묶음으로 참조하며 JSON 결과는 배열입니다. 일반
              데이터베이스의 여러 칼럼으로 만든 복합 고유키가 아니라 기존 그룹 키입니다.
            </p>
            <pre>{`Excel: GroupId = 10 (3개 행)\nJSON: { "items": [{...}, {...}, {...}] }`}</pre>
          </section>
          <section>
            <h4>호환 주의</h4>
            <p>
              한 테이블에서 기본키와 합성키를 함께 사용할 수 없습니다. 여러 기본키를 다른 테이블에서
              참조할 때는 첫 번째 기본키 값으로 행을 찾고, 같은 값의 행들을 배열로 출력합니다.
            </p>
            <pre>{`대상 Excel: Region = 1, ItemId = 1001 / 1002\n참조 Excel: RegionRef = 1\nJSON: { "RegionRef": [{ "ItemId": 1001 }, { "ItemId": 1002 }] }`}</pre>
          </section>
          <p className="key-help-annotation">호환 표기: 기본키 @PK, 합성키 @Key</p>
        </div>
        <div className="dialog-actions">
          <button className="button button-primary" onClick={onClose} type="button">
            확인
          </button>
        </div>
      </div>
    </div>
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
    <label className="file-name-field">
      <span>파일명</span>
      <div className="file-name-input">
        <input
          aria-label="Proto 파일명"
          onChange={(event) => {
            const fileStem = normalizeProtoFileStem(event.target.value)
            onChange({
              ...editor,
              fileStem,
              fileStemEdited: true
            })
          }}
          onBlur={() => {
            if (!editor.fileStem) onChange({ ...editor, fileStemEdited: false })
          }}
          placeholder={defaultProtoFileStem(editor.kind, editor.draft.name)}
          readOnly={Boolean(editor.originalName)}
          value={currentFileStem(editor)}
        />
        <span aria-hidden="true" className="file-name-suffix">
          .proto
        </span>
      </div>
    </label>
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
  readOnly: boolean,
  legacyMemoColumns: readonly MemoColumn[] = []
): MessageEditorState {
  const memos =
    declaration.memos.length > 0
      ? declaration.memos.map(({ id, name, order }) => ({ id, name, order }))
      : legacyMemoColumns.map(({ id, name }, index) => ({
          id,
          name,
          order: declaration.fields.length + index
        }))
  return {
    kind: 'message',
    sourceFile: declaration.sourceFile,
    fileStem: normalizeProtoFileStem(declaration.sourceFile),
    fileStemEdited: true,
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
        optionsText: field.optionsText,
        order: field.order
      })),
      memos
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
    fileStem: normalizeProtoFileStem(declaration.sourceFile),
    fileStemEdited: true,
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

function currentFileStem(editor: EditorState): string {
  return editor.fileStemEdited
    ? editor.fileStem
    : defaultProtoFileStem(editor.kind, editor.draft.name)
}

function unqualifiedTypeName(type: string): string {
  return type.replace(/^\./, '').split('.').at(-1) ?? type
}

function legacyMemoColumnsForDeclaration(
  tables: Readonly<Record<string, { memoColumns: MemoColumn[] }>>,
  declaration: LoadedProtoWorkspace['workspace']['messages'][number]
): MemoColumn[] {
  const key = normalizeTableMetadataKey(declaration.sourceFile, declaration.name)
  return [...(tables[key]?.memoColumns ?? [])].sort((left, right) => left.order - right.order)
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
