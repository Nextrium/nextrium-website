// Pinned posts per site. nextrium.org is the parent blog and shows every
// brand's posts, so it can pin any published post; each brand's own site
// (zivana.network, and future ones) can pin only its own brand's posts.
// The database enforces the same rules (set_post_pins); these mirror them so
// the dashboard can explain a refusal before asking.

export const PIN_SITES = {
  nextrium: 'Nextrium blog',
  zivana: 'Zivana site',
} as const
export type PinSite = keyof typeof PIN_SITES
export const MAX_PINS = 5
/** The parent site, which can pin posts of any brand. */
export const PARENT_SITE: PinSite = 'nextrium'

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isPinSite(v: unknown): v is PinSite {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PIN_SITES, v)
}

/** Whether a post may be pinned on a site at all. */
export function canPinOn(site: PinSite, post: { is_published: boolean; brand?: string | null }): boolean {
  if (!post.is_published) return false
  return site === PARENT_SITE || (post.brand ?? 'nextrium') === site
}

/** A full ordered pin list as sent to the server: ids, each once, at most MAX_PINS. */
export function parsePinList(raw: unknown): { ids: string[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: 'Invalid pin list.' }
  if (raw.length > MAX_PINS) return { error: `At most ${MAX_PINS} posts can be pinned on a site.` }
  const ids: string[] = []
  for (const v of raw) {
    if (typeof v !== 'string' || !ID.test(v)) return { error: 'Invalid pin list.' }
    const id = v.toLowerCase()
    if (ids.includes(id)) return { error: 'A post can only be pinned once on a site.' }
    ids.push(id)
  }
  return { ids }
}

export type PinOp = { kind: 'pin'; id: string } | { kind: 'unpin'; id: string } | { kind: 'move'; id: string; by: -1 | 1 }

/** The pin list after one change, or why the change isn't possible. */
export function applyPinOp(current: string[], op: PinOp): { ids: string[] } | { error: string } {
  const i = current.indexOf(op.id)
  if (op.kind === 'pin') {
    if (i >= 0) return { error: 'This post is already pinned here.' }
    if (current.length >= MAX_PINS) return { error: `${MAX_PINS} posts are already pinned here. Unpin one first.` }
    return { ids: [...current, op.id] }
  }
  if (i < 0) return { error: 'This post is not pinned here.' }
  if (op.kind === 'unpin') return { ids: current.filter((x) => x !== op.id) }
  const j = i + op.by
  if (j < 0 || j >= current.length) return { ids: current }
  const next = [...current]
  ;[next[i], next[j]] = [next[j], next[i]]
  return { ids: next }
}

/** Database refusals from set_post_pins, in words. */
export function describePinError(message: string | undefined): string {
  const m = message ?? ''
  if (/at most 5/i.test(m)) return `At most ${MAX_PINS} posts can be pinned on a site.`
  if (/duplicate/i.test(m)) return 'A post can only be pinned once on a site.'
  if (/not pinnable/i.test(m)) return 'Only published posts can be pinned, and a brand site only takes its own posts. Reload and try again.'
  if (/unknown site/i.test(m)) return 'Unknown site.'
  return 'Could not save the pinned posts. Try again.'
}

/**
 * Saves a site's whole ordered pin list in one step through the database
 * function set_post_pins, which checks everything again and replaces the
 * list atomically. `db` is the service client (a fake in tests).
 */
export async function savePostPins(db: any, actorId: string, site: unknown, rawIds: unknown): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  if (!isPinSite(site)) return { ok: false, error: 'Unknown site.' }
  const parsed = parsePinList(rawIds)
  if ('error' in parsed) return { ok: false, error: parsed.error }
  const { error } = await db.rpc('set_post_pins', { p_site: site, p_post_ids: parsed.ids, p_actor: actorId })
  if (error) return { ok: false, error: describePinError(error.message) }
  return { ok: true, ids: parsed.ids }
}

/** Current pins for every site, in order. */
export async function loadPins(db: any): Promise<Record<PinSite, string[]>> {
  const out = Object.fromEntries(Object.keys(PIN_SITES).map((s) => [s, [] as string[]])) as Record<PinSite, string[]>
  const { data, error } = await db.from('post_pins').select('site, post_id, position').order('position')
  if (error || !data) return out
  for (const r of data as { site: string; post_id: string }[]) if (isPinSite(r.site)) out[r.site].push(r.post_id)
  return out
}
