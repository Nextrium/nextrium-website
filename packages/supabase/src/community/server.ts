import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { CommunityDatabase } from './database'
import { communityEnv } from './env'

// Clients for the community project (the contributor portal's own Supabase).
// Every read and write happens on the server.

/** Session-aware client: who is signed in, and auth calls (sign-in links, sign-out). */
export async function createCommunityClient() {
  const cookieStore = await cookies()

  return createServerClient<CommunityDatabase>(
    communityEnv('COMMUNITY_SUPABASE_URL'),
    communityEnv('COMMUNITY_SUPABASE_PUBLISHABLE_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — safe to ignore
          }
        },
      },
    }
  )
}

/** Service client for data access. Only use it after the caller's identity and rights are checked. */
export function createCommunityServiceClient() {
  const key = communityEnv('COMMUNITY_SUPABASE_SECRET_KEY')
  return createSupabaseClient<CommunityDatabase>(
    communityEnv('COMMUNITY_SUPABASE_URL'),
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          apikey: key,
        },
      },
    }
  )
}
