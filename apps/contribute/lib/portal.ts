import { cache } from 'react'
import { brand } from '@nextrium/brand'
import { createCommunityClient, createCommunityServiceClient } from '@nextrium/supabase/community/server'
import type { Contributor } from '@nextrium/supabase/community/database'

// Who is using the portal, decided on the server for every page and action:
// the signed-in account comes from a verified getUser() call, and the
// contributor record is looked up by that account, never by anything the
// browser sends.

export const CONTRIBUTOR_STATUSES = ['pending', 'active', 'revision_requested', 'rejected', 'inactive'] as const
export type ContributorStatus = (typeof CONTRIBUTOR_STATUSES)[number]

export type GateContributor = Pick<Contributor, 'id' | 'name' | 'status' | 'revision_notes' | 'rejection_reason'>

export interface PortalIdentity {
  userId: string
  email: string
  /** null until the person has submitted an application. */
  contributor: GateContributor | null
}

const GATE_COLUMNS = 'id, name, status, revision_notes, rejection_reason'

/** The portal's own address, used for sign-in links. */
export function portalUrl(): string {
  return (process.env.NEXT_PUBLIC_CONTRIBUTE_URL || brand.urls.contribute).replace(/\/+$/, '')
}

/**
 * The signed-in person and their contributor record, once per request.
 * null when nobody is signed in. Throws (fails closed) when the record
 * can't be read, so a database error never looks like "not registered".
 */
export const getPortalIdentity = cache(async (): Promise<PortalIdentity | null> => {
  const supabase = await createCommunityClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  const email = user.email.toLowerCase()

  const db = createCommunityServiceClient()
  const { data, error } = await db.from('contributors').select(GATE_COLUMNS).eq('user_id', user.id).maybeSingle()
  if (error) throw new Error('Could not load the contributor record')
  if (data) return { userId: user.id, email, contributor: data }

  // Records created before sign-in existed have no account attached. The
  // email is proven by the sign-in link, so attach the account once, and
  // only to a record no other account holds.
  const { data: linked, error: linkError } = await db
    .from('contributors')
    .update({ user_id: user.id })
    .eq('email', email)
    .is('user_id', null)
    .select(GATE_COLUMNS)
    .maybeSingle()
  if (linkError) throw new Error('Could not load the contributor record')
  return { userId: user.id, email, contributor: linked ?? null }
})

/** The contributor record when the signed-in person is an approved (active) contributor, else null. */
export async function getActiveContributor(): Promise<(GateContributor & { userId: string; email: string }) | null> {
  const me = await getPortalIdentity()
  if (!me?.contributor || me.contributor.status !== 'active') return null
  return { ...me.contributor, userId: me.userId, email: me.email }
}

/**
 * Staff join as approved contributors straight away. Staff = an active
 * core team member with the same email. Any lookup error means "not staff",
 * so the application simply waits for review.
 */
export async function isActiveStaffEmail(email: string): Promise<boolean> {
  const db = createCommunityServiceClient()
  const { data, error } = await db.from('core_team').select('email').eq('is_active', true)
  if (error || !data) return false
  const wanted = email.trim().toLowerCase()
  return data.some((row) => row.email.trim().toLowerCase() === wanted)
}
