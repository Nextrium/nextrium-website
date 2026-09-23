import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { readDiscordConfig } from '@/lib/discordLink'
import Header from '@/components/dashboard/Header'
import ProfileEditClient from './ProfileEditClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Profile' }

export default async function MyProfilePage({ searchParams }: { searchParams: Promise<{ discord?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()
  const { data: dashboardUser } = await (serviceClient.from('dashboard_users') as any)
    .select('bio, social_handles, onboarding_completed_at, discord_username, discord_linked_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const isFirstTime = !dashboardUser?.onboarding_completed_at
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
        />
      </div>
    </>
  )
}
