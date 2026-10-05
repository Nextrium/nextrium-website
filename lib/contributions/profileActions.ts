'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getVerifiedIdentity } from '@/lib/dashboard/getRole'
import { parseContributorProfile } from './profile'
import { isContributorRole } from './auth'

/**
 * Saves the caller's contributor preferences. Always the caller's own row
 * (never a user id from the client); any active dashboard role can
 * contribute.
 */
export async function saveContributorProfile(raw: unknown): Promise<{ error?: string }> {
  const me = await getVerifiedIdentity()
  if (!me || !isContributorRole(me.role)) return { error: 'You do not have permission to do this.' }

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
