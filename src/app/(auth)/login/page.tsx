'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function LoginForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const authError = searchParams.get('error')

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    authError === 'auth' ? 'Ссылка недействительна или истекла. Попробуйте снова.' : null
  )

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })

    setLoading(false)
    if (error) {
      setError(`Ошибка: ${error.message}`)
      return
    }
    setStep('code')
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })

    setLoading(false)
    if (error) {
      setError('Неверный код. Проверьте письмо и попробуйте снова.')
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  const inputCls = 'w-full px-4 py-2.5 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent transition text-sm'

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-stone-50">
      <div className="max-w-sm w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="text-4xl mb-2">🌳</div>
          <h1 className="text-2xl font-light text-stone-800">
            Цифровой семейный архив
          </h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 space-y-5">
          {step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
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
                  className={inputCls}
                />
                <p className="text-xs text-stone-400">Пришлём код для входа на почту</p>
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
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center mb-2">
                <div className="text-2xl mb-2">📬</div>
                <p className="text-stone-700 text-sm font-medium">Код отправлен на</p>
                <p className="text-stone-500 text-sm">{email}</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="code" className="block text-sm font-medium text-stone-700">
                  Код из письма
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="12345678"
                  required
                  autoComplete="one-time-code"
                  maxLength={8}
                  className={inputCls + ' text-center text-xl tracking-widest font-mono'}
                />
                <p className="text-xs text-stone-400">Введите код из письма</p>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full py-2.5 px-4 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? 'Проверяю...' : 'Войти'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(null) }}
                className="w-full text-sm text-stone-500 hover:text-stone-700 transition-colors"
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
