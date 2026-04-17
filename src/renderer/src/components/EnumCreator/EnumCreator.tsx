import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '../../store/appStore'
import { IPC } from '../../../../shared/ipc-channels'
import { ipcInvoke } from '../../hooks/useIpc'
import type { ProtoEnum, ProtoEnumValue } from '../../../../shared/types'

interface ValueDraft {
  name: string
  number: number
}

function makeValue(index: number): ValueDraft {
  return { name: '', number: index + 1 }
}

type Mode = 'list' | 'add' | 'edit'

export function EnumCreator(): React.JSX.Element {
  const { parsed, loadProto } = useAppStore()
  const [mode, setMode] = useState<Mode>('list')
  const [editTarget, setEditTarget] = useState<ProtoEnum | null>(null)

  // 폼 상태
  const [enumName, setEnumName] = useState('')
  const [fileName, setFileName] = useState('')
  const [values, setValues] = useState<ValueDraft[]>([makeValue(0)])
  const [saving, setSaving] = useState(false)

  const existingEnumFiles = parsed
    ? [...new Set(parsed.enums.map((e) => e.sourceFile).filter((f) => f.endsWith('EnumType.proto')))]
    : []

  // sourceFile별 Enum 그룹
  const enumGroups = parsed
    ? Array.from(
        parsed.enums.reduce((map, e) => {
          if (!map.has(e.sourceFile)) map.set(e.sourceFile, [])
          map.get(e.sourceFile)!.push(e)
          return map
        }, new Map<string, ProtoEnum[]>())
      )
    : []

  const resetForm = useCallback((): void => {
    setEnumName('')
    setFileName('')
    setValues([makeValue(0)])
    setEditTarget(null)
  }, [])

  const openAdd = (): void => { resetForm(); setMode('add') }

  const openEdit = (protoEnum: ProtoEnum): void => {
    setEditTarget(protoEnum)
    setEnumName(protoEnum.name)
    setFileName(protoEnum.sourceFile)
    // _NONE=0, _MAX 는 자동 처리되므로 편집에서 제외
    const userValues = protoEnum.values.filter(
      (v) => !(v.name === `${protoEnum.name}_NONE` && v.number === 0) && v.name !== `${protoEnum.name}_MAX`
    )
    setValues(userValues.length > 0 ? userValues : [makeValue(0)])
    setMode('edit')
  }

  const addValue = (): void => setValues((prev) => [...prev, makeValue(prev.length)])
  const removeValue = (i: number): void => setValues((prev) => prev.filter((_, idx) => idx !== i))
  const updateValue = (i: number, patch: Partial<ValueDraft>): void =>
    setValues((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))

  const handleDelete = async (protoEnum: ProtoEnum): Promise<void> => {
    if (!window.confirm(`'${protoEnum.name}' Enum을 삭제하시겠습니까?`)) return
    const result = await ipcInvoke(IPC.PROTO_DELETE_ENUM, { sourceFile: protoEnum.sourceFile, enumName: protoEnum.name })
    if (result.success) {
      toast.success(`'${protoEnum.name}' 이 삭제되었습니다.`)
      await loadProto()
    } else {
      toast.error(result.error ?? '삭제 실패')
    }
  }

  const handleSubmit = async (): Promise<void> => {
    if (!enumName.trim()) { toast.error('Enum 이름을 입력하세요.'); return }
    if (!fileName.trim()) { toast.error('저장할 파일 이름을 입력하세요.'); return }
    if (!fileName.endsWith('EnumType.proto')) { toast.error('파일 이름은 {Name}EnumType.proto 형식이어야 합니다.'); return }
    if (values.some((v) => !v.name.trim())) { toast.error('모든 Enum 값 이름을 입력하세요.'); return }

    const hasNone = values.some((v) => v.name === `${enumName}_NONE` && v.number === 0)
    const hasMax = values.some((v) => v.name === `${enumName}_MAX`)
    const finalValues: ProtoEnumValue[] = []
    if (!hasNone) finalValues.push({ name: `${enumName}_NONE`, number: 0 })
    finalValues.push(...values.map((v) => ({ name: v.name, number: v.number })))
    if (!hasMax) {
      const maxNum = Math.max(...finalValues.map((v) => v.number)) + 1
      finalValues.push({ name: `${enumName}_MAX`, number: maxNum })
    }

    setSaving(true)
    const protoEnum: ProtoEnum = { name: enumName.trim(), values: finalValues, sourceFile: fileName.trim() }

    const result = mode === 'edit' && editTarget
      ? await ipcInvoke(IPC.PROTO_UPDATE_ENUM, { sourceFile: editTarget.sourceFile, oldName: editTarget.name, protoEnum })
      : await ipcInvoke(IPC.PROTO_ADD_ENUM, { fileName: fileName.trim(), protoEnum })
    setSaving(false)

    if (result.success) {
      toast.success(mode === 'edit' ? `Enum '${enumName}' 이 수정되었습니다.` : `Enum '${enumName}' 이 추가되었습니다.`)
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
        <span className="page-title">Enum</span>
        {mode === 'list'
          ? <button className="btn btn-success" style={{ marginLeft: 'auto' }} onClick={openAdd}>+ Enum 추가</button>
          : <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => { resetForm(); setMode('list') }}>← 목록으로</button>
        }
      </div>
      <div className="page-body">

        {/* ── 목록 뷰 ── */}
        {mode === 'list' && (
          enumGroups.length === 0
            ? <div className="card"><p className="empty-state">등록된 Enum이 없습니다. proto 디렉토리를 설정하거나 Enum을 추가하세요.</p></div>
            : enumGroups.map(([sourceFile, enums]) => (
              <div className="card" key={sourceFile}>
                <div className="card-title" style={{ color: '#a0c4ff', fontSize: 13 }}>{sourceFile}</div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Enum 이름</th>
                      <th>값 개수</th>
                      <th style={{ width: 150 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {enums.map((e) => (
                      <tr key={e.name}>
                        <td>{e.name}</td>
                        <td>{e.values.length}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => openEdit(e)}>✏️ 수정</button>
                            <button className="btn btn-danger" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => handleDelete(e)}>🗑 삭제</button>
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
            <div className="card-title">{mode === 'edit' ? `'${editTarget?.name}' 수정` : '새 Enum'}</div>

            <div className="form-group">
              <label className="form-label">Enum 이름</label>
              <input className="form-input" placeholder="예: MonsterTypeEnum" value={enumName} onChange={(e) => setEnumName(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">저장 파일 (EnumType.proto)</label>
              {mode === 'add' && existingEnumFiles.length > 0 && (
                <select className="form-select" style={{ marginBottom: 6 }} value={fileName} onChange={(e) => setFileName(e.target.value)}>
                  <option value="">-- 기존 파일 선택 --</option>
                  {existingEnumFiles.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              )}
              {mode === 'add'
                ? <input className="form-input" placeholder="예: MonsterEnumType.proto (신규 파일)" value={fileName} onChange={(e) => setFileName(e.target.value)} />
                : <input className="form-input" value={fileName} readOnly style={{ opacity: 0.6 }} />
              }
              <span style={{ fontSize: 11, color: '#4b5563' }}>
                _NONE=0 과 _MAX 값은 없으면 자동으로 추가됩니다.
              </span>
            </div>

            <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>Enum 값</label>

            <div className="columns-list">
              {values.map((val, i) => (
                <div key={i} className="column-row">
                  <input className="form-input" placeholder="값 이름 (예: WARRIOR)" value={val.name} onChange={(e) => updateValue(i, { name: e.target.value })} />
                  <input className="form-input" type="number" placeholder="숫자" style={{ width: 80, flexShrink: 0 }} value={val.number} min={1} onChange={(e) => updateValue(i, { number: parseInt(e.target.value) || i + 1 })} />
                  <button className="btn btn-danger" style={{ padding: '4px 10px', flexShrink: 0 }} onClick={() => removeValue(i)} disabled={values.length === 1}>✕</button>
                </div>
              ))}
            </div>

            <div className="toolbar">
              <button className="btn btn-ghost" onClick={addValue}>+ 값 추가</button>
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
