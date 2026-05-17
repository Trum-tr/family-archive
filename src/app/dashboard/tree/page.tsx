'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NODE_W = 130
const NODE_H = 168
const GEN_GAP = 220
const NODE_GAP = 50
const PAD = 100

// Цвета для семейных групп (связных компонент)
const FAMILY_COLORS = [
  { strip: '#f59e0b', label: 'Семья 1' },
  { strip: '#3b82f6', label: 'Семья 2' },
  { strip: '#10b981', label: 'Семья 3' },
  { strip: '#ec4899', label: 'Семья 4' },
  { strip: '#8b5cf6', label: 'Семья 5' },
  { strip: '#ef4444', label: 'Семья 6' },
  { strip: '#14b8a6', label: 'Семья 7' },
  { strip: '#f97316', label: 'Семья 8' },
]

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  clan_name: string | null
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

/** Union-Find для поиска связных семейных групп */
function findFamilyGroups(persons: Person[], rels: Rel[]): Record<string, number> {
  const parent: Record<string, string> = {}
  persons.forEach(p => { parent[p.id] = p.id })

  function find(x: string): string {
    if (parent[x] !== x) parent[x] = find(parent[x])
    return parent[x]
  }
  function union(a: string, b: string) {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }

  for (const r of rels) {
    union(r.person1_id, r.person2_id)
  }

  const groupMap: Record<string, number> = {}
  let counter = 0
  const result: Record<string, number> = {}
  for (const p of persons) {
    const root = find(p.id)
    if (groupMap[root] === undefined) groupMap[root] = counter++
    result[p.id] = groupMap[root]
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

  // Pan & Zoom
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [scale, setScale] = useState(1)
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from('persons')
          .select('id, first_name, last_name, clan_name, birth_date, death_date, main_photo_url')
          .eq('created_by', user.id),
        supabase.from('relationships').select('id, person1_id, person2_id, relation_type'),
      ])
      setPersons((p as Person[]) || [])
      setRels((r as Rel[]) || [])
      setLoading(false)
    }
    load()
  }, [router])

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.12 : 0.9
    setScale(prev => {
      const newScale = Math.min(4, Math.max(0.15, prev * factor))
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect) {
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        setTx(txPrev => mx - (mx - txPrev) * (newScale / prev))
        setTy(tyPrev => my - (my - tyPrev) * (newScale / prev))
      }
      return newScale
    })
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('[data-node]')) return
    dragging.current = true
    dragStart.current = { x: e.clientX - tx, y: e.clientY - ty }
  }, [tx, ty])

  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging.current) return
    setTx(e.clientX - dragStart.current.x)
    setTy(e.clientY - dragStart.current.y)
  }, [])

  const onMouseUp = useCallback(() => { dragging.current = false }, [])

  const resetView = () => { setTx(0); setTy(0); setScale(1) }

  const nodes = buildLayout(persons, rels)
  const nodeIndex: Record<string, NodeData> = {}
  nodes.forEach(n => { nodeIndex[n.id] = n })
  const familyGroups = findFamilyGroups(persons, rels)
  const uniqueGroups = [...new Set(Object.values(familyGroups))].sort()

  // Для каждой группы — название рода (если задано хоть у кого-то из группы)
  const groupClanName: Record<number, string> = {}
  for (const p of persons) {
    const g = familyGroups[p.id]
    if (p.clan_name && !groupClanName[g]) {
      groupClanName[g] = p.clan_name
    }
  }
  const getGroupLabel = (g: number): string =>
    groupClanName[g] || FAMILY_COLORS[g % FAMILY_COLORS.length].label

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
    <div className="min-h-screen bg-stone-50 flex flex-col select-none">
      {/* Шапка */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 bg-white border-b border-stone-200">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-stone-400 text-sm hover:text-stone-600 transition-colors">
            ← Дашборд
          </Link>
          <span className="text-stone-200">·</span>
          <h1 className="text-sm font-medium text-stone-800">Семейное дерево</h1>
          {persons.length > 0 && (
            <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
              {persons.length} {persons.length === 1 ? 'профиль' : persons.length < 5 ? 'профиля' : 'профилей'}
            </span>
          )}
          <span className="hidden sm:inline text-xs text-stone-300 pl-1">
            колёсико — зум &nbsp;·&nbsp; тащи — перемещение
          </span>
          <span className="hidden md:flex items-center gap-3 pl-2 text-xs text-stone-300">
            <span className="flex items-center gap-1">
              <svg width="20" height="6"><path d="M0 3 L20 3" stroke="#c8c4be" strokeWidth="1.5"/></svg>
              родитель
            </span>
            <span className="flex items-center gap-1">
              <svg width="20" height="6"><path d="M0 3 L20 3" stroke="#c8c4be" strokeWidth="1.5" strokeDasharray="4 3"/></svg>
              супруги
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {uniqueGroups.length > 1 && (
            <div className="hidden sm:flex items-center gap-2">
              {uniqueGroups.slice(0, 5).map(g => (
                <span key={g} className="flex items-center gap-1 text-xs text-stone-500">
                  <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: FAMILY_COLORS[g % FAMILY_COLORS.length].strip }} />
                  {getGroupLabel(g)}
                </span>
              ))}
              {uniqueGroups.length > 5 && (
                <span className="text-xs text-stone-400">+{uniqueGroups.length - 5}</span>
              )}
            </div>
          )}
          <Link
            href="/dashboard/persons"
            className="text-xs text-stone-500 hover:text-stone-800 transition-colors border border-stone-200 rounded-lg px-3 py-1.5"
          >
            Управление профилями
          </Link>
        </div>
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
        <div className="flex-1 overflow-hidden relative">
          {/* Кнопки зума */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
            <button onClick={() => setScale(s => Math.min(4, s * 1.2))}
              className="w-8 h-8 bg-white border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 text-lg font-light shadow-sm flex items-center justify-center">
              +
            </button>
            <button onClick={() => setScale(s => Math.max(0.15, s * 0.8))}
              className="w-8 h-8 bg-white border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 text-lg font-light shadow-sm flex items-center justify-center">
              −
            </button>
            <button onClick={resetView} title="Сбросить вид"
              className="w-8 h-8 bg-white border border-stone-200 rounded-lg text-stone-500 hover:bg-stone-50 text-xs shadow-sm flex items-center justify-center">
              ↺
            </button>
          </div>

          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            style={{ cursor: 'grab', touchAction: 'none' }}
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <defs>
              <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000018" />
              </filter>
              {/* clipPath для фото-аватаров — вынесены в defs чтобы гарантированно работали */}
              {nodes.map(node => (
                <clipPath key={`cp-def-${node.id}`} id={`cp-${node.id}`}>
                  <circle cx={node.x + NODE_W / 2} cy={node.y + 54} r={34} />
                </clipPath>
              ))}
            </defs>

            <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>
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
                const groupIdx = familyGroups[node.id] ?? 0
                const color = FAMILY_COLORS[groupIdx % FAMILY_COLORS.length].strip

                return (
                  <g key={node.id} data-node="true"
                    onClick={() => router.push(`/dashboard/persons/${node.id}`)}
                    style={{ cursor: 'pointer' }}>

                    {/* Фон карточки */}
                    <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={12}
                      fill="white" stroke="#e7e5e4" strokeWidth={1} filter="url(#card-shadow)" />

                    {/* Цветная полоска — path с закруглёнными верхними углами (без clipPath) */}
                    <path
                      d={`M ${x} ${y+12} A 12 12 0 0 1 ${x+12} ${y} L ${x+NODE_W-12} ${y} A 12 12 0 0 1 ${x+NODE_W} ${y+12} L ${x+NODE_W} ${y+8} L ${x} ${y+8} Z`}
                      fill={color}
                    />

                    {/* Аватар фон */}
                    <circle cx={x + NODE_W / 2} cy={y + 54} r={34} fill="#e7e5e4" />
                    {node.main_photo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <foreignObject x={x + NODE_W / 2 - 34} y={y + 20} width={68} height={68}
                        clipPath={`url(#cp-${node.id})`}>
                        <img src={node.main_photo_url} alt=""
                          style={{ width: 68, height: 68, objectFit: 'cover', borderRadius: '50%' }} />
                      </foreignObject>
                    ) : (
                      /* SVG-силуэт: тёмный для контраста с фоном */
                      <g>
                        <circle cx={x + NODE_W / 2} cy={y + 44} r={13} fill="#a8a29e" />
                        <ellipse cx={x + NODE_W / 2} cy={y + 71} rx={21} ry={16} fill="#a8a29e" />
                      </g>
                    )}

                    {/* Фамилия */}
                    <text x={x + NODE_W / 2} y={y + 106} textAnchor="middle" fontSize={11} fontWeight="600"
                      fill="#292524" fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                      {lastName.length > 14 ? lastName.slice(0, 13) + '…' : lastName}
                    </text>

                    {/* Имя */}
                    <text x={x + NODE_W / 2} y={y + 122} textAnchor="middle" fontSize={11}
                      fill="#44403c" fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                      {firstName.length > 14 ? firstName.slice(0, 13) + '…' : firstName}
                    </text>

                    {/* Годы */}
                    {years && (
                      <text x={x + NODE_W / 2} y={y + 140} textAnchor="middle" fontSize={10}
                        fill="#a8a29e" fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                        {years}
                      </text>
                    )}

                    {/* Кнопка открыть */}
                    <rect x={x + 12} y={y + NODE_H - 28} width={NODE_W - 24} height={18} rx={6} fill="#f5f5f4" />
                    <text x={x + NODE_W / 2} y={y + NODE_H - 15} textAnchor="middle" fontSize={9}
                      fill="#a8a29e" fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                      Открыть профиль →
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>

        </div>
      )}
    </div>
  )
}
