import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createCommunityServiceClient } from '@nextrium/supabase/community/server'
import { getPortalIdentity } from '@/lib/portal'
import PublicShell from '@/components/PublicShell'
import RegisterForm, { type RegisterInitial } from './RegisterForm'

export const metadata: Metadata = { title: 'Register' }

export default async function RegisterPage() {
  const me = await getPortalIdentity()
  if (!me) redirect('/signin?next=/register')
  // One application per person. Only a revision request reopens the form.
  if (me.contributor && me.contributor.status !== 'revision_requested') redirect('/dashboard')

  let initial: RegisterInitial | null = null
  if (me.contributor) {
    const db = createCommunityServiceClient()
    const { data, error } = await db
      .from('contributors')
      .select('name, contributor_type, team_name, location, timezone, categories, skills, availability_hours_per_week, bio, github_handle, twitter_handle, linkedin_url, portfolio_url, wallet_address, notification_email')
      .eq('id', me.contributor.id)
      .eq('user_id', me.userId)
      .single()
    if (error || !data) throw new Error('Could not load your application')
    initial = data
  }

  return (
    <PublicShell signedIn>
      <RegisterForm email={me.email} initial={initial} revisionNotes={me.contributor?.revision_notes ?? null} />
    </PublicShell>
  )
}
