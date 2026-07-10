import { lazy, Suspense, useMemo, useState } from 'react'
import { Braces, Code2, FileSpreadsheet, Network, Settings, Table2 } from 'lucide-react'
import { Toaster } from 'sonner'
import { createNativePort } from '../adapters/native/createNativePort'
import { SchemaScreen } from '../features/schema/SchemaScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'

const DiagramScreen = lazy(async () => {
  const module = await import('../features/diagram/DiagramScreen')
  return { default: module.DiagramScreen }
})
const ExcelScreen = lazy(async () => {
  const module = await import('../features/excel/ExcelScreen')
  return { default: module.ExcelScreen }
})
const CodegenScreen = lazy(async () => {
  const module = await import('../features/codegen/CodegenScreen')
  return { default: module.CodegenScreen }
})

if (import.meta.env.VITE_EXCEL_SPIKE === '1') {
  void import('../adapters/excel/ExcelWorkerClient')
    .then(({ runExcelSpikeInWorker }) => runExcelSpikeInWorker())
    .catch((error: unknown) => console.error('Excel worker spike failed.', error))
}

export function App(): React.JSX.Element {
  const nativePort = useMemo(() => createNativePort(), [])
  const [activeArea, setActiveArea] = useState<WorkspaceArea>('diagram')

  return (
    <div className="application-shell">
      <header className="application-header">
        <div>
          <p className="application-kicker">Data workspace</p>
          <h1>DataManager</h1>
        </div>
        <nav aria-label="작업 영역" className="workspace-navigation">
          {workspaceAreas.map(({ id, label, Icon }) => (
            <button
              aria-current={activeArea === id ? 'page' : undefined}
              className={activeArea === id ? 'workspace-nav-active' : undefined}
              key={id}
              onClick={() => setActiveArea(id)}
            >
              <Icon aria-hidden="true" size={16} /> {label}
            </button>
          ))}
        </nav>
      </header>
      <Suspense fallback={<div className="workspace-loading">작업 영역을 불러오는 중입니다.</div>}>
        <WorkspaceContent
          activeArea={activeArea}
          nativePort={nativePort}
          onOpenSettings={() => setActiveArea('settings')}
        />
      </Suspense>
      <Toaster closeButton position="bottom-right" richColors />
    </div>
  )
}

type WorkspaceArea = 'diagram' | 'tables' | 'enums' | 'excel' | 'codegen' | 'settings'

const workspaceAreas = [
  { id: 'diagram', label: '관계도', Icon: Network },
  { id: 'tables', label: '테이블', Icon: Table2 },
  { id: 'enums', label: 'Enum', Icon: Braces },
  { id: 'excel', label: 'Excel', Icon: FileSpreadsheet },
  { id: 'codegen', label: '코드 생성', Icon: Code2 },
  { id: 'settings', label: '설정', Icon: Settings }
] as const

function WorkspaceContent({
  activeArea,
  nativePort,
  onOpenSettings
}: {
  activeArea: WorkspaceArea
  nativePort: ReturnType<typeof createNativePort>
  onOpenSettings: () => void
}): React.JSX.Element {
  switch (activeArea) {
    case 'diagram':
      return <DiagramScreen nativePort={nativePort} onOpenSettings={onOpenSettings} />
    case 'tables':
      return (
        <SchemaScreen focusKind="message" nativePort={nativePort} onOpenSettings={onOpenSettings} />
      )
    case 'enums':
      return (
        <SchemaScreen focusKind="enum" nativePort={nativePort} onOpenSettings={onOpenSettings} />
      )
    case 'excel':
      return <ExcelScreen nativePort={nativePort} onOpenSettings={onOpenSettings} />
    case 'codegen':
      return <CodegenScreen nativePort={nativePort} onOpenSettings={onOpenSettings} />
    case 'settings':
      return <SettingsScreen nativePort={nativePort} />
  }
}
