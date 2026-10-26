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
  /** Présent pour un événement importé d'un agenda externe (lecture seule) */
  external?: { calendarName: string }
}

/** Ligne de external_events : une occurrence déjà dépliée par le serveur */
export type ExternalEvent = {
  id: string
  space_id: string
  user_id: string
  calendar_name: string
  title: string
  location: string | null
  notes: string | null
  start_at: string
  end_at: string
  all_day: boolean
}

export function fromExternal(e: ExternalEvent): CalEvent {
  return {
    id: e.id, space_id: e.space_id, created_by: e.user_id,
    title: e.title, location: e.location, notes: e.notes,
    start_at: e.start_at, end_at: e.end_at, all_day: e.all_day,
    recurrence: null, recurrence_until: null, for_users: [e.user_id],
    is_private: false, reminder_minutes: null, updated_by: null,
    external: { calendarName: e.calendar_name },
  }
}

export type Occurrence = { event: CalEvent; start: Date; end: Date }

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: 'Chaque jour',
  weekly: 'Chaque semaine',
  monthly: 'Chaque mois',
  yearly: 'Chaque année',
}
