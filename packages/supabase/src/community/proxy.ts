import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { communityEnv } from './env'

// Same bound as the dashboard's session check: a slow auth response must not
// hang every request. A timeout counts as signed out (fail closed).
const AUTH_QUERY_TIMEOUT_MS = 4000

/** Refreshes the community session cookies and reports who is signed in. */
export async function updateCommunitySession(request: NextRequest): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request })

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
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), AUTH_QUERY_TIMEOUT_MS)
  })
  const user = await Promise.race([
    supabase.auth.getUser().then(({ data }) => data.user).catch(() => null),
    timeout,
  ])
  clearTimeout(timer)

  return { response, user }
}
