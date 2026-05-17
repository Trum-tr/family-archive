import { createClient } from '@/lib/supabase/client'

export async function uploadPhoto(
  file: File,
  userId: string,
  personId: string
): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const path = `${userId}/${personId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('photos')
    .upload(path, file, { upsert: true })

  if (error) {
    console.error('Upload error:', error)
    return null
  }

  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}

export async function deletePhoto(url: string): Promise<void> {
  const supabase = createClient()
  // Извлекаем путь из URL
  const match = url.match(/\/storage\/v1\/object\/public\/photos\/(.+)/)
  if (!match) return
  await supabase.storage.from('photos').remove([match[1]])
}
