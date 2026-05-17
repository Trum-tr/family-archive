'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()

  const [step, setStep] = useState<'email' | 'sent'>('email')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (error) {
      setError('Не удалось отправить ссылку. Проверьте email и попробуйте снова.')
      return
    }

    setStep('sent')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-stone-50">
      <div className="max-w-sm w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-light text-stone-800">
            Цифровой семейный архив
          </h1>
          <p className="text-stone-500 text-sm">
            {step === 'email'
              ? 'Введите email для входа без пароля'
              : 'Проверьте почту'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 space-y-5">
          {step === 'email' ? (
            <form onSubmit={handleSendLink} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-stone-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent transition text-sm"
                />
                <p className="text-xs text-stone-400">
                  Пришлём ссылку для входа — без пароля
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-2.5 px-4 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? 'Отправка...' : 'Получить ссылку'}
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="text-4xl">📬</div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-stone-800">
                  Ссылка отправлена на
                </p>
                <p className="text-sm text-stone-500">{email}</p>
              </div>
              <p className="text-xs text-stone-400">
                Откройте письмо и нажмите на ссылку — вы войдёте автоматически.
                Если письма нет, проверьте папку «Спам».
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setError(null)
                }}
                className="w-full py-2 text-sm text-stone-500 hover:text-stone-700 transition-colors"
              >
                Изменить email
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-stone-400">
          После подключения SMS можно будет входить по номеру телефона
        </p>
      </div>
    </main>
  )
}
