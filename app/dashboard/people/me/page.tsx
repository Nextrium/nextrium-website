import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
import ProfileEditClient from './ProfileEditClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Profile' }

export default async function MyProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()
  const { data: dashboardUser } = await (serviceClient.from('dashboard_users') as any)
    .select('bio, social_handles, onboarding_completed_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const isFirstTime = !dashboardUser?.onboarding_completed_at

  return (
    <>
      <Header
        title={isFirstTime ? 'Welcome — set up your profile' : 'My Profile'}
        description={isFirstTime
          ? 'A quick one-time step so the team can find and reach you — this only takes a minute.'
          : 'Update your bio and social handles.'}
      />
      <div className="dash-content">
        <ProfileEditClient
          isFirstTime={isFirstTime}
          initialBio={dashboardUser?.bio ?? ''}
          initialHandles={dashboardUser?.social_handles ?? {}}
        />
      </div>
    </>
  )
}
