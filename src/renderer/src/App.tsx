import { useState, useEffect } from 'react'
import { useAppStore } from './store/appStore'
import { DiagramView } from './components/DiagramView/DiagramCanvas'
import { TableCreator } from './components/TableCreator/TableCreator'
import { EnumCreator } from './components/EnumCreator/EnumCreator'
import { ExcelPanel } from './components/ExcelPanel/ExcelPanel'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { CodeGenPanel } from './components/CodeGen/CodeGenPanel'

type Page = 'diagram' | 'table-creator' | 'enum-creator' | 'excel' | 'codegen' | 'settings'

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: 'diagram', label: '관계도', icon: '🗂' },
  { id: 'table-creator', label: '테이블', icon: '📋' },
  { id: 'enum-creator', label: 'Enum', icon: '🔢' },
  { id: 'excel', label: 'Excel', icon: '📊' },
  { id: 'codegen', label: '코드 생성', icon: '🛠' },
  { id: 'settings', label: '설정', icon: '⚙️' }
]

function App(): React.JSX.Element {
  const [page, setPage] = useState<Page>('diagram')
  const { loadSettings, loadProto } = useAppStore()

  useEffect(() => {
    const init = async (): Promise<void> => {
      await loadSettings()
      // loadSettings 이후 최신 상태를 store에서 직접 읽어 proto 자동 로드
      const s = useAppStore.getState().settings
      if (s?.protoDir) await loadProto()
    }
    init()
  }, [])

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-title">DataManager</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        {page === 'diagram' && <DiagramView />}
        {page === 'table-creator' && <TableCreator />}
        {page === 'enum-creator' && <EnumCreator />}
        {page === 'excel' && <ExcelPanel />}
        {page === 'codegen' && <CodeGenPanel />}
        {page === 'settings' && <SettingsPanel />}
      </main>
    </div>
  )
}

export default App
