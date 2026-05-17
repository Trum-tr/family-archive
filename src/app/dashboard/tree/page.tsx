'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NODE_W = 130
const NODE_H = 168
const GEN_GAP = 220
const NODE_GAP = 50
const PAD = 60

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  birth_date: string | null
  death_date: string | null
  main_photo_url: string | null
}

type Rel = {
  id: string
  person1_id: string
  person2_id: string
  relation_type: string
}

type NodeData = Person & { x: number; y: number }

function addToMap(map: Record<string, string[]>, key: string, val: string) {
  if (!map[key]) map[key] = []
  map[key].push(val)
}

function buildLayout(persons: Person[], rels: Rel[]): NodeData[] {
  if (persons.length === 0) return []

  const childrenOf: Record<string, string[]> = {}
  const parentsOf: Record<string, string[]> = {}

  for (const r of rels) {
    if (r.relation_type === 'parent') {
      addToMap(childrenOf, r.person1_id, r.person2_id)
      addToMap(parentsOf, r.person2_id, r.person1_id)
    } else if (r.relation_type === 'child') {
      addToMap(childrenOf, r.person2_id, r.person1_id)
      addToMap(parentsOf, r.person1_id, r.person2_id)
    }
  }

  const gen: Record<string, number> = {}
  const ids = persons.map(p => p.id)
  const roots = ids.filter(id => !parentsOf[id] || parentsOf[id].length === 0)
  const starts = roots.length > 0 ? roots : [ids[0]]
  starts.forEach(id => { gen[id] = 0 })

  const queue = [...starts]
  while (queue.length > 0) {
    const cur = queue.shift()!
    const children = childrenOf[cur] || []
    for (const child of children) {
      if (gen[child] === undefined) {
        gen[child] = gen[cur] + 1
        queue.push(child)
      }
    }
  }
  ids.forEach(id => { if (gen[id] === undefined) gen[id] = 0 })

  const byGen: Record<number, string[]> = {}
  ids.forEach(id => {
    const g = gen[id]
    if (!byGen[g]) byGen[g] = []
    byGen[g].push(id)
  })

  const genList = Object.entries(byGen).map(([g, list]) => ({ g: Number(g), list }))
  const maxW = Math.max(...genList.map(({ list }) => list.length * (NODE_W + NODE_GAP) - NODE_GAP))

  const result: NodeData[] = []
  for (const { g, list } of genList) {
    const rowW = list.length * (NODE_W + NODE_GAP) - NODE_GAP
    const offsetX = (maxW - rowW) / 2
    list.forEach((id, i) => {
      const person = persons.find(p => p.id === id)
      if (!person) return
      result.push({
        ...person,
        x: PAD + offsetX + i * (NODE_W + NODE_GAP),
        y: PAD + g * GEN_GAP,
      })
    })
  }
  return result
}

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const midY = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
}

