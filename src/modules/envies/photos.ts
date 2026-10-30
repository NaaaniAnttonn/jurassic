// Photos des envies : réduites dans le navigateur, puis rangées dans le bucket privé « envies »
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export type WishPhoto = {
  id: string
  wish_id: string
  space_id: string
  path: string
  thumb_path: string
  width: number | null
  height: number | null
  created_by: string | null
  created_at: string
}

const BUCKET = 'envies'
const FULL_PX = 2048
const THUMB_PX = 480
export const MAX_PER_UPLOAD = 20

const bucket = () => supabase.storage.from(BUCKET)

async function resize(bitmap: ImageBitmap, max: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Compression impossible'))), 'image/jpeg', quality),
  )
}

/** Photo de téléphone (souvent 3-8 Mo) → JPEG ~500 Ko + vignette ~40 Ko, orientation corrigée */
export async function prepare(file: File) {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(`« ${file.name} » : format d’image non pris en charge.`)
  }
  try {
    return {
      full: await resize(bitmap, FULL_PX, 0.82),
      thumb: await resize(bitmap, THUMB_PX, 0.75),
      width: bitmap.width,
      height: bitmap.height,
    }
  } finally {
    bitmap.close()
  }
}

/**
 * Envoie les photos une par une (une photo ratée n'empêche pas les autres).
 * Renvoie le nombre de photos ajoutées et les messages d'erreur éventuels.
 */
export async function uploadPhotos(
  wish: { id: string; space_id: string },
  files: File[],
  userId: string,
  onProgress?: (done: number, total: number) => void,
) {
  const errors: string[] = []
  let added = 0
  const list = files.slice(0, MAX_PER_UPLOAD)
  if (files.length > MAX_PER_UPLOAD) errors.push(`${MAX_PER_UPLOAD} photos maximum à la fois : les suivantes sont ignorées.`)

  for (const [i, file] of list.entries()) {
    try {
      const p = await prepare(file)
      const id = crypto.randomUUID()
      const path = `${wish.space_id}/${wish.id}/${id}.jpg`
      const thumbPath = `${wish.space_id}/${wish.id}/${id}-mini.jpg`
      const up = await bucket().upload(path, p.full, { contentType: 'image/jpeg' })
      if (up.error) throw up.error
      const upThumb = await bucket().upload(thumbPath, p.thumb, { contentType: 'image/jpeg' })
      if (upThumb.error) {
        await bucket().remove([path])
        throw upThumb.error
      }
      const { error } = await supabase.from('wish_photos').insert({
        id, wish_id: wish.id, space_id: wish.space_id, path, thumb_path: thumbPath,
        width: p.width, height: p.height, created_by: userId,
      })
      if (error) {
        await bucket().remove([path, thumbPath])
        throw error
      }
      added++
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
    onProgress?.(i + 1, list.length)
  }
  return { added, errors }
}

/** Supprime les fichiers puis les lignes (sinon ils resteraient dans le stockage) */
export async function deletePhotos(photos: WishPhoto[]) {
  if (!photos.length) return null
  const { error: storageError } = await bucket().remove(photos.flatMap((p) => [p.path, p.thumb_path]))
  if (storageError) return storageError
  const { error } = await supabase.from('wish_photos').delete().in('id', photos.map((p) => p.id))
  return error
}

// ---------- Liens temporaires (bucket privé) ----------

const cache = new Map<string, { url: string; expires: number }>()
const TTL_S = 3600

async function signUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now()
  const missing = paths.filter((p) => (cache.get(p)?.expires ?? 0) < now + 60_000)
  if (missing.length) {
    const { data } = await bucket().createSignedUrls(missing, TTL_S)
    for (const d of data ?? []) {
      if (d.path && d.signedUrl) cache.set(d.path, { url: d.signedUrl, expires: now + TTL_S * 1000 })
    }
  }
  return Object.fromEntries(paths.filter((p) => cache.has(p)).map((p) => [p, cache.get(p)!.url]))
}

/** Liens affichables pour une liste de chemins (mis en cache une heure) */
export function useSignedUrls(paths: string[]) {
  const key = paths.join('|')
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!key) return
    let alive = true
    signUrls(key.split('|')).then((u) => alive && setUrls(u))
    return () => {
      alive = false
    }
  }, [key])
  return urls
}
