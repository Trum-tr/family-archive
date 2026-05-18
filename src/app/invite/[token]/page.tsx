import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InviteAcceptButton from './InviteAcceptButton'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ token: string }> }

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  // Load invitation
  const { data: invite } = await supabase
    .from('invitations')
    .select('*, family_spaces(name, created_by)')
    .eq('token', token)
    .is('used_by', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  // Invalid / expired / already used
  if (!invite) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-light text-stone-700 mb-2">Ссылка недействительна</h1>
          <p className="text-stone-400 text-sm mb-6">
            Приглашение истекло, уже использовано или не существует.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2.5 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 transition-colors"
          >
            На главную
          </Link>
        </div>
      </div>
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  const familyName = (invite.family_spaces as { name: string } | null)?.name ?? 'семейный архив'

  // Already a member?
  if (user) {
    const { data: existing } = await supabase
      .from('family_members')
      .select('id')
      .eq('family_id', invite.family_id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      redirect(`/dashboard?family=${invite.family_id}`)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-5">🌳</div>
        <h1 className="text-2xl font-light text-stone-800 mb-2">Вас приглашают</h1>
        <p className="text-stone-500 text-sm mb-1">в семейный архив</p>
        <p className="text-stone-800 font-medium text-lg mb-6">«{familyName}»</p>

        <div className="bg-stone-50 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-center gap-2 text-sm text-stone-600">
            <span className="text-stone-400">Ваша роль:</span>
            <span className="font-medium capitalize">
              {invite.role === 'admin'  ? '👑 Администратор' :
               invite.role === 'editor' ? '✏️ Редактор' :
               invite.role === 'member' ? '👤 Участник' : '👁 Наблюдатель'}
            </span>
          </div>
        </div>

        {user ? (
          <InviteAcceptButton
            inviteId={invite.id}
            familyId={invite.family_id}
            token={token}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-stone-400 text-sm mb-4">
              Войдите или зарегистрируйтесь, чтобы принять приглашение
            </p>
            <Link
              href={`/login?redirect=/invite/${token}`}
              className="block w-full py-2.5 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 transition-colors text-center"
            >
              Войти
            </Link>
            <Link
              href={`/register?redirect=/invite/${token}`}
              className="block w-full py-2.5 border border-stone-300 text-stone-700 text-sm rounded-lg hover:bg-stone-50 transition-colors text-center"
            >
              Зарегистрироваться
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
