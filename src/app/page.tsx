import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl font-light tracking-tight text-stone-800">
            Цифровой семейный архив
          </h1>
          <p className="text-stone-500 text-lg font-light">
            Сохраните историю своей семьи для будущих поколений
          </p>
        </div>

        <div className="w-16 h-px bg-stone-300 mx-auto" />

        <p className="text-stone-500 text-sm leading-relaxed">
          Храните фотографии, биографии и семейные связи в едином защищённом архиве.
          Доступ только для членов семьи.
        </p>

        <Link
          href="/login"
          className="inline-block px-8 py-3 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors duration-200"
        >
          Войти
        </Link>
      </div>
    </main>
  )
}
