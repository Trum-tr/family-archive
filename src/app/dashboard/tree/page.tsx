'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─── Константы радиального дерева ──────────────────────────────
const RING_RADIUS = 210   // расстояние между кольцами (поколениями)
const NODE_R      = 42    // радиус аватара
const CANVAS      = 4000  // размер SVG-холста (большой, потом fitView)
const CX          = CANVAS / 2
const CY          = CANVAS / 2

// ─── Цвета узлов ───────────────────────────────────────────────
const COLOR_ROOT     = '#534AB7'  // фиолетовый — основоположник
const COLOR_ALIVE    = '#0F6E56'  // тёмно-зелёный — живые
const COLOR_DECEASED = '#78716c'  // серый — ушедшие
const COLOR_ROOT_BG  = '#EEEDFE'
const COLOR_ALIVE_BG = '#E1F5EE'
const COLOR_DEC_BG   = '#f5f5f4'

// ─── Типы ──────────────────────────────────────────────────────
type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  clan_name: string | null
  birth_date: string | null
  death_date: string | null
  main_photo_url: string | null
  is_alive: boolean
  is_root: boolean
}

type Rel = {
  id: string
  person1_id: string
  person2_id: string
  relation_type: string
}

type NodePos = {
  id: string
  x: number
  y: number
  depth: number
  angle: number
}

// ─── Построить карту детей ─────────────────────────────────────
function buildChildrenMap(persons: Person[], rels: Rel[]): Record<string, string[]> {
  const allIds = new Set(persons.map(p => p.id))
  const childrenOf: Record<string, string[]> = {}
  for (const r of rels) {
    if (!allIds.has(r.person1_id) || !allIds.has(r.person2_id)) continue
    const addEdge = (parent: string, child: string) => {
      if (!childrenOf[parent]) childrenOf[parent] = []
      if (!childrenOf[parent].includes(child)) childrenOf[parent].push(child)
    }
    if (r.relation_type === 'parent') addEdge(r.person1_id, r.person2_id)
    else if (r.relation_type === 'child') addEdge(r.person2_id, r.person1_id)
  }
  return childrenOf
}

// ─── Размер поддерева (для распределения угла) ─────────────────
function subtreeSize(id: string, childrenOf: Record<string, string[]>, visited: Set<string>): number {
  if (visited.has(id)) return 1
  visited.add(id)
  return 1 + (childrenOf[id] || []).reduce((s, c) => s + subtreeSize(c, childrenOf, visited), 0)
}

