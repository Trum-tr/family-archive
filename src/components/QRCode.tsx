'use client'

import { useState } from 'react'

type Props = {
  url: string
  name: string
  size?: number
}

export default function QRCode({ url, name, size = 200 }: Props) {
  const [copied, setCopied] = useState(false)

  async function downloadPDF() {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(url)}&format=png&qzone=2`

    // Открываем в новом окне — браузер позволит сохранить
    const win = window.open('', '_blank')
    if (!win) return

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR — ${name}</title>
        <style>
          @media print { body { margin: 0; } }
          body { font-family: serif; text-align: center; padding: 40px; background: white; }
          img { width: 300px; height: 300px; display: block; margin: 0 auto 20px; }
          h1 { font-size: 24px; margin: 0 0 8px; font-weight: normal; }
          p { font-size: 14px; color: #666; word-break: break-all; }
        </style>
      </head>
      <body>
        <img src="${qrUrl}" />
        <h1>${name}</h1>
        <p>${url}</p>
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
      </html>
    `)
    win.document.close()
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=svg&qzone=1`

  return (
    <div className="flex flex-col items-center gap-4">
      {/* QR изображение */}
      <div className="border border-stone-200 rounded-xl p-4 bg-white">
        <img
          src={qrImageUrl}
          alt="QR код"
          width={size}
          height={size}
          className="block"
        />
      </div>

      {/* URL */}
      <p className="text-xs text-stone-400 text-center break-all max-w-xs">{url}</p>

      {/* Кнопки */}
      <div className="flex gap-2 w-full">
        <button
          onClick={copyLink}
          className="flex-1 px-3 py-2 border border-stone-300 text-stone-600 text-sm rounded-lg hover:bg-stone-50 transition-colors"
        >
          {copied ? '✓ Скопировано' : 'Копировать ссылку'}
        </button>
        <button
          onClick={downloadPDF}
          className="flex-1 px-3 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 transition-colors"
        >
          Печать / PDF
        </button>
      </div>

      {/* Подсказка */}
      <p className="text-xs text-stone-400 text-center">
        Распечатайте QR-код и прикрепите к надгробию — посетители смогут сканировать и читать профиль
      </p>

    </div>
  )
}
