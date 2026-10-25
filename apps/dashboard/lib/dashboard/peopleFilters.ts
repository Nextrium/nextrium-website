// Filters for the General Team Members list. Area and status are separate
// filters; a value that isn't one of the known options is ignored rather
// than emptying the list.

export const PEOPLE_AREAS = ['technical', 'design', 'research', 'operations', 'community'] as const
export const PEOPLE_STATUSES = ['active', 'invited'] as const

export function readPeopleFilters(params: { get(name: string): string | null }): { category: string; status: string } {
  const c = (params.get('category') ?? '').toLowerCase()
  const s = (params.get('status') ?? '').toLowerCase()
  return {
    category: (PEOPLE_AREAS as readonly string[]).includes(c) ? c : '',
    status: (PEOPLE_STATUSES as readonly string[]).includes(s) ? s : '',
  }
}

export function filterPeople<T extends { contribution?: { categories: string[]; status: string } | null }>(people: T[], f: { category: string; status: string }): T[] {
  return people.filter((m) =>
    (!f.category || !!m.contribution?.categories.includes(f.category)) &&
    (!f.status || m.contribution?.status === f.status))
}
