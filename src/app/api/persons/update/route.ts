import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })
  }

  const body = await req.json()
  // Remove fields that may not exist in DB yet (family_id, linked_user_id)
  const { id, family_id: _f, linked_user_id: _l, ...fields } = body

  if (!id) {
    return NextResponse.json({ error: 'id не передан' }, { status: 400 })
  }

  // Verify the user has access to edit this person (created_by check)
  const { data: person } = await supabase
    .from('persons')
    .select('id, created_by')
    .eq('id', id)
    .single()

  if (!person) {
    return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 })
  }

  // Allow if user created this person record
  if (person.created_by !== user.id) {
    return NextResponse.json({ error: 'Недостаточно прав для редактирования' }, { status: 403 })
  }

  const { error } = await supabase
    .from('persons')
    .update(fields)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
