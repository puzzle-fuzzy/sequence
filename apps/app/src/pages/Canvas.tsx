import { useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  ReactFlow,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Play } from 'lucide-react'

/* ── Custom nodes ── */

function ImageNode({ data }: NodeProps) {
  const [c1, , c2] = (data.color as string).split(' ')
  return (
    <div className="relative">
      <div
        className="w-48 aspect-4/3 cursor-grab active:cursor-grabbing"
        style={{ background: `linear-gradient(135deg, ${c1 || '#6366f1'}, ${c2 || c1 || '#a855f7'})` }}
      />
      <Handle type="target" position={Position.Top} className="border-border/50! !bg-background! size-3!" />
      <Handle type="source" position={Position.Bottom} className="border-border/50! !bg-background! size-3!" />
    </div>
  )
}

function VideoNode({ data }: NodeProps) {
  const [c1, , c2] = (data.color as string).split(' ')
  return (
    <div className="relative">
      <div
        className="w-64 aspect-video cursor-grab active:cursor-grabbing flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${c1 || '#1e1b4b'}, ${c2 || c1 || '#3b0764'})` }}
      >
        <div className="size-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
          <Play className="size-4 text-white fill-white ml-0.5" />
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="border-border/50! !bg-background! size-3!" />
      <Handle type="source" position={Position.Bottom} className="border-border/50! !bg-background! size-3!" />
    </div>
  )
}

function AudioNode({ data }: NodeProps) {
  return (
    <div className="relative">
      <div
        className="w-48 h-14 flex items-end gap-0.5 px-2 cursor-grab active:cursor-grabbing"
        style={{ background: `linear-gradient(135deg, ${(data.color as string).split(' ')[0] || '#292524'}, ${(data.color as string).split(' ')[2] || '#78716c'})` }}
      >
        {Array.from({ length: 32 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-white/35"
            style={{ height: `${16 + Math.sin(i * 0.6) * 12 + Math.sin(i * 1.3) * 6}%` }}
          />
        ))}
      </div>
      <Handle type="target" position={Position.Top} className="border-border/50! !bg-background! size-3!" />
      <Handle type="source" position={Position.Bottom} className="border-border/50! !bg-background! size-3!" />
    </div>
  )
}

/* ── Initial data ── */

const INITIAL_NODES: Node[] = [
  { id: 'img-1', type: 'image', position: { x: 40, y: 40 }, data: { color: '#1e3a5f #4facfe' } },
  { id: 'img-2', type: 'image', position: { x: 40, y: 280 }, data: { color: '#7c2d12 #f97316' } },
  { id: 'img-3', type: 'image', position: { x: 40, y: 520 }, data: { color: '#065f46 #34d399' } },
  { id: 'img-4', type: 'image', position: { x: 40, y: 760 }, data: { color: '#2d1b69 #7c3aed' } },
  { id: 'proc-1', type: 'image', position: { x: 340, y: 100 }, data: { color: '#0f0c29 #302b63' } },
  { id: 'proc-2', type: 'image', position: { x: 340, y: 340 }, data: { color: '#4a0e4e #d4145a' } },
  { id: 'proc-3', type: 'image', position: { x: 340, y: 580 }, data: { color: '#1a1a2e #e94560' } },
  { id: 'vid-1', type: 'video', position: { x: 640, y: 40 }, data: { color: '#0f172a #38bdf8' } },
  { id: 'vid-2', type: 'video', position: { x: 640, y: 300 }, data: { color: '#1e1b4b #3b0764' } },
  { id: 'vid-3', type: 'video', position: { x: 640, y: 560 }, data: { color: '#020617 #a855f7' } },
  { id: 'aud-1', type: 'audio', position: { x: 960, y: 120 }, data: { color: '#292524 #78716c' } },
  { id: 'aud-2', type: 'audio', position: { x: 960, y: 400 }, data: { color: '#1c1917 #a8a29e' } },
  { id: 'aud-3', type: 'audio', position: { x: 960, y: 680 }, data: { color: '#44403c #d6d3d1' } },
]

const MARKER = { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#9ca3af' }

const INITIAL_EDGES: Edge[] = [
  { id: 'e-img1-proc1', source: 'img-1', target: 'proc-1', markerEnd: MARKER },
  { id: 'e-img2-proc1', source: 'img-2', target: 'proc-1', markerEnd: MARKER },
  { id: 'e-img2-proc2', source: 'img-2', target: 'proc-2', markerEnd: MARKER },
  { id: 'e-img3-proc2', source: 'img-3', target: 'proc-2', markerEnd: MARKER },
  { id: 'e-img3-proc3', source: 'img-3', target: 'proc-3', markerEnd: MARKER },
  { id: 'e-img4-proc3', source: 'img-4', target: 'proc-3', markerEnd: MARKER },
  { id: 'e-proc1-vid1', source: 'proc-1', target: 'vid-1', markerEnd: MARKER },
  { id: 'e-proc1-vid2', source: 'proc-1', target: 'vid-2', markerEnd: MARKER },
  { id: 'e-proc2-vid2', source: 'proc-2', target: 'vid-2', markerEnd: MARKER },
  { id: 'e-proc2-vid3', source: 'proc-2', target: 'vid-3', markerEnd: MARKER },
  { id: 'e-proc3-vid3', source: 'proc-3', target: 'vid-3', markerEnd: MARKER },
  { id: 'e-vid1-aud1', source: 'vid-1', target: 'aud-1', markerEnd: MARKER },
  { id: 'e-vid2-aud2', source: 'vid-2', target: 'aud-2', markerEnd: MARKER },
  { id: 'e-vid3-aud3', source: 'vid-3', target: 'aud-3', markerEnd: MARKER },
]

/* ── Page ── */

export default function Canvas() {
  const { id } = useParams<{ id: string }>()
  const [nodes, _setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES)

  const onConnect = useCallback(
    (conn: Connection) => setEdges((eds) => addEdge({ ...conn, markerEnd: MARKER }, eds)),
    [setEdges],
  )

  const nodeTypes = useMemo(
    () => ({
      image: ImageNode,
      video: VideoNode,
      audio: AudioNode,
    }),
    [],
  )

  return (
    <div className="w-screen h-screen bg-white relative">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md bg-white/70 backdrop-blur-sm border border-border/50 text-xs text-muted-foreground z-10 pointer-events-none">
        Project #{id}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        colorMode="light"
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'default',
          animated: true,
          style: { stroke: '#9ca3af', strokeWidth: 1.5 },
        }}
        connectionLineStyle={{ stroke: '#9ca3af', strokeWidth: 2 }}
        deleteKeyCode="Backspace"
      />
    </div>
  )
}
