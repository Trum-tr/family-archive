'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  inviteId: string
  familyId: string
  token: string
}

export default function InviteAcceptButton({ inviteId, familyId, token }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleAccept() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Ошибка')
      router.push(`/dashboard?family=${familyId}&onboarding=1`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
      <button
        onClick={handleAccept}
        disabled={loading}
        className="w-full py-2.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-medium"
      >
        {loading ? '⏳ Принимаю…' : '✅ Принять приглашение'}
      </button>
    </div>
  )
}
