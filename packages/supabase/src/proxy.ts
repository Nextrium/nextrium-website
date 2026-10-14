import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Bounds the auth check the same way the dashboard-role lookup in proxy.ts
// already is — this was the one remaining unbounded await in the
// middleware chain. Left unguarded, a slow/hanging Supabase auth response
// here blocks every single /dashboard request, including the very first
// navigation right after signing in, which can look like sign-in silently
// never completing even though the session was actually created.
const AUTH_QUERY_TIMEOUT_MS = 4000

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const authPromise = supabase.auth.getUser()
  const timeoutPromise = new Promise<{ data: { user: null } }>((resolve) =>
    setTimeout(() => resolve({ data: { user: null } }), AUTH_QUERY_TIMEOUT_MS)
  )

  const { data: { user } } = await Promise.race([authPromise, timeoutPromise])

  return { response: supabaseResponse, user }
}