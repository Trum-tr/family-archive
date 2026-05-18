import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import InviteWidget from './InviteWidget'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user's family space
  const { data: mySpace } = await supabase
    .from('family_spaces')
    .select('id, name')
    .eq('created_by', user.id)
    .single()

  // Also check if user is member of any family
  const { data: memberSpaces } = await supabase
    .from('family_members')
    .select('family_id, role, family_spaces(id, name)')
    .eq('user_id', user.id)

  const familyId = mySpace?.id ?? (memberSpaces?.[0] as { family_id: string } | undefined)?.family_id ?? null
  const familyName = mySpace?.name ?? (memberSpaces?.[0] as { family_spaces: { name: string } } | undefined)?.family_spaces?.name ?? 'Семейный архив'

  // Counts
  const personsQuery = supabase.from('persons').select('id, is_alive', { count: 'exact', head: false })
  if (familyId) personsQuery.eq('family_id', familyId)
  else personsQuery.eq('created_by', user.id)

  const { data: personsSample, count: totalCount } = await personsQuery
  const aliveCount = (personsSample ?? []).filter((p: { is_alive: boolean }) => p.is_alive).length
  const deceasedCount = (totalCount ?? 0) - aliveCount

  // Member count
  const { count: memberCount } = familyId
    ? await supabase.from('family_members').select('id', { count: 'exact', head: true }).eq('family_id', familyId)
    : { count: null }

  // Is admin/editor?
  const isAdmin = mySpace != null || (memberSpaces ?? []).some(
    (m: { role: string }) => ['admin', 'editor'].includes(m.role)
  )

  // Linked profile
  const { data: myPerson } = await supabase
    .from('persons')
    .select('id, first_name, last_name, main_photo_url, is_alive')
    .eq('linked_user_id', user.id)
    .single()

  return (
    <main className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-light text-stone-800">🌳 Генеалогия рода</h1>
            {familyName && (
              <p className="text-xs text-stone-400 mt-0.5">«{familyName}»</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/me" className="text-sm text-stone-500 hover:text-stone-700 transition-colors">
              Мой профиль
            </Link>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="text-sm text-stone-500 hover:text-stone-700 transition-colors">
                Выйти
              </button>
            </form>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Welcome + stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-light text-stone-800">Добро пожаловать</h2>
            <p className="text-stone-500 text-sm mt-1">
              {user.phone ?? user.email ?? 'Пользователь'}
            </p>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-2xl font-light text-emerald-600">{aliveCount}</p>
              <p className="text-xs text-stone-400">живых</p>
            </div>
            <div className="w-px bg-stone-200" />
            <div>
              <p className="text-2xl font-light text-stone-500">{deceasedCount}</p>
              <p className="text-xs text-stone-400">ушедших</p>
            </div>
            {memberCount != null && (
              <>
                <div className="w-px bg-stone-200" />
                <div>
                  <p className="text-2xl font-light text-violet-600">{memberCount}</p>
                  <p className="text-xs text-stone-400">участников</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* My profile mini-card */}
        {myPerson && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full overflow-hidden bg-stone-100 flex-shrink-0 ${myPerson.is_alive ? 'ring-2 ring-emerald-300' : ''}`}>
              {myPerson.main_photo_url
                ? <img src={myPerson.main_photo_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-stone-300 text-lg">👤</div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-800">
                {[myPerson.last_name, myPerson.first_name].filter(Boolean).join(' ') || 'Мой профиль'}
              </p>
              <p className="text-xs text-emerald-700">Ваш профиль в дереве привязан</p>
            </div>
            <Link href="/dashboard/me" className="text-xs text-emerald-700 font-medium hover:text-emerald-900 transition-colors">
              Редактировать →
            </Link>
          </div>
        )}

        {!myPerson && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">🌿</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-700">Привяжите себя к дереву</p>
              <p className="text-xs text-stone-500">Найдите свой профиль в семейном архиве</p>
            </div>
            <Link href="/dashboard/onboarding" className="text-xs text-amber-700 font-medium hover:text-amber-900 transition-colors flex-shrink-0">
              Найти →
            </Link>
          </div>
        )}

        {/* Navigation cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/dashboard/persons"
            className="bg-white rounded-xl border border-stone-200 p-5 space-y-2 hover:border-stone-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-stone-700 group-hover:text-stone-900">👥 Участники рода</h3>
              <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{totalCount ?? 0}</span>
            </div>
            <p className="text-sm text-stone-400">Биографии, фотографии, профили живых и ушедших</p>
            <p className="text-xs text-stone-800 font-medium pt-1">Открыть →</p>
          </Link>

          <Link
            href="/dashboard/tree"
            className="bg-white rounded-xl border border-stone-200 p-5 space-y-2 hover:border-stone-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-stone-700 group-hover:text-stone-900">🌳 Семейное дерево</h3>
              <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">Радиальное</span>
            </div>
            <p className="text-sm text-stone-400">Визуальная карта семейных связей</p>
            <p className="text-xs text-stone-800 font-medium pt-1">Открыть →</p>
          </Link>

          <Link
            href="/map"
            className="bg-white rounded-xl border border-stone-200 p-5 space-y-2 hover:border-stone-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-stone-700 group-hover:text-stone-900">📍 Карта захоронений</h3>
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Leaflet</span>
            </div>
            <p className="text-sm text-stone-400">Места погребения на интерактивной карте</p>
            <p className="text-xs text-stone-800 font-medium pt-1">Открыть →</p>
          </Link>

          {/* Members management — admin only */}
          {isAdmin && familyId && (
            <Link
              href={`/dashboard/members?family=${familyId}`}
              className="bg-white rounded-xl border border-stone-200 p-5 space-y-2 hover:border-stone-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-stone-700 group-hover:text-stone-900">👑 Участники семьи</h3>
                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{memberCount ?? 0}</span>
              </div>
              <p className="text-sm text-stone-400">Управление ролями и доступом к архиву</p>
              <p className="text-xs text-stone-800 font-medium pt-1">Управлять →</p>
            </Link>
          )}

          {/* My profile */}
          <Link
            href="/dashboard/me"
            className="bg-white rounded-xl border border-stone-200 p-5 space-y-2 hover:border-stone-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-stone-700 group-hover:text-stone-900">👤 Мой профиль</h3>
              {myPerson && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Привязан</span>}
            </div>
            <p className="text-sm text-stone-400">Редактируйте свою страницу в семейном архиве</p>
            <p className="text-xs text-stone-800 font-medium pt-1">Открыть →</p>
          </Link>
        </div>

        {/* Invite widget — admin/editor only */}
        {isAdmin && familyId && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="font-medium text-stone-700 mb-1">📨 Пригласить в архив</h3>
            <p className="text-sm text-stone-400 mb-4">Сгенерируйте ссылку-приглашение для родственников</p>
            <InviteWidget familyId={familyId} />
          </div>
        )}
      </div>
    </main>
  )
}
