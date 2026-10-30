import type { Recurrence } from '../agenda/types'

export type Task = {
  id: string
  space_id: string
  title: string
  notes: string | null
  for_users: string[]
  due_date: string | null // AAAA-MM-JJ
  recurrence: Recurrence | null
  done: boolean
  done_at: string | null
  done_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
