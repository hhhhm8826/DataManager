import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '../../store/appStore'
import { IPC } from '../../../../shared/ipc-channels'
import { ipcInvoke } from '../../hooks/useIpc'
import type { ProtoMessage, ProtoField } from '../../../../shared/types'

const PRIMITIVE_TYPES = ['string', 'int32', 'int64', 'uint32', 'uint64', 'float', 'double', 'bool', 'bytes']

interface FieldDraft {
  name: string
  type: string
  fieldNumber: number
  isPk: boolean
  isRepeated: boolean
}

function makeField(index: number): FieldDraft {
  return { name: '', type: 'int32', fieldNumber: index + 1, isPk: false, isRepeated: false }
}

function messageToDrafts(msg: ProtoMessage): FieldDraft[] {
  return msg.fields.map((f) => ({
    name: f.name,
    type: f.type,
    fieldNumber: f.fieldNumber,
    isPk: f.isPk,
    isRepeated: f.isRepeated,
  }))
}

type Mode = 'list' | 'add' | 'edit'

export function TableCreator(): React.JSX.Element {
  const { parsed, loadProto } = useAppStore()
  const [mode, setMode] = useState<Mode>('list')
  const [editTarget, setEditTarget] = useState<ProtoMessage | null>(null)

  // 폼 상태
  const [tableName, setTableName] = useState('')
  const [protoFileName, setProtoFileName] = useState('')
  const [newProtoFileName, setNewProtoFileName] = useState('')
  const [fields, setFields] = useState<FieldDraft[]>([makeField(0)])
  const [saving, setSaving] = useState(false)

  const allEnums = parsed?.enums ?? []
  const existingProtoFiles = parsed
    ? [...new Set(parsed.messages.map((m) => m.sourceFile))]
    : []
  const resolvedProtoFile = newProtoFileName.trim() || protoFileName

  // proto 파일별 메시지 그룹
  const protoGroups = parsed
    ? Array.from(
        parsed.messages.reduce((map, msg) => {
          if (!map.has(msg.sourceFile)) map.set(msg.sourceFile, [])
          map.get(msg.sourceFile)!.push(msg)
          return map
        }, new Map<string, ProtoMessage[]>())
      )
    : []

  const resetForm = useCallback((): void => {
    setTableName('')
    setProtoFileName('')
    setNewProtoFileName('')
    setFields([makeField(0)])
    setEditTarget(null)
  }, [])

  const openAdd = (): void => { resetForm(); setMode('add') }

  const openEdit = (msg: ProtoMessage): void => {
    setEditTarget(msg)
    setTableName(msg.name)
    setProtoFileName(msg.sourceFile)
    setNewProtoFileName('')
    setFields(messageToDrafts(msg))
    setMode('edit')
  }

  const addField = (): void => setFields((prev) => [...prev, makeField(prev.length)])
  const removeField = (i: number): void => setFields((prev) => prev.filter((_, idx) => idx !== i))
  const updateField = (i: number, patch: Partial<FieldDraft>): void =>
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))

  const handleDelete = async (msg: ProtoMessage): Promise<void> => {
    if (!window.confirm(`'${msg.name}' 테이블을 삭제하시겠습니까?`)) return
    const result = await ipcInvoke(IPC.PROTO_DELETE_MESSAGE, { sourceFile: msg.sourceFile, messageName: msg.name })
    if (result.success) {
      toast.success(`'${msg.name}' 이 삭제되었습니다.`)
      await loadProto()
    } else {
      toast.error(result.error ?? '삭제 실패')
    }
  }

  const handleSubmit = async (): Promise<void> => {
    if (!tableName.trim()) { toast.error('테이블 이름을 입력하세요.'); return }
    if (!resolvedProtoFile) { toast.error('저장할 proto 파일을 선택하거나 입력하세요.'); return }
    if (!resolvedProtoFile.endsWith('Table.proto')) { toast.error('파일 이름은 {Name}Table.proto 형식이어야 합니다.'); return }
    if (fields.some((f) => !f.name.trim())) { toast.error('모든 필드 이름을 입력하세요.'); return }

    setSaving(true)
    const message: ProtoMessage = {
      name: tableName.trim(),
      fields: fields.map((f): ProtoField => ({ ...f, comment: '' })),
      pkFields: fields.filter((f) => f.isPk).map((f) => f.name),
      sourceFile: resolvedProtoFile,
    }

    const result = mode === 'edit' && editTarget
      ? await ipcInvoke(IPC.PROTO_UPDATE_MESSAGE, { sourceFile: editTarget.sourceFile, oldName: editTarget.name, message })
      : await ipcInvoke(IPC.PROTO_ADD_MESSAGE, message)
    setSaving(false)

    if (result.success) {
      toast.success(mode === 'edit' ? `'${tableName}' 이 수정되었습니다.` : `'${tableName}' 이 ${resolvedProtoFile} 에 추가되었습니다.`)
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
        {mode === 'list'
          ? <button className="btn btn-success" style={{ marginLeft: 'auto' }} onClick={openAdd}>+ 테이블 추가</button>
          : <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => { resetForm(); setMode('list') }}>← 목록으로</button>
        }
      </div>
      <div className="page-body">

        {/* ── 목록 뷰 ── */}
        {mode === 'list' && (
          protoGroups.length === 0
            ? <div className="card"><p className="empty-state">등록된 테이블이 없습니다. proto 디렉토리를 설정하거나 테이블을 추가하세요.</p></div>
            : protoGroups.map(([protoFile, msgs]) => (
              <div className="card" key={protoFile}>
                <div className="card-title" style={{ color: '#a0c4ff', fontSize: 13 }}>{protoFile}</div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>테이블 이름</th>
                      <th>컬럼 수</th>
                      <th>PK</th>
                      <th style={{ width: 150 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {msgs.map((msg) => (
                      <tr key={msg.name}>
                        <td>{msg.name}</td>
                        <td>{msg.fields.length}</td>
                        <td style={{ color: '#6fcf97', fontSize: 12 }}>{msg.pkFields.join(', ')}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => openEdit(msg)}>✏️ 수정</button>
                            <button className="btn btn-danger" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => handleDelete(msg)}>🗑 삭제</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
        )}

        {/* ── 추가/수정 폼 ── */}
        {mode !== 'list' && (
          <div className="card">
            <div className="card-title">{mode === 'edit' ? `'${editTarget?.name}' 수정` : '새 테이블 (Message)'}</div>

            <div className="form-group">
              <label className="form-label">저장할 proto 파일 <span style={{ color: '#6b7280', textTransform: 'none', fontWeight: 400 }}>({'{Name}'}Table.proto)</span></label>
              {mode === 'add' && existingProtoFiles.length > 0 && (
                <select
                  className="form-select"
                  style={{ marginBottom: 6 }}
                  value={protoFileName}
                  onChange={(e) => { setProtoFileName(e.target.value); setNewProtoFileName('') }}
                >
                  <option value="">-- 기존 파일 선택 --</option>
                  {existingProtoFiles.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              )}
              {mode === 'add'
                ? <input className="form-input" placeholder="신규 파일명 입력 (예: GameItemTable.proto)" value={newProtoFileName} onChange={(e) => { setNewProtoFileName(e.target.value); setProtoFileName('') }} />
                : <input className="form-input" value={protoFileName} readOnly style={{ opacity: 0.6 }} />
              }
              {resolvedProtoFile && mode === 'add' && (
                <span style={{ fontSize: 11, color: '#6fcf97' }}>→ {resolvedProtoFile} 에 저장됩니다</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">테이블 이름</label>
              <input className="form-input" placeholder="예: RewardTable" value={tableName} onChange={(e) => setTableName(e.target.value)} />
            </div>

            <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>컬럼</label>

            <div className="columns-list">
              {fields.map((field, i) => (
                <div key={i} className="column-row">
                  <input className="form-input" placeholder="필드 이름" value={field.name} onChange={(e) => updateField(i, { name: e.target.value })} />
                  <select className="form-select" value={field.type} onChange={(e) => updateField(i, { type: e.target.value })}>
                    <optgroup label="기본 타입">
                      {PRIMITIVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </optgroup>
                    {allEnums.length > 0 && (
                      <optgroup label="Enum">
                        {allEnums.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
                      </optgroup>
                    )}
                    {(parsed?.messages ?? []).length > 0 && (
                      <optgroup label="Message (참조)">
                        {(parsed?.messages ?? []).map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <input className="form-input" type="number" placeholder="#" style={{ width: 64, flexShrink: 0 }} value={field.fieldNumber} min={1} onChange={(e) => updateField(i, { fieldNumber: parseInt(e.target.value) || i + 1 })} />
                  <label className="checkbox-group" title="기본키(PK)">
                    <input type="checkbox" checked={field.isPk} onChange={(e) => updateField(i, { isPk: e.target.checked })} />
                    PK
                  </label>
                  <label className="checkbox-group" title="repeated">
                    <input type="checkbox" checked={field.isRepeated} onChange={(e) => updateField(i, { isRepeated: e.target.checked })} />
                    List
                  </label>
                  <button className="btn btn-danger" style={{ padding: '4px 10px', flexShrink: 0 }} onClick={() => removeField(i)} disabled={fields.length === 1}>✕</button>
                </div>
              ))}
            </div>

            <div className="toolbar">
              <button className="btn btn-ghost" onClick={addField}>+ 컬럼 추가</button>
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
