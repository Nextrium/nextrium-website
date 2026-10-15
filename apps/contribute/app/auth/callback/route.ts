import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createCommunityClient } from '@nextrium/supabase/community/server'
import { safeNext } from '@/lib/safeNext'

// Where sign-in links land. Two link styles are accepted:
//   ?code=…                    the default email template (same browser only)
//   ?token_hash=…&type=…       a template that carries the token itself (any browser)
// Either way the session is created on the server and the visitor is sent
// on to a same-site page.

const OTP_TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup']

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const next = safeNext(params.get('next'))
  const fail = (reason: 'expired' | 'browser' | 'invalid') =>
    NextResponse.redirect(new URL(`/auth/error?reason=${reason}`, request.nextUrl.origin))

  if (params.get('error') || params.get('error_code')) return fail('expired')

  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null
  const supabase = await createCommunityClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return fail(/code verifier/i.test(error.message) ? 'browser' : 'expired')
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) return fail('expired')
  } else {
    return fail('invalid')
  }

  return NextResponse.redirect(new URL(next, request.nextUrl.origin))
}
