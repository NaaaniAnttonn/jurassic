export type List = {
  id: string
  space_id: string
  name: string
  created_by: string | null
  created_at: string
}

export type ListItem = {
  id: string
  list_id: string
  space_id: string
  text: string
  quantity: string | null
  position: number
  checked: boolean
  checked_at: string | null
  added_by: string | null
  created_at: string
  notified: boolean
}

/** Comparaison tolérante pour repérer un doublon : « Œufs » = « oeufs » */
export const normalize = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/\s+/g, ' ')

/** « lait, œufs et pain » ; au-delà de 6 : « lait, œufs, pain, riz, thé et 3 autres » */
export function summarize(texts: string[], max = 6): string {
  if (texts.length <= max) return texts.length > 1 ? `${texts.slice(0, -1).join(', ')} et ${texts[texts.length - 1]}` : texts[0] ?? ''
  return `${texts.slice(0, max - 1).join(', ')} et ${texts.length - max + 1} autres`
}
