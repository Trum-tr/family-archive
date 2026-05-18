'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  middle_name: string | null
  birth_date: string | null
  main_photo_url: string | null
  is_alive: boolean
  linked_user_id: string | null
}

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const familyId = params.get('family')

  const [search, setSearch] = useState('')
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [currentUser, setCurrentUser] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user?.id ?? null)
    })
  }, [supabase])

  const searchPersons = useCallback(async (q: string) => {
    if (!familyId) return
    setLoading(true)
    const query = supabase
      .from('persons')
      .select('id, first_name, last_name, middle_name, birth_date, main_photo_url, is_alive, linked_user_id')
      .eq('family_id', familyId)
      .is('linked_user_id', null)  // only unlinked profiles

    if (q.trim()) {
      query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,middle_name.ilike.%${q}%`
      )
    }

    const { data } = await query.order('last_name').limit(20)
    setPersons(data ?? [])
    setLoading(false)
  }, [familyId, supabase])

  useEffect(() => {
    searchPersons(search)
  }, [search, searchPersons])

  async function handleLink(personId: string) {
    if (!currentUser) return
    setLinking(personId)
    const { error } = await supabase
      .from('persons')
      .update({ linked_user_id: currentUser })
      .eq('id', personId)
    setLinking(null)
    if (!error) setDone(true)
  }

  async function handleSkip() {
    router.push(familyId ? `/dashboard?family=${familyId}` : '/dashboard')
  }

  if (done) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-light text-stone-700 mb-2">Профиль привязан!</h1>
          <p className="text-stone-400 text-sm mb-6">
            Теперь вы можете редактировать свою страницу в семейном архиве.
          </p>
          <Link
            href={familyId ? `/dashboard?family=${familyId}` : '/dashboard'}
            className="inline-block px-6 py-2.5 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 transition-colors"
          >
            Перейти в архив
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🌳</div>
          <h1 className="text-2xl font-light text-stone-800 mb-2">Найдите себя в дереве</h1>
          <p className="text-stone-400 text-sm leading-relaxed">
            Привяжите свой аккаунт к профилю в семейном архиве,<br />
            чтобы редактировать свою страницу.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">🔍</span>
          <input
            type="text"
            placeholder="Поиск по имени…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-stone-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>

        {/* Person list */}
        <div className="space-y-2 mb-6">
          {loading && (
            <div className="text-center py-8 text-stone-400 text-sm">Поиск…</div>
          )}
          {!loading && persons.length === 0 && (
            <div className="text-center py-8 text-stone-400 text-sm">
              {search ? 'Никого не найдено' : 'Профили не найдены'}
            </div>
          )}
          {persons.map(p => {
            const name = [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(' ') || 'Без имени'
            const year = p.birth_date ? new Date(p.birth_date).getFullYear() : null
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl p-3 hover:border-stone-300 transition-colors"
              >
                <div className={`w-11 h-11 rounded-full bg-stone-100 flex-shrink-0 overflow-hidden ${p.is_alive ? 'ring-2 ring-emerald-200' : ''}`}>
                  {p.main_photo_url
                    ? <img src={p.main_photo_url} alt={name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-stone-300 text-xl">👤</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{name}</p>
                  {year && <p className="text-xs text-stone-400">{p.is_alive ? `р. ${year}` : year}</p>}
                </div>
                <button
                  onClick={() => handleLink(p.id)}
                  disabled={linking === p.id}
                  className="flex-shrink-0 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {linking === p.id ? '⏳' : '✓ Это я'}
                </button>
              </div>
            )
          })}
        </div>

        <div className="text-center">
          <button
            onClick={handleSkip}
            className="text-stone-400 text-sm hover:text-stone-600 transition-colors underline underline-offset-2"
          >
            Пропустить, меня нет в дереве
          </button>
        </div>
      </div>
    </div>
  )
}