// ─── Радиальная раскладка ──────────────────────────────────────
function buildRadialLayout(persons: Person[], rels: Rel[]): NodePos[] {
  if (persons.length === 0) return []

  const childrenOf = buildChildrenMap(persons, rels)

  // Карта родителей
  const parentsOf: Record<string, string[]> = {}
  for (const r of rels) {
    const addParent = (child: string, parent: string) => {
      if (!parentsOf[child]) parentsOf[child] = []
      if (!parentsOf[child].includes(parent)) parentsOf[child].push(parent)
    }
    if (r.relation_type === 'parent') addParent(r.person2_id, r.person1_id)
    else if (r.relation_type === 'child') addParent(r.person1_id, r.person2_id)
  }

  // Выбор корня: is_root → без родителей → с наибольшим числом связей
  const rootPerson = persons.find(p => p.is_root)
    || persons.find(p => !parentsOf[p.id] || parentsOf[p.id].length === 0)
    || persons.reduce((best, p) => {
        const score = (childrenOf[p.id]?.length || 0) - (parentsOf[p.id]?.length || 0)
        const bestScore = (childrenOf[best.id]?.length || 0) - (parentsOf[best.id]?.length || 0)
        return score > bestScore ? p : best
      })

  const rootId = rootPerson.id
  const result: NodePos[] = []
  const placed = new Set<string>()

  // Корень — в центре
  result.push({ id: rootId, x: CX, y: CY, depth: 0, angle: 0 })
  placed.add(rootId)

  // Рекурсивное распределение углов
  function place(id: string, aStart: number, aEnd: number, depth: number) {
    const children = (childrenOf[id] || []).filter(c => !placed.has(c))
    if (children.length === 0) return

    const sizes = children.map(c => subtreeSize(c, childrenOf, new Set(placed)))
    const total = sizes.reduce((a, b) => a + b, 0)
    const span  = aEnd - aStart

    // Минимальный угол чтобы узлы не накладывались (зависит от радиуса кольца)
    const minAngle = Math.max(span / children.length, (2 * (NODE_R + 8)) / (depth * RING_RADIUS))

    let cur = aStart
    children.forEach((child, i) => {
      const fraction  = sizes[i] / total
      const allocated = Math.max(span * fraction, minAngle)
      const midAngle  = cur + allocated / 2
      const r = depth * RING_RADIUS

      placed.add(child)
      result.push({
        id: child,
        x: CX + r * Math.cos(midAngle),
        y: CY + r * Math.sin(midAngle),
        depth,
        angle: midAngle,
      })

      place(child, cur, cur + allocated, depth + 1)
      cur += allocated
    })
  }

  place(rootId, -Math.PI, Math.PI, 1)

  // Несвязанные персоны — на внешнем кольце
  const orphans = persons.filter(p => !placed.has(p.id))
  if (orphans.length > 0) {
    const maxDepth = Math.max(...result.map(n => n.depth), 1) + 1
    const r = maxDepth * RING_RADIUS
    orphans.forEach((p, i) => {
      const angle = (i / orphans.length) * Math.PI * 2 - Math.PI / 2
      result.push({ id: p.id, x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle), depth: maxDepth, angle })
    })
  }

  return result
}

