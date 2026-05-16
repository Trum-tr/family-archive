import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Цифровой семейный архив',
  description: 'Сохраните историю своей семьи для будущих поколений',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className="antialiased bg-stone-50 text-stone-900">
        {children}
      </body>
    </html>
  )
}
