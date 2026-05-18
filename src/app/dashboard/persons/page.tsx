import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import SearchInput from './SearchInput'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ q?: string; filter?: string }> }

export default async function PersonsPage({ searchParams }: Props) {
  const { q, filter } = await searchParams
  const query = q?.trim() || ''
  const statusFilter = filter || 'all' // all | alive | deceased

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let dbQuery = supabase
    .from('persons')
    .select('id, first_name, last_name, middle_name, birth_date, death_date, main_photo_url, clan_name, is_alive, is_root, profile_visibility')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  if (query) {
    dbQuery = dbQuery.or(
      `last_name.ilike.%${query}%,first_name.ilike.%${query}%,middle_name.ilike.%${query}%,clan_name.ilike.%${query}%`
    )
  }

  if (statusFilter === 'alive') {
    dbQuery = dbQuery.eq('is_alive', true)
  } else if (statusFilter === 'deceased') {
    dbQuery = dbQuery.eq('is_alive', false)
  }

  const { data: persons } = await dbQuery

  const totalAll = statusFilter !== 'all' ? null : persons?.length ?? 0
  const aliveCount = persons?.filter(p => p.is_alive).length ?? 0
  const deceasedCount = persons?.filter(p => !p.is_alive).length ?? 0

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Шапка */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/dashboard" className="text-stone-400 text-sm hover:text-stone-600 transition-colors">
              ← Дашборд
            </Link>
            <h1 className="text-2xl font-light text-stone-800 mt-1">Генеалогия рода</h1>
          </div>
          <Link
            href="/dashboard/persons/new"
            className="px-4 py-2 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
          >
            + Добавить
          </Link>
        </div>

        {/* Поиск */}
        <div className="mb-4">
          <Suspense>
            <SearchInput defaultValue={query} />
          </Suspense>
        </div>

        {/* Фильтр по статусу */}
        <div className="flex gap-2 mb-5">
          {[
            { value: 'all',      label: 'Все' },
            { value: 'alive',    label: '● Живые' },
            { value: 'deceased', label: '† Ушедшие' },
          ].map(({ value, label }) => (
            <Link
              key={value}
              href={`/dashboard/persons?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(value !== 'all' ? { filter: value } : {}) }).toString()}`}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                statusFilter === value
                  ? 'bg-stone-800 text-white border-stone-800'
                  : 'border-stone-200 text-stone-500 hover:bg-stone-50'
              }`}
            >
              {label}
            </Link>
          ))}
          {persons && persons.length > 0 && (
            <span className="ml-auto text-xs text-stone-400 self-center">
              {statusFilter === 'all'
                ? `${aliveCount} живых · ${deceasedCount} ушедших`
                : `${persons.length} чел.`}
            </span>
          )}
        </div>

        {/* Счётчик при поиске */}
        {query && (
          <p className="text-sm text-stone-400 mb-4">
            {persons && persons.length > 0
              ? `Найдено: ${persons.length}`
              : 'Ничего не найдено'}
          </p>
        )}

        {/* Список */}
        {!persons || persons.length === 0 ? (
          query ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">🔍</div>
              <p className="text-stone-500 text-lg font-light">Ничего не найдено</p>
              <p className="text-stone-400 text-sm mt-2">Попробуйте другой запрос</p>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">🌳</div>
              <p className="text-stone-500 text-lg font-light">
                {statusFilter === 'alive' ? 'Нет живых участников' :
                 statusFilter === 'deceased' ? 'Нет записей об ушедших' :
                 'Участники ещё не добавлены'}
              </p>
              <p className="text-stone-400 text-sm mt-2">
                {statusFilter === 'all' && 'Начните строить генеалогическое дерево'}
              </p>
              {statusFilter === 'all' && (
                <Link
                  href="/dashboard/persons/new"
                  className="inline-block mt-6 px-6 py-2.5 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
                >
                  Добавить первого участника
                </Link>
              )}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {persons.map(person => {
              const name = [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ')
              const birthYear = person.birth_date ? new Date(person.birth_date).getFullYear() : null
              const deathYear = person.death_date ? new Date(person.death_date).getFullYear() : null

              return (
                <Link
                  key={person.id}
                  href={`/dashboard/persons/${person.id}`}
                  className="flex items-center gap-4 bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-300 hover:shadow-sm transition-all"
                >
                  {/* Фото */}
                  <div className={`w-14 h-14 rounded-full flex-shrink-0 overflow-hidden relative ${
                    person.is_alive ? 'ring-2 ring-emerald-200' : 'ring-2 ring-stone-200'
                  }`}>
                    {person.main_photo_url ? (
                      <img src={person.main_photo_url} alt={name} className="w-full h-full object-cover bg-stone-100" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-300 text-2xl bg-stone-50">👤</div>
                    )}
                  </div>

                  {/* Инфо */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-medium text-stone-800 truncate">{name || 'Без имени'}</p>
                      {person.is_root && (
                        <span className="text-xs text-amber-600 flex-shrink-0">★</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {/* Статус */}
                      {person.is_alive ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                          Живёт
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">
                          {birthYear ?? '?'} – {deathYear ?? '?'}
                        </span>
                      )}
                      {person.clan_name && (
                        <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full flex-shrink-0">
                          {person.clan_name}
                        </span>
                      )}
                      {/* Видимость */}
                      {person.profile_visibility === 'private' && (
                        <span className="text-xs text-stone-400 flex-shrink-0">🔒</span>
                      )}
                      {person.profile_visibility === 'family' && (
                        <span className="text-xs text-violet-500 flex-shrink-0">🔗</span>
                      )}
                    </div>
                  </div>
                  <span className="text-stone-300 text-lg flex-shrink-0">›</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