export default function TreePage() {
  const [persons, setPersons] = useState<Person[]>([])
  const [rels, setRels] = useState<Rel[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from('persons')
          .select('id, first_name, last_name, birth_date, death_date, main_photo_url')
          .eq('created_by', user.id),
        supabase.from('relationships').select('id, person1_id, person2_id, relation_type'),
      ])
      setPersons((p as Person[]) || [])
      setRels((r as Rel[]) || [])
      setLoading(false)
    }
    load()
  }, [router])

  const nodes = buildLayout(persons, rels)
  const nodeIndex: Record<string, NodeData> = {}
  nodes.forEach(n => { nodeIndex[n.id] = n })

  const svgW = nodes.length > 0 ? Math.max(...nodes.map(n => n.x + NODE_W)) + PAD : 600
  const svgH = nodes.length > 0 ? Math.max(...nodes.map(n => n.y + NODE_H)) + PAD : 400

  type Edge = { d: string; dashed: boolean }
  const edges: Edge[] = []
  for (const r of rels) {
    const a = nodeIndex[r.person1_id]
    const b = nodeIndex[r.person2_id]
    if (!a || !b) continue
    if (r.relation_type === 'parent') {
      edges.push({ d: bezier(a.x + NODE_W / 2, a.y + NODE_H, b.x + NODE_W / 2, b.y), dashed: false })
    } else if (r.relation_type === 'child') {
      edges.push({ d: bezier(b.x + NODE_W / 2, b.y + NODE_H, a.x + NODE_W / 2, a.y), dashed: false })
    } else if (r.relation_type === 'spouse') {
      const left = a.x < b.x ? a : b
      const right = a.x < b.x ? b : a
      edges.push({ d: `M ${left.x + NODE_W} ${left.y + NODE_H / 2} L ${right.x} ${right.y + NODE_H / 2}`, dashed: true })
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 bg-white border-b border-stone-200">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-stone-400 text-sm hover:text-stone-600 transition-colors">
            ← Дашборд
          </Link>
          <span className="text-stone-200">·</span>
          <h1 className="text-sm font-medium text-stone-800">Семейное дерево</h1>
        </div>
        <Link
          href="/dashboard/persons"
          className="text-xs text-stone-500 hover:text-stone-800 transition-colors border border-stone-200 rounded-lg px-3 py-1.5"
        >
          Управление профилями
        </Link>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">Загрузка...</div>
      ) : persons.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <div className="text-5xl">🌳</div>
          <p className="text-stone-500 font-light text-lg">Дерево пусто</p>
          <p className="text-stone-400 text-sm">Добавьте профили предков чтобы построить семейное дерево</p>
          <Link href="/dashboard/persons/new" className="mt-2 px-5 py-2.5 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 transition-colors">
            Добавить профиль
          </Link>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <svg width={svgW} height={svgH} className="block">
            <defs>
              <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000018" />
              </filter>
            </defs>

            {edges.map((e, i) => (
              <path key={i} d={e.d} fill="none" stroke="#c8c4be" strokeWidth={1.5}
                strokeDasharray={e.dashed ? '6 4' : undefined} />
            ))}

            {nodes.map(node => {
              const { x, y } = node
              const lastName  = node.last_name  || ''
              const firstName = node.first_name || ''
              const birth = node.birth_date ? new Date(node.birth_date).getFullYear() : null
              const death = node.death_date ? new Date(node.death_date).getFullYear() : null
              const years = (birth || death) ? `${birth ?? '?'} – ${death ?? '...'}` : ''

              return (
                <g key={node.id} onClick={() => router.push(`/dashboard/persons/${node.id}`)}
                  style={{ cursor: 'pointer' }}>
                  <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={12}
                    fill="white" stroke="#e7e5e4" strokeWidth={1} filter="url(#card-shadow)" />

                  {/* Аватар */}
                  <circle cx={x + NODE_W / 2} cy={y + 50} r={34} fill="#f5f5f4" />
                  {node.main_photo_url
                    ? (
                      <>
                        <defs>
                          <clipPath id={`cp-${node.id}`}>
                            <circle cx={x + NODE_W / 2} cy={y + 50} r={34} />
                          </clipPath>
                        </defs>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <foreignObject x={x + NODE_W / 2 - 34} y={y + 16} width={68} height={68}
                          clipPath={`url(#cp-${node.id})`}>
                          <img src={node.main_photo_url} alt=""
                            style={{ width: 68, height: 68, objectFit: 'cover', borderRadius: '50%' }} />
                        </foreignObject>
                      </>
                    )
                    : (
                      <text x={x + NODE_W / 2} y={y + 57} textAnchor="middle" fontSize={26} fill="#d6d3d1">👤</text>
                    )
                  }

                  {/* Фамилия */}
                  <text x={x + NODE_W / 2} y={y + 102} textAnchor="middle" fontSize={11} fontWeight="600"
                    fill="#292524" fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                    {lastName.length > 14 ? lastName.slice(0, 13) + '…' : lastName}
                  </text>

                  {/* Имя */}
                  <text x={x + NODE_W / 2} y={y + 118} textAnchor="middle" fontSize={11}
                    fill="#44403c" fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                    {firstName.length > 14 ? firstName.slice(0, 13) + '…' : firstName}
                  </text>

                  {/* Годы */}
                  {years && (
                    <text x={x + NODE_W / 2} y={y + 136} textAnchor="middle" fontSize={10}
                      fill="#a8a29e" fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                      {years}
                    </text>
                  )}

                  {/* Подсказка */}
                  <rect x={x + 12} y={y + NODE_H - 28} width={NODE_W - 24} height={18} rx={6} fill="#f5f5f4" />
                  <text x={x + NODE_W / 2} y={y + NODE_H - 15} textAnchor="middle" fontSize={9}
                    fill="#a8a29e" fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                    Открыть профиль →
                  </text>
                </g>
              )
            })}
          </svg>

          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white border border-stone-200 rounded-xl px-4 py-2.5 flex items-center gap-5 text-xs text-stone-400 shadow-sm pointer-events-none">
            <span className="flex items-center gap-1.5">
              <svg width="24" height="8"><path d="M0 4 L24 4" stroke="#c8c4be" strokeWidth="1.5" /></svg>
              Родитель – ребёнок
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="24" height="8"><path d="M0 4 L24 4" stroke="#c8c4be" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
              Супруги
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
