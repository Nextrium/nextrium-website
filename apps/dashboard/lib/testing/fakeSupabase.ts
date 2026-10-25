// An in-memory stand-in for the Supabase service client, for tests only.
// It supports the query-builder calls the dashboard uses (select, insert,
// update, delete; eq/neq/is/in/ilike filters; order, limit; single and
// maybeSingle) and behaves like the real database where it matters for
// correctness: unique constraints fail with code 23505, and maybeSingle on
// several rows fails instead of picking one.

type Row = Record<string, any>
type Filter = (r: Row) => boolean
type Result = { data: any; error: { code: string; message: string } | null; count?: number | null }

export interface FakeAuthUser { id: string; email: string; user_metadata?: Record<string, unknown>; last_sign_in_at?: string | null }

export interface FakeOptions {
  /** Columns that must be unique per table, e.g. { dashboard_users: ['user_id'] }. */
  unique?: Record<string, string[]>
  /** Make the next write to a table fail with this error (once). */
  failNextWrite?: Record<string, { code: string; message: string }>
}

let seq = 0
const newId = () => `00000000-0000-4000-9000-${String(++seq).padStart(12, '0')}`

function likeToRegex(pattern: string): RegExp {
  let out = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\' && i + 1 < pattern.length) { out += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue }
    if (c === '%') out += '.*'
    else if (c === '_') out += '.'
    else out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`, 'i')
}

export function createFakeSupabase(seed: Record<string, Row[]> = {}, opts: FakeOptions = {}, authUsers: FakeAuthUser[] = []) {
  const tables: Record<string, Row[]> = {}
  for (const [t, rows] of Object.entries(seed)) tables[t] = rows.map((r) => ({ ...r }))
  const table = (t: string) => (tables[t] ??= [])
  const calls: { table: string; op: string; payload?: unknown }[] = []

  function violates(t: string, candidate: Row, ignore?: Row): boolean {
    for (const col of opts.unique?.[t] ?? []) {
      if (candidate[col] === undefined || candidate[col] === null) continue
      if (table(t).some((r) => r !== ignore && r[col] === candidate[col])) return true
    }
    return false
  }
  function takeFailure(t: string) {
    const f = opts.failNextWrite?.[t]
    if (f) delete opts.failNextWrite![t]
    return f ?? null
  }

  function builder(t: string) {
    const filters: Filter[] = []
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: any = null
    let returning = false
    let countMode = false
    let head = false
    let orderBy: { col: string; asc: boolean }[] = []
    let limitN: number | null = null
    let one: 'single' | 'maybe' | null = null

    const api: any = {
      select(_cols?: string, o?: { count?: string; head?: boolean }) {
        if (op === 'select') { countMode = o?.count === 'exact'; head = !!o?.head } else returning = true
        return api
      },
      insert(rows: Row | Row[]) { op = 'insert'; payload = Array.isArray(rows) ? rows : [rows]; return api },
      update(patch: Row) { op = 'update'; payload = patch; return api },
      delete() { op = 'delete'; return api },
      eq(c: string, v: unknown) { filters.push((r) => r[c] === v); return api },
      neq(c: string, v: unknown) { filters.push((r) => r[c] !== v); return api },
      is(c: string, v: unknown) { filters.push((r) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v)); return api },
      in(c: string, vs: unknown[]) { filters.push((r) => vs.includes(r[c])); return api },
      ilike(c: string, p: string) { const re = likeToRegex(p); filters.push((r) => typeof r[c] === 'string' && re.test(r[c])); return api },
      not(c: string, o: string, v: unknown) { if (o === 'is') filters.push((r) => !(v === null ? r[c] == null : r[c] === v)); return api },
      order(c: string, o?: { ascending?: boolean }) { orderBy.push({ col: c, asc: o?.ascending !== false }); return api },
      limit(n: number) { limitN = n; return api },
      single() { one = 'single'; return api },
      maybeSingle() { one = 'maybe'; return api },
      then(resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) {
        try { return Promise.resolve(run()).then(resolve, reject) } catch (e) { return reject ? reject(e) : Promise.reject(e) }
      },
    }

    function shape(rows: Row[]): Result {
      if (one) {
        if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
        if (rows.length === 0) return one === 'single' ? { data: null, error: { code: 'PGRST116', message: 'no rows' } } : { data: null, error: null }
        return { data: { ...rows[0] }, error: null }
      }
      return { data: rows.map((r) => ({ ...r })), error: null }
    }

    function run(): Result {
      const rows = table(t)
      calls.push({ table: t, op, payload })
      if (op === 'insert') {
        const fail = takeFailure(t)
        if (fail) return { data: null, error: fail }
        const made: Row[] = []
        for (const p of payload as Row[]) {
          const r: Row = { id: newId(), created_at: new Date().toISOString(), ...p }
          if (violates(t, r) || made.some((m) => (opts.unique?.[t] ?? []).some((c) => m[c] != null && m[c] === r[c]))) {
            return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint on ${t}` } }
          }
          made.push(r)
        }
        rows.push(...made)
        return returning ? shape(made) : { data: null, error: null }
      }
      let hit = rows.filter((r) => filters.every((f) => f(r)))
      if (op === 'update') {
        const fail = takeFailure(t)
        if (fail) return { data: null, error: fail }
        for (const r of hit) if (violates(t, { ...r, ...payload }, r)) return { data: null, error: { code: '23505', message: 'duplicate key' } }
        for (const r of hit) Object.assign(r, payload)
        return returning ? shape(hit) : { data: null, error: null }
      }
      if (op === 'delete') {
        tables[t] = rows.filter((r) => !hit.includes(r))
        return returning ? shape(hit) : { data: null, error: null }
      }
      for (const o of [...orderBy].reverse()) hit = [...hit].sort((a, b) => (a[o.col] > b[o.col] ? 1 : a[o.col] < b[o.col] ? -1 : 0) * (o.asc ? 1 : -1))
      const count = hit.length
      if (limitN !== null) hit = hit.slice(0, limitN)
      if (countMode && head) return { data: null, error: null, count }
      const res = shape(hit)
      return countMode ? { ...res, count } : res
    }
    return api
  }

  const client: any = {
    from: (t: string) => builder(t),
    auth: {
      admin: {
        async listUsers({ page = 1, perPage = 50 }: { page?: number; perPage?: number } = {}) {
          const start = (page - 1) * perPage
          return { data: { users: authUsers.slice(start, start + perPage) }, error: null }
        },
        async getUserById(id: string) {
          const u = authUsers.find((x) => x.id === id)
          return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'User not found' } }
        },
      },
    },
  }
  return { client, tables, calls, authUsers }
}
