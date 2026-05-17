import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('persons')
    .select('first_name, last_name, middle_name, birth_date, death_date')
    .eq('id', id)
    .single()

  if (!data) return { title: 'Профиль не найден' }

  const name = [data.last_name, data.first_name, data.middle_name].filter(Boolean).join(' ')
  return {
    title: name || 'Цифровой архив',
    description: `Профиль — ${name}`,
  }
}

export default async function PublicProfilePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: person } = await supabase
    .from('persons')
    .select('*')
    .eq('id', id)
    .single()

  if (!person) notFound()

  const { data: mediaItems } = await supabase
    .from('media_items')
    .select('*')
    .eq('person_id', id)
    .order('created_at', { ascending: true })

  const { data: galleryPhotos } = await supabase
    .from('photos')
    .select('*')
    .eq('person_id', id)
    .order('created_at', { ascending: true })

  // Связи с другими профилями
  const { data: relationships } = await supabase
    .from('relationships')
    .select('*')
    .or(`person1_id.eq.${id},person2_id.eq.${id}`)

  // ID всех связанных людей
  const relatedIds = (relationships ?? []).map(r =>
    r.person1_id === id ? r.person2_id : r.person1_id
  )

  // Загрузить профили связанных
  const { data: relatedPersons } = relatedIds.length > 0
    ? await supabase
        .from('persons')
        .select('id, first_name, last_name, middle_name, birth_date, death_date, main_photo_url')
        .in('id', relatedIds)
    : { data: [] }

  const fullName = [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ') || 'Неизвестный'

  const birthYear = person.birth_date ? new Date(person.birth_date).getFullYear() : null
  const deathYear = person.death_date ? new Date(person.death_date).getFullYear() : null

  function formatDate(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Герой */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-xl mx-auto px-4 py-10 text-center">
          {/* Фото */}
          <div className="w-32 h-32 rounded-full bg-stone-100 mx-auto mb-5 overflow-hidden shadow-sm">
            {person.main_photo_url ? (
              <img
                src={person.main_photo_url}
                alt={fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300 text-5xl">👤</div>
            )}
          </div>

          {/* Имя */}
          <h1 className="text-2xl font-light text-stone-800 mb-2">{fullName}</h1>

          {/* Годы жизни */}
          {(birthYear || deathYear) && (
            <p className="text-stone-400 text-lg font-light tracking-wide">
              {birthYear ?? '?'} — {deathYear ?? '...'}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8 space-y-5">
        {/* Даты */}
        {(person.birth_date || person.death_date) && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Даты</p>
            <div className="space-y-2">
              {person.birth_date && (
                <div className="flex items-center gap-2 text-sm text-stone-700">
                  <span className="text-stone-400">🕯 Родился:</span>
                  <span>{formatDate(person.birth_date)}</span>
                </div>
              )}
              {person.death_date && (
                <div className="flex items-center gap-2 text-sm text-stone-700">
                  <span className="text-stone-400">✝ Умер:</span>
                  <span>{formatDate(person.death_date)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Биография */}
        {person.biography && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Биография</p>
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{person.biography}</p>
          </div>
        )}

        {/* Место захоронения */}
        {(person.burial_place || person.burial_lat) && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3">Место захоронения</p>
            {person.burial_place && (
              <p className="text-sm text-stone-700 mb-2">📍 {person.burial_place}</p>
            )}
            {person.burial_lat && person.burial_lng && (
              <a
                href={`https://maps.google.com/?q=${person.burial_lat},${person.burial_lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 text-sm rounded-lg hover:bg-blue-100 transition-colors"
              >
                🗺 Открыть на карте
              </a>
            )}
          </div>
        )}

        {/* Родственники */}
        {relationships && relationships.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-4">Родственники</p>
            <div className="space-y-3">
              {relationships.map((r: { id: string; person1_id: string; person2_id: string; relation_type: string }) => {
                const otherId = r.person1_id === id ? r.person2_id : r.person1_id
                const rel = (relatedPersons ?? []).find((p: { id: string }) => p.id === otherId) as {
                  id: string; first_name: string | null; last_name: string | null; middle_name: string | null;
                  birth_date: string | null; death_date: string | null; main_photo_url: string | null
                } | undefined
                if (!rel) return null
                const relName = [rel.last_name, rel.first_name, rel.middle_name].filter(Boolean).join(' ') || 'Без имени'
                const relBirth = rel.birth_date ? new Date(rel.birth_date).getFullYear() : null
                const relDeath = rel.death_date ? new Date(rel.death_date).getFullYear() : null
                const REL_LABELS: Record<string, string> = {
                  parent: 'Родитель', child: 'Ребёнок', spouse: 'Супруг(а)',
                  sibling: 'Брат/Сестра', adopted: 'Усыновлён'
                }
                return (
                  <Link
                    key={r.id}
                    href={`/p/${otherId}`}
                    className="flex items-center gap-3 hover:bg-stone-50 rounded-lg p-2 -mx-2 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-stone-100 flex-shrink-0 overflow-hidden">
                      {rel.main_photo_url ? (
                        <img src={rel.main_photo_url} alt={relName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300 text-lg">👤</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{relName}</p>
                      <p className="text-xs text-stone-400">
                        {REL_LABELS[r.relation_type] ?? r.relation_type}
                        {(relBirth || relDeath) && ` · ${relBirth ?? '?'} – ${relDeath ?? '...'}`}
                      </p>
                    </div>
                    <span className="text-stone-300">›</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Фотогалерея */}
        {galleryPhotos && galleryPhotos.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-4">Фотогалерея</p>
            <div className="grid grid-cols-3 gap-2">
              {galleryPhotos.map((photo: { id: string; url: string; caption: string | null }) => (
                <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-stone-100">
                  <img
                    src={photo.url}
                    alt={photo.caption || ''}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Медиа */}
        {mediaItems && mediaItems.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Материалы</p>
            {mediaItems.map((item: { id: string; type: string; title: string | null; content: string | null; file_url: string | null }) => {
              if (item.type === 'note') return (
                <div key={item.id}>
                  {item.title && <p className="text-sm font-medium text-stone-700 mb-1">📝 {item.title}</p>}
                  <p className="text-sm text-stone-600 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                </div>
              )
              if (item.type === 'audio') return (
                <div key={item.id}>
                  <p className="text-sm font-medium text-stone-700 mb-2">🎵 {item.title || 'Аудио'}</p>
                  <audio controls className="w-full h-10" src={item.file_url!}>Ваш браузер не поддерживает аудио</audio>
                </div>
              )
              if (item.type === 'video') {
                const yt = item.content?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
                const vk = item.content?.match(/vk\.com\/video(-?\d+)_(\d+)/)
                const embed = yt ? `https://www.youtube.com/embed/${yt[1]}`
                  : vk ? `https://vk.com/video_ext.php?oid=${vk[1]}&id=${vk[2]}` : null
                return (
                  <div key={item.id}>
                    <p className="text-sm font-medium text-stone-700 mb-2">🎬 {item.title || 'Видео'}</p>
                    {embed ? (
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <iframe src={embed} className="absolute inset-0 w-full h-full rounded-lg"
                          allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                      </div>
                    ) : (
                      <a href={item.content!} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline">{item.content}</a>
                    )}
                  </div>
                )
              }
              return null
            })}
          </div>
        )}

        {/* Подпись */}
        <div className="text-center pt-4 pb-2">
          <div className="w-8 h-px bg-stone-300 mx-auto mb-4" />
          <p className="text-xs text-stone-400">
            Цифровой семейный архив ·{' '}
            <Link href="/" className="hover:text-stone-600 transition-colors">
              Создать свой
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
