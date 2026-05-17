import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Считаем профили
  const { count } = await supabase
    .from('persons')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', user.id)

  return (
    <main className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-light text-stone-800">Цифровой семейный архив</h1>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="text-sm text-stone-500 hover:text-stone-700 transition-colors">
              Выйти
            </button>
          </form>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-light text-stone-800">Добро пожаловать</h2>
          <p className="text-stone-500 text-sm">
            Вы вошли как:{' '}
            <span className="font-medium text-stone-700">{user.phone ?? user.email ?? 'Пользователь'}</span>
          </p>
        </div>

        <div className="w-16 h-px bg-stone-200" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Профили предков — активно */}
          <Link
            href="/dashboard/persons"
            className="bg-white rounded-xl border border-stone-200 p-5 space-y-2 hover:border-stone-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-stone-700 group-hover:text-stone-900">Профили предков</h3>
              <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{count ?? 0}</span>
            </div>
            <p className="text-sm text-stone-400">Биографии, фотографии и QR-коды для надгробий</p>
            <p className="text-xs text-stone-800 font-medium pt-1">Открыть →</p>
          </Link>

          {/* Родословное дерево — активно */}
          <Link
            href="/dashboard/tree"
            className="bg-white rounded-xl border border-stone-200 p-5 space-y-2 hover:border-stone-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-stone-700 group-hover:text-stone-900">Семейное дерево</h3>
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Новое</span>
            </div>
            <p className="text-sm text-stone-400">Визуальная карта семейных связей</p>
            <p className="text-xs text-stone-800 font-medium pt-1">Открыть →</p>
          </Link>

          {/* Карта захоронений — в разработке */}
          <div className="bg-white rounded-xl border border-stone-100 p-5 space-y-2 opacity-60">
            <h3 className="font-medium text-stone-500">Карта захоронений</h3>
            <p className="text-sm text-stone-400">Места погребения на интерактивной карте</p>
            <p className="text-xs text-stone-300 pt-1">Этап 6</p>
          </div>
        </div>
      </div>
    </main>
  )
}
