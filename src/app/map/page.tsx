'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Динамический импорт — Leaflet не работает на сервере
const BurialMap = dynamic(() => import('@/components/BurialMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-stone-400 text-sm">
      Загрузка карты…
    </div>
  ),
})

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  middle_name: string | null
  birth_date: string | null
  death_date: string | null
  burial_place: string | null
  burial_lat: number
  burial_lng: number
  main_photo_url: string | null
}

export default function MapPage() {
  const [persons, setPersons] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('persons')
        .select('id, first_name, last_name, middle_name, birth_date, death_date, burial_place, burial_lat, burial_lng, main_photo_url')
        .not('burial_lat', 'is', null)
        .not('burial_lng', 'is', null)
      setPersons((data as Person[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return persons
    return persons.filter(p => {
      const full = [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(' ').toLowerCase()
      return full.includes(q)
    })
  }, [persons, search])

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Шапка */}
      <div className="flex-shrink-0 bg-white border-b border-stone-200 px-5 py-3.5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <Link href="/" className="text-stone-400 text-sm hover:text-stone-600 transition-colors">
              ← Главная
            </Link>
            <span className="text-stone-200">·</span>
            <h1 className="text-sm font-medium text-stone-800">Карта захоронений</h1>
            {!loading && (
              <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                {persons.length} {persons.length === 1 ? 'место' : persons.length < 5 ? 'места' : 'мест'}
              </span>
            )}
          </div>

          {/* Поиск */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по имени…"
              className="pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-lg bg-stone-50 focus:outline-none focus:ring-1 focus:ring-stone-300 focus:bg-white transition-colors w-56"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Карта */}
      <div className="flex-1 relative" style={{ minHeight: 'calc(100vh - 60px)' }}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-stone-400 text-sm">
            Загрузка…
          </div>
        ) : persons.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
            <div className="text-5xl">🗺️</div>
            <p className="text-stone-500 font-light text-lg">Нет геолокаций</p>
            <p className="text-stone-400 text-sm max-w-xs">
              Добавьте координаты места захоронения в профилях предков — они появятся на карте
            </p>
            <Link
              href="/dashboard/persons"
              className="mt-2 px-5 py-2.5 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 transition-colors"
            >
              Открыть профили
            </Link>
          </div>
        ) : (
          <>
            {search && filtered.length === 0 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm text-stone-500 shadow-sm">
                Ничего не найдено по запросу «{search}»
              </div>
            )}
            <BurialMap persons={filtered} />
          </>
        )}
      </div>
    </div>
  )
}
