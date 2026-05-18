'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })

    setLoading(false)
    if (error) {
      setError(`Ошибка: ${error.message}`)
      return
    }
    setStep('otp')
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'email',
    })

    setLoading(false)
    if (error) {
      setError('Неверный код. Проверьте письмо и попробуйте снова.')
      return
    }
    router.push(redirectTo)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-stone-50">
      <div className="max-w-sm w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-light text-stone-800">
            Цифровой семейный архив
          </h1>
          <p className="text-stone-500 text-sm">
            {step === 'email' ? 'Введите email для входа' : `Код отправлен на ${email}`}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 space-y-5">
          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-stone-700">
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
                <p className="text-xs text-stone-400">Пришлём 6-значный код для входа</p>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-2.5 px-4 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? 'Отправка...' : 'Получить код'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="token" className="block text-sm font-medium text-stone-700">
                  Код из письма
                </label>
                <input
                  id="token"
                  type="text"
                  inputMode="numeric"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="123456"
                  required
                  autoComplete="one-time-code"
                  className="w-full px-4 py-2.5 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent transition text-sm text-center text-xl tracking-widest"
                />
                <p className="text-xs text-stone-400">Проверьте папку «Спам» если нет письма</p>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || token.length < 6 || token.length > 8}
                className="w-full py-2.5 px-4 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? 'Проверка...' : 'Войти'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setToken(''); setError(null) }}
                className="w-full py-2 text-sm text-stone-500 hover:text-stone-700 transition-colors"
              >
                ← Изменить email
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-400 text-sm">Загрузка…</p>
      </main>
    }>
      <LoginForm />
    </Suspense>
  )
}
