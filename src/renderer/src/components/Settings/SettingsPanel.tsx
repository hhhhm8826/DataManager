import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '../../store/appStore'
import { IPC } from '../../../../shared/ipc-channels'
import { ipcInvoke } from '../../hooks/useIpc'
import type { AppSettings } from '../../../../shared/types'

export function SettingsPanel(): React.JSX.Element {
  const { settings, saveSettings, loadProto } = useAppStore()
  const [draft, setDraft] = useState<AppSettings>({
    protoDir: '',
    excelDir: '',
    jsonDir: '',
    outputDirs: [],
    protocPath: ''
  })

  useEffect(() => {
    if (settings) setDraft(settings)
  }, [settings])

  const pickDir = async (field: keyof Pick<AppSettings, 'protoDir' | 'excelDir' | 'jsonDir'>): Promise<void> => {
    const result = await ipcInvoke<string>(IPC.SETTINGS_SELECT_DIR)
    if (!result.success || !result.data) return
    setDraft((prev) => ({ ...prev, [field]: result.data }))
  }

  const openDir = async (dirPath: string): Promise<void> => {
    if (!dirPath.trim()) { toast.error('경로를 먼저 설정하세요.'); return }
    await ipcInvoke(IPC.SETTINGS_OPEN_DIR, dirPath)
  }

  const handleSave = async (): Promise<void> => {
    await saveSettings(draft)
    await loadProto()
    toast.success('설정이 저장되었습니다.')
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <span className="page-title">설정</span>
        <button className="btn btn-success" style={{ marginLeft: 'auto' }} onClick={handleSave}>💾 저장</button>
      </div>
      <div className="page-body">

        <div className="card">
          <div className="card-title">경로 설정</div>

          <div className="form-group">
            <label className="form-label">Proto 디렉토리</label>
            <div className="path-row">
              <input className="form-input path-input" placeholder="proto 파일이 있는 폴더" value={draft.protoDir} onChange={(e) => setDraft((p) => ({ ...p, protoDir: e.target.value }))} />
              <button className="btn btn-ghost" onClick={() => pickDir('protoDir')} title="폴더 선택">📂</button>
              <button className="btn btn-ghost" title="탐색기에서 열기" onClick={() => openDir(draft.protoDir)}>↗</button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Excel 디렉토리</label>
            <div className="path-row">
              <input className="form-input path-input" placeholder="Excel 파일을 생성/읽을 폴더" value={draft.excelDir} onChange={(e) => setDraft((p) => ({ ...p, excelDir: e.target.value }))} />
              <button className="btn btn-ghost" onClick={() => pickDir('excelDir')} title="폴더 선택">📂</button>
              <button className="btn btn-ghost" title="탐색기에서 열기" onClick={() => openDir(draft.excelDir)}>↗</button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">JSON 디렉토리</label>
            <div className="path-row">
              <input className="form-input path-input" placeholder="JSON 파일을 저장할 폴더" value={draft.jsonDir} onChange={(e) => setDraft((p) => ({ ...p, jsonDir: e.target.value }))} />
              <button className="btn btn-ghost" onClick={() => pickDir('jsonDir')} title="폴더 선택">📂</button>
              <button className="btn btn-ghost" title="탐색기에서 열기" onClick={() => openDir(draft.jsonDir)}>↗</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
