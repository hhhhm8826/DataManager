import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildSchemaGraph,
  diagramNodeSize,
  formatDiagnosticMessage,
  normalizeDiagramPosition,
  normalizeDiagramViewport,
  overlappingNodePairs,
  projectSchemaDiagram,
  schemaGraphNeighbors,
  toNativeError,
  type DiagramProjection,
  type ProtoEnumDeclaration,
  type ProtoMessageDeclaration,
  type SavedDiagramLayout,
  type SchemaGraph,
  type SchemaGraphEdge,
  type SchemaGraphNode
} from '@datamanager/core'
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type Viewport
} from '@xyflow/react'
import {
  ArrowLeft,
  EyeOff,
  FolderInput,
  LocateFixed,
  RefreshCw,
  Save,
  Search,
  Settings,
  Trash2,
  X
} from 'lucide-react'
import { createNativePort } from '../../adapters/native/createNativePort'
import type { NativePort } from '../../adapters/native/NativePort'
import { useWorkspaceMetadataStore } from '../projectMetadata/workspaceMetadataStore'
import { loadProtoWorkspace, type LoadedProtoWorkspace } from '../schema/protoWorkspaceService'
import {
  fallbackDiagramLayout,
  runDiagramLayoutWorker,
  type DiagramLayoutResult,
  type DiagramLayoutRunner
} from './diagramLayout'

interface DiagramScreenProps {
  nativePort?: NativePort
  onOpenSettings?: () => void
  layoutRunner?: DiagramLayoutRunner
}

type DetailView =
  | {
      kind: 'enum'
      nodeId: string
      context?: { tableName: string; fieldName: string; repeated: boolean }
    }
  | {
      kind: 'table'
      nodeId: string
      context?: { tableName: string; fieldName: string; repeated: boolean }
    }
  | { kind: 'hidden' }

interface DiagramNodeData extends Record<string, unknown> {
  graphNode: SchemaGraphNode
  color: string
  dimmed: boolean
  emphasized: boolean
  incomingEdgeIds: string[]
  enumByName: Readonly<Record<string, SchemaGraphNode>>
  modalMessageByName: Readonly<Record<string, SchemaGraphNode>>
  onOpenDetail: (view: DetailView) => void
}

interface DiagramEdgeData extends Record<string, unknown> {
  fieldName: string
  repeated: boolean
  points: Array<{ x: number; y: number }>
}

type DiagramNode = Node<DiagramNodeData, 'schema'>
type DiagramEdge = Edge<DiagramEdgeData, 'orthogonal'>

const nodeTypes = { schema: SchemaNode }
const edgeTypes = { orthogonal: OrthogonalEdge }

export function DiagramScreen(props: DiagramScreenProps): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <DiagramCanvas {...props} />
    </ReactFlowProvider>
  )
}

