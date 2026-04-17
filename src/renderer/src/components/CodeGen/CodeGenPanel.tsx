import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '../../store/appStore'
import { IPC } from '../../../../shared/ipc-channels'
import { ipcInvoke } from '../../hooks/useIpc'
import type { OutputDirConfig } from '../../../../shared/types'

// 언어별 표시 레이블 맵 — 새 언어 추가 시 이 맵에만 추가하면 됨
const LANGUAGE_LABELS: Record<string, string> = {
  cpp: 'C++',
  csharp: 'C#'
}

function getLabel(lang: string): string {
  return LANGUAGE_LABELS[lang] ?? lang.toUpperCase()
}

export function CodeGenPanel(): React.JSX.Element {
  const { settings, saveSettings } = useAppStore()

  // 백엔드에 등록된 언어 목록
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([])
  // 출력 경로 draft (settings.outputDirs 기반)
  const [outputDirs, setOutputDirs] = useState<OutputDirConfig[]>([])
  const [generating, setGenerating] = useState<string | 'all' | null>(null)
  const [dirty, setDirty] = useState(false)

  // 백엔드에서 지원 언어 목록 로드
  useEffect(() => {
    ipcInvoke<string[]>(IPC.CODEGEN_LIST_LANGUAGES).then((r) => {
      if (r.success && r.data) setAvailableLanguages(r.data)
    })
  }, [])

  // settings가 변경될 때마다 draft 동기화
  useEffect(() => {
    if (settings) {
      setOutputDirs(settings.outputDirs ?? [])
      setDirty(false)
    }
  }, [settings])

  // 언어별 출력 경로 조회 (없으면 '')
  const getDirForLang = (lang: string): string =>
    outputDirs.find((o) => o.language === lang)?.dir ?? ''

  const setDirForLang = (lang: string, dir: string): void => {
    setOutputDirs((prev) => {
      const exists = prev.find((o) => o.language === lang)
      if (exists) return prev.map((o) => (o.language === lang ? { ...o, dir } : o))
      return [...prev, { language: lang, dir }]
    })
    setDirty(true)
  }

  const pickDir = async (lang: string): Promise<void> => {
    const result = await ipcInvoke<string>(IPC.SETTINGS_SELECT_DIR)
    if (result.success && result.data) setDirForLang(lang, result.data)
  }

  const openDir = async (dirPath: string): Promise<void> => {
    if (!dirPath.trim()) { toast.error('경로를 먼저 설정하세요.'); return }
    await ipcInvoke(IPC.SETTINGS_OPEN_DIR, dirPath)
  }

  const handleSavePaths = async (): Promise<void> => {
    // outputDirs 변경만 settings에 반영
    const filtered = outputDirs.filter((o) => o.dir.trim())
    await saveSettings({ outputDirs: filtered })
    setDirty(false)
    toast.success('출력 경로가 저장되었습니다.')
  }

  const handleGenerate = async (lang: string): Promise<void> => {
    if (dirty) {
      toast.error('변경된 경로를 먼저 저장하세요.')
      return
    }
    setGenerating(lang)
    const result = await ipcInvoke(IPC.CODEGEN_GENERATE, lang)
    setGenerating(null)
    if (result.success) {
      toast.success(`${getLabel(lang)} 코드가 생성되었습니다.`)
    } else {
      toast.error(result.error ?? '코드 생성 실패')
    }
  }

  const handleGenerateAll = async (): Promise<void> => {
    if (dirty) {
      toast.error('변경된 경로를 먼저 저장하세요.')
      return
    }
    setGenerating('all')
    const result = await ipcInvoke<string[]>(IPC.CODEGEN_GENERATE_ALL)
    setGenerating(null)
    if (result.success && result.data) {
      toast.success(`${result.data.map(getLabel).join(', ')} 코드가 생성되었습니다.`)
    } else {
      toast.error(result.error ?? '코드 생성 실패')
    }
  }

  const configuredCount = outputDirs.filter((o) => o.dir.trim()).length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <span className="page-title">코드 생성</span>
        {dirty && (
          <button className="btn btn-success" style={{ marginLeft: 'auto' }} onClick={handleSavePaths}>
            💾 경로 저장
          </button>
        )}
      </div>
      <div className="page-body">

        {/* 출력 경로 설정 */}
        <div className="card">
          <div className="card-title">출력 경로 설정</div>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
            언어별 코드 파일을 저장할 폴더를 지정합니다.
            새 언어 지원은 백엔드에 Generator를 등록하면 자동으로 반영됩니다.
          </p>

          {availableLanguages.length === 0 ? (
            <p className="empty-state">등록된 언어 Generator가 없습니다.</p>
          ) : (
            availableLanguages.map((lang) => (
              <div key={lang} className="form-group">
                <label className="form-label">
                  <span style={{
                    display: 'inline-block',
                    background: '#0f3460',
                    color: '#a0c4ff',
                    borderRadius: 4,
                    padding: '1px 8px',
                    fontSize: 11,
                    marginRight: 8
                  }}>
                    {getLabel(lang)}
                  </span>
                  출력 디렉토리
                </label>
                <div className="path-row">
                  <input
                    className="form-input path-input"
                    placeholder={`${getLabel(lang)} 코드를 저장할 폴더`}
                    value={getDirForLang(lang)}
                    onChange={(e) => setDirForLang(lang, e.target.value)}
                  />
                  <button className="btn btn-ghost" onClick={() => pickDir(lang)}>📂</button>
                  <button className="btn btn-ghost" title="폴더 열기" onClick={() => openDir(getDirForLang(lang))}>🗂</button>
                </div>
              </div>
            ))
          )}

          {dirty && (
            <div className="toolbar" style={{ marginTop: 4 }}>
              <button className="btn btn-success" onClick={handleSavePaths}>💾 경로 저장</button>
            </div>
          )}
        </div>

        {/* 생성 실행 */}
        <div className="card">
          <div className="card-title">생성 실행</div>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
            Proto 정의를 기반으로 선택한 언어의 데이터 구조 코드를 생성합니다.
            현재 설정된 경로: <strong style={{ color: '#6fcf97' }}>{configuredCount}개</strong>
          </p>

          {/* 전체 생성 */}
          <div style={{ marginBottom: 16 }}>
            <button
              className="btn btn-primary"
              onClick={handleGenerateAll}
              disabled={generating !== null || configuredCount === 0}
              style={{ fontSize: 14, padding: '8px 20px' }}
            >
              {generating === 'all' ? '생성 중...' : `⚡ 전체 생성 (${configuredCount}개 언어)`}
            </button>
          </div>

          {/* 언어별 개별 생성 */}
          <div className="toolbar">
            {availableLanguages
              .filter((lang) => getDirForLang(lang).trim())
              .map((lang) => (
                <button
                  key={lang}
                  className="btn btn-ghost"
                  onClick={() => handleGenerate(lang)}
                  disabled={generating !== null}
                >
                  {generating === lang ? '생성 중...' : `🛠 ${getLabel(lang)} 생성`}
                </button>
              ))}
            {configuredCount === 0 && (
              <span style={{ fontSize: 13, color: '#4b5563' }}>
                출력 경로를 설정하면 생성 버튼이 활성화됩니다.
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
