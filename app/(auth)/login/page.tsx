import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginClient from './LoginClient'

export const metadata = { title: 'Dashboard Login' }

interface Props {
  searchParams: Promise<{ message?: string; error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Deliberately NOT using the cached role cookie here (getDashboardRole())
    // — that cache can hold a pre-archival role for up to its ~30s TTL,
    // which would auto-redirect a freshly-archived user straight back to
    // /dashboard, which the middleware then bounces back here: an infinite
    // loop between the two. This page is low-traffic, so a fresh,
    // uncached check is cheap and closes that race entirely.
    const { data: dashboardUser } = await supabase
      .from('dashboard_users')
      .select('archived')
      .eq('user_id', user.id)
      .maybeSingle() as { data: { archived: boolean } | null }

    if (!dashboardUser?.archived) redirect('/dashboard')
  }

  const { message, error } = await searchParams
  return <LoginClient message={message} error={error} />
}