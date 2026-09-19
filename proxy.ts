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

async function fetchUserRole(userId: string): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const queryPromise = supabase
    .from('dashboard_users')
    .select('role, archived')
    .eq('user_id', userId)
    .maybeSingle() as unknown as Promise<{ data: { role: string; archived: boolean } | null; error: unknown }>

  const timeoutPromise = new Promise<{ data: null; error: 'timeout' }>((resolve) =>
    setTimeout(() => resolve({ data: null, error: 'timeout' }), ROLE_QUERY_TIMEOUT_MS)
  )

  const { data } = await Promise.race([queryPromise, timeoutPromise])
  if (!data) return 'community'
  if (data.archived) return 'archived'
  return data.role;
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
): Promise<string> {
  // Cookie value is "<userId>:<role>" — binding it to the signed-in user id
  // means a different account signing in on the same browser can never
  // inherit a stale cached role left over from whoever used it before.
  const cached = request.cookies.get(ROLE_COOKIE)?.value
  if (cached) {
    const [cachedUserId, cachedRole] = cached.split(':')
    if (cachedUserId === userId && cachedRole) return cachedRole
  }

  const role = await fetchUserRole(userId)
  response.cookies.set(ROLE_COOKIE, `${userId}:${role}`, {
    maxAge: ROLE_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  return role
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

  const role = await getUserRole(request, response, user.id)

  // Archived blocks the entire /dashboard tree (including /dashboard
  // itself), so redirecting there like every other restriction does would
  // loop forever — send them out to /login instead, same as a signed-out
  // visitor, with a message explaining why.
  if (role === 'archived') {
    return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent('Your dashboard access has been revoked. Contact an administrator.'), request.url))
  }

  if (isRestricted(pathname, role)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webpp)$).*)',
  ],
}