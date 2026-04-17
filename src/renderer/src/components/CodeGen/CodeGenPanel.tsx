import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '../../store/appStore'
import { IPC } from '../../../../shared/ipc-channels'
import { ipcInvoke } from '../../hooks/useIpc'
import type { OutputDirConfig } from '../../../../shared/types'

// protoc 언어 키 → 표시 레이블
const LANGUAGE_LABELS: Record<string, string> = {
  cpp: 'C++',
  csharp: 'C#',
  java: 'Java',
  python: 'Python',
  ruby: 'Ruby',
  php: 'PHP',
  golang: 'Go',
  rust: 'Rust(지원예정)',
}

function getLabel(lang: string): string {
  return LANGUAGE_LABELS[lang] ?? lang.toUpperCase()
}

export function CodeGenPanel(): React.JSX.Element {
  const { settings, saveSettings } = useAppStore()

  const [availableLanguages, setAvailableLanguages] = useState<string[]>([])
  const [outputDirs, setOutputDirs] = useState<OutputDirConfig[]>([])
  const [protocPath, setProtocPath] = useState('')
  const [generating, setGenerating] = useState<string | 'all' | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    ipcInvoke<string[]>(IPC.CODEGEN_LIST_LANGUAGES).then((r) => {
      if (r.success && r.data) setAvailableLanguages(r.data)
    })
  }, [])

  useEffect(() => {
    if (settings) {
      setOutputDirs(settings.outputDirs ?? [])
      setProtocPath(settings.protocPath ?? '')
      setDirty(false)
    }
  }, [settings])

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

  const pickProtoc = async (): Promise<void> => {
    const result = await ipcInvoke<string>(IPC.SETTINGS_SELECT_FILE, {
      title: 'protoc 실행 파일 선택',
      filters: [
        { name: 'protoc', extensions: ['exe', '*'] },
        { name: '모든 파일', extensions: ['*'] }
      ]
    })
    if (result.success && result.data) {
      setProtocPath(result.data)
      setDirty(true)
    }
  }

  const handleSavePaths = async (): Promise<void> => {
    const filtered = outputDirs.filter((o) => o.dir.trim())
    await saveSettings({ outputDirs: filtered, protocPath })
    setDirty(false)
    toast.success('설정이 저장되었습니다.')
  }

  const handleGenerate = async (lang: string): Promise<void> => {
    if (dirty) { toast.error('변경된 경로를 먼저 저장하세요.'); return }
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
    if (dirty) { toast.error('변경된 경로를 먼저 저장하세요.'); return }
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
            💾 저장
          </button>
        )}
      </div>
      <div className="page-body">

        {/* 생성 실행 */}
        <div className="card">
          <div className="card-title">생성 실행</div>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
            proto 파일을 <code style={{ color: '#a0c4ff' }}>protoc</code>로 컴파일하여 코드를 생성합니다.
            경로가 설정된 언어: <strong style={{ color: '#6fcf97' }}>{configuredCount}개</strong>
          </p>

          <div style={{ marginBottom: 16 }}>
            <button
              className="btn btn-primary"
              onClick={handleGenerateAll}
              disabled={generating !== null || configuredCount === 0 || !protocPath}
              style={{ fontSize: 14, padding: '8px 20px' }}
            >
              {generating === 'all' ? '생성 중...' : `⚡ 전체 생성 (${configuredCount}개 언어)`}
            </button>
          </div>

          <div className="toolbar">
            {availableLanguages
              .filter((lang) => getDirForLang(lang).trim())
              .map((lang) => (
                <button
                  key={lang}
                  className="btn btn-ghost"
                  onClick={() => handleGenerate(lang)}
                  disabled={generating !== null || !protocPath}
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

        {/* 출력 경로 설정 */}
        <div className="card">
          <div className="card-title">언어별 출력 경로</div>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
            생성할 언어와 출력 폴더를 지정합니다. 경로가 비어 있는 언어는 생성에서 제외됩니다. 
          </p>

          {availableLanguages.map((lang) => (
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
                <button className="btn btn-ghost" onClick={() => pickDir(lang)} title="폴더 선택">📂</button>
                <button className="btn btn-ghost" title="탐색기에서 열기" onClick={() => openDir(getDirForLang(lang))}>↗</button>
              </div>
            </div>
          ))}

          {dirty && (
            <div className="toolbar" style={{ marginTop: 4 }}>
              <button className="btn btn-success" onClick={handleSavePaths}>💾 저장</button>
            </div>
          )}
        </div>

        {/* protoc 경로 */}
        <div className="card">
          <div className="card-title">protoc 설정</div>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>
            Protocol Buffers 컴파일러(<code style={{ color: '#a0c4ff' }}>protoc</code>) 실행 파일 경로를 지정합니다.&nbsp;
            <a href="https://github.com/protocolbuffers/protobuf/releases" target="_blank" rel="noopener noreferrer">다운로드</a>
          </p>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>
            Go는 <code style={{ color: '#a0c4ff' }}>protoc-gen-go</code>, Rust는 <code style={{ color: '#a0c4ff' }}>protoc-gen-rust</code> 플러그인이 PATH에 있어야 합니다.
          </p>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">protoc 실행 파일</label>
            <div className="path-row">
              <input
                className="form-input path-input"
                placeholder="protoc.exe 경로 (예: C:\tools\protoc\bin\protoc.exe)"
                value={protocPath}
                onChange={(e) => { setProtocPath(e.target.value); setDirty(true) }}
              />
              <button className="btn btn-ghost" onClick={pickProtoc}>📂</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

