'use server'

import { redirect } from 'next/navigation'
import { brand } from '@nextrium/brand'
import { createCommunityServiceClient } from '@nextrium/supabase/community/server'
import { getPortalIdentity, isActiveStaffEmail } from '@/lib/portal'
import { parseApplication } from '@/lib/registration'

export type ApplyState = { status: 'idle' } | { status: 'error'; message: string }

/**
 * Submits (or, after a revision request, resubmits) the signed-in person's
 * contributor application. The account and email come from the session;
 * the form only supplies profile fields. New applications wait for review,
 * except staff, who are approved on the spot.
 */
export async function submitApplication(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const me = await getPortalIdentity()
  if (!me) return { status: 'error', message: 'Your session has ended. Sign in again, then submit your application.' }

  const parsed = parseApplication(formData)
  if (!parsed.ok) return { status: 'error', message: parsed.error }

  const db = createCommunityServiceClient()
  const contact = `Contact ${brand.emails.contributors} if this persists.`

  if (me.contributor) {
    if (me.contributor.status !== 'revision_requested') {
      return { status: 'error', message: 'Your application is already on file.' }
    }
    // Conditional on the status still being "revision requested", so a
    // decision made meanwhile by a reviewer is never overwritten.
    const { data, error } = await db
      .from('contributors')
      .update({ ...parsed.value, status: 'pending', revision_notes: null })
      .eq('id', me.contributor.id)
      .eq('user_id', me.userId)
      .eq('status', 'revision_requested')
      .select('id')
    if (error) {
      console.error('[contribute] resubmission failed:', error.code)
      return { status: 'error', message: `We could not save your application. ${contact}` }
    }
    if (!data || data.length === 0) return { status: 'error', message: 'Your application status has changed. Reload the page to see it.' }
    redirect('/dashboard')
  }

  const staff = await isActiveStaffEmail(me.email)
  const { error } = await db.from('contributors').insert({
    ...parsed.value,
    user_id: me.userId,
    email: me.email,
    status: staff ? 'active' : 'pending',
  })
  if (error) {
    if (error.code === '23505') {
      return { status: 'error', message: `This email already has an application. ${contact}` }
    }
    console.error('[contribute] application failed:', error.code)
    return { status: 'error', message: `We could not save your application. ${contact}` }
  }
  redirect('/dashboard')
}
