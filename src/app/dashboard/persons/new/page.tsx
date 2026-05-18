'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { uploadPhoto } from '@/lib/supabase/storage'
import { Suspense } from 'react'

function NewPersonForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const familyIdFromUrl = searchParams.get('family')

  const [loading, setLoading] = useState(false)
  const [familyId, setFamilyId] = useState<string | null>(familyIdFromUrl)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    last_name: '',
    first_name: '',
    middle_name: '',
    clan_name: '',
    birth_date: '',
    death_date: '',
    biography: '',
    burial_lat: '',
    burial_lng: '',
    burial_place: '',
  })

  // Получаем family_id если не передан в URL
  useEffect(() => {
    if (familyId) return
    const supabase = createClient()
    async function getFamilyId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: mySpace } = await supabase
        .from('family_spaces')
        .select('id')
        .eq('created_by', user.id)
        .single()
      if (mySpace?.id) { setFamilyId(mySpace.id); return }
      const { data: membership } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (membership?.family_id) setFamilyId(membership.family_id)
    }
    getFamilyId()
  }, [familyId])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: person, error } = await supabase
        .from('persons')
        .insert({
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
          created_by: user.id,
          family_id: familyId ?? null,
        })
        .select()
        .single()

      if (error || !person) throw error

      if (photoFile) {
        const url = await uploadPhoto(photoFile, user.id, person.id)
        if (url) {
          await supabase
            .from('persons')
            .update({ main_photo_url: url })
            .eq('id', person.id)
        }
      }

      router.push(`/dashboard/persons/${person.id}`)
    } catch (err) {
      console.error(err)
      alert('Ошибка при сохранении. Проверьте данные и попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard/persons" className="text-stone-400 text-sm hover:text-stone-600 transition-colors">
            ← Назад
          </Link>
          <h1 className="text-2xl font-light text-stone-800 mt-1">Новый профиль</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Фото */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Фотография</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-stone-100 flex-shrink-0 overflow-hidden">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300 text-3xl">👤</div>
                )}
              </div>
              <div>
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" id="photo-input" />
                <label htmlFor="photo-input" className="inline-block px-4 py-2 border border-stone-300 text-stone-600 text-sm rounded-lg cursor-pointer hover:bg-stone-50 transition-colors">
                  Выбрать фото
                </label>
                <p className="text-xs text-stone-400 mt-1">JPG, PNG, WEBP до 5 МБ</p>
              </div>
            </div>
          </div>

          {/* ФИО */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">ФИО</label>
            {[
              { key: 'last_name', label: 'Фамилия' },
              { key: 'first_name', label: 'Имя' },
              { key: 'middle_name', label: 'Отчество' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm text-stone-600 mb-1">{label}</label>
                <input
                  type="text"
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
                  placeholder={label}
                />
              </div>
            ))}
            <div>
              <label className="block text-sm text-stone-600 mb-1">Род / фамильная ветвь</label>
              <input
                type="text"
                value={form.clan_name}
                onChange={e => setForm(f => ({ ...f, clan_name: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
                placeholder="Например: Ахмадовы, Джабраиловы..."
              />
            </div>
          </div>

          {/* Даты */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">Даты</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-stone-600 mb-1">Дата рождения</label>
                <input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300" />
              </div>
              <div>
                <label className="block text-sm text-stone-600 mb-1">Дата смерти</label>
                <input type="date" value={form.death_date} onChange={e => setForm(f => ({ ...f, death_date: e.target.value }))} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300" />
              </div>
            </div>
          </div>

          {/* Биография */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Биография</label>
            <textarea
              value={form.biography}
              onChange={e => setForm(f => ({ ...f, biography: e.target.value }))}
              rows={5}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none"
              placeholder="Расскажите о жизни, деятельности, памятных событиях..."
            />
          </div>

          {/* GPS */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">Место захоронения</label>
            <div>
              <label className="block text-sm text-stone-600 mb-1">Название кладбища / адрес</label>
              <input type="text" value={form.burial_place} onChange={e => setForm(f => ({ ...f, burial_place: e.target.value }))} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300" placeholder="Например: Новодевичье кладбище, Москва" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-stone-600 mb-1">Широта (lat)</label>
                <input type="number" step="any" value={form.burial_lat} onChange={e => setForm(f => ({ ...f, burial_lat: e.target.value }))} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300" placeholder="55.7289" />
              </div>
              <div>
                <label className="block text-sm text-stone-600 mb-1">Долгота (lng)</label>
                <input type="number" step="any" value={form.burial_lng} onChange={e => setForm(f => ({ ...f, burial_lng: e.target.value }))} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300" placeholder="37.5672" />
              </div>
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex gap-3">
            <Link href="/dashboard/persons" className="flex-1 text-center px-4 py-3 border border-stone-300 text-stone-600 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors">
              Отмена
            </Link>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-3 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50">
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function NewPersonPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center"><p className="text-stone-400 text-sm">Загрузка…</p></div>}>
      <NewPersonForm />
    </Suspense>
  )
}
