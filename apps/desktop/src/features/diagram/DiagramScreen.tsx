import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildSchemaGraph,
  layoutSchemaGraph,
  schemaGraphNeighbors,
  toNativeError,
  type ProtoEnumDeclaration,
  type ProtoMessageDeclaration,
  type SchemaGraph,
  type SchemaGraphNode
} from '@datamanager/core'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps
} from '@xyflow/react'
import { LocateFixed, RefreshCw, Search, Settings } from 'lucide-react'
import { createNativePort } from '../../adapters/native/createNativePort'
import type { NativePort } from '../../adapters/native/NativePort'
import { loadProtoWorkspace, type LoadedProtoWorkspace } from '../schema/protoWorkspaceService'

interface DiagramScreenProps {
  nativePort?: NativePort
  onOpenSettings?: () => void
}

interface DiagramNodeData extends Record<string, unknown> {
  graphNode: SchemaGraphNode
  color: string
  dimmed: boolean
  emphasized: boolean
}

type DiagramNode = Node<DiagramNodeData, 'schema'>
type DiagramEdge = Edge<{ fieldName: string; repeated: boolean }>

const nodeTypes = { schema: SchemaNode }

export function DiagramScreen(props: DiagramScreenProps): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <DiagramCanvas {...props} />
    </ReactFlowProvider>
  )
}

function DiagramCanvas({
  nativePort: providedNativePort,
  onOpenSettings
}: DiagramScreenProps): React.JSX.Element {
  const nativePort = useMemo(() => providedNativePort ?? createNativePort(), [providedNativePort])
  const [loaded, setLoaded] = useState<LoadedProtoWorkspace | null>(null)
  const [graph, setGraph] = useState<SchemaGraph | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<DiagramEdge>([])
  const [query, setQuery] = useState('')
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { fitView } = useReactFlow<DiagramNode, DiagramEdge>()

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const next = await loadProtoWorkspace(nativePort)
      setLoaded(next)
      const nextGraph = buildSchemaGraph(next.workspace)
      setGraph(nextGraph)
      const positions = new Map(
        layoutSchemaGraph(nextGraph, next.settings.diagram.maxNodesPerColumn).map((position) => [
          position.id,
          position
        ])
      )
      setNodes(
        nextGraph.nodes.map((node) =>
          toFlowNode(node, positions.get(node.id), next.settings.diagram.fileColors)
        )
      )
      setEdges(nextGraph.edges.map(toFlowEdge))
    } catch (cause) {
      setError(toNativeError(cause).message)
    } finally {
      setLoading(false)
    }
  }, [nativePort, setEdges, setNodes])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (nodes.length > 0) void fitView({ padding: 0.18, maxZoom: 1.1 })
  }, [fitView, graph, nodes.length])

  const resetLayout = (): void => {
    if (!graph || !loaded) return
    const positions = new Map(
      layoutSchemaGraph(graph, loaded.settings.diagram.maxNodesPerColumn).map((position) => [
        position.id,
        position
      ])
    )
    setNodes((current) =>
      current.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position }))
    )
    window.requestAnimationFrame(() => void fitView({ padding: 0.18, maxZoom: 1.1 }))
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

  return (
    <main className="diagram-page">
      <div className="diagram-toolbar">
        <div>
          <p className="section-eyebrow">Schema graph</p>
          <h2>관계도</h2>
        </div>
        <label className="diagram-search">
          <Search aria-hidden="true" size={16} />
          <input
            aria-label="관계도 검색"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="테이블, Enum, 필드 검색"
            value={query}
          />
        </label>
        <div className="diagram-toolbar-actions">
          <button
            aria-label="자동 배치"
            className="icon-button"
            onClick={resetLayout}
            title="자동 배치"
          >
            <LocateFixed aria-hidden="true" size={17} />
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

      {error ? <div className="notice notice-error">{error}</div> : null}
      {!loaded?.settings.protoRoot && !loading ? (
        <div className="empty-workspace">
          <p>Proto 루트가 설정되지 않았습니다.</p>
          <button className="button button-primary icon-text-button" onClick={onOpenSettings}>
            <Settings aria-hidden="true" size={16} /> 설정 열기
          </button>
        </div>
      ) : (
        <div className="diagram-surface" aria-busy={loading}>
          {graph && graph.nodes.length > 0 ? (
            <ReactFlow<DiagramNode, DiagramEdge>
              edges={visibleEdges}
              fitView
              fitViewOptions={{ padding: 0.18, maxZoom: 1.1 }}
              maxZoom={1.7}
              minZoom={0.2}
              nodes={visibleNodes}
              nodesConnectable={false}
              nodeTypes={nodeTypes}
              onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
              onEdgeMouseLeave={() => setHoveredEdgeId(null)}
              onEdgesChange={onEdgesChange}
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
            <div className="diagram-empty">표시할 테이블 또는 Enum이 없습니다.</div>
          )}
          {graph?.unresolvedReferences.length ? (
            <div className="diagram-warning">미해결 참조 {graph.unresolvedReferences.length}개</div>
          ) : null}
        </div>
      )}
    </main>
  )
}

