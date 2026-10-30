export type Wish = {
  id: string
  space_id: string
  title: string
  category: string
  notes: string | null
  done_on: string | null // AAAA-MM-JJ, null = encore à faire
  done_by: string | null
  created_by: string | null
  created_at: string
}

export const DEFAULT_CATEGORIES = ['Activités', 'Voyages', 'Restos']

/** Catégories par défaut, puis celles créées par vous (ordre alphabétique) */
export function categoriesOf(wishes: Wish[]): string[] {
  const custom = [...new Set(wishes.map((w) => w.category))].filter((c) => !DEFAULT_CATEGORIES.includes(c))
  return [...DEFAULT_CATEGORIES, ...custom.sort((a, b) => a.localeCompare(b, 'fr'))]
}
