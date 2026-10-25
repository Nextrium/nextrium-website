import { APPLICATION_TRACKS } from '../automation/rulesAdmin'

// A team member's track comes from the screening of their application. These
// helpers link a person to their application (found by their sign-in email when
// it isn't linked yet) and set their track from its latest screening. A track
// someone already has, set by hand or before, is never changed.

export interface ApplicationCandidate { id: string; status: string | null; created_at: string }
export interface Screening { application_id: string; evaluation_track: string | null; screened_at: string }

/** Several applications from one email: a screened one first, then an accepted one, then the newest. */
export function pickApplication(apps: ApplicationCandidate[], screened: Set<string>): string | null {
  if (apps.length === 0) return null
  const rank = (a: ApplicationCandidate) => [Number(screened.has(a.id)), Number(a.status === 'accepted'), a.created_at] as const
  return [...apps].sort((a, b) => {
    const ra = rank(a), rb = rank(b)
    return rb[0] - ra[0] || rb[1] - ra[1] || (rb[2] > ra[2] ? 1 : rb[2] < ra[2] ? -1 : 0)
  })[0].id
}

/** The track from an application's most recent screening, if it is one of the known tracks. */
export function latestScreenedTrack(screenings: Screening[], applicationId: string): string | null {
  const latest = screenings
    .filter((s) => s.application_id === applicationId && s.evaluation_track)
    .sort((a, b) => (b.screened_at > a.screened_at ? 1 : b.screened_at < a.screened_at ? -1 : 0))[0]
  const track = latest?.evaluation_track?.trim() ?? null
  return track && APPLICATION_TRACKS.includes(track) ? track : null
}

/** An email made safe for an exact, case-insensitive ilike match (no wildcards). */
export function exactLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export interface TrackOutcome {
  applicationId: string | null
  /** The application was linked by this call. */
  linked: boolean
  track: string | null
  /** The track was set by this call (so Discord roles may need a sync). */
  trackSet: boolean
}

/**
 * Links a dashboard user to their application and sets their track from its
 * screening, only filling what is empty. Archived people are left alone.
 * `db` is the service client (passed in so tests can use a fake).
 */
export async function linkApplicationAndTrack(db: any, userId: string, email: string | null): Promise<TrackOutcome> {
  const none: TrackOutcome = { applicationId: null, linked: false, track: null, trackSet: false }
  const { data: person } = await db.from('dashboard_users')
    .select('application_id, staff_track_id, archived').eq('user_id', userId).maybeSingle()
  if (!person || person.archived) return none

  let applicationId: string | null = person.application_id ?? null
  let linked = false
  if (!applicationId && email && email.includes('@')) {
    const { data: apps } = await db.from('applications').select('id, status, created_at').ilike('email', exactLike(email.trim()))
    const candidates: ApplicationCandidate[] = apps ?? []
    if (candidates.length > 0) {
      const { data: scr } = await db.from('agent_screening_results')
        .select('application_id, evaluation_track, screened_at').in('application_id', candidates.map((a) => a.id))
      const screened = new Set<string>(((scr ?? []) as Screening[]).filter((s) => s.evaluation_track).map((s) => s.application_id))
      const pick = pickApplication(candidates, screened)
      if (pick) {
        // Only if still unlinked, so a link made meanwhile is kept.
        const { data: done } = await db.from('dashboard_users').update({ application_id: pick, updated_at: new Date().toISOString() })
          .eq('user_id', userId).is('application_id', null).select('application_id')
        if (done && done.length > 0) { applicationId = pick; linked = true }
        else {
          const { data: now } = await db.from('dashboard_users').select('application_id').eq('user_id', userId).maybeSingle()
          applicationId = now?.application_id ?? null
        }
      }
    }
  }

  if (person.staff_track_id || !applicationId) return { applicationId, linked, track: null, trackSet: false }

  const { data: scr } = await db.from('agent_screening_results')
    .select('application_id, evaluation_track, screened_at').eq('application_id', applicationId)
  const track = latestScreenedTrack(scr ?? [], applicationId)
  if (!track) return { applicationId, linked, track: null, trackSet: false }

  const trackId = await ensureTrack(db, track)
  if (!trackId) return { applicationId, linked, track: null, trackSet: false }
  const { data: set } = await db.from('dashboard_users').update({ staff_track_id: trackId, updated_at: new Date().toISOString() })
    .eq('user_id', userId).is('staff_track_id', null).select('staff_track_id')
  const trackSet = !!set && set.length > 0
  return { applicationId, linked, track: trackSet ? track : null, trackSet }
}

/** The id of the staff track with this name, adding it if it doesn't exist yet. */
async function ensureTrack(db: any, name: string): Promise<string | null> {
  const { data: existing } = await db.from('staff_tracks').select('id').eq('name', name).limit(1)
  if (existing && existing.length > 0) return existing[0].id
  const { data: created, error } = await db.from('staff_tracks').insert({ name }).select('id').single()
  if (created) return created.id
  // Added by someone else in the meantime: read it again.
  if (error) {
    const { data: again } = await db.from('staff_tracks').select('id').eq('name', name).limit(1)
    return again?.[0]?.id ?? null
  }
  return null
}
