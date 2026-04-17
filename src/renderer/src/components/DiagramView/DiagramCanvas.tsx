import { useCallback, useEffect, useState } from 'react'
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
  if (messages.length === 0) return []
  const cols = Math.ceil(Math.sqrt(messages.length))
  const numRows = Math.ceil(messages.length / cols)

  // 각 노드의 실제 높이 계산
  const heights = messages.map((msg) => NODE_HEIGHT_BASE + msg.fields.length * NODE_FIELD_HEIGHT)

  // 행별 최대 높이
  const rowMaxHeights = Array<number>(numRows).fill(0)
  messages.forEach((_, i) => {
    const row = Math.floor(i / cols)
    rowMaxHeights[row] = Math.max(rowMaxHeights[row], heights[i])
  })

  // 행별 누적 y 오프셋
  const rowYOffsets = Array<number>(numRows).fill(0)
  for (let r = 1; r < numRows; r++) {
    rowYOffsets[r] = rowYOffsets[r - 1] + rowMaxHeights[r - 1] + ROW_GAP
  }

  return messages.map((_, i) => ({
    x: (i % cols) * (NODE_WIDTH + COLUMN_GAP),
    y: rowYOffsets[Math.floor(i / cols)]
  }))
}

export function DiagramView(): React.JSX.Element {
  const { parsed, parseErrors, isLoadingProto, loadProto } = useAppStore()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredPair, setHoveredPair] = useState<{ source: string; target: string } | null>(null)

  // 파싱 에러 → 토스트
  useEffect(() => {
    parseErrors.forEach((err) => toast.error(err))
  }, [parseErrors])

  // 노드/엣지 빌드
  useEffect(() => {
    if (!parsed) return
    const { messages, enums } = parsed

    const positions = buildLayout(messages)

    // 엣지 빌드 + 참조되는 필드 수집
    const messageNames = new Set(messages.map((m) => m.name))
    const newEdges: Edge[] = []
    const edgeSet = new Set<string>()
    // msgName -> 실제로 target handle로 연결되는 필드명 Set
    const referencedFieldsMap = new Map<string, Set<string>>()

    messages.forEach((msg) => {
      msg.fields.forEach((field) => {
        if (messageNames.has(field.type) && field.type !== msg.name) {
          const edgeId = `${msg.name}.${field.name}->${field.type}`
          if (!edgeSet.has(edgeId)) {
            edgeSet.add(edgeId)
            const targetMsg = messages.find((m) => m.name === field.type)
            const targetPk = targetMsg?.pkFields[0] ?? targetMsg?.fields[0]?.name
            if (targetPk) {
              if (!referencedFieldsMap.has(field.type)) referencedFieldsMap.set(field.type, new Set())
              referencedFieldsMap.get(field.type)!.add(targetPk)
            }
            newEdges.push({
              id: edgeId,
              source: msg.name,
              sourceHandle: `src-${field.name}`,
              target: field.type,
              targetHandle: targetPk ? `tgt-${targetPk}` : undefined,
              style: { stroke: '#a0c4ff', strokeWidth: 1.5 },
              labelStyle: { fontSize: 10, fill: '#9ca3af' }
            })
          }
        }
      })
    })

    const newNodes: Node[] = messages.map((msg, i) => ({
      id: msg.name,
      type: 'tableNode',
      position: positions[i],
      data: {
        message: msg,
        allEnums: enums,
        allMessages: messages,
        onMessageHover: setHoveredPair,
        referencedFields: referencedFieldsMap.get(msg.name) ?? new Set<string>()
      }
    }))

    setNodes(newNodes)
    setEdges(newEdges)
  }, [parsed])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  // 검색 쿼리에 따라 노드 opacity 조정
  const q = searchQuery.trim().toLowerCase()
  const displayNodes: Node[] = nodes.map((node) => {
    const matched = !q || node.id.toLowerCase().includes(q)
    const isHighlighted = hoveredPair
      ? node.id === hoveredPair.source || node.id === hoveredPair.target
      : false
    return {
      ...node,
      data: { ...node.data, isHighlighted },
      style: {
        ...node.style,
        opacity: matched ? 1 : 0.15,
        transition: 'opacity 0.2s'
      }
    }
  })
  const matchCount = q ? displayNodes.filter((n) => (n.style?.opacity ?? 1) === 1).length : nodes.length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <span className="page-title">테이블 관계도</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 검색 입력창 */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="테이블 검색..."
              style={{
                background: '#16213e',
                border: '1px solid #0f3460',
                borderRadius: 6,
                color: '#e0e0e0',
                padding: '5px 28px 5px 10px',
                fontSize: 13,
                width: 180,
                outline: 'none'
              }}
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: 6,
                  background: 'none', border: 'none', color: '#9ca3af',
                  cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1
                }}
              >✕</button>
            ) : (
              <span style={{ position: 'absolute', right: 8, color: '#4b5563', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
            )}
          </div>
          {q && (
            <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
              {matchCount}개 일치
            </span>
          )}
          <button className="btn btn-primary" onClick={loadProto} disabled={isLoadingProto}>
            {isLoadingProto ? '로딩 중...' : '🔄 다시 불러오기'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {!parsed || parsed.messages.length === 0 ? (
          <div className="empty-state">
            <p>설정에서 proto 디렉토리를 지정하고 불러오기를 클릭하세요.</p>
          </div>
        ) : (
          <ReactFlow
            nodes={displayNodes}
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
