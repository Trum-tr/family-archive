import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })
  }

  const { token } = await req.json()
  if (!token) {
    return NextResponse.json({ error: 'Токен не передан' }, { status: 400 })
  }

  // Load valid invite
  const { data: invite, error: inviteErr } = await supabase
    .from('invitations')
    .select('id, family_id, role')
    .eq('token', token)
    .is('used_by', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (inviteErr || !invite) {
    return NextResponse.json({ error: 'Приглашение недействительно или истекло' }, { status: 404 })
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('family_members')
    .select('id')
    .eq('family_id', invite.family_id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    // Add to family
    const { error: memberErr } = await supabase
      .from('family_members')
      .insert({ family_id: invite.family_id, user_id: user.id, role: invite.role })

    if (memberErr) {
      return NextResponse.json({ error: 'Не удалось добавить в семью' }, { status: 500 })
    }
  }

  // Mark invite as used
  await supabase
    .from('invitations')
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq('id', invite.id)

  return NextResponse.json({ ok: true, familyId: invite.family_id })
}
