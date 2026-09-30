'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getVerifiedIdentity } from '@/lib/dashboard/getRole'
import { parseContributorProfile } from './profile'

/**
 * Saves the calling member's contributor preferences. Always the caller's
 * own row (never a user id from the client), and only for members — the
 * contributor program is for people with the member role.
 */
export async function saveContributorProfile(raw: unknown): Promise<{ error?: string }> {
  const me = await getVerifiedIdentity()
  if (!me || me.role !== 'member') return { error: 'Only members have contributor preferences.' }

  const parsed = parseContributorProfile(raw)
  if ('error' in parsed) return { error: parsed.error }
  const p = parsed.profile

  // Points and verified counts are maintained by the database and never
  // written here; the upsert only touches preference columns.
  const { error } = await (createServiceClient().from('contributor_profiles') as any).upsert(
    {
      user_id: me.userId,
      categories: p.categories,
      skills: p.skills,
      availability_hours_per_week: p.availabilityHoursPerWeek,
      notify_email: p.notifyEmail,
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    console.error('[contributor profile] save failed:', error.message)
    return { error: 'Could not save your contributor preferences.' }
  }
  return {}
}