function SchemaNode({ data }: NodeProps<DiagramNode>): React.JSX.Element {
  const declaration = data.graphNode.declaration
  return (
    <div
      className={`diagram-node diagram-node-${data.graphNode.kind}${data.dimmed ? ' diagram-node-dimmed' : ''}${data.emphasized ? ' diagram-node-emphasized' : ''}`}
      style={{ '--node-color': data.color } as React.CSSProperties}
    >
      <Handle position={Position.Left} type="target" />
      <div className="diagram-node-heading">
        <span>{data.graphNode.kind === 'message' ? 'TABLE' : 'ENUM'}</span>
        <strong>{data.graphNode.name}</strong>
        <small>{data.graphNode.sourceFile}</small>
      </div>
      {declaration.kind === 'message' ? (
        <MessageNodeBody declaration={declaration} />
      ) : (
        <EnumNodeBody declaration={declaration} />
      )}
      <Handle position={Position.Right} type="source" />
    </div>
  )
}

function MessageNodeBody({
  declaration
}: {
  declaration: ProtoMessageDeclaration
}): React.JSX.Element {
  return (
    <div className="diagram-node-rows nowheel">
      {declaration.fields.map((field) => (
        <div key={`${field.name}-${field.fieldNumber}`}>
          <span className="diagram-field-key">
            {field.isPrimaryKey ? 'PK' : field.isGroupKey ? 'KEY' : field.fieldNumber}
          </span>
          <span>{field.name}</span>
          <small>{field.label === 'repeated' ? `${field.type}[]` : field.type}</small>
        </div>
      ))}
    </div>
  )
}

function EnumNodeBody({ declaration }: { declaration: ProtoEnumDeclaration }): React.JSX.Element {
  return (
    <div className="diagram-node-rows diagram-enum-rows nowheel">
      {declaration.values.map((value) => (
        <div key={`${value.name}-${value.number}`}>
          <span>{value.name}</span>
          <small>{value.number}</small>
        </div>
      ))}
    </div>
  )
}

function toFlowNode(
  graphNode: SchemaGraphNode,
  position: { x: number; y: number } | undefined,
  fileColors: Record<string, string>
): DiagramNode {
  return {
    id: graphNode.id,
    type: 'schema',
    ariaLabel: `${graphNode.kind === 'message' ? '테이블' : 'Enum'} ${graphNode.name}`,
    position: position ?? { x: 0, y: 0 },
    data: {
      graphNode,
      color:
        fileColors[graphNode.sourceFile] ?? (graphNode.kind === 'enum' ? '#a0652a' : '#007d74'),
      dimmed: false,
      emphasized: false
    }
  }
}

function toFlowEdge(edge: SchemaGraph['edges'][number]): DiagramEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: { fieldName: edge.fieldName, repeated: edge.repeated },
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
    type: 'smoothstep'
  }
}

function searchableText(node: SchemaGraphNode): string {
  const declarationText =
    node.declaration.kind === 'message'
      ? node.declaration.fields.map((field) => `${field.name} ${field.type}`).join(' ')
      : node.declaration.values.map((value) => value.name).join(' ')
  return `${node.name} ${node.sourceFile} ${declarationText}`.toLocaleLowerCase()
}
