'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Member = {
  id: string
  user_id: string
  role: string
  joined_at: string
  person: {
    id: string
    first_name: string | null
    last_name: string | null
    main_photo_url: string | null
  } | null
}

const ROLE_LABELS: Record<string, string> = {
  viewer:  '👁 Наблюдатель',
  member:  '👤 Участник',
  editor:  '✏️ Редактор',
  admin:   '👑 Администратор',
}

const ROLES = ['viewer', 'member', 'editor', 'admin']

type Props = {
  members: Member[]
  familyId: string
  currentUserId: string
  isOwner: boolean
}

export default function MembersTable({ members, familyId, currentUserId, isOwner }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [updating, setUpdating] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  async function changeRole(memberId: string, newRole: string) {
    setUpdating(memberId)
    await supabase
      .from('family_members')
      .update({ role: newRole })
      .eq('id', memberId)
    setUpdating(null)
    router.refresh()
  }

  async function removeMember(memberId: string, userId: string) {
    if (!confirm('Удалить этого участника из семьи?')) return
    setRemoving(memberId)
    await supabase
      .from('family_members')
      .delete()
      .eq('id', memberId)
    setRemoving(null)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100 bg-stone-50">
            <th className="text-left px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Участник</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Роль</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Вступил</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {members.map(m => {
            const name = m.person
              ? [m.person.last_name, m.person.first_name].filter(Boolean).join(' ') || 'Без имени'
              : `Участник (${m.user_id.slice(0, 8)}…)`
            const isSelf = m.user_id === currentUserId
            const joinedDate = new Date(m.joined_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
            const canEdit = isOwner && !isSelf

            return (
              <tr key={m.id} className={`hover:bg-stone-50 ${isSelf ? 'bg-emerald-50/30' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-stone-100 flex-shrink-0 overflow-hidden">
                      {m.person?.main_photo_url
                        ? <img src={m.person.main_photo_url} alt={name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-stone-300 text-sm">👤</div>
                      }
                    </div>
                    <div>
                      <p className="font-medium text-stone-700 leading-tight">
                        {name}
                        {isSelf && <span className="ml-1.5 text-xs text-emerald-600">(Вы)</span>}
                      </p>
                      {m.person && (
                        <a href={`/p/${m.person.id}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                          Профиль →
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {canEdit ? (
                    <select
                      value={m.role}
                      disabled={updating === m.id}
                      onChange={e => changeRole(m.id, e.target.value)}
                      className="border border-stone-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 text-stone-700"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-stone-600 text-xs">{ROLE_LABELS[m.role] ?? m.role}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-stone-400">{joinedDate}</td>
                <td className="px-4 py-3 text-right">
                  {canEdit && (
                    <button
                      onClick={() => removeMember(m.id, m.user_id)}
                      disabled={removing === m.id}
                      className="text-xs text-stone-300 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {removing === m.id ? '…' : 'Удалить'}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {members.length === 0 && (
        <div className="text-center py-10 text-stone-400 text-sm">
          Участников нет. Пригласите родственников!
        </div>
      )}
    </div>
  )
}
