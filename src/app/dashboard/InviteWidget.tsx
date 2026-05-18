'use client'

import { useState } from 'react'

type Props = { familyId: string }

export default function InviteWidget({ familyId }: Props) {
  const [role, setRole] = useState<string>('member')
  const [link, setLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generate() {
    setLoading(true)
    setCopied(false)
    try {
      const res = await fetch('/api/invitations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setLink(json.link)
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select
          value={role}
          onChange={e => { setRole(e.target.value); setLink(null) }}
          className="px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400"
        >
          <option value="viewer">Наблюдатель</option>
          <option value="member">Участник</option>
          <option value="editor">Редактор</option>
          <option value="admin">Администратор</option>
        </select>
        <button
          onClick={generate}
          disabled={loading}
          className="px-4 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '⏳ Генерирую…' : '🔗 Создать ссылку'}
        </button>
      </div>

      {link && (
        <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg p-3">
          <input
            readOnly
            value={link}
            className="flex-1 text-xs text-stone-600 bg-transparent outline-none truncate"
          />
          <button
            onClick={copyLink}
            className="flex-shrink-0 text-xs px-3 py-1 bg-white border border-stone-300 rounded-md hover:bg-stone-50 transition-colors text-stone-700"
          >
            {copied ? '✓ Скопировано!' : 'Копировать'}
          </button>
        </div>
      )}
    </div>
  )
}
