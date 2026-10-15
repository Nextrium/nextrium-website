'use server'

import { redirect } from 'next/navigation'
import { createCommunityClient } from '@nextrium/supabase/community/server'
import { portalUrl } from '@/lib/portal'
import { safeNext } from '@/lib/safeNext'

export type SignInState =
  | { status: 'idle' }
  | { status: 'sent'; email: string }
  | { status: 'error'; message: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Emails a one-time sign-in link. New addresses get an account, which is
 * how registration starts: the link proves the email, then the person fills
 * in the application. The link returns to /auth/callback on this site only.
 */
export async function sendSignInLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const raw = formData.get('email')
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return { status: 'error', message: 'Enter a valid email address.' }
  }
  const next = safeNext(formData.get('next'))

  const supabase = await createCommunityClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${portalUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  })

  if (error) {
    if (error.status === 429) {
      return { status: 'error', message: 'Too many sign in links were requested. Wait a few minutes, then try again.' }
    }
    console.error('[contribute] sign-in link failed:', error.status, error.code)
    return { status: 'error', message: 'We could not send the link. Try again in a moment.' }
  }
  return { status: 'sent', email }
}

export async function signOut(): Promise<void> {
  const supabase = await createCommunityClient()
  await supabase.auth.signOut()
  redirect('/')
}
