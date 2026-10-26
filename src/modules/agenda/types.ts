export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type CalEvent = {
  id: string
  space_id: string
  created_by: string
  title: string
  location: string | null
  notes: string | null
  start_at: string
  end_at: string
  all_day: boolean
  recurrence: Recurrence | null
  recurrence_until: string | null
  for_users: string[]
  is_private: boolean
  reminder_minutes: number | null
  updated_by: string | null
}

export type Occurrence = { event: CalEvent; start: Date; end: Date }

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: 'Chaque jour',
  weekly: 'Chaque semaine',
  monthly: 'Chaque mois',
  yearly: 'Chaque année',
}
