import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MeEditForm from './MeEditForm'

export const dynamic = 'force-dynamic'

export default async function MePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Find profile linked to this user
  const { data: person } = await supabase
    .from('persons')
    .select('*')
    .eq('linked_user_id', user.id)
    .single()

  const fullName = person
    ? [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ')
    : null

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-light text-stone-800">Мой профиль</h1>
            <p className="text-stone-400 text-sm mt-0.5">
              {user.email ?? user.phone ?? ''}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-stone-400 hover:text-stone-600 text-sm transition-colors"
          >
            ← Назад
          </Link>
        </div>

        {person ? (
          <>
            {/* Linked profile card */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-5">
              <div className="flex items-center gap-4 mb-5">
                <div className={`w-16 h-16 rounded-full bg-stone-100 overflow-hidden ${person.is_alive ? 'ring-4 ring-emerald-100' : ''}`}>
                  {person.main_photo_url
                    ? <img src={person.main_photo_url} alt={fullName ?? ''} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-stone-300 text-3xl">👤</div>
                  }
                </div>
                <div>
                  <p className="font-medium text-stone-800">{fullName || 'Без имени'}</p>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Связан с аккаунтом
                  </span>
                </div>
              </div>
              <div className="border-t border-stone-100 pt-4">
                <MeEditForm person={person} />
              </div>
            </div>

            {/* Link to public profile */}
            <div className="text-center">
              <Link
                href={`/p/${person.id}`}
                target="_blank"
                className="text-stone-400 text-sm hover:text-stone-600 transition-colors underline underline-offset-2"
              >
                Посмотреть публичный профиль →
              </Link>
            </div>
          </>
        ) : (
          /* No linked profile */
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
            <div className="text-4xl mb-4">🌿</div>
            <h2 className="text-lg font-light text-stone-700 mb-2">Профиль не привязан</h2>
            <p className="text-stone-400 text-sm mb-6">
              Найдите себя в семейном дереве, чтобы редактировать свою страницу
            </p>
            <Link
              href="/dashboard/onboarding"
              className="inline-block px-6 py-2.5 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 transition-colors"
            >
              Найти себя в дереве
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
