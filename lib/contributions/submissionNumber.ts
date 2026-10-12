// Program-wide submission numbers: #1 is the first submission anyone ever
// made, and so on. A submission's created_at is set once, on its first
// submit, and contributions are never deleted, so the number never changes.
// Resubmissions of the same task keep their number; their "attempt" counts up.

export interface NumberedRow {
  id: string
  created_at: string
}

export function submissionNumbers(rows: NumberedRow[]): Map<string, number> {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  return new Map(sorted.map((r, i) => [r.id, i + 1]))
}

/** Every contribution's program-wide number. Server-only (service-role client). */
export async function loadSubmissionNumbers(supabase: any): Promise<Map<string, number>> {
  const { data } = await supabase.from('contributions').select('id, created_at').limit(10000)
  return submissionNumbers((data ?? []) as NumberedRow[])
}
