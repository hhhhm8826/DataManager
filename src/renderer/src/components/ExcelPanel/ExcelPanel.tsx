import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '../../store/appStore'
import { IPC } from '../../../../shared/ipc-channels'
import { ipcInvoke } from '../../hooks/useIpc'
import type { ExcelFileInfo } from '../../../../shared/types'

type SubTab = 'generate' | 'json'

export function ExcelPanel(): React.JSX.Element {
  const { parsed, settings } = useAppStore()

  const [activeTab, setActiveTab] = useState<SubTab>('json')
  const [fileInfos, setFileInfos] = useState<ExcelFileInfo[]>([])
  const [loadingInfos, setLoadingInfos] = useState(false)

  // 생성 섹션 선택 상태 (protoFile 기준)
  const [selectedGen, setSelectedGen] = useState<Set<string>>(new Set())
  // JSON 내보내기 섹션 선택 상태 (key: "protoFile::msgName")
  const [selectedJson, setSelectedJson] = useState<Set<string>>(new Set())

  const [generating, setGenerating] = useState(false)
  const [jsonExporting, setJsonExporting] = useState(false)
  // 덮어쓰기 확인이 필요한 파일 목록 (비어있으면 확인 패널 숨김)
  const [confirmOverwrite, setConfirmOverwrite] = useState<ExcelFileInfo[]>([])

  const openDir = async (dirPath: string | undefined): Promise<void> => {
    if (!dirPath?.trim()) { toast.error('경로를 먼저 설정하세요.'); return }
    await ipcInvoke(IPC.SETTINGS_OPEN_DIR, dirPath)
  }

  const loadFileInfos = useCallback(async () => {
    if (!parsed) return
    setLoadingInfos(true)
    const r = await ipcInvoke<ExcelFileInfo[]>(IPC.EXCEL_LIST_EXISTING)
    setLoadingInfos(false)
    if (r.success && r.data) {
      setFileInfos(r.data)
      // 기본: 아무것도 선택하지 않은 상태
      setSelectedGen(new Set())
      setSelectedJson(new Set())
    }
  }, [parsed, settings?.excelDir])

  useEffect(() => {
    loadFileInfos()
  }, [loadFileInfos])

  // 존재하는 Excel 파일 → 시트 단위 평탄화 (JSON 내보내기 대상)
  const sheetsForJson = fileInfos
    .filter((f) => f.exists)
    .flatMap((f) => f.msgNames.map((msgName) => ({ ...f, msgName, key: `${f.protoFile}::${msgName}` })))

  // ── 생성 섹션 헬퍼 ──

  const toggleGen = (protoFile: string): void => {
    setSelectedGen((prev) => {
      const n = new Set(prev)
      if (n.has(protoFile)) n.delete(protoFile)
      else n.add(protoFile)
      return n
    })
  }

  const toggleAllGen = (): void => {
    if (selectedGen.size === fileInfos.length) setSelectedGen(new Set())
    else setSelectedGen(new Set(fileInfos.map((f) => f.protoFile)))
  }

  const handleGenerate = async (backup = false, skipConflictCheck = false): Promise<void> => {
    if (selectedGen.size === 0) { toast.error('생성할 파일을 선택하세요.'); return }

    // 덮어쓰기 충돌 검사 (첫 호출 시, 모달에서 확인하지 않은 경우)
    if (!backup && !skipConflictCheck) {
      const conflicts = fileInfos.filter((f) => selectedGen.has(f.protoFile) && f.exists)
      if (conflicts.length > 0) {
        setConfirmOverwrite(conflicts)
        return
      }
    }

    setConfirmOverwrite([])
    setGenerating(true)
    const r = await ipcInvoke<{ created: string[]; backedUp: string[] }>(
      IPC.EXCEL_GENERATE,
      Array.from(selectedGen),
      backup
    )
    setGenerating(false)
    if (r.success && r.data) {
      const { created, backedUp } = r.data
      const msg = backedUp.length > 0
        ? `${created.length}개 Excel 파일이 생성되었습니다. (백업: ${backedUp.join(', ')})`
        : `${created.length}개 Excel 파일이 생성되었습니다.`
      toast.success(msg)
      await loadFileInfos()
    } else {
      toast.error(r.error ?? 'Excel 생성 실패')
    }
  }

  // ── JSON 내보내기 섹션 헬퍼 ──

  const toggleJson = (key: string): void => {
    setSelectedJson((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  const toggleAllJson = (): void => {
    if (selectedJson.size === sheetsForJson.length) setSelectedJson(new Set())
    else setSelectedJson(new Set(sheetsForJson.map((s) => s.key)))
  }

  const handleExportJson = async (): Promise<void> => {
    const selected = sheetsForJson.filter((s) => selectedJson.has(s.key))
    if (selected.length === 0) { toast.error('내보낼 시트를 선택하세요.'); return }

    // ── 연결된 테이블 재귀 수집 ──
    // parsed.messages 에서 각 메시지의 필드 타입이 다른 메시지 이름이면 의존성으로 추가
    const allMessages = parsed?.messages ?? []
    const messageNameSet = new Set(allMessages.map((m) => m.name))

    // msgName → excelPath 맵 (존재하는 파일만)
    const msgToSheet = new Map<string, { excelPath: string; msgName: string }>()
    for (const s of sheetsForJson) {
      if (!msgToSheet.has(s.msgName)) msgToSheet.set(s.msgName, { excelPath: s.excelPath, msgName: s.msgName })
    }

    // BFS로 의존 메시지 수집
    const toExport = new Map<string, { excelPath: string; msgName: string }>()
    const queue: string[] = selected.map((s) => s.msgName)
    for (const s of selected) toExport.set(s.msgName, { excelPath: s.excelPath, msgName: s.msgName })

    while (queue.length > 0) {
      const msgName = queue.shift()!
      const msgDef = allMessages.find((m) => m.name === msgName)
      if (!msgDef) continue
      for (const field of msgDef.fields) {
        if (messageNameSet.has(field.type) && !toExport.has(field.type)) {
          const sheetEntry = msgToSheet.get(field.type)
          if (sheetEntry) {
            toExport.set(field.type, sheetEntry)
            queue.push(field.type)
          }
        }
      }
    }

    // 자동으로 추가된 의존 테이블 이름 목록 (서버에서 임베드 처리)

    // excelPath 기준으로 그룹화
    const byExcel = new Map<string, { excelPath: string; sheets: string[] }>()
    for (const { excelPath, msgName } of toExport.values()) {
      if (!byExcel.has(excelPath)) byExcel.set(excelPath, { excelPath, sheets: [] })
      byExcel.get(excelPath)!.sheets.push(msgName)
    }

    setJsonExporting(true)
    const requests = [...byExcel.values()]
    const r = await ipcInvoke<{ exported: number; embedded: string[] }>(IPC.EXCEL_EXPORT_JSON, requests)
    setJsonExporting(false)
    if (r.success && r.data) {
      const { exported, embedded } = r.data
      const embeddedMsg = embedded.length > 0 ? ` (임베드: ${embedded.join(', ')})` : ''
      toast.success(`${exported}개 테이블을 JSON으로 내보냈습니다.${embeddedMsg}`)
    } else {
      toast.error(r.error ?? 'JSON 내보내기 실패')
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── 덮어쓰기 확인 모달 ── */}
      {confirmOverwrite.length > 0 && (
        <div className="modal-overlay" onClick={() => setConfirmOverwrite([])}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">⚠️ 파일 덮어쓰기 확인</span>
              <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => setConfirmOverwrite([])}>✕</button>
            </div>
            <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>
              다음 파일이 이미 존재합니다. 어떻게 처리할까요?
            </p>
            <ul style={{ margin: '0 0 20px 20px', color: '#9ca3af', fontSize: 13, lineHeight: 1.8 }}>
              {confirmOverwrite.map((f) => (
                <li key={f.protoFile}>
                  <span style={{ color: '#f87171' }}>{f.excelFile}</span>
                  {' → 백업: '}
                  <span style={{ color: '#a0c4ff' }}>backup/{f.excelFile.replace('.xlsx', '_YYYYMMDDHHmmss.xlsx')}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmOverwrite([])}>취소</button>
              <button
                className="btn btn-danger"
                onClick={() => handleGenerate(false, true)}
                disabled={generating}
              >
                덮어쓰기 (백업 없이)
              </button>
              <button
                className="btn btn-warning"
                onClick={() => handleGenerate(true)}
                disabled={generating}
              >
                💾 백업 후 생성
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <span className="page-title">Excel 관리</span>
      </div>
      <div className="page-body" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* ── 상단 탭 ── */}
        <div className="sub-tabs">
          <button
            className={`sub-tab${activeTab === 'json' ? ' active' : ''}`}
            onClick={() => setActiveTab('json')}
          >
            📥 JSON 내보내기
          </button>
          <button
            className={`sub-tab${activeTab === 'generate' ? ' active' : ''}`}
            onClick={() => setActiveTab('generate')}
          >
            📄 Excel 파일 생성
          </button>
        </div>

        {/* ── Excel 파일 생성 탭 ── */}
        {activeTab === 'generate' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <button
                    className="btn btn-success"
                    onClick={() => handleGenerate()}
                    disabled={generating || selectedGen.size === 0}
                >
                    {generating ? '생성 중...' : `📄 선택된 ${selectedGen.size}개 생성`}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, color: '#9ca3af' }}>
                        출력 경로: <strong style={{ color: '#a0c4ff' }}>{settings?.excelDir || '(미설정)'}</strong>
                    </span>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 13 }} title="탐색기에서 열기" onClick={() => openDir(settings?.excelDir)}>↗</button>
                </div>
            </div>

            {loadingInfos ? (
              <p className="empty-state" style={{ padding: '16px 0' }}>로딩 중...</p>
            ) : fileInfos.length > 0 ? (
              <>
                <table className="data-table" style={{ marginBottom: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedGen.size === fileInfos.length && fileInfos.length > 0}
                          onChange={toggleAllGen}
                        />
                      </th>
                      <th>proto 파일</th>
                      <th>생성될 Excel 파일</th>
                      <th>시트 (테이블)</th>
                      <th style={{ width: 56, textAlign: 'center' }}>파일 존재</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fileInfos.map((f) => (
                      <tr key={f.protoFile}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedGen.has(f.protoFile)}
                            onChange={() => toggleGen(f.protoFile)}
                          />
                        </td>
                        <td style={{ color: '#a0c4ff' }}>{f.protoFile}</td>
                        <td style={{ color: '#6fcf97' }}>{f.excelFile}</td>
                        <td style={{ color: '#9ca3af', fontSize: 12 }}>{f.msgNames.join(', ')}</td>
                        <td style={{ textAlign: 'center', fontSize: 14 }}>{f.exists ? '✅' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

              </>
            ) : (
              <p className="empty-state" style={{ padding: '16px 0' }}>
                로드된 테이블이 없습니다. 설정에서 proto 디렉토리를 지정하세요.
              </p>
            )}
          </div>
        )}

        {/* ── JSON 내보내기 탭 ── */}
        {activeTab === 'json' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleExportJson}
                  disabled={jsonExporting || selectedJson.size === 0}
                >
                  {jsonExporting ? '내보내는 중...' : `📥 선택된 ${selectedJson.size}개 시트 JSON 내보내기`}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, color: '#9ca3af' }}>
                        출력 경로: <strong style={{ color: '#a0c4ff' }}>{settings?.jsonDir || '(미설정)'}</strong>
                    </span>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 13 }} title="탐색기에서 열기" onClick={() => openDir(settings?.jsonDir)}>↗</button>
                </div>
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              Excel 파일이 존재하는 시트만 표시됩니다. 시트 단위로 선택하여 JSON으로 내보냅니다.
            </p>

            {loadingInfos ? (
              <p className="empty-state" style={{ padding: '16px 0' }}>로딩 중...</p>
            ) : sheetsForJson.length > 0 ? (
              <>
                <table className="data-table" style={{ marginBottom: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedJson.size === sheetsForJson.length && sheetsForJson.length > 0}
                          onChange={toggleAllJson}
                        />
                      </th>
                      <th>시트 (테이블)</th>
                      <th>Excel 파일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheetsForJson.map((s) => (
                      <tr key={s.key}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedJson.has(s.key)}
                            onChange={() => toggleJson(s.key)}
                          />
                        </td>
                        <td style={{ color: '#e0e0e0' }}>{s.msgName}</td>
                        <td style={{ color: '#6fcf97', fontSize: 12 }}>{s.excelFile}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="empty-state" style={{ padding: '16px 0' }}>
                Excel 디렉토리에 파일이 없습니다. 먼저 Excel을 생성하세요.
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
