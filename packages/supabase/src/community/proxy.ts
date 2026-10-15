import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { communityEnv } from './env'

// Same bound as the dashboard's session check: a slow auth response must not
// hang every request. A timeout counts as signed out (fail closed).
const AUTH_QUERY_TIMEOUT_MS = 4000

/** True when the request carries a Supabase session cookie (possibly split into chunks). */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
}

/**
 * Refreshes the community session cookies and reports whether someone is signed in.
 * The session is checked against the project's published signing key, so most
 * requests need no call to the auth server; it is only contacted to refresh an
 * expired session. Pages and actions still confirm the account themselves.
 */
export async function updateCommunitySession(request: NextRequest): Promise<{ response: NextResponse; signedIn: boolean }> {
  let response = NextResponse.next({ request })
  // No session cookie: nobody is signed in and there is nothing to refresh.
  if (!hasSessionCookie(request)) return { response, signedIn: false }

  const supabase = createServerClient(
    communityEnv('COMMUNITY_SUPABASE_URL'),
    communityEnv('COMMUNITY_SUPABASE_PUBLISHABLE_KEY'),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), AUTH_QUERY_TIMEOUT_MS)
  })
  const signedIn = await Promise.race([
    supabase.auth.getClaims().then(({ data }) => typeof data?.claims?.sub === 'string').catch(() => false),
    timeout,
  ])
  clearTimeout(timer)

  return { response, signedIn }
}
