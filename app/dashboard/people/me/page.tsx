import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { readDiscordConfig } from '@/lib/discordLink'
import Header from '@/components/dashboard/Header'
import ProfileEditClient from './ProfileEditClient'
import { isContributorRole } from '@/lib/contributions/auth'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Profile' }

export default async function MyProfilePage({ searchParams }: { searchParams: Promise<{ discord?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()
  const { data: dashboardUser } = await (serviceClient.from('dashboard_users') as any)
    .select('bio, social_handles, onboarding_completed_at, discord_username, discord_linked_at, role')
    .eq('user_id', user.id)
    .maybeSingle()

  const isFirstTime = !dashboardUser?.onboarding_completed_at

  // Anyone with dashboard access can contribute, so everyone sets the areas they want tasks in.
  const isContributor = isContributorRole(dashboardUser?.role)
  const { data: contributorProfile } = isContributor
    ? await (serviceClient.from('contributor_profiles') as any)
        .select('categories, skills, availability_hours_per_week, notify_email')
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null }
  const { discord: discordNotice } = await searchParams

  return (
    <>
      <Header
        title={isFirstTime ? 'Welcome — set up your profile' : 'My Profile'}
        description={isFirstTime
          ? 'A quick one-time step so the team can find and reach you — this only takes a minute.'
          : 'Update your bio, social handles and Discord connection.'}
      />
      <div className="dash-content">
        <ProfileEditClient
          isFirstTime={isFirstTime}
          initialBio={dashboardUser?.bio ?? ''}
          initialHandles={dashboardUser?.social_handles ?? {}}
          discordUsername={dashboardUser?.discord_linked_at ? (dashboardUser?.discord_username ?? null) : null}
          discordAvailable={!!readDiscordConfig()}
          discordNotice={discordNotice ?? null}
          contributor={isContributor ? {
            categories: contributorProfile?.categories ?? [],
            skillsText: (contributorProfile?.skills ?? []).join(', '),
            availability: contributorProfile?.availability_hours_per_week?.toString() ?? '',
            notifyEmail: contributorProfile?.notify_email ?? true,
          } : null}
        />
      </div>
    </>
  )
}
