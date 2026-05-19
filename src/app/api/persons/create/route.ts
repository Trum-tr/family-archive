import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })
  }

  const body = await req.json()

  const { data: person, error } = await supabase
    .from('persons')
    .insert({
      first_name:     body.first_name    ?? null,
      last_name:      body.last_name     ?? null,
      middle_name:    body.middle_name   ?? null,
      clan_name:      body.clan_name     ?? null,
      birth_date:     body.birth_date    ?? null,
      death_date:     body.death_date    ?? null,
      biography:      body.biography     ?? null,
      burial_lat:     body.burial_lat    ?? null,
      burial_lng:     body.burial_lng    ?? null,
      burial_place:   body.burial_place  ?? null,
      main_photo_url: body.main_photo_url ?? null,
      created_by:     user.id,
    })
    .select()
    .single()

  if (error || !person) {
    return NextResponse.json({ error: error?.message ?? 'Не удалось создать профиль' }, { status: 500 })
  }

  return NextResponse.json({ person })
}
