import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import SearchInput from './SearchInput'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ q?: string }> }

export default async function PersonsPage({ searchParams }: Props) {
  const { q } = await searchParams
  const query = q?.trim() || ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let dbQuery = supabase
    .from('persons')
    .select('id, first_name, last_name, middle_name, birth_date, death_date, main_photo_url, clan_name')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  if (query) {
    dbQuery = dbQuery.or(
      `last_name.ilike.%${query}%,first_name.ilike.%${query}%,middle_name.ilike.%${query}%,clan_name.ilike.%${query}%`
    )
  }

  const { data: persons } = await dbQuery

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Шапка */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/dashboard" className="text-stone-400 text-sm hover:text-stone-600 transition-colors">
              ← Дашборд
            </Link>
            <h1 className="text-2xl font-light text-stone-800 mt-1">Профили предков</h1>
          </div>
          <Link
            href="/dashboard/persons/new"
            className="px-4 py-2 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
          >
            + Добавить
          </Link>
        </div>

        {/* Поиск */}
        <div className="mb-5">
          <Suspense>
            <SearchInput defaultValue={query} />
          </Suspense>
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
              <div className="text-4xl mb-4">🪦</div>
              <p className="text-stone-500 text-lg font-light">Профили пока не добавлены</p>
              <p className="text-stone-400 text-sm mt-2">Создайте первый профиль предка</p>
              <Link
                href="/dashboard/persons/new"
                className="inline-block mt-6 px-6 py-2.5 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
              >
                Создать профиль
              </Link>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {persons.map(person => {
              const name = [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ')
              const years = [
                person.birth_date ? new Date(person.birth_date).getFullYear() : '?',
                person.death_date ? new Date(person.death_date).getFullYear() : '?'
              ].join(' – ')

              return (
                <Link
                  key={person.id}
                  href={`/dashboard/persons/${person.id}`}
                  className="flex items-center gap-4 bg-white border border-stone-200 rounded-xl p-4 hover:border-stone-300 hover:shadow-sm transition-all"
                >
                  {/* Фото */}
                  <div className="w-14 h-14 rounded-full bg-stone-100 flex-shrink-0 overflow-hidden">
                    {person.main_photo_url ? (
                      <img src={person.main_photo_url} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-300 text-2xl">👤</div>
                    )}
                  </div>
                  {/* Инфо */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-800 truncate">{name || 'Без имени'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm text-stone-400">{years}</p>
                      {person.clan_name && (
                        <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                          {person.clan_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-stone-300 text-lg">›</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
