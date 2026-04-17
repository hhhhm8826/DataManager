import { useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAppStore } from '../../store/appStore'
import { TableNode } from './TableNode'
import { toast } from 'sonner'
import type { ProtoMessage } from '../../../../shared/types'

const NODE_TYPES = { tableNode: TableNode }
const NODE_WIDTH = 260
const NODE_HEIGHT_BASE = 60
const NODE_FIELD_HEIGHT = 30
const COLUMN_GAP = 100
const ROW_GAP = 60

function buildLayout(messages: ProtoMessage[]): { x: number; y: number }[] {
  const cols = Math.ceil(Math.sqrt(messages.length))
  return messages.map((msg, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const height = NODE_HEIGHT_BASE + msg.fields.length * NODE_FIELD_HEIGHT
    return {
      x: col * (NODE_WIDTH + COLUMN_GAP),
      y: row * (height + ROW_GAP)
    }
  })
}

export function DiagramView(): React.JSX.Element {
  const { parsed, parseErrors, isLoadingProto, loadProto } = useAppStore()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // 파싱 에러 → 토스트
  useEffect(() => {
    parseErrors.forEach((err) => toast.error(err))
  }, [parseErrors])

  // 노드/엣지 빌드
  useEffect(() => {
    if (!parsed) return
    const { messages, enums } = parsed

    const positions = buildLayout(messages)

    const newNodes: Node[] = messages.map((msg, i) => ({
      id: msg.name,
      type: 'tableNode',
      position: positions[i],
      data: { message: msg, allEnums: enums }
    }))

    // 엣지: 필드 타입이 다른 Message 이름과 일치할 때
    const messageNames = new Set(messages.map((m) => m.name))
    const newEdges: Edge[] = []
    const edgeSet = new Set<string>()

    messages.forEach((msg) => {
      msg.fields.forEach((field) => {
        if (messageNames.has(field.type) && field.type !== msg.name) {
          const edgeId = `${msg.name}->${field.type}`
          if (!edgeSet.has(edgeId)) {
            edgeSet.add(edgeId)
            newEdges.push({
              id: edgeId,
              source: msg.name,
              target: field.type,
              label: field.name,
              style: { stroke: '#a0c4ff', strokeWidth: 1.5 },
              labelStyle: { fontSize: 10, fill: '#9ca3af' }
            })
          }
        }
      })
    })

    setNodes(newNodes)
    setEdges(newEdges)
  }, [parsed])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <span className="page-title">테이블 관계도</span>
        <button className="btn btn-primary" onClick={loadProto} disabled={isLoadingProto}>
          {isLoadingProto ? '로딩 중...' : '🔄 다시 불러오기'}
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {!parsed || parsed.messages.length === 0 ? (
          <div className="empty-state">
            <p>설정에서 proto 디렉토리를 지정하고 불러오기를 클릭하세요.</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={NODE_TYPES}
            fitView
            style={{ background: '#1a1a2e' }}
          >
            <Background color="#0f3460" gap={24} />
            <Controls style={{ background: '#16213e', border: '1px solid #0f3460' }} />
            <MiniMap
              style={{ background: '#16213e', border: '1px solid #0f3460' }}
              nodeColor="#0f3460"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}
