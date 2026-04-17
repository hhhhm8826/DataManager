import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '../../store/appStore'
import { IPC } from '../../../../shared/ipc-channels'
import { ipcInvoke } from '../../hooks/useIpc'
import type { ExcelFileInfo, ExcelReadResult } from '../../../../shared/types'

export function ExcelPanel(): React.JSX.Element {
  const { parsed, settings } = useAppStore()

  const [fileInfos, setFileInfos] = useState<ExcelFileInfo[]>([])
  const [loadingInfos, setLoadingInfos] = useState(false)

  // 생성 섹션 선택 상태 (protoFile 기준)
  const [selectedGen, setSelectedGen] = useState<Set<string>>(new Set())
  // JSON 내보내기 섹션 선택 상태
  const [selectedJson, setSelectedJson] = useState<Set<string>>(new Set())

  const [generating, setGenerating] = useState(false)
  const [jsonExporting, setJsonExporting] = useState(false)
  const [jsonResults, setJsonResults] = useState<{ file: string; results: ExcelReadResult[] }[]>([])

  const loadFileInfos = useCallback(async () => {
    if (!parsed) return
    setLoadingInfos(true)
    const r = await ipcInvoke<ExcelFileInfo[]>(IPC.EXCEL_LIST_EXISTING)
    setLoadingInfos(false)
    if (r.success && r.data) {
      setFileInfos(r.data)
      // 생성: 전체 선택 기본값
      setSelectedGen(new Set(r.data.map((f) => f.protoFile)))
      // JSON: 이미 존재하는 파일만 기본 선택
      setSelectedJson(new Set(r.data.filter((f) => f.exists).map((f) => f.protoFile)))
    }
  }, [parsed, settings?.excelDir])

  useEffect(() => {
    loadFileInfos()
  }, [loadFileInfos])

  // 존재하는 Excel 파일 (JSON 내보내기 대상)
  const existingForJson = fileInfos.filter((f) => f.exists)

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

  const handleGenerate = async (): Promise<void> => {
    if (selectedGen.size === 0) { toast.error('생성할 파일을 선택하세요.'); return }
    setGenerating(true)
    const r = await ipcInvoke<string[]>(IPC.EXCEL_GENERATE, Array.from(selectedGen))
    setGenerating(false)
    if (r.success && r.data) {
      toast.success(`${r.data.length}개 Excel 파일이 생성되었습니다.`)
      await loadFileInfos()
    } else {
      toast.error(r.error ?? 'Excel 생성 실패')
    }
  }

  // ── JSON 내보내기 섹션 헬퍼 ──

  const toggleJson = (protoFile: string): void => {
    setSelectedJson((prev) => {
      const n = new Set(prev)
      if (n.has(protoFile)) n.delete(protoFile)
      else n.add(protoFile)
      return n
    })
  }

  const toggleAllJson = (): void => {
    if (selectedJson.size === existingForJson.length) setSelectedJson(new Set())
    else setSelectedJson(new Set(existingForJson.map((f) => f.protoFile)))
  }

  const handleExportJson = async (): Promise<void> => {
    const selected = existingForJson.filter((f) => selectedJson.has(f.protoFile))
    if (selected.length === 0) { toast.error('내보낼 파일을 선택하세요.'); return }
    setJsonExporting(true)
    const results: { file: string; results: ExcelReadResult[] }[] = []
    for (const fileInfo of selected) {
      const r = await ipcInvoke<ExcelReadResult[]>(IPC.EXCEL_READ, fileInfo.excelPath)
      if (r.success && r.data) {
        results.push({ file: fileInfo.excelFile, results: r.data })
      } else {
        toast.error(`${fileInfo.excelFile}: ${r.error ?? '읽기 실패'}`)
      }
    }
    setJsonExporting(false)
    setJsonResults(results)
    if (results.length > 0) {
      toast.success(`${results.length}개 파일을 JSON으로 내보냈습니다.`)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <span className="page-title">Excel 관리</span>
      </div>
      <div className="page-body">

        {/* ── Excel 생성 ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="card-title" style={{ marginBottom: 0 }}>Excel 파일 생성</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              출력 경로: <strong style={{ color: '#a0c4ff' }}>{settings?.excelDir || '(미설정)'}</strong>
            </span>
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
                        checked={selectedGen.size === fileInfos.length}
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
              <button
                className="btn btn-success"
                onClick={handleGenerate}
                disabled={generating || selectedGen.size === 0}
              >
                {generating ? '생성 중...' : `📄 선택된 ${selectedGen.size}개 생성`}
              </button>
            </>
          ) : (
            <p className="empty-state" style={{ padding: '16px 0' }}>
              로드된 테이블이 없습니다. 설정에서 proto 디렉토리를 지정하세요.
            </p>
          )}
        </div>

        {/* ── JSON 내보내기 ── */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="card-title" style={{ marginBottom: 0 }}>JSON 내보내기</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              출력 경로: <strong style={{ color: '#a0c4ff' }}>{settings?.jsonDir || '(미설정)'}</strong>
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            Excel 디렉토리에 파일이 실제로 존재하는 항목만 표시됩니다.
          </p>

          {loadingInfos ? (
            <p className="empty-state" style={{ padding: '16px 0' }}>로딩 중...</p>
          ) : existingForJson.length > 0 ? (
            <>
              <table className="data-table" style={{ marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedJson.size === existingForJson.length}
                        onChange={toggleAllJson}
                      />
                    </th>
                    <th>Excel 파일</th>
                    <th>시트 (테이블)</th>
                  </tr>
                </thead>
                <tbody>
                  {existingForJson.map((f) => (
                    <tr key={f.protoFile}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedJson.has(f.protoFile)}
                          onChange={() => toggleJson(f.protoFile)}
                        />
                      </td>
                      <td style={{ color: '#6fcf97' }}>{f.excelFile}</td>
                      <td style={{ color: '#9ca3af', fontSize: 12 }}>{f.msgNames.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                className="btn btn-primary"
                onClick={handleExportJson}
                disabled={jsonExporting || selectedJson.size === 0}
              >
                {jsonExporting ? '내보내는 중...' : `📥 선택된 ${selectedJson.size}개 JSON 내보내기`}
              </button>
            </>
          ) : (
            <p className="empty-state" style={{ padding: '16px 0' }}>
              Excel 디렉토리에 파일이 없습니다. 먼저 Excel을 생성하세요.
            </p>
          )}
        </div>

        {/* ── 내보내기 결과 ── */}
        {jsonResults.length > 0 && (
          <div className="card">
            <div className="card-title">내보내기 결과</div>
            {jsonResults.map(({ file, results }) => (
              <div key={file} style={{ marginBottom: 16 }}>
                <div style={{ color: '#a0c4ff', fontSize: 13, marginBottom: 6 }}>📄 {file}</div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>시트 (테이블)</th>
                      <th>행 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.messageName}>
                        <td>{r.messageName}</td>
                        <td>{r.rows.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
