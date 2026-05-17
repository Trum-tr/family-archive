'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { uploadPhoto } from '@/lib/supabase/storage'
import QRCode from '@/components/QRCode'

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  middle_name: string | null
  clan_name: string | null
  birth_date: string | null
  death_date: string | null
  biography: string | null
  burial_lat: number | null
  burial_lng: number | null
  burial_place: string | null
  main_photo_url: string | null
}

type Rel = {
  id: string
  person1_id: string
  person2_id: string
  relation_type: string
}

type SimplePerson = {
  id: string
  first_name: string | null
  last_name: string | null
}

const REL_LABELS: Record<string, string> = {
  parent:  'Родитель',
  child:   'Ребёнок',
  spouse:  'Супруг(а)',
  sibling: 'Брат/Сестра',
  adopted: 'Усыновлён',
}

function RelativesSection({ personId }: { personId: string }) {
  const [rels, setRels]         = useState<Rel[]>([])
  const [allPersons, setAll]    = useState<SimplePerson[]>([])
  const [adding, setAdding]     = useState(false)
  const [selId, setSelId]       = useState('')
  const [relType, setRelType]   = useState('parent')
  const [saving, setSaving]     = useState(false)

  const loadRels = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from('relationships').select('*')
        .or(`person1_id.eq.${personId},person2_id.eq.${personId}`),
      supabase.from('persons').select('id,first_name,last_name').eq('created_by', user.id),
    ])
    setRels(r ?? [])
    setAll(((p ?? []) as SimplePerson[]).filter(pp => pp.id !== personId))
  }, [personId])

  useEffect(() => { loadRels() }, [loadRels])

  async function addRel() {
    if (!selId) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('relationships').insert({
      person1_id: personId,
      person2_id: selId,
      relation_type: relType,
      created_by: user.id,
    })
    setAdding(false); setSelId(''); setRelType('parent')
    setSaving(false)
    loadRels()
  }

  async function removeRel(relId: string) {
    const supabase = createClient()
    await supabase.from('relationships').delete().eq('id', relId)
    loadRels()
  }

  const getName = (id: string) => {
    const p = allPersons.find(pp => pp.id === id)
    if (!p) return 'Неизвестно'
    return [p.last_name, p.first_name].filter(Boolean).join(' ') || 'Без имени'
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Родственники</p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs text-stone-600 border border-stone-200 rounded-lg px-2.5 py-1 hover:bg-stone-50 transition-colors"
          >
            + Добавить
          </button>
        )}
      </div>

      {/* Форма добавления */}
      {adding && (
        <div className="mb-3 p-3 bg-stone-50 rounded-lg space-y-2">
          <select
            value={selId}
            onChange={e => setSelId(e.target.value)}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          >
            <option value="">Выберите человека...</option>
            {allPersons.map(p => (
              <option key={p.id} value={p.id}>
                {[p.last_name, p.first_name].filter(Boolean).join(' ') || 'Без имени'}
              </option>
            ))}
          </select>
          <select
            value={relType}
            onChange={e => setRelType(e.target.value)}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          >
            {Object.entries(REL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={addRel}
              disabled={saving || !selId}
              className="flex-1 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Сохраняю...' : 'Сохранить'}
            </button>
            <button
              onClick={() => { setAdding(false); setSelId(''); setRelType('parent') }}
              className="flex-1 py-2 border border-stone-200 text-stone-600 text-sm rounded-lg hover:bg-stone-50 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Список родственников */}
      {rels.length === 0 && !adding ? (
        <p className="text-sm text-stone-300 italic">Связи не добавлены</p>
      ) : (
        <div className="space-y-2">
          {rels.map(r => {
            const otherId = r.person1_id === personId ? r.person2_id : r.person1_id
            return (
              <div key={r.id} className="flex items-center justify-between py-1.5">
                <div>
                  <span className="text-xs text-stone-400 mr-2">{REL_LABELS[r.relation_type] ?? r.relation_type}</span>
                  <Link
                    href={`/dashboard/persons/${otherId}`}
                    className="text-sm text-stone-700 hover:text-stone-900 hover:underline"
                  >
                    {getName(otherId)}
                  </Link>
                </div>
                <button
                  onClick={() => removeRel(r.id)}
                  className="text-stone-300 hover:text-red-400 transition-colors text-lg leading-none"
                  title="Удалить связь"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [person, setPerson] = useState<Person | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [form, setForm] = useState<{
    last_name: string; first_name: string; middle_name: string; clan_name: string
    birth_date: string; death_date: string; biography: string
    burial_lat: string; burial_lng: string; burial_place: string
  }>({
    last_name: '', first_name: '', middle_name: '', clan_name: '',
    birth_date: '', death_date: '', biography: '',
    burial_lat: '', burial_lng: '', burial_place: '',
  })

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('persons').select('*').eq('id', id).single()
    if (data) {
      setPerson(data)
      setForm({
        last_name: data.last_name || '',
        first_name: data.first_name || '',
        middle_name: data.middle_name || '',
        clan_name: data.clan_name || '',
        birth_date: data.birth_date || '',
        death_date: data.death_date || '',
        biography: data.biography || '',
        burial_lat: data.burial_lat?.toString() || '',
        burial_lng: data.burial_lng?.toString() || '',
        burial_place: data.burial_place || '',
      })
    }
  }, [id])

  useEffect(() => { load() }, [load])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let photoUrl = person?.main_photo_url
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile, user.id, id) || photoUrl
      }

      await supabase.from('persons').update({
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        middle_name: form.middle_name || null,
        clan_name: form.clan_name || null,
        birth_date: form.birth_date || null,
        death_date: form.death_date || null,
        biography: form.biography || null,
        burial_lat: form.burial_lat ? parseFloat(form.burial_lat) : null,
        burial_lng: form.burial_lng ? parseFloat(form.burial_lng) : null,
        burial_place: form.burial_place || null,
        main_photo_url: photoUrl,
      }).eq('id', id)

      await load()
      setEditing(false)
      setPhotoFile(null)
      setPhotoPreview(null)
    } finally {
      setLoading(false)
    }
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400">Загрузка...</div>
      </div>
    )
  }

  const fullName = [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ') || 'Без имени'
  const publicUrl = `${process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/p/${id}`

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Шапка */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/dashboard/persons" className="text-stone-400 text-sm hover:text-stone-600 transition-colors">
            ← Профили
          </Link>
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={loading}
            className="px-4 py-1.5 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Сохраняю...' : editing ? 'Сохранить' : 'Редактировать'}
          </button>
        </div>

        {/* Фото + имя */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 mb-4 text-center">
          <div className="w-28 h-28 rounded-full bg-stone-100 mx-auto mb-4 overflow-hidden relative">
            {(photoPreview || person.main_photo_url) ? (
              <img src={photoPreview || person.main_photo_url!} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300 text-4xl">👤</div>
            )}
            {editing && (
              <label className="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer rounded-full">
                <span className="text-white text-xs">Сменить</span>
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </label>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              {[
                { key: 'last_name', placeholder: 'Фамилия' },
                { key: 'first_name', placeholder: 'Имя' },
                { key: 'middle_name', placeholder: 'Отчество' },
              ].map(({ key, placeholder }) => (
                <input
                  key={key}
                  type="text"
                  value={form[key as keyof typeof form] ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full text-center border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              ))}
              <input
                type="text"
                value={form.clan_name}
                onChange={e => setForm(f => ({ ...f, clan_name: e.target.value }))}
                placeholder="Род (например: Ахмадовы)"
                className="w-full text-center border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>
          ) : (
            <>
              <h1 className="text-xl font-medium text-stone-800">{fullName}</h1>
              {person.clan_name && (
                <p className="text-stone-500 text-sm mt-0.5">Род: {person.clan_name}</p>
              )}
              {(person.birth_date || person.death_date) && (
                <p className="text-stone-400 text-sm mt-1">
                  {person.birth_date ? new Date(person.birth_date).getFullYear() : '?'}
                  {' – '}
                  {person.death_date ? new Date(person.death_date).getFullYear() : '...'}
                </p>
              )}
            </>
          )}
        </div>

        {/* Даты (в режиме редактирования) */}
        {editing && (
          <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4 space-y-4">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Даты</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-stone-600 mb-1">Рождение</label>
                <input type="date" value={form.birth_date}
                  onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300" />
              </div>
              <div>
                <label className="block text-sm text-stone-600 mb-1">Смерть</label>
                <input type="date" value={form.death_date}
                  onChange={e => setForm(f => ({ ...f, death_date: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300" />
              </div>
            </div>
          </div>
        )}

        {/* Биография */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Биография</p>
          {editing ? (
            <textarea value={form.biography}
              onChange={e => setForm(f => ({ ...f, biography: e.target.value }))}
              rows={6} placeholder="Расскажите о жизни..."
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none" />
          ) : (
            <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">
              {person.biography || <span className="text-stone-300 italic">Биография не добавлена</span>}
            </p>
          )}
        </div>

        {/* Место захоронения */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Место захоронения</p>
          {editing ? (
            <div className="space-y-3">
              <input type="text" value={form.burial_place}
                onChange={e => setForm(f => ({ ...f, burial_place: e.target.value }))}
                placeholder="Название кладбища / адрес"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="any" value={form.burial_lat}
                  onChange={e => setForm(f => ({ ...f, burial_lat: e.target.value }))}
                  placeholder="Широта"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300" />
                <input type="number" step="any" value={form.burial_lng}
                  onChange={e => setForm(f => ({ ...f, burial_lng: e.target.value }))}
                  placeholder="Долгота"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300" />
              </div>
            </div>
          ) : (
            <div className="text-sm text-stone-600">
              {person.burial_place && <p className="mb-1">📍 {person.burial_place}</p>}
              {person.burial_lat && person.burial_lng && (
                <a
                  href={`https://maps.google.com/?q=${person.burial_lat},${person.burial_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-xs"
                >
                  Открыть на карте ({person.burial_lat.toFixed(5)}, {person.burial_lng.toFixed(5)})
                </a>
              )}
              {!person.burial_place && !person.burial_lat && (
                <span className="text-stone-300 italic">Не указано</span>
              )}
            </div>
          )}
        </div>

        {/* Родственники */}
        {!editing && <RelativesSection personId={id} />}

        {/* QR-код */}
        {!editing && (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-4">QR-код для надгробия</p>
            <QRCode url={publicUrl} name={fullName} />
          </div>
        )}

        {/* Отмена редактирования */}
        {editing && (
          <button
            onClick={() => { setEditing(false); setPhotoFile(null); setPhotoPreview(null); load() }}
            className="w-full mt-2 px-4 py-3 border border-stone-300 text-stone-600 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors"
          >
            Отмена
          </button>
        )}
      </div>
    </div>
  )
}
