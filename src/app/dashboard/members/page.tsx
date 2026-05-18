import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MembersTable from './MembersTable'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ family?: string }>

export default async function MembersPage({ searchParams }: { searchParams: SearchParams }) {
  const { family: familyId } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!familyId) redirect('/dashboard')

  // Check admin access
  const { data: myMembership } = await supabase
    .from('family_members')
    .select('role')
    .eq('family_id', familyId)
    .eq('user_id', user.id)
    .single()

  const { data: isOwner } = await supabase
    .from('family_spaces')
    .select('id, name')
    .eq('id', familyId)
    .eq('created_by', user.id)
    .single()

  const isAdmin = isOwner != null || myMembership?.role === 'admin'
  if (!isAdmin) redirect('/dashboard')

  const familyName = isOwner?.name ?? 'Семейный архив'

  // Load members with user info
  const { data: members } = await supabase
    .from('family_members')
    .select('id, role, joined_at, user_id')
    .eq('family_id', familyId)
    .order('joined_at', { ascending: true })

  // Load persons linked to these users
  const userIds = (members ?? []).map(m => m.user_id)
  const { data: linkedPersons } = userIds.length > 0
    ? await supabase
        .from('persons')
        .select('id, first_name, last_name, main_photo_url, linked_user_id')
        .in('linked_user_id', userIds)
    : { data: [] }

  // Enrich members
  const enriched = (members ?? []).map(m => ({
    ...m,
    person: (linkedPersons ?? []).find(p => p.linked_user_id === m.user_id) ?? null,
  }))

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-light text-stone-800">👥 Участники семьи</h1>
            <p className="text-stone-400 text-sm mt-0.5">«{familyName}»</p>
          </div>
          <Link href="/dashboard" className="text-stone-400 hover:text-stone-600 text-sm transition-colors">
            ← Назад
          </Link>
        </div>

        <MembersTable
          members={enriched}
          familyId={familyId}
          currentUserId={user.id}
          isOwner={!!isOwner}
        />
      </div>
    </div>
  )
}
