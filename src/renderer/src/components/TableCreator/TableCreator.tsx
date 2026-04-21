import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '../../store/appStore'
import { IPC } from '../../../../shared/ipc-channels'
import { ipcInvoke } from '../../hooks/useIpc'
import type { ProtoMessage, ProtoField, ProtoEnum } from '../../../../shared/types'

const PRIMITIVE_TYPES = [
  'string',
  'int32',
  'int64',
  'uint32',
  'uint64',
  'float',
  'double',
  'bool',
  'bytes'
]

const stripProto = (f: string): string => f.replace(/\.proto$/i, '')

interface FieldDraft {
  name: string
  type: string
  typeCategory: string // 'primitive' | sourceFile
  fieldNumber: number
  isPk: boolean
  isKey: boolean
  isRepeated: boolean
}

function getTypeCategory(type: string, allEnums: ProtoEnum[], allMessages: ProtoMessage[]): string {
  if (PRIMITIVE_TYPES.includes(type)) return 'primitive'
  const enumDef = allEnums.find((e) => e.name === type)
  if (enumDef) return enumDef.sourceFile
  const msgDef = allMessages.find((m) => m.name === type)
  if (msgDef) return msgDef.sourceFile
  return 'primitive'
}

function makeField(index: number): FieldDraft {
  return {
    name: '',
    type: 'int32',
    typeCategory: 'primitive',
    fieldNumber: index + 1,
    isPk: false,
    isKey: false,
    isRepeated: false
  }
}

function messageToDrafts(
  msg: ProtoMessage,
  allEnums: ProtoEnum[],
  allMessages: ProtoMessage[]
): FieldDraft[] {
  return msg.fields.map((f) => ({
    name: f.name,
    type: f.type,
    typeCategory: getTypeCategory(f.type, allEnums, allMessages),
    fieldNumber: f.fieldNumber,
    isPk: f.isPk,
    isKey: f.isKey,
    isRepeated: f.isRepeated
  }))
}

type Mode = 'list' | 'add' | 'edit'

