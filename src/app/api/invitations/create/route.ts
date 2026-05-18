import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })
  }

  const { familyId, role = 'member', email } = await req.json()
  if (!familyId) {
    return NextResponse.json({ error: 'familyId не передан' }, { status: 400 })
  }

  // Check that caller is editor or admin
  const { data: membership } = await supabase
    .from('family_members')
    .select('role')
    .eq('family_id', familyId)
    .eq('user_id', user.id)
    .single()

  const isOwner = await supabase
    .from('family_spaces')
    .select('id')
    .eq('id', familyId)
    .eq('created_by', user.id)
    .single()

  const hasAccess = isOwner.data ||
    (membership && ['editor', 'admin'].includes(membership.role))

  if (!hasAccess) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  // Create invitation
  const { data: invite, error } = await supabase
    .from('invitations')
    .insert({ family_id: familyId, invited_by: user.id, role, email: email || null })
    .select('token')
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Не удалось создать приглашение' }, { status: 500 })
  }

  // Используем origin из запроса — работает и локально, и на Vercel
  const origin = req.nextUrl.origin
  const link = `${origin}/invite/${invite.token}`

  return NextResponse.json({ token: invite.token, link })
}