// ─── Главный компонент ─────────────────────────────────────────
export default function TreePage() {
  const [persons, setPersons] = useState<Person[]>([])
  const [rels, setRels]       = useState<Rel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const router = useRouter()

  const [tx, setTx]       = useState(0)
  const [ty, setTy]       = useState(0)
  const [scale, setScale] = useState(1)
  const dragging    = useRef(false)
  const dragStart   = useRef({ x: 0, y: 0 })
  const svgRef      = useRef<SVGSVGElement>(null)
  const fittedRef   = useRef(false)

  // Блокируем браузерный pinch-zoom
  useEffect(() => {
    const prevent = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault() }
    document.addEventListener('wheel', prevent, { passive: false })
    return () => document.removeEventListener('wheel', prevent)
  }, [])

  // Загрузка данных
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from('persons')
          .select('id,first_name,last_name,clan_name,birth_date,death_date,main_photo_url,is_alive,is_root')
          .eq('created_by', user.id),
        supabase.from('relationships').select('id,person1_id,person2_id,relation_type'),
      ])
      setPersons((p as Person[]) || [])
      setRels((r as Rel[]) || [])
      setLoading(false)
    }
    load()
  }, [router])

  const nodes = buildRadialLayout(persons, rels)
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))
  const personMap = Object.fromEntries(persons.map(p => [p.id, p]))

  // ── fitView ────────────────────────────────────────────────────
  const fitView = useCallback(() => {
    if (nodes.length === 0 || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const xs = nodes.map(n => n.x)
    const ys = nodes.map(n => n.y)
    const minX = Math.min(...xs) - NODE_R - 80
    const maxX = Math.max(...xs) + NODE_R + 80
    const minY = Math.min(...ys) - NODE_R - 60
    const maxY = Math.max(...ys) + NODE_R + 60
    const w = maxX - minX
    const h = maxY - minY
    const s = Math.min(0.95, (rect.width - 40) / w, (rect.height - 40) / h)
    setScale(s)
    setTx((rect.width  - w * s) / 2 - minX * s)
    setTy((rect.height - h * s) / 2 - minY * s)
  }, [nodes])

  useEffect(() => {
    if (nodes.length > 0 && !fittedRef.current) {
      fittedRef.current = true
      requestAnimationFrame(() => requestAnimationFrame(fitView))
    }
  }, [nodes, fitView])

  // ── Зум колёсиком ──────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.91
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setScale(prev => {
      const next = Math.min(4, Math.max(0.1, prev * factor))
      setTx(t => mx - (mx - t) * (next / prev))
      setTy(t => my - (my - t) * (next / prev))
      return next
    })
  }, [])

  // ── Зум кнопками (центрирование) ───────────────────────────────
  const zoomBtn = useCallback((factor: number) => {
    if (!svgRef.current || nodes.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    if (!rect.width) return
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y)
    const minX = Math.min(...xs) - NODE_R - 80
    const maxX = Math.max(...xs) + NODE_R + 80
    const minY = Math.min(...ys) - NODE_R - 60
    const maxY = Math.max(...ys) + NODE_R + 60
    const w = maxX - minX, h = maxY - minY
    setScale(prev => {
      const next = Math.min(4, Math.max(0.1, prev * factor))
      setTx((rect.width  - w * next) / 2 - minX * next)
      setTy((rect.height - h * next) / 2 - minY * next)
      return next
    })
  }, [nodes])

  // ── Перетаскивание ─────────────────────────────────────────────
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

  // ── Рёбра ──────────────────────────────────────────────────────
  type Edge = { d: string; dashed: boolean; color: string }
  const edges: Edge[] = []

  for (const r of rels) {
    const a = nodeMap[r.person1_id]
    const b = nodeMap[r.person2_id]
    if (!a || !b) continue

    if (r.relation_type === 'spouse' || r.relation_type === 'sibling') {
      // Дуга между узлами одного уровня — пунктир
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      // Контрольная точка смещается к центру (для изгиба дуги)
      const dx = mx - CX, dy = my - CY
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const ctrlX = mx - dx / len * 40
      const ctrlY = my - dy / len * 40
      edges.push({
        d: `M ${a.x} ${a.y} Q ${ctrlX} ${ctrlY} ${b.x} ${b.y}`,
        dashed: true,
        color: r.relation_type === 'spouse' ? '#d97706' : '#a8a29e',
      })
      continue
    }

    // parent/child — находим кто родитель
    let parent = a, child = b
    if (r.relation_type === 'child') { parent = b; child = a }

    // Кривая от родителя к ребёнку — через промежуточную точку
    const midR = (parent.depth * RING_RADIUS + child.depth * RING_RADIUS) / 2
    const midAngle = (parent.angle + child.angle) / 2
    // Если углы далеко друг от друга — используем прямую контрольную
    const angleDiff = Math.abs(parent.angle - child.angle)
    const ctrlX = angleDiff > Math.PI / 2
      ? (parent.x + child.x) / 2
      : CX + midR * Math.cos(midAngle)
    const ctrlY = angleDiff > Math.PI / 2
      ? (parent.y + child.y) / 2
      : CY + midR * Math.sin(midAngle)

    edges.push({
      d: `M ${parent.x} ${parent.y} Q ${ctrlX} ${ctrlY} ${child.x} ${child.y}`,
      dashed: false,
      color: '#c8c4be',
    })
  }

  // ── Статистика ─────────────────────────────────────────────────
  const aliveCount    = persons.filter(p => p.is_alive).length
  const deceasedCount = persons.length - aliveCount
  const rootPerson    = persons.find(p => p.is_root)

  return (
    <div className="h-screen bg-stone-50 flex flex-col select-none overflow-hidden">

      {/* ── Шапка ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-white border-b border-stone-200 overflow-hidden">
        <div className="flex items-center gap-3 min-w-0 overflow-hidden">
          <Link href="/dashboard" className="text-stone-400 text-sm hover:text-stone-600 transition-colors flex-shrink-0">
            ← Дашборд
          </Link>
          <span className="text-stone-200 flex-shrink-0">·</span>
          <h1 className="text-sm font-medium text-stone-800 flex-shrink-0">Генеалогическое дерево</h1>

          {persons.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {aliveCount}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
                † {deceasedCount}
              </span>
              {rootPerson && (
                <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex-shrink-0 max-w-[120px] truncate">
                  ★ {[rootPerson.last_name, rootPerson.first_name].filter(Boolean).join(' ') || 'Основатель'}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <Link
            href="/dashboard/persons"
            className="text-xs text-stone-500 hover:text-stone-800 transition-colors border border-stone-200 rounded-lg px-3 py-1.5"
          >
            Участники
          </Link>
        </div>
      </div>

      {/* ── Содержимое ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">Загрузка…</div>
      ) : persons.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <div className="text-5xl">🌳</div>
          <p className="text-stone-500 font-light text-lg">Дерево пусто</p>
          <p className="text-stone-400 text-sm">Добавьте участников и свяжите их между собой</p>
          <Link href="/dashboard/persons/new"
            className="mt-2 px-5 py-2.5 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 transition-colors">
            Добавить участника
          </Link>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden relative">
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
              <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#00000020" />
              </filter>
              <filter id="root-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#534AB740" />
              </filter>
            </defs>

            <g transform={`translate(${tx},${ty}) scale(${scale})`}>

              {/* Концентрические кольца поколений (декор) */}
              {nodes.length > 0 && (() => {
                const maxDepth = Math.max(...nodes.map(n => n.depth), 0)
                return Array.from({ length: maxDepth }, (_, i) => (
                  <circle
                    key={i}
                    cx={CX} cy={CY}
                    r={(i + 1) * RING_RADIUS}
                    fill="none"
                    stroke="#e7e5e4"
                    strokeWidth={1}
                    strokeDasharray="4 6"
                  />
                ))
              })()}

              {/* Рёбра */}
              {edges.map((e, i) => (
                <path key={i} d={e.d} fill="none"
                  stroke={e.color} strokeWidth={1.5}
                  strokeDasharray={e.dashed ? '5 4' : undefined}
                  strokeOpacity={0.7}
                />
              ))}

              {/* Узлы */}
              {nodes.map(node => {
                const person = personMap[node.id]
                if (!person) return null

                const { x, y } = node
                const isRoot  = person.is_root
                const isAlive = person.is_alive
                const lastName  = person.last_name  || ''
                const firstName = person.first_name || ''
                const shortLast  = lastName.length  > 13 ? lastName.slice(0, 12)  + '…' : lastName
                const shortFirst = firstName.length > 13 ? firstName.slice(0, 12) + '…' : firstName
                const birth = person.birth_date ? new Date(person.birth_date).getFullYear() : null
                const death = person.death_date ? new Date(person.death_date).getFullYear() : null

                const yearLabel = isAlive
                  ? (birth ? `р. ${birth}` : '')
                  : birth || death
                    ? `${birth ?? '?'} – ${death ?? '…'}`
                    : ''

                const ringColor = isRoot ? COLOR_ROOT : isAlive ? COLOR_ALIVE : COLOR_DECEASED
                const bgColor   = isRoot ? COLOR_ROOT_BG : isAlive ? COLOR_ALIVE_BG : COLOR_DEC_BG

                const textY = y + NODE_R + 18

                return (
                  <g key={node.id} data-node="true"
                    onClick={() => setSelectedId(node.id)}
                    style={{ cursor: 'pointer' }}>

                    {/* Внешнее кольцо (цвет статуса) */}
                    <circle cx={x} cy={y} r={NODE_R + 4}
                      fill={bgColor}
                      stroke={ringColor}
                      strokeWidth={isRoot ? 3 : 2}
                      filter={isRoot ? 'url(#root-glow)' : 'url(#node-shadow)'}
                    />

                    {/* Аватар фон */}
                    <circle cx={x} cy={y} r={NODE_R} fill={bgColor} />

                    {/* Фото или силуэт */}
                    {person.main_photo_url ? (
                      <>
                        <defs>
                          <clipPath id={`cp-${node.id}`}>
                            <circle cx={x} cy={y} r={NODE_R - 1} />
                          </clipPath>
                        </defs>
                        <image
                          href={person.main_photo_url}
                          x={x - NODE_R + 1} y={y - NODE_R + 1}
                          width={(NODE_R - 1) * 2} height={(NODE_R - 1) * 2}
                          clipPath={`url(#cp-${node.id})`}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </>
                    ) : (
                      <g opacity={0.5}>
                        <circle cx={x} cy={y - 12} r={14} fill={ringColor} />
                        <ellipse cx={x} cy={y + 20} rx={22} ry={18} fill={ringColor} />
                      </g>
                    )}

                    {/* Звезда основоположника */}
                    {isRoot && (
                      <circle cx={x + NODE_R - 2} cy={y - NODE_R + 2} r={10} fill={COLOR_ROOT}>
                        <title>Основоположник рода</title>
                      </circle>
                    )}
                    {isRoot && (
                      <text x={x + NODE_R - 2} y={y - NODE_R + 6} textAnchor="middle" fontSize={11}
                        fill="white" fontFamily="sans-serif">★</text>
                    )}

                    {/* Зелёная точка — живой */}
                    {!isRoot && isAlive && (
                      <circle cx={x + NODE_R - 2} cy={y - NODE_R + 2} r={8} fill="#10b981" stroke="white" strokeWidth={2} />
                    )}

                    {/* Имя */}
                    <text x={x} y={textY} textAnchor="middle"
                      fontSize={12} fontWeight="600"
                      fill="#292524"
                      fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                      {shortLast}
                    </text>
                    <text x={x} y={textY + 14} textAnchor="middle"
                      fontSize={11} fill="#78716c"
                      fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                      {shortFirst}
                    </text>

                    {/* Годы */}
                    {yearLabel && (
                      <text x={x} y={textY + 28} textAnchor="middle"
                        fontSize={10} fill="#a8a29e"
                        fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
                        {yearLabel}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Кнопки зума — после SVG, поверх него */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 pointer-events-auto">
            <button onClick={() => zoomBtn(1.25)}
              className="w-8 h-8 bg-white border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 text-lg font-light shadow-sm flex items-center justify-center">
              +
            </button>
            <button onClick={() => zoomBtn(0.8)}
              className="w-8 h-8 bg-white border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 text-lg font-light shadow-sm flex items-center justify-center">
              −
            </button>
            <button onClick={fitView} title="Вписать в экран"
              className="w-8 h-8 bg-white border border-stone-200 rounded-lg text-stone-500 hover:bg-stone-50 text-xs shadow-sm flex items-center justify-center">
              ↺
            </button>
          </div>

          {/* Легенда */}
          <div className="absolute bottom-3 left-3 z-10 bg-white border border-stone-200 rounded-xl px-3 py-2 shadow-sm flex items-center gap-4 text-xs text-stone-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-violet-600 inline-block"></span>
              Основоположник
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
              Живёт
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-stone-400 inline-block"></span>
              Ушёл
            </span>
          </div>

          {/* Подсказка: нет корня */}
          {!persons.find(p => p.is_root) && persons.length > 0 && (
            <div className="absolute top-3 left-3 z-10 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 shadow-sm text-xs text-amber-700 max-w-xs">
              ★ Откройте профиль основателя рода и нажмите «Сделать основателем» — дерево перестроится от него
            </div>
          )}

          {/* ── Боковая панель профиля ────────────────────────── */}
          {selectedId && (() => {
            const sel = personMap[selectedId]
            if (!sel) return null
            const selName = [sel.last_name, sel.first_name].filter(Boolean).join(' ') || 'Без имени'
            const selBirth = sel.birth_date ? new Date(sel.birth_date).getFullYear() : null
            const selDeath = sel.death_date ? new Date(sel.death_date).getFullYear() : null
            const selAlive = sel.is_alive

            // Find relatives of selected
            const relatedRels = rels.filter(r => r.person1_id === selectedId || r.person2_id === selectedId)
            const REL_LABELS: Record<string, string> = { parent: 'Родитель', child: 'Ребёнок', spouse: 'Супруг(а)', sibling: 'Брат/Сестра', adopted: 'Усыновлён' }

            return (
              <div className="absolute top-0 right-0 bottom-0 w-72 bg-white border-l border-stone-200 shadow-xl z-20 flex flex-col overflow-hidden"
                style={{ animation: 'slideIn 0.2s ease' }}>
                <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

                {/* Header */}
                <div className={`p-4 border-b border-stone-100 ${selAlive ? 'bg-emerald-50' : sel.is_root ? 'bg-violet-50' : 'bg-stone-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full bg-stone-100 overflow-hidden flex-shrink-0 ${selAlive ? 'ring-2 ring-emerald-300' : sel.is_root ? 'ring-2 ring-violet-400' : ''}`}>
                        {sel.main_photo_url
                          ? <img src={sel.main_photo_url} alt={selName} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-stone-300 text-2xl">👤</div>
                        }
                      </div>
                      <div>
                        <p className="font-medium text-stone-800 text-sm leading-tight">{selName}</p>
                        {sel.clan_name && <p className="text-xs text-stone-400 mt-0.5">Род: {sel.clan_name}</p>}
                        <p className="text-xs mt-1">
                          {selAlive ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              Живёт{selBirth ? ` · р. ${selBirth}` : ''}
                            </span>
                          ) : (
                            <span className="text-stone-400">
                              {selBirth ?? '?'} — {selDeath ?? '…'}
                              {sel.is_root && ' · ★ Основоположник'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedId(null)}
                      className="text-stone-300 hover:text-stone-600 text-xl leading-none flex-shrink-0 mt-0.5">×</button>
                  </div>
                </div>

                {/* Relatives */}
                {relatedRels.length > 0 && (
                  <div className="p-4 border-b border-stone-100 overflow-y-auto flex-1">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Родственники</p>
                    <div className="space-y-2">
                      {relatedRels.map(r => {
                        const otherId = r.person1_id === selectedId ? r.person2_id : r.person1_id
                        const other = personMap[otherId]
                        if (!other) return null
                        const otherName = [other.last_name, other.first_name].filter(Boolean).join(' ') || 'Без имени'
                        return (
                          <button key={r.id} onClick={() => setSelectedId(otherId)}
                            className="w-full flex items-center gap-2.5 text-left hover:bg-stone-50 rounded-lg p-1.5 -mx-1.5 transition-colors">
                            <div className={`w-7 h-7 rounded-full bg-stone-100 overflow-hidden flex-shrink-0 ${other.is_alive ? 'ring-1 ring-emerald-200' : ''}`}>
                              {other.main_photo_url
                                ? <img src={other.main_photo_url} alt={otherName} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">👤</div>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-stone-700 truncate">{otherName}</p>
                              <p className="text-xs text-stone-400">{REL_LABELS[r.relation_type] ?? r.relation_type}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="p-4 border-t border-stone-100 flex flex-col gap-2">
                  <Link href={`/dashboard/persons/${selectedId}`}
                    className="block w-full text-center py-2 bg-stone-800 text-white text-xs rounded-lg hover:bg-stone-700 transition-colors">
                    Открыть полный профиль →
                  </Link>
                  <Link href={`/p/${selectedId}`} target="_blank"
                    className="block w-full text-center py-2 border border-stone-200 text-stone-600 text-xs rounded-lg hover:bg-stone-50 transition-colors">
                    Публичная страница ↗
                  </Link>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
