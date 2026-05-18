'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type LifeEvent = {
  id: string
  event_type: string
  title: string
  description: string | null
  event_date: string | null
  event_year: number | null
  location: string | null
}

const EVENT_ICONS: Record<string, string> = {
  birth:            '🕯',
  death:            '✝',
  education:        '📚',
  graduation:       '🎓',
  work_start:       '💼',
  work_end:         '🏁',
  emigration:       '✈️',
  relocation:       '🏠',
  marriage:         '💍',
  divorce:          '💔',
  military_service: '🎖',
  military_end:     '🏅',
  award:            '🏆',
  achievement:      '⭐',
  other:            '📌',
}

const EVENT_LABELS: Record<string, string> = {
  birth:            'Рождение',
  death:            'Смерть',
  education:        'Учёба',
  graduation:       'Окончание учёбы',
  work_start:       'Начало работы',
  work_end:         'Окончание работы',
  emigration:       'Эмиграция',
  relocation:       'Переезд',
  marriage:         'Бракосочетание',
  divorce:          'Развод',
  military_service: 'Воинская служба',
  military_end:     'Окончание службы',
  award:            'Награда',
  achievement:      'Достижение',
  other:            'Событие',
}

const TYPES = Object.entries(EVENT_LABELS)

function eventSortKey(e: LifeEvent): number {
  if (e.event_date) return new Date(e.event_date).getTime()
  if (e.event_year) return new Date(e.event_year, 0).getTime()
  return 0
}

export default function LifeEventsSection({ personId }: { personId: string }) {
  const supabase = createClient()
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    event_type:  'other',
    title:       '',
    description: '',
    event_date:  '',
    event_year:  '',
    location:    '',
  })

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('life_events')
      .select('id, event_type, title, description, event_date, event_year, location')
      .eq('person_id', personId)
      .order('event_year', { ascending: true, nullsFirst: false })
    setEvents(((data ?? []) as LifeEvent[]).sort((a, b) => eventSortKey(a) - eventSortKey(b)))
  }, [personId, supabase])

  useEffect(() => { load() }, [load])

  function setF(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    // auto-fill title if empty
    if (k === 'event_type' && !form.title) {
      setForm(f => ({ ...f, event_type: v, title: EVENT_LABELS[v] ?? '' }))
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('life_events').insert({
      person_id:   personId,
      event_type:  form.event_type,
      title:       form.title.trim(),
      description: form.description.trim() || null,
      event_date:  form.event_date  || null,
      event_year:  form.event_year ? parseInt(form.event_year) : null,
      location:    form.location.trim() || null,
      created_by:  user?.id,
    })
    setSaving(false)
    setAdding(false)
    setForm({ event_type: 'other', title: '', description: '', event_date: '', event_year: '', location: '' })
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from('life_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  function formatDate(e: LifeEvent) {
    if (e.event_date) return new Date(e.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    if (e.event_year) return `${e.event_year} г.`
    return 'Дата не указана'
  }

  const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 bg-white"

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Хронология жизни</p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs text-stone-600 border border-stone-200 rounded-lg px-2.5 py-1 hover:bg-stone-50 transition-colors"
          >
            + Добавить событие
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <form onSubmit={handleAdd} className="mb-4 p-4 bg-stone-50 rounded-xl space-y-3 border border-stone-200">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">Тип события</label>
              <select className={inputCls} value={form.event_type} onChange={e => setF('event_type', e.target.value)}>
                {TYPES.map(([val, label]) => (
                  <option key={val} value={val}>{EVENT_ICONS[val]} {label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">Год (если нет точной даты)</label>
              <input className={inputCls} type="number" min="1800" max="2100" placeholder="1945" value={form.event_year} onChange={e => setF('event_year', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Точная дата</label>
            <input className={inputCls} type="date" value={form.event_date} onChange={e => setF('event_date', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Название *</label>
            <input className={inputCls} required placeholder="Поступил в МГУ" value={form.title} onChange={e => setF('title', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Описание</label>
            <textarea className={inputCls + ' resize-none'} rows={2} placeholder="Подробности…" value={form.description} onChange={e => setF('description', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Место</label>
            <input className={inputCls} placeholder="Москва" value={form.location} onChange={e => setF('location', e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors">
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="px-4 py-2 text-stone-500 text-sm rounded-lg hover:bg-stone-100 transition-colors">
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Timeline */}
      {events.length === 0 && !adding ? (
        <p className="text-sm text-stone-300 italic">События не добавлены</p>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          {events.length > 1 && (
            <div className="absolute left-3.5 top-4 bottom-4 w-px bg-stone-200" />
          )}
          <div className="space-y-4">
            {events.map(ev => (
              <div key={ev.id} className="flex gap-3 group">
                {/* Dot */}
                <div className="w-7 h-7 rounded-full bg-white border-2 border-stone-200 flex items-center justify-center text-sm flex-shrink-0 z-10">
                  {EVENT_ICONS[ev.event_type] ?? '📌'}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-700 leading-tight">{ev.title}</p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {formatDate(ev)}
                        {ev.location && ` · 📍 ${ev.location}`}
                      </p>
                      {ev.description && (
                        <p className="text-xs text-stone-500 mt-1 leading-relaxed">{ev.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="text-stone-200 hover:text-red-400 transition-colors text-lg leading-none opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
