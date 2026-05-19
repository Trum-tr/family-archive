'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  middle_name: string | null
  birth_date: string | null
  current_city: string | null
  biography: string | null
  profile_visibility: string | null
  is_alive: boolean
}

export default function MeEditForm({ person }: { person: Person }) {
  const supabase = createClient()
  const [form, setForm] = useState({
    first_name:         person.first_name ?? '',
    last_name:          person.last_name ?? '',
    middle_name:        person.middle_name ?? '',
    birth_date:         person.birth_date ?? '',
    current_city:       person.current_city ?? '',
    biography:          person.biography ?? '',
    profile_visibility: person.profile_visibility ?? 'family',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
    setSaved(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/persons/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:                 person.id,
          first_name:         form.first_name || null,
          last_name:          form.last_name  || null,
          middle_name:        form.middle_name || null,
          birth_date:         form.birth_date  || null,
          current_city:       form.current_city || null,
          biography:          form.biography    || null,
          profile_visibility: form.profile_visibility,
        }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error ?? 'Ошибка сохранения')
      else setSaved(true)
    } catch {
      setError('Сетевая ошибка, попробуйте снова')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-3 py-2 border border-stone-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 text-stone-800"
  const labelCls = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Фамилия</label>
          <input className={inputCls} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Иванов" />
        </div>
        <div>
          <label className={labelCls}>Имя</label>
          <input className={inputCls} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Иван" />
        </div>
      </div>

      <div>
        <label className={labelCls}>Отчество</label>
        <input className={inputCls} value={form.middle_name} onChange={e => set('middle_name', e.target.value)} placeholder="Иванович" />
      </div>

      {person.is_alive && (
        <>
          <div>
            <label className={labelCls}>Дата рождения</label>
            <input type="date" className={inputCls} value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Город проживания</label>
            <input className={inputCls} value={form.current_city} onChange={e => set('current_city', e.target.value)} placeholder="Москва" />
          </div>
        </>
      )}

      <div>
        <label className={labelCls}>О себе</label>
        <textarea
          className={inputCls + ' resize-none'}
          rows={4}
          value={form.biography}
          onChange={e => set('biography', e.target.value)}
          placeholder="Расскажите немного о себе…"
        />
      </div>

      <div>
        <label className={labelCls}>Видимость профиля</label>
        <select className={inputCls} value={form.profile_visibility} onChange={e => set('profile_visibility', e.target.value)}>
          <option value="private">🔒 Только я</option>
          <option value="family">👨‍👩‍👧 Семья</option>
          <option value="public">🌐 Публично</option>
        </select>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Сохраняю…' : saved ? '✓ Сохранено' : 'Сохранить'}
      </button>
    </form>
  )
}
