import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { createClient } from '@supabase/supabase-js'
import { isRestricted } from '@/lib/dashboard/accessControl'

const ROLE_COOKIE = 'nextrium-role'
// 30s: short enough that a role change (e.g. promoting/demoting someone in
// Team Access) takes effect on their next couple of page loads instead of
// up to 5 minutes, while still absorbing the request-per-poll load this
// cache exists for in the first place.
const ROLE_COOKIE_MAX_AGE = 30
const ROLE_QUERY_TIMEOUT_MS = 4000 // never let one slow Supabase response hang the whole middleware

interface RoleQueryResult {
  role: string
  archived: boolean
  onboarded: boolean
}

async function fetchUserRole(userId: string): Promise<RoleQueryResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const queryPromise = supabase
    .from('dashboard_users')
    .select('role, archived, onboarding_completed_at')
    .eq('user_id', userId)
    .maybeSingle() as unknown as Promise<{ data: { role: string; archived: boolean; onboarding_completed_at: string | null } | null; error: unknown }>

  const timeoutPromise = new Promise<{ data: null; error: 'timeout' }>((resolve) =>
    setTimeout(() => resolve({ data: null, error: 'timeout' }), ROLE_QUERY_TIMEOUT_MS)
  )

  const { data } = await Promise.race([queryPromise, timeoutPromise])
  if (!data) return { role: 'community', archived: false, onboarded: true }
  if (data.archived) return { role: 'archived', archived: true, onboarded: true }
  return { role: data.role, archived: false, onboarded: !!data.onboarding_completed_at }
}

/**
 * Resolves the dashboard role for middleware's per-request access check.
 * Reads from a short-lived cookie first so a slow or momentarily
 * unreachable Supabase can never hang every single dashboard request —
 * previously this ran a fresh Supabase query on every request with no
 * timeout, so one slow response could take the whole middleware (and by
 * extension the entire /dashboard tree) down with a 504
 * MIDDLEWARE_INVOCATION_TIMEOUT.
 */
async function getUserRole(
  request: NextRequest,
  response: NextResponse,
  userId: string
): Promise<RoleQueryResult> {
  // Cookie value is "<userId>:<role>:<onboarded 0|1>" — binding it to the
  // signed-in user id means a different account signing in on the same
  // browser can never inherit a stale cached role left over from whoever
  // used it before.
  const cached = request.cookies.get(ROLE_COOKIE)?.value
  if (cached) {
    const [cachedUserId, cachedRole, cachedOnboarded] = cached.split(':')
    if (cachedUserId === userId && cachedRole) {
      return { role: cachedRole, archived: cachedRole === 'archived', onboarded: cachedOnboarded === '1' }
    }
  }

  const result = await fetchUserRole(userId)
  response.cookies.set(ROLE_COOKIE, `${userId}:${result.role}:${result.onboarded ? '1' : '0'}`, {
    maxAge: ROLE_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  return result
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/login')        return NextResponse.next()
  if (pathname === '/set-password') return NextResponse.next()
  if (pathname.startsWith('/auth/')) return NextResponse.next()
  if (!pathname.startsWith('/dashboard')) return NextResponse.next()

  const { response, user } = await updateSession(request)

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { role, onboarded } = await getUserRole(request, response, user.id)

  // Archived blocks the entire /dashboard tree (including /dashboard
  // itself), so redirecting there like every other restriction does would
  // loop forever — send them out to /login instead, same as a signed-out
  // visitor, with a message explaining why.
  if (role === 'archived') {
    return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent('Your dashboard access has been revoked. Contact an administrator.'), request.url))
  }

  // Forced post-invite profile setup — the same page doubles as "edit my
  // profile" later, so this only ever fires once per account. Existing
  // accounts were backfilled with onboarding_completed_at set, so this
  // never surprises anyone who was already using the dashboard.
  const ONBOARDING_PATH = '/dashboard/people/me'
  if (!onboarded && pathname !== ONBOARDING_PATH) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url))
  }

  if (isRestricted(pathname, role)) {
    // member is allowlisted to /dashboard/people only, so the usual
    // "bounce back to /dashboard" would loop forever for them exactly like
    // the archived case above — land them on the one place they can go.
    const landingPath = role === 'member' ? '/dashboard/people' : '/dashboard'
    return NextResponse.redirect(new URL(landingPath, request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webpp)$).*)',
  ],
}