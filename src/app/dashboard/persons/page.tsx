import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function PersonsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: persons } = await supabase
    .from('persons')
    .select('id, first_name, last_name, middle_name, birth_date, death_date, main_photo_url')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Шапка */}
        <div className="flex items-center justify-between mb-8">
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

        {/* Список */}
        {!persons || persons.length === 0 ? (
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
                    <p className="text-sm text-stone-400 mt-0.5">{years}</p>
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
