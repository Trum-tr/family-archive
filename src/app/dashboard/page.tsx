import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-light text-stone-800">
            Цифровой семейный архив
          </h1>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              Выйти
            </button>
          </form>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-light text-stone-800">
            Добро пожаловать
          </h2>
          <p className="text-stone-500 text-sm">
            Вы вошли как:{' '}
            <span className="font-medium text-stone-700">
              {user.phone ?? user.email ?? 'Пользователь'}
            </span>
          </p>
        </div>

        <div className="w-16 h-px bg-stone-200" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-2">
            <h3 className="font-medium text-stone-700">Люди</h3>
            <p className="text-sm text-stone-400">
              Карточки членов семьи, биографии и фотографии
            </p>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-2">
            <h3 className="font-medium text-stone-700">Родословное дерево</h3>
            <p className="text-sm text-stone-400">
              Визуальная карта семейных связей
            </p>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-2">
            <h3 className="font-medium text-stone-700">Карта захоронений</h3>
            <p className="text-sm text-stone-400">
              Места погребения на интерактивной карте
            </p>
          </div>
        </div>

        <p className="text-xs text-stone-400 text-center pt-4">
          Раздел находится в разработке
        </p>
      </div>
    </main>
  )
}
