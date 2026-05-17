'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'

export default function SearchInput({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value.trim()
      const params = new URLSearchParams(searchParams.toString())
      if (q) {
        params.set('q', q)
      } else {
        params.delete('q')
      }
      startTransition(() => {
        router.replace(`/dashboard/persons?${params.toString()}`)
      })
    },
    [router, searchParams]
  )

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">🔍</span>
      <input
        type="search"
        defaultValue={defaultValue}
        onChange={handleChange}
        placeholder="Поиск по имени или роду…"
        className={`w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400 transition-colors ${isPending ? 'opacity-60' : ''}`}
      />
    </div>
  )
}
