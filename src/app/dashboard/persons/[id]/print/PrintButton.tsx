'use client'

import { useEffect } from 'react'

export default function PrintButton() {
  useEffect(() => {
    // Небольшая задержка чтобы изображения успели загрузиться
    const t = setTimeout(() => window.print(), 800)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="no-print fixed bottom-6 right-6 flex gap-3">
      <button
        onClick={() => window.print()}
        className="px-5 py-2.5 bg-stone-800 text-white text-sm font-medium rounded-lg shadow-lg hover:bg-stone-700 transition-colors"
      >
        🖨 Печать / Сохранить PDF
      </button>
      <button
        onClick={() => window.close()}
        className="px-4 py-2.5 bg-white text-stone-600 text-sm font-medium rounded-lg shadow-lg border border-stone-200 hover:bg-stone-50 transition-colors"
      >
        ✕ Закрыть
      </button>
    </div>
  )
}
