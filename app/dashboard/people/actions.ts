'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activityLog'

export interface ProfileInput {
  bio: string
  socialHandles: Record<string, string>
}

// Always updates the CALLING user's own row (never takes a userId from the
// client) - editing someone else's profile is a separate, not-yet-built
// admin capability, and this must never become the path to it by accident.
// First successful save also completes onboarding, so the same form and
// action serve both the forced first-login prompt and later "edit profile"
// visits without duplicating logic.
export async function saveProfile(input: ProfileInput): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not signed in.' }

    const cleanHandles = Object.fromEntries(
      Object.entries(input.socialHandles)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v.length > 0)
    )

    const serviceClient = createServiceClient()
    const { data: existing } = await (serviceClient.from('dashboard_users') as any)
      .select('onboarding_completed_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const { error } = await (serviceClient.from('dashboard_users') as any)
      .update({
        bio: input.bio.trim() || null,
        social_handles: cleanHandles,
        ...(existing && !existing.onboarding_completed_at ? { onboarding_completed_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/people')
    logActivity({
      action: 'profile_updated',
      targetType: 'dashboard_user',
      targetId: user.id,
    }).catch(() => {})
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save profile.' }
  }
}