function DiagramCanvas({
  nativePort: providedNativePort,
  onOpenSettings,
  layoutRunner = runDiagramLayoutWorker
}: DiagramScreenProps): React.JSX.Element {
  const nativePort = useMemo(() => providedNativePort ?? createNativePort(), [providedNativePort])
  const [loaded, setLoaded] = useState<LoadedProtoWorkspace | null>(null)
  const [graph, setGraph] = useState<SchemaGraph | null>(null)
  const [projection, setProjection] = useState<DiagramProjection | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<DiagramEdge>([])
  const [query, setQuery] = useState('')
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [layouting, setLayouting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [layoutWarning, setLayoutWarning] = useState<string | null>(null)
  const [thresholdInput, setThresholdInput] = useState('5')
  const [dirty, setDirty] = useState(false)
  const [detailStack, setDetailStack] = useState<DetailView[]>([])
  const [pendingLayoutAction, setPendingLayoutAction] = useState<'load' | 'delete' | null>(null)
  const layoutRevision = useRef(0)
  const detailOpener = useRef<HTMLElement | null>(null)
  const applyingViewport = useRef(false)
  const pendingThresholdUpdate = useRef<Promise<void> | null>(null)
  const metadata = useWorkspaceMetadataStore((state) => state.metadata)
  const metadataBusy = useWorkspaceMetadataStore((state) => state.loading)
  const { fitView, getNodes, getViewport, setViewport } = useReactFlow<DiagramNode, DiagramEdge>()

  const closeDetails = useCallback((): void => {
    const opener = detailOpener.current
    setDetailStack([])
    detailOpener.current = null
    window.setTimeout(() => opener?.focus(), 0)
  }, [])
  const openDetail = useCallback((view: DetailView): void => {
    if (detailOpener.current === null) detailOpener.current = document.activeElement as HTMLElement
    setDetailStack((current) => [...current, view])
  }, [])
  const backDetail = useCallback((): void => {
    setDetailStack((current) => {
      if (current.length <= 1) {
        const opener = detailOpener.current
        detailOpener.current = null
        window.setTimeout(() => opener?.focus(), 0)
        return []
      }
      return current.slice(0, -1)
    })
  }, [])

  const applyLayout = useCallback(
    async (
      nextProjection: DiagramProjection,
      fileColors: Record<string, string>,
      markDirty: boolean
    ): Promise<void> => {
      const revision = ++layoutRevision.current
      setLayouting(true)
      setLayoutWarning(null)
      try {
        const result = await layoutRunner(nextProjection, revision)
        if (revision !== layoutRevision.current) return
        setNodes(toFlowNodes(nextProjection, result, fileColors, openDetail))
        setEdges(toFlowEdges(nextProjection.edges, result))
        setDirty(markDirty)
        window.requestAnimationFrame(() => void fitView({ padding: 0.18, maxZoom: 1.1 }))
      } catch {
        if (revision !== layoutRevision.current) return
        setLayoutWarning('자동 배치를 계산하지 못했습니다. 마지막 정상 배치를 유지합니다.')
        setNodes((current) =>
          current.length > 0
            ? current
            : toFlowNodes(
                nextProjection,
                fallbackDiagramLayout(nextProjection),
                fileColors,
                openDetail
              )
        )
        setEdges((current) =>
          current.length > 0 ? current : toFlowEdges(nextProjection.edges, { nodes: [], edges: [] })
        )
      } finally {
        if (revision === layoutRevision.current) setLayouting(false)
      }
    },
    [fitView, layoutRunner, openDetail, setEdges, setNodes]
  )

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const next = await loadProtoWorkspace(nativePort)
      const nextMetadata = next.settings.protoRoot
        ? await useWorkspaceMetadataStore.getState().load(nativePort, next.settings.protoRoot)
        : useWorkspaceMetadataStore.getState().metadata
      const nextGraph = buildSchemaGraph(next.workspace)
      const nextProjection = projectSchemaDiagram(nextGraph, nextMetadata.diagram.hubThreshold)
      setLoaded(next)
      setGraph(nextGraph)
      setProjection(nextProjection)
      setThresholdInput(String(nextMetadata.diagram.hubThreshold))
      if (nextMetadata.diagram.savedLayout) {
        const result = layoutFromSaved(nextProjection, nextMetadata.diagram.savedLayout)
        setNodes(toFlowNodes(nextProjection, result, next.settings.diagram.fileColors, openDetail))
        setEdges(toFlowEdges(nextProjection.edges, { nodes: result.nodes, edges: [] }))
        setDirty(false)
        warnForSavedOverlap(nextProjection, result, setLayoutWarning)
        applyingViewport.current = true
        window.requestAnimationFrame(() => {
          void setViewport(nextMetadata.diagram.savedLayout!.viewport, { duration: 0 }).finally(
            () => {
              applyingViewport.current = false
              setDirty(false)
            }
          )
        })
      } else {
        await applyLayout(nextProjection, next.settings.diagram.fileColors, true)
      }
    } catch (cause) {
      setError(formatDiagnosticMessage(toNativeError(cause)))
    } finally {
      setLoading(false)
    }
  }, [applyLayout, nativePort, openDetail, setEdges, setNodes, setViewport])

  useEffect(() => {
    void reload()
  }, [reload])

  const resetLayout = (): void => {
    if (!projection || !loaded || layouting) return
    void applyLayout(projection, loaded.settings.diagram.fileColors, true)
  }

  const applyThreshold = async (): Promise<void> => {
    if (!graph || !loaded) return
    const threshold = Number(thresholdInput)
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 50) {
      setError('연결 간소화 기준은 1부터 50 사이의 정수여야 합니다.')
      setThresholdInput(String(metadata.diagram.hubThreshold))
      return
    }
    if (threshold === metadata.diagram.hubThreshold) return
    setError(null)
    const nextProjection = projectSchemaDiagram(graph, threshold)
    const update = (async (): Promise<void> => {
      try {
        await useWorkspaceMetadataStore
          .getState()
          .updateSection(nativePort, loaded.settings.protoRoot, 'diagram', {
            ...metadata.diagram,
            hubThreshold: threshold
          })
        setProjection(nextProjection)
        await applyLayout(nextProjection, loaded.settings.diagram.fileColors, true)
      } catch (cause) {
        setError(formatDiagnosticMessage(toNativeError(cause)))
        setThresholdInput(String(metadata.diagram.hubThreshold))
      }
    })()
    pendingThresholdUpdate.current = update
    try {
      await update
    } finally {
      if (pendingThresholdUpdate.current === update) pendingThresholdUpdate.current = null
    }
  }

  const saveLayout = async (): Promise<void> => {
    if (!loaded || !graph) return
    await pendingThresholdUpdate.current
    const threshold = Number(thresholdInput)
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 50) {
      setError('연결 간소화 기준은 1부터 50 사이의 정수여야 합니다.')
      setThresholdInput(String(useWorkspaceMetadataStore.getState().metadata.diagram.hubThreshold))
      return
    }
    const currentDiagram = useWorkspaceMetadataStore.getState().metadata.diagram
    const messageIds = new Set(
      graph.nodes.filter(({ kind }) => kind === 'message').map(({ id }) => id)
    )
    const positions = Object.fromEntries(
      Object.entries(currentDiagram.savedLayout?.positions ?? {}).filter(([id]) =>
        messageIds.has(id)
      )
    )
    for (const node of getNodes()) positions[node.id] = normalizeDiagramPosition(node.position)
    const savedLayout: SavedDiagramLayout = {
      hubThreshold: threshold,
      positions,
      viewport: normalizeDiagramViewport(getViewport())
    }
    try {
      await useWorkspaceMetadataStore
        .getState()
        .updateSection(nativePort, loaded.settings.protoRoot, 'diagram', {
          ...currentDiagram,
          hubThreshold: threshold,
          savedLayout
        })
      setDirty(false)
    } catch (cause) {
      setError(formatDiagnosticMessage(toNativeError(cause)))
    }
  }

  const loadSavedLayout = async (): Promise<void> => {
    if (!projection || !graph || !loaded || !metadata.diagram.savedLayout) return
    const savedLayout = metadata.diagram.savedLayout
    const savedThreshold = savedLayout.hubThreshold ?? metadata.diagram.hubThreshold
    const nextProjection = projectSchemaDiagram(graph, savedThreshold)
    if (savedThreshold !== metadata.diagram.hubThreshold) {
      try {
        await useWorkspaceMetadataStore
          .getState()
          .updateSection(nativePort, loaded.settings.protoRoot, 'diagram', {
            ...metadata.diagram,
            hubThreshold: savedThreshold
          })
      } catch (cause) {
        setError(formatDiagnosticMessage(toNativeError(cause)))
        return
      }
    }
    setError(null)
    setThresholdInput(String(savedThreshold))
    setProjection(nextProjection)
    const result = layoutFromSaved(nextProjection, savedLayout)
    setNodes(toFlowNodes(nextProjection, result, loaded.settings.diagram.fileColors, openDetail))
    setEdges(toFlowEdges(nextProjection.edges, { nodes: result.nodes, edges: [] }))
    applyingViewport.current = true
    void setViewport(savedLayout.viewport, { duration: 0 }).finally(() => {
      applyingViewport.current = false
      setDirty(false)
    })
    warnForSavedOverlap(nextProjection, result, setLayoutWarning)
  }

  const deleteSavedLayout = async (): Promise<void> => {
    if (!loaded) return
    try {
      await useWorkspaceMetadataStore
        .getState()
        .updateSection(nativePort, loaded.settings.protoRoot, 'diagram', {
          ...metadata.diagram,
          savedLayout: null
        })
      setDirty(true)
    } catch (cause) {
      setError(formatDiagnosticMessage(toNativeError(cause)))
    }
  }

  const confirmLayoutAction = (): void => {
    const action = pendingLayoutAction
    setPendingLayoutAction(null)
    if (action === 'load') void loadSavedLayout()
    if (action === 'delete') void deleteSavedLayout()
  }

  const visibleNodes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    const matches = new Set(
      nodes
        .filter(
          (node) => normalized === '' || searchableText(node.data.graphNode).includes(normalized)
        )
        .map((node) => node.id)
    )
    const neighbors = hoveredNodeId && graph ? schemaGraphNeighbors(graph, hoveredNodeId) : null
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        dimmed:
          (normalized !== '' && !matches.has(node.id)) ||
          Boolean(neighbors && !neighbors.has(node.id)),
        emphasized: node.id === hoveredNodeId
      }
    }))
  }, [graph, hoveredNodeId, nodes, query])

  const visibleEdges = useMemo(() => {
    const dimmedNodes = new Set(
      visibleNodes.filter((node) => node.data.dimmed).map((node) => node.id)
    )
    return edges.map((edge) => {
      const hovered = edge.id === hoveredEdgeId
      const dimmed = dimmedNodes.has(edge.source) || dimmedNodes.has(edge.target)
      return {
        ...edge,
        label: hovered ? `${edge.data?.fieldName}${edge.data?.repeated ? '[]' : ''}` : undefined,
        animated: hovered,
        style: {
          stroke: hovered ? '#007d74' : '#7a898a',
          strokeWidth: hovered ? 2.3 : 1.35,
          opacity: dimmed ? 0.12 : 0.78
        }
      }
    })
  }, [edges, hoveredEdgeId, visibleNodes])

  const searchResults = useMemo(() => modalSearchResults(projection, query), [projection, query])
  const currentDetail = detailStack.at(-1)

  return (
    <main className="diagram-page">
      <div className="diagram-toolbar">
        <div>
          <p className="section-eyebrow">Schema graph</p>
          <h2>관계도</h2>
        </div>
        <div className="diagram-search-wrap">
          <label className="diagram-search">
            <Search aria-hidden="true" size={16} />
            <input
              aria-label="관계도 검색"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="테이블, Enum, 필드 검색"
              value={query}
            />
          </label>
          {searchResults.length > 0 ? (
            <div className="diagram-search-results" role="listbox" aria-label="관계도 검색 결과">
              {searchResults.slice(0, 8).map((result) => (
                <button key={result.key} onClick={() => openDetail(result.view)} type="button">
                  <strong>{result.label}</strong>
                  <span>{result.sourceFile}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="diagram-toolbar-actions">
          <label className="hub-threshold-control">
            <span>연결 간소화 기준</span>
            <input
              aria-label="연결 간소화 기준"
              inputMode="numeric"
              max={50}
              min={1}
              onBlur={() => void applyThreshold()}
              onChange={(event) => setThresholdInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void applyThreshold()
              }}
              step={1}
              type="number"
              value={thresholdInput}
            />
          </label>
          {projection && projection.hiddenNodes.length > 0 ? (
            <button
              className="button button-secondary icon-text-button"
              onClick={() => openDetail({ kind: 'hidden' })}
              type="button"
            >
              <EyeOff aria-hidden="true" size={16} /> 모달 테이블 {projection.hiddenNodes.length}개
            </button>
          ) : null}
          <button
            aria-label="자동 배치"
            className="icon-button"
            disabled={layouting}
            onClick={resetLayout}
            title="자동 배치"
          >
            <LocateFixed aria-hidden="true" size={17} />
          </button>
          <button
            aria-label="배치 저장"
            className="icon-button"
            disabled={layouting || nodes.length === 0}
            onClick={() => void saveLayout()}
            title="배치 저장"
          >
            <Save aria-hidden="true" size={17} />
          </button>
          <button
            aria-label="저장 배치 불러오기"
            className="icon-button"
            disabled={!metadata.diagram.savedLayout || metadataBusy}
            onClick={() => (dirty ? setPendingLayoutAction('load') : void loadSavedLayout())}
            title="저장 배치 불러오기"
          >
            <FolderInput aria-hidden="true" size={17} />
          </button>
          <button
            aria-label="저장 배치 삭제"
            className="icon-button"
            disabled={!metadata.diagram.savedLayout || metadataBusy}
            onClick={() => (dirty ? setPendingLayoutAction('delete') : void deleteSavedLayout())}
            title="저장 배치 삭제"
          >
            <Trash2 aria-hidden="true" size={17} />
          </button>
          <button
            aria-label="관계도 새로고침"
            className="icon-button"
            disabled={loading}
            onClick={() => void reload()}
            title="관계도 새로고침"
          >
            <RefreshCw aria-hidden="true" size={17} />
          </button>
        </div>
      </div>

      <div className="diagram-status-row" aria-live="polite">
        {layouting ? <span>배치 계산 중...</span> : null}
        {dirty ? <span>저장되지 않은 배치</span> : null}
      </div>
      {error ? <div className="notice notice-error">{error}</div> : null}
      {!loaded?.settings.protoRoot && !loading ? (
        <div className="empty-workspace">
          <p>Proto 루트가 설정되지 않았습니다.</p>
          <button className="button button-primary icon-text-button" onClick={onOpenSettings}>
            <Settings aria-hidden="true" size={16} /> 설정 열기
          </button>
        </div>
      ) : (
        <div className="diagram-surface" aria-busy={loading || layouting}>
          {projection && projection.nodes.length > 0 ? (
            <ReactFlow<DiagramNode, DiagramEdge>
              edgeTypes={edgeTypes}
              edges={visibleEdges}
              fitView={!metadata.diagram.savedLayout}
              fitViewOptions={{ padding: 0.18, maxZoom: 1.1 }}
              maxZoom={1.7}
              minZoom={0.2}
              nodes={visibleNodes}
              nodesConnectable={false}
              nodeTypes={nodeTypes}
              onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
              onEdgeMouseLeave={() => setHoveredEdgeId(null)}
              onEdgesChange={onEdgesChange}
              onMoveEnd={(_, viewport) =>
                !applyingViewport.current &&
                setDirty(layoutDirty(nodes, viewport, metadata.diagram.savedLayout))
              }
              onNodeDragStart={() =>
                setEdges((current) =>
                  current.map((edge) => ({
                    ...edge,
                    data: edge.data ? { ...edge.data, points: [] } : edge.data
                  }))
                )
              }
              onNodeDragStop={(_, dragged) => {
                const nextNodes = nodes.map((node) => (node.id === dragged.id ? dragged : node))
                setDirty(layoutDirty(nextNodes, getViewport(), metadata.diagram.savedLayout))
              }}
              onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
              onNodeMouseLeave={() => setHoveredNodeId(null)}
              onNodesChange={onNodesChange}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#cbd4d4" gap={22} size={1} />
              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap
                maskColor="rgb(235 241 241 / 70%)"
                nodeColor={(node) => (node.data?.color as string | undefined) ?? '#78918c'}
                pannable
                position="bottom-right"
                zoomable
              />
            </ReactFlow>
          ) : loading ? (
            <div className="diagram-empty">Proto를 불러오는 중입니다.</div>
          ) : (
            <div className="diagram-empty">표시할 테이블이 없습니다.</div>
          )}
          {graph?.unresolvedReferences.length ? (
            <div className="diagram-warning">미해결 참조 {graph.unresolvedReferences.length}개</div>
          ) : null}
          {layoutWarning ? <div className="diagram-warning">{layoutWarning}</div> : null}
        </div>
      )}

      {currentDetail && graph && projection ? (
        <TypeDetailDialog
          graph={graph}
          onBack={backDetail}
          onClose={closeDetails}
          onNavigate={openDetail}
          projection={projection}
          showBack={detailStack.length > 1}
          view={currentDetail}
        />
      ) : null}
      {pendingLayoutAction ? (
        <ConfirmLayoutDialog
          action={pendingLayoutAction}
          onCancel={() => setPendingLayoutAction(null)}
          onConfirm={confirmLayoutAction}
        />
      ) : null}
    </main>
  )
}

function SchemaNode({ data }: NodeProps<DiagramNode>): React.JSX.Element {
  const declaration = data.graphNode.declaration as ProtoMessageDeclaration
  return (
    <div
      className={`diagram-node diagram-node-message${data.dimmed ? ' diagram-node-dimmed' : ''}${data.emphasized ? ' diagram-node-emphasized' : ''}`}
      style={{ '--node-color': data.color } as React.CSSProperties}
    >
      {data.incomingEdgeIds.map((edgeId, index) => (
        <Handle
          id={`target:${edgeId}`}
          key={edgeId}
          position={Position.Left}
          style={{
            top: `${68 + ((index + 1) / (data.incomingEdgeIds.length + 1)) * Math.max(32, declaration.fields.length * 32)}px`
          }}
          type="target"
        />
      ))}
      <div className="diagram-node-heading">
        <span>TABLE</span>
        <strong>{data.graphNode.name}</strong>
        <small>{data.graphNode.sourceFile}</small>
      </div>
      <MessageNodeBody data={data} declaration={declaration} />
    </div>
  )
}

function MessageNodeBody({
  data,
  declaration
}: {
  data: DiagramNodeData
  declaration: ProtoMessageDeclaration
}): React.JSX.Element {
  return (
    <div className="diagram-node-rows nowheel">
      {declaration.fields.map((field, index) => {
        const enumNode = data.enumByName[unqualifiedType(field.type)]
        const modalMessage = data.modalMessageByName[unqualifiedType(field.type)]
        const detailNode = enumNode ?? modalMessage
        return (
          <div key={`${field.name}-${field.fieldNumber}`}>
            <span className="diagram-field-key">
              {field.isPrimaryKey ? 'PK' : field.isGroupKey ? 'KEY' : field.fieldNumber}
            </span>
            <span>{field.name}</span>
            {detailNode ? (
              <button
                className="diagram-type-button nodrag"
                onClick={() =>
                  data.onOpenDetail({
                    kind: enumNode ? 'enum' : 'table',
                    nodeId: detailNode.id,
                    context: {
                      tableName: declaration.name,
                      fieldName: field.name,
                      repeated: field.label === 'repeated'
                    }
                  })
                }
                type="button"
              >
                {field.label === 'repeated' ? `${field.type}[]` : field.type}
              </button>
            ) : (
              <small>{field.label === 'repeated' ? `${field.type}[]` : field.type}</small>
            )}
            <Handle
              id={`source:${field.name}`}
              position={Position.Right}
              style={{ top: `${68 + (index + 0.5) * 32}px` }}
              type="source"
            />
          </div>
        )
      })}
    </div>
  )
}

function OrthogonalEdge(props: EdgeProps<DiagramEdge>): React.JSX.Element {
  const points = props.data?.points ?? []
  const [fallbackPath, fallbackLabelX, fallbackLabelY] = getSmoothStepPath(props)
  const path =
    points.length > 1
      ? points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
      : fallbackPath
  const labelPoint = points[Math.floor(points.length / 2)]
  const labelX = labelPoint?.x ?? fallbackLabelX
  const labelY = labelPoint?.y ?? fallbackLabelY
  return (
    <>
      <BaseEdge {...props} path={path} />
      {props.label ? (
        <EdgeLabelRenderer>
          <div
            className="react-flow__edge-text nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {props.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

function TypeDetailDialog({
  graph,
  onBack,
  onClose,
  onNavigate,
  projection,
  showBack,
  view
}: {
  graph: SchemaGraph
  onBack: () => void
  onClose: () => void
  onNavigate: (view: DetailView) => void
  projection: DiagramProjection
  showBack: boolean
  view: DetailView
}): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLButtonElement>('button')?.focus()
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]')]
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, view])
  const title = detailTitle(view, graph)
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
      role="presentation"
    >
      <div
        aria-labelledby="type-detail-title"
        aria-modal="true"
        className="impact-dialog type-detail-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <div className="dialog-heading">
          <div className="dialog-title-with-back">
            {showBack ? (
              <button aria-label="이전 상세" className="icon-button" onClick={onBack} title="이전">
                <ArrowLeft aria-hidden="true" size={17} />
              </button>
            ) : null}
            <h3 id="type-detail-title">{title}</h3>
          </div>
          <button aria-label="상세 창 닫기" className="icon-button" onClick={onClose} title="닫기">
            <X aria-hidden="true" size={17} />
          </button>
        </div>
        <div className="type-detail-content">
          <DetailContent
            graph={graph}
            onNavigate={onNavigate}
            projection={projection}
            view={view}
          />
        </div>
      </div>
    </div>
  )
}

function DetailContent({
  graph,
  onNavigate,
  projection,
  view
}: {
  graph: SchemaGraph
  onNavigate: (view: DetailView) => void
  projection: DiagramProjection
  view: DetailView
}): React.JSX.Element {
  if (view.kind === 'hidden') {
    return (
      <div className="detail-list">
        {projection.hiddenNodes.map((node) => (
          <button key={node.id} onClick={() => onNavigate({ kind: 'table', nodeId: node.id })}>
            <strong>{node.name}</strong>
            <span>{node.sourceFile}</span>
          </button>
        ))}
      </div>
    )
  }
  const node = graph.nodes.find(({ id }) => id === view.nodeId)
  if (!node) return <p>현재 스키마에서 선언을 찾을 수 없습니다.</p>
  if (view.kind === 'enum') {
    const declaration = node.declaration as ProtoEnumDeclaration
    return (
      <>
        <p className="detail-source">{node.sourceFile}</p>
        {view.context ? (
          <p className="detail-context">
            참조: {view.context.tableName}.{view.context.fieldName}
            {view.context.repeated ? ' (반복)' : ''}
          </p>
        ) : null}
        <div className="enum-detail-values">
          {declaration.values.map((value) => (
            <div key={`${value.name}-${value.number}`}>
              <span>{value.name}</span>
              <strong>{value.number}</strong>
            </div>
          ))}
        </div>
      </>
    )
  }
  const declaration = node.declaration as ProtoMessageDeclaration
  return (
    <>
      <p className="detail-source">{node.sourceFile}</p>
      {view.kind === 'table' && view.context ? (
        <p className="detail-context">
          참조: {view.context.tableName}.{view.context.fieldName}
          {view.context.repeated ? ' (반복)' : ''}
        </p>
      ) : null}
      <div className="table-detail-fields">
        {declaration.fields.map((field) => {
          const target = graph.nodes.find(({ name }) => name === unqualifiedType(field.type))
          return (
            <div key={field.name}>
              <span>
                {field.isPrimaryKey ? 'PK' : field.isGroupKey ? 'KEY' : field.fieldNumber}
              </span>
              <strong>{field.name}</strong>
              {target &&
              (target.kind === 'enum' ||
                projection.hiddenNodes.some(({ id }) => id === target.id)) ? (
                <button
                  onClick={() =>
                    onNavigate(
                      target.kind === 'enum'
                        ? { kind: 'enum', nodeId: target.id }
                        : { kind: 'table', nodeId: target.id }
                    )
                  }
                >
                  {field.type}
                </button>
              ) : (
                <small>{field.type}</small>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function ConfirmLayoutDialog({
  action,
  onCancel,
  onConfirm
}: {
  action: 'load' | 'delete'
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="layout-confirm-title"
        aria-modal="true"
        className="impact-dialog"
        role="dialog"
      >
        <div className="dialog-heading">
          <h3 id="layout-confirm-title">저장되지 않은 배치가 있습니다</h3>
        </div>
        <p className="dialog-copy">
          {action === 'load'
            ? '현재 배치를 버리고 저장된 배치를 불러옵니다.'
            : '저장된 배치를 삭제하면 현재 배치는 저장되지 않은 상태로 남습니다.'}
        </p>
        <div className="dialog-actions">
          <button className="button button-secondary" onClick={onCancel}>
            취소
          </button>
          <button className="button button-primary" onClick={onConfirm}>
            계속
          </button>
        </div>
      </div>
    </div>
  )
}

function toFlowNodes(
  projection: DiagramProjection,
  layout: DiagramLayoutResult,
  fileColors: Record<string, string>,
  onOpenDetail: (view: DetailView) => void
): DiagramNode[] {
  const positions = new Map(layout.nodes.map((node) => [node.id, node]))
  const enumByName = Object.fromEntries(projection.enumNodes.map((node) => [node.name, node]))
  const modalMessageByName = Object.fromEntries(
    projection.hiddenNodes.map((node) => [node.name, node])
  )
  return projection.nodes.map((graphNode) => {
    const position = positions.get(graphNode.id)
    const size = diagramNodeSize(graphNode)
    return {
      id: graphNode.id,
      type: 'schema',
      ariaLabel: `테이블 ${graphNode.name}`,
      position: position ?? { x: 0, y: 0 },
      style: { width: size.width },
      data: {
        graphNode,
        color: fileColors[graphNode.sourceFile] ?? '#007d74',
        dimmed: false,
        emphasized: false,
        incomingEdgeIds: projection.edges
          .filter((edge) => edge.target === graphNode.id)
          .map((edge) => edge.id),
        enumByName,
        modalMessageByName,
        onOpenDetail
      }
    }
  })
}

function toFlowEdges(
  edges: readonly SchemaGraphEdge[],
  layout: DiagramLayoutResult
): DiagramEdge[] {
  const routes = new Map(layout.edges.map((edge) => [edge.id, edge.points]))
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: `source:${edge.fieldName}`,
    targetHandle: `target:${edge.id}`,
    data: {
      fieldName: edge.fieldName,
      repeated: edge.repeated,
      points: routes.get(edge.id) ?? []
    },
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
    type: 'orthogonal'
  }))
}

function layoutFromSaved(
  projection: DiagramProjection,
  savedLayout: SavedDiagramLayout
): DiagramLayoutResult {
  const fallback = fallbackDiagramLayout(projection)
  const fallbackById = new Map(fallback.nodes.map((node) => [node.id, node]))
  const maxSavedX = Math.max(0, ...Object.values(savedLayout.positions).map(({ x }) => x))
  let missing = 0
  return {
    nodes: projection.nodes.map((node) => {
      const size = diagramNodeSize(node)
      const saved = savedLayout.positions[node.id]
      const fallbackNode = fallbackById.get(node.id)!
      const position = saved ?? {
        x: maxSavedX + 420 + (missing % 2) * 390,
        y: Math.floor(missing++ / 2) * 260 + fallbackNode.y
      }
      return { id: node.id, ...position, ...size }
    }),
    edges: []
  }
}

function layoutDirty(
  nodes: ReadonlyArray<{
    id: string
    position?: { x: number; y: number }
    x?: number
    y?: number
  }>,
  viewport: Viewport,
  savedLayout: SavedDiagramLayout | null
): boolean {
  if (!savedLayout) return nodes.length > 0
  const normalizedViewport = normalizeDiagramViewport(viewport)
  if (JSON.stringify(normalizedViewport) !== JSON.stringify(savedLayout.viewport)) return true
  return nodes.some((node) => {
    const point = node.position ?? { x: node.x ?? 0, y: node.y ?? 0 }
    return (
      JSON.stringify(normalizeDiagramPosition(point)) !==
      JSON.stringify(savedLayout.positions[node.id])
    )
  })
}

function warnForSavedOverlap(
  projection: DiagramProjection,
  result: DiagramLayoutResult,
  setWarning: (warning: string | null) => void
): void {
  const boxes = result.nodes.map((node) => {
    const graphNode = projection.nodes.find(({ id }) => id === node.id)!
    return {
      ...node,
      ...diagramNodeSize(graphNode)
    }
  })
  setWarning(
    overlappingNodePairs(boxes).length > 0
      ? '저장된 배치에서 테이블이 겹칩니다. 자동 배치를 사용해 정리하세요.'
      : null
  )
}

function modalSearchResults(
  projection: DiagramProjection | null,
  query: string
): Array<{ key: string; label: string; sourceFile: string; view: DetailView }> {
  const normalized = query.trim().toLocaleLowerCase()
  if (!projection || !normalized) return []
  const hidden = projection.hiddenNodes
    .filter((node) => searchableText(node).includes(normalized))
    .map((node) => ({
      key: node.id,
      label: `모달 테이블 ${node.name}`,
      sourceFile: node.sourceFile,
      view: { kind: 'table' as const, nodeId: node.id }
    }))
  const enums = projection.enumNodes
    .filter((node) => searchableText(node).includes(normalized))
    .map((node) => ({
      key: node.id,
      label: `Enum ${node.name}`,
      sourceFile: node.sourceFile,
      view: { kind: 'enum' as const, nodeId: node.id }
    }))
  return [...hidden, ...enums]
}

function detailTitle(view: DetailView, graph: SchemaGraph): string {
  if (view.kind === 'hidden') return '모달 테이블'
  const node = graph.nodes.find(({ id }) => id === view.nodeId)
  return node?.name ?? '선언 상세'
}

function searchableText(node: SchemaGraphNode): string {
  const declarationText =
    node.declaration.kind === 'message'
      ? node.declaration.fields.map((field) => `${field.name} ${field.type}`).join(' ')
      : node.declaration.values.map((value) => `${value.name} ${value.number}`).join(' ')
  return `${node.name} ${node.sourceFile} ${declarationText}`.toLocaleLowerCase()
}

function unqualifiedType(type: string): string {
  return type.replace(/^\./, '').split('.').at(-1) ?? type
}
