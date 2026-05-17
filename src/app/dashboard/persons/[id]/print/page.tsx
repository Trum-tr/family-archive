import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PrintButton from './PrintButton'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function PrintPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: person } = await supabase
    .from('persons')
    .select('first_name, last_name, middle_name, birth_date, death_date, burial_place, clan_name, main_photo_url')
    .eq('id', id)
    .single()

  if (!person) notFound()

  const fullName = [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ') || 'Неизвестный'
  const birthYear = person.birth_date ? new Date(person.birth_date).getFullYear() : null
  const deathYear = person.death_date ? new Date(person.death_date).getFullYear() : null

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://family-archive.vercel.app'
  const publicUrl = `${siteUrl}/p/${id}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&qzone=1&data=${encodeURIComponent(publicUrl)}`

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        @page {
          size: A4;
          margin: 20mm;
        }
        body {
          font-family: Georgia, 'Times New Roman', serif;
          background: white;
          color: #1c1917;
        }
      `}</style>

      <div className="no-print bg-amber-50 border-b border-amber-200 px-6 py-3 text-sm text-amber-800 text-center">
        Нажмите «Печать / Сохранить PDF» → выберите «Сохранить как PDF» в диалоге печати
      </div>

      {/* Страница для печати */}
      <div className="max-w-lg mx-auto px-8 py-12 text-center">

        {/* Имя */}
        <h1 className="text-3xl font-light text-stone-900 mb-1 tracking-wide">
          {fullName}
        </h1>

        {/* Годы */}
        {(birthYear || deathYear) && (
          <p className="text-xl text-stone-500 font-light mb-8 tracking-widest">
            {birthYear ?? '?'} — {deathYear ?? '...'}
          </p>
        )}

        {/* Разделитель */}
        <div className="w-16 h-px bg-stone-300 mx-auto mb-8" />

        {/* QR-код */}
        <div className="flex justify-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt="QR-код"
            width={200}
            height={200}
            className="block"
          />
        </div>

        {/* Подпись QR */}
        <p className="text-xs text-stone-400 mb-10 tracking-wide uppercase">
          Отсканируйте для просмотра профиля
        </p>

        {/* Анкета */}
        <div className="text-left border-t border-stone-200 pt-6 space-y-3">
          {person.birth_date && (
            <div className="flex items-start gap-3">
              <span className="text-stone-400 text-sm w-32 flex-shrink-0">Дата рождения</span>
              <span className="text-stone-800 text-sm">{formatDate(person.birth_date)}</span>
            </div>
          )}
          {person.death_date && (
            <div className="flex items-start gap-3">
              <span className="text-stone-400 text-sm w-32 flex-shrink-0">Дата смерти</span>
              <span className="text-stone-800 text-sm">{formatDate(person.death_date)}</span>
            </div>
          )}
          {person.burial_place && (
            <div className="flex items-start gap-3">
              <span className="text-stone-400 text-sm w-32 flex-shrink-0">Место захоронения</span>
              <span className="text-stone-800 text-sm">{person.burial_place}</span>
            </div>
          )}
          {person.clan_name && (
            <div className="flex items-start gap-3">
              <span className="text-stone-400 text-sm w-32 flex-shrink-0">Род</span>
              <span className="text-stone-800 text-sm">{person.clan_name}</span>
            </div>
          )}
        </div>

        {/* URL */}
        <div className="mt-8 pt-6 border-t border-stone-200">
          <p className="text-xs text-stone-400 break-all">{publicUrl}</p>
        </div>
      </div>

      <PrintButton />
    </>
  )
}