export function TableCreator(): React.JSX.Element {
  const { parsed, loadProto } = useAppStore()
  const [mode, setMode] = useState<Mode>('list')
  const [editTarget, setEditTarget] = useState<ProtoMessage | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState<ProtoMessage | null>(null)
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())

  const toggleExpand = (key: string): void =>
    setExpandedTables((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  // 폼 상태
  const [tableName, setTableName] = useState('')
  const [protoFileName, setProtoFileName] = useState('')
  const [newProtoFileName, setNewProtoFileName] = useState('')
  const [fields, setFields] = useState<FieldDraft[]>([makeField(0)])
  const [saving, setSaving] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  const allMessages = parsed?.messages ?? []
  const allEnums = parsed?.enums ?? []

  // 타입 선택용 파일 목록: 테이블 파일과 Enum 파일 구분
  const tableSourceFiles = [...new Set(allMessages.map((m) => m.sourceFile))].sort()
  const enumSourceFiles = [...new Set(allEnums.map((e) => e.sourceFile))].sort()

  // 카테고리(소스파일)에 따른 타입 목록 반환, 자기 자신 테이블 제외
  const getTypesForCategory = (category: string): string[] => {
    if (category === 'primitive') return PRIMITIVE_TYPES
    const selfName = tableName.trim()
    const msgs = allMessages
      .filter((m) => m.sourceFile === category && m.name !== selfName)
      .map((m) => m.name)
    const enums = allEnums.filter((e) => e.sourceFile === category).map((e) => e.name)
    return [...msgs, ...enums]
  }

  const existingProtoFiles = parsed ? [...new Set(parsed.messages.map((m) => m.sourceFile))] : []

  // 이름만 입력하면 {Name}Table.proto 형식으로 자동 변환
  const buildTableFileName = (raw: string): string => {
    let name = raw.trim().replace(/\.proto$/i, '')
    if (!name) return ''
    if (!name.endsWith('Table')) name += 'Table'
    return name + '.proto'
  }

  const resolvedProtoFile = buildTableFileName(newProtoFileName) || protoFileName

  // 검색 필터링 후 proto 파일별 메시지 그룹
  const q = searchQuery.trim().toLowerCase()
  const filteredMessages = parsed
    ? parsed.messages.filter(
        (m) => !q || m.name.toLowerCase().includes(q) || m.sourceFile.toLowerCase().includes(q)
      )
    : []

  const protoGroups = Array.from(
    filteredMessages.reduce((map, msg) => {
      if (!map.has(msg.sourceFile)) map.set(msg.sourceFile, [])
      map.get(msg.sourceFile)!.push(msg)
      return map
    }, new Map<string, ProtoMessage[]>())
  )

  const resetForm = useCallback((): void => {
    setTableName('')
    setProtoFileName('')
    setNewProtoFileName('')
    setFields([makeField(0)])
    setEditTarget(null)
  }, [])

  const openAdd = (): void => {
    resetForm()
    setMode('add')
  }

  const openEdit = (msg: ProtoMessage): void => {
    setEditTarget(msg)
    setTableName(msg.name)
    setProtoFileName(msg.sourceFile)
    setNewProtoFileName('')
    setFields(messageToDrafts(msg, allEnums, parsed?.messages ?? []))
    setMode('edit')
  }

  const addField = (): void => setFields((prev) => [...prev, makeField(prev.length)])
  const removeField = (i: number): void => setFields((prev) => prev.filter((_, idx) => idx !== i))
  const updateField = (i: number, patch: Partial<FieldDraft>): void =>
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  const moveField = (i: number, dir: -1 | 1): void =>
    setFields((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const handleDelete = async (msg: ProtoMessage): Promise<void> => {
    const result = await ipcInvoke(IPC.PROTO_DELETE_MESSAGE, {
      sourceFile: msg.sourceFile,
      messageName: msg.name
    })
    if (result.success) {
      toast.success(`'${msg.name}' 이 삭제되었습니다.`)
      setConfirmDeleteMsg(null)
      resetForm()
      setMode('list')
      await loadProto()
    } else {
      toast.error(result.error ?? '삭제 실패')
    }
  }

  const handleSubmit = async (): Promise<void> => {
    const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    if (!tableName.trim()) {
      toast.error('테이블 이름을 입력하세요.')
      return
    }
    if (!IDENT_RE.test(tableName.trim())) {
      toast.error(
        `테이블 이름 '​${tableName.trim()}'은 유효하지 않습니다. (\uc601문자/언더스코어로 시작, 영문자/숫자/언더스코어만 허용)`
      )
      return
    }
    if (!resolvedProtoFile) {
      toast.error('저장할 proto 파일을 선택하거나 입력하세요.')
      return
    }
    if (fields.some((f) => !f.name.trim())) {
      toast.error('모든 필드 이름을 입력하세요.')
      return
    }
    const invalidFields = fields.filter((f) => f.name.trim() && !IDENT_RE.test(f.name.trim()))
    if (invalidFields.length > 0) {
      toast.error(
        `유효하지 않은 필드 이름: ${invalidFields.map((f) => `'​${f.name}'`).join(', ')}\n(영문자/언더스코어로 시작, 영문자/숫자/언더스코어만 허용)`
      )
      return
    }

    setSaving(true)
    const hasPk = fields.some((f) => f.isPk)
    const hasKey = fields.some((f) => f.isKey)
    if (hasPk && hasKey) {
      toast.error('PK와 Key는 동시에 사용할 수 없습니다. 하나만 선택하세요.')
      setSaving(false)
      return
    }
    const message: ProtoMessage = {
      name: tableName.trim(),
      fields: fields.map((f, idx): ProtoField => ({ ...f, fieldNumber: idx + 1, comment: '' })),
      pkFields: fields.filter((f) => f.isPk).map((f) => f.name),
      keyFields: fields.filter((f) => f.isKey).map((f) => f.name),
      sourceFile: resolvedProtoFile
    }

    const result =
      mode === 'edit' && editTarget
        ? await ipcInvoke(IPC.PROTO_UPDATE_MESSAGE, {
            sourceFile: editTarget.sourceFile,
            oldName: editTarget.name,
            message
          })
        : await ipcInvoke(IPC.PROTO_ADD_MESSAGE, message)
    setSaving(false)

    if (result.success) {
      toast.success(
        mode === 'edit'
          ? `'${tableName}' 이 수정되었습니다.`
          : `'${tableName}' 이 ${resolvedProtoFile} 에 추가되었습니다.`
      )
      resetForm()
      setMode('list')
      await loadProto()
    } else {
      toast.error(result.error ?? '저장 실패')
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <span className="page-title">테이블</span>
        {mode === 'list' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="테이블 / 파일 검색..."
                style={{
                  background: '#16213e',
                  border: '1px solid #0f3460',
                  borderRadius: 6,
                  color: '#e0e0e0',
                  padding: '5px 28px 5px 10px',
                  fontSize: 13,
                  width: 200,
                  outline: 'none'
                }}
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: 6,
                    background: 'none',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: 0,
                    lineHeight: 1
                  }}
                >
                  ✕
                </button>
              ) : (
                <span
                  style={{
                    position: 'absolute',
                    right: 8,
                    color: '#4b5563',
                    fontSize: 13,
                    pointerEvents: 'none'
                  }}
                >
                  🔍
                </span>
              )}
            </div>
            <button className="btn btn-success" onClick={openAdd}>
              + 테이블 추가
            </button>
          </div>
        ) : (
          <button
            className="btn btn-ghost"
            style={{ marginLeft: 'auto' }}
            onClick={() => {
              resetForm()
              setMode('list')
            }}
          >
            ← 목록으로
          </button>
        )}
      </div>
      <div className="page-body">
        {/* ── 가이드 모달 ── */}
        {showGuide && (
          <div className="modal-overlay" onClick={() => setShowGuide(false)}>
            <div
              className="modal-box"
              style={{ maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <span className="modal-title">📖 타입 가이드</span>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '2px 8px' }}
                  onClick={() => setShowGuide(false)}
                >
                  ✕
                </button>
              </div>

              <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.8 }}>
                <p style={{ color: '#a0c4ff', fontWeight: 600, marginBottom: 6 }}>기본 타입</p>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginBottom: 16,
                    border: '1px solid #1f2937',
                    borderRadius: 6,
                    overflow: 'hidden'
                  }}
                >
                  <thead>
                    <tr style={{ background: '#1f2937' }}>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '7px 12px',
                          color: '#a0c4ff',
                          fontWeight: 600,
                          fontSize: 12
                        }}
                      >
                        타입
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '7px 12px',
                          color: '#a0c4ff',
                          fontWeight: 600,
                          fontSize: 12
                        }}
                      >
                        설명
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '7px 12px',
                          color: '#a0c4ff',
                          fontWeight: 600,
                          fontSize: 12
                        }}
                      >
                        범위
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ['string', '문자열', '—'],
                        ['int32', '32비트 정수', '-2,147,483,648 ~ 2,147,483,647'],
                        [
                          'int64',
                          '64비트 정수',
                          '-9,223,372,036,854,775,808 ~ 9,223,372,036,854,775,807'
                        ],
                        ['uint32', '32비트 부호없는 정수', '0 ~ 4,294,967,295'],
                        ['uint64', '64비트 부호없는 정수', '0 ~ 18,446,744,073,709,551,615'],
                        ['float', '32비트 부동소수점', '약 ±3.4 × 10³⁸ (소수점 7자리)'],
                        ['double', '64비트 부동소수점', '약 ±1.8 × 10³⁰⁸ (소수점 15자리)'],
                        ['bool', '참/거짓', 'true / false'],
                        ['bytes', '바이트 배열', '—']
                      ] as [string, string, string][]
                    ).map(([t, desc, range], idx) => (
                      <tr
                        key={t}
                        style={{
                          background: idx % 2 === 0 ? '#111827' : '#0d1520',
                          borderBottom: '1px solid #1f2937'
                        }}
                      >
                        <td
                          style={{
                            padding: '6px 12px',
                            color: '#6fcf97',
                            fontFamily: 'monospace',
                            fontWeight: 600
                          }}
                        >
                          {t}
                        </td>
                        <td style={{ padding: '6px 12px', color: '#e0e0e0' }}>{desc}</td>
                        <td style={{ padding: '6px 12px', fontSize: 12, color: '#9ca3af' }}>
                          {range}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <br />
                <p style={{ color: '#a0c4ff', fontWeight: 600, marginBottom: 6 }}>테이블 참조</p>
                <p style={{ marginBottom: 8 }}>
                  다른 테이블의 메시지를 필드 타입으로 사용할 수 있습니다.\n 타입 선택 시{' '}
                  <strong style={{ color: '#e0e0e0' }}>기본 타입</strong> 대신 참조할 proto 파일을
                  선택하면, 해당 파일에 정의된 테이블/Enum 목록이 표시됩니다.
                </p>
                <div
                  style={{
                    background: '#111827',
                    borderRadius: 6,
                    padding: '10px 14px',
                    fontSize: 12,
                    color: '#9ca3af',
                    marginBottom: 8
                  }}
                >
                  <div style={{ marginBottom: 4 }}>
                    예시: <span style={{ color: '#a0c4ff' }}>ItemTable.proto</span> 에 정의된{' '}
                    <span style={{ color: '#e0e0e0' }}>ItemTable</span> 을 참조
                  </div>
                  <div>
                    ① 카테고리 선택 → <span style={{ color: '#6fcf97' }}>ItemTable.proto</span>
                  </div>
                  <div>
                    ② 타입 선택 → <span style={{ color: '#6fcf97' }}>ItemTable</span>
                  </div>
                </div>
                <p style={{ fontSize: 12 }}>
                  참조된 필드는 Excel에서 해당 테이블의 PK/Key 값을 드롭다운으로 선택할 수 있게
                  연결됩니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── PK / Key 설명 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '2px 8px', fontSize: 15, flexShrink: 0 }}
            onClick={() => setShowGuide(true)}
            title="타입 가이드 보기"
          >
            ❓ 가이드
          </button>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9ca3af' }}>
            <span>
              <span style={{ color: '#f0c040', fontWeight: 600 }}>PK</span> — Primary Key. 행을
              고유하게 식별하는 컬럼. 2개 이상이면 Composite Key로 동작합니다.
            </span>
            <span style={{ color: '#4b5563' }}>|</span>
            <span>
              <span style={{ color: '#4dbb88', fontWeight: 600 }}>Key</span> — 같은 Key 값을 가진
              행들을 배열로 묶어 그룹으로 사용합니다.
            </span>
          </div>
        </div>

        {/* ── 목록 뷰 ── */}
        {mode === 'list' &&
          (protoGroups.length === 0 ? (
            <div className="card">
              <p className="empty-state">
                {q
                  ? `'${searchQuery}' 에 해당하는 테이블이 없습니다.`
                  : '등록된 테이블이 없습니다. proto 디렉토리를 설정하거나 테이블을 추가하세요.'}
              </p>
            </div>
          ) : (
            protoGroups.map(([protoFile, msgs]) => (
              <div className="card" key={protoFile}>
                <div className="card-title" style={{ color: '#a0c4ff', fontSize: 13 }}>
                  {stripProto(protoFile)}
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '35%' }}>테이블 이름</th>
                      <th>PK / Key</th>
                      <th style={{ width: '20%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {msgs.map((msg) => {
                      const expandKey = `${protoFile}::${msg.name}`
                      const isExpanded = expandedTables.has(expandKey)
                      return (
                        <>
                          <tr key={msg.name}>
                            <td
                              style={{ cursor: 'pointer', userSelect: 'none' }}
                              onClick={() => toggleExpand(expandKey)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, color: '#6b7280', minWidth: 10 }}>
                                  {isExpanded ? '▼' : '▶'}
                                </span>
                                <span>{msg.name}</span>
                              </div>
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {msg.pkFields.length > 0 && (
                                <span style={{ color: '#f0c040' }}>
                                  PK: {msg.pkFields.join(', ')}
                                </span>
                              )}
                              {msg.keyFields && msg.keyFields.length > 0 && (
                                <span style={{ color: '#4dbb88' }}>
                                  Key: {msg.keyFields.join(', ')}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                                <button
                                  className="btn btn-ghost"
                                  style={{ padding: '3px 10px', fontSize: 12 }}
                                  onClick={() => openEdit(msg)}
                                >
                                  ✏️ 수정
                                </button>
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '3px 10px', fontSize: 12 }}
                                  onClick={() => setConfirmDeleteMsg(msg)}
                                >
                                  🗑 삭제
                                </button>
                              </div>
                            </td>
                          </tr>
                          {confirmDeleteMsg?.name === msg.name &&
                            confirmDeleteMsg?.sourceFile === msg.sourceFile && (
                              <tr key={`${msg.name}__confirm`}>
                                <td
                                  colSpan={3}
                                  style={{ background: '#2d1515', padding: '8px 12px' }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      fontSize: 13
                                    }}
                                  >
                                    <span style={{ color: '#fca5a5' }}>
                                      '​{msg.name}'을 정말 삭제하시겠습니까?
                                    </span>
                                    <button
                                      className="btn btn-danger"
                                      style={{ padding: '3px 12px', fontSize: 12 }}
                                      onClick={() => handleDelete(msg)}
                                    >
                                      삭제
                                    </button>
                                    <button
                                      className="btn btn-ghost"
                                      style={{ padding: '3px 12px', fontSize: 12 }}
                                      onClick={() => setConfirmDeleteMsg(null)}
                                    >
                                      취소
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          {isExpanded && (
                            <tr key={`${msg.name}__fields`}>
                              <td
                                colSpan={3}
                                style={{ padding: '6px 12px 10px 28px', background: '#111827' }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  {msg.fields.map((f) => (
                                    <span key={f.name} className="table-field-row">
                                      <span className="table-field-badges">
                                        {f.isPk && (
                                          <span className="badge badge-pk" style={{ fontSize: 10 }}>
                                            PK
                                          </span>
                                        )}
                                        {f.isKey && (
                                          <span
                                            className="badge badge-key"
                                            style={{ fontSize: 10 }}
                                          >
                                            Key
                                          </span>
                                        )}
                                      </span>
                                      <span className="table-field-name">{f.name}</span>
                                      <span className="table-field-type">
                                        {f.isRepeated ? `repeated ${f.type}` : f.type}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))
          ))}

        {/* ── 추가/수정 폼 ── */}
        {mode !== 'list' && (
          <div className="card">
            <div className="card-title">
              {mode === 'edit' ? `'${editTarget?.name}' 수정` : '새 테이블 (Message)'}
            </div>

            <div className="form-group">
              <label className="form-label">
                저장할 proto 파일{' '}
                <span style={{ color: '#6b7280', textTransform: 'none', fontWeight: 400 }}>
                  ({'{Name}'}Table.proto)
                </span>
              </label>
              {mode === 'add' && existingProtoFiles.length > 0 && (
                <select
                  className="form-select"
                  style={{ marginBottom: 6 }}
                  value={protoFileName}
                  onChange={(e) => {
                    setProtoFileName(e.target.value)
                    setNewProtoFileName('')
                  }}
                >
                  <option value="">-- 기존 파일 선택 --</option>
                  {existingProtoFiles.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              )}
              {mode === 'add' ? (
                <input
                  className="form-input"
                  placeholder="예: GameItem → GameItemTable.proto"
                  value={newProtoFileName}
                  onChange={(e) => {
                    setNewProtoFileName(e.target.value)
                    setProtoFileName('')
                  }}
                />
              ) : (
                <input
                  className="form-input"
                  value={protoFileName}
                  readOnly
                  style={{ opacity: 0.6 }}
                />
              )}
              {resolvedProtoFile && mode === 'add' && (
                <span style={{ fontSize: 11, color: '#6fcf97' }}>
                  → {resolvedProtoFile} 에 저장됩니다
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">테이블 이름</label>
              <input
                className="form-input"
                placeholder="예: RewardTable"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              />
            </div>

            <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>
              컬럼
            </label>

            <div className="columns-list">
              {(() => {
                const tablePkMode = fields.some((f) => f.isPk)
                const tableKeyMode = fields.some((f) => f.isKey)
                return fields.map((field, i) => (
                  <div key={i} className="column-row">
                    <div
                      style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}
                    >
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '0 6px', lineHeight: '16px', fontSize: 11 }}
                        onClick={() => moveField(i, -1)}
                        disabled={i === 0}
                        title="위로"
                      >
                        ▲
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '0 6px', lineHeight: '16px', fontSize: 11 }}
                        onClick={() => moveField(i, 1)}
                        disabled={i === fields.length - 1}
                        title="아래로"
                      >
                        ▼
                      </button>
                    </div>
                    <span
                      style={{
                        width: 22,
                        textAlign: 'center',
                        color: '#6b7280',
                        fontSize: 12,
                        flexShrink: 0
                      }}
                    >
                      {i + 1}
                    </span>
                    <input
                      className="form-input"
                      placeholder="필드 이름"
                      value={field.name}
                      onChange={(e) => updateField(i, { name: e.target.value })}
                    />
                    {/* 두 단계 타입 선택 */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        minWidth: 180,
                        flexShrink: 0
                      }}
                    >
                      {/* 1단계: 카테고리(파일) 선택 */}
                      <select
                        className="form-select"
                        style={{ fontSize: 13, padding: '3px 6px' }}
                        value={field.typeCategory}
                        onChange={(e) => {
                          const cat = e.target.value
                          const types =
                            cat === 'primitive' ? PRIMITIVE_TYPES : getTypesForCategory(cat)
                          const firstType = types[0] ?? 'int32'
                          updateField(i, { typeCategory: cat, type: firstType })
                        }}
                      >
                        <option value="primitive">기본 타입</option>
                        {tableSourceFiles.length > 0 && (
                          <optgroup label="── 테이블">
                            {tableSourceFiles.map((f) => (
                              <option key={f} value={f}>
                                {stripProto(f)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {enumSourceFiles.length > 0 && (
                          <optgroup label="── Enum">
                            {enumSourceFiles.map((f) => (
                              <option key={f} value={f}>
                                {stripProto(f)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {/* 2단계: 해당 카테고리 내 타입 선택 */}
                      {field.typeCategory === 'primitive' ? (
                        <select
                          className="form-select"
                          style={{ fontSize: 13, padding: '3px 6px' }}
                          value={field.type}
                          onChange={(e) => updateField(i, { type: e.target.value })}
                        >
                          {PRIMITIVE_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          className="form-select"
                          style={{ fontSize: 13, padding: '3px 6px' }}
                          value={field.type}
                          onChange={(e) => updateField(i, { type: e.target.value })}
                        >
                          {getTypesForCategory(field.typeCategory).map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <label className="checkbox-group" title="기본키(PK)">
                      <input
                        type="checkbox"
                        checked={field.isPk}
                        disabled={tableKeyMode}
                        onChange={(e) => {
                          if (e.target.checked) updateField(i, { isPk: true, isKey: false })
                          else updateField(i, { isPk: false })
                        }}
                      />
                      PK
                    </label>
                    <label className="checkbox-group" title="모아서 배열로 (Key)">
                      <input
                        type="checkbox"
                        checked={field.isKey}
                        disabled={tablePkMode}
                        onChange={(e) => {
                          if (e.target.checked) updateField(i, { isKey: true, isPk: false })
                          else updateField(i, { isKey: false })
                        }}
                      />
                      Key
                    </label>
                    <label className="checkbox-group" title="repeated" style={{ display: 'none' }}>
                      <input
                        type="checkbox"
                        checked={field.isRepeated}
                        onChange={(e) => updateField(i, { isRepeated: e.target.checked })}
                      />
                      List
                    </label>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 10px', flexShrink: 0 }}
                      onClick={() => removeField(i)}
                      disabled={fields.length === 1}
                    >
                      ✕
                    </button>
                  </div>
                ))
              })()}
            </div>

            <div className="toolbar">
              <button className="btn btn-ghost" onClick={addField}>
                + 컬럼 추가
              </button>
              <button className="btn btn-success" onClick={handleSubmit} disabled={saving}>
                {saving ? '저장 중...' : mode === 'edit' ? '💾 수정 저장' : '💾 proto에 저장'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
