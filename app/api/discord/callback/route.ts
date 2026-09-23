import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getVerifiedIdentity } from '@/lib/dashboard/getRole'
import { logActivity } from '@/lib/activityLog'
import { ACCESS_SYNC, emitAutomationEvent } from '@/lib/automation/server'
import { STATE_COOKIE, canLinkDiscord, fetchDiscordIdentity, readDiscordConfig, verifyState } from '@/lib/discordLink'

function finish(request: NextRequest, result: string): NextResponse {
  const response = NextResponse.redirect(new URL(`/dashboard/people/me?discord=${result}`, request.url))
  response.cookies.set(STATE_COOKIE, '', { path: '/api/discord', maxAge: 0 })
  return response
}

// Discord sends the member back here after they approve or cancel.
export async function GET(request: NextRequest) {
  const me = await getVerifiedIdentity()
  if (!me || !canLinkDiscord(me.role)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const config = readDiscordConfig()
  if (!config) return finish(request, 'unavailable')

  const params = request.nextUrl.searchParams
  if (params.get('error')) return finish(request, 'denied')

  const code = params.get('code')
  const stateOk = verifyState(request.cookies.get(STATE_COOKIE)?.value, params.get('state'), me.userId, config.clientSecret)
  if (!code || !stateOk) return finish(request, 'error')

  const identity = await fetchDiscordIdentity(fetch, config, code)
  if (!identity.ok) {
    console.error('[discord link] lookup failed:', identity.reason)
    return finish(request, 'error')
  }

  const now = new Date().toISOString()
  const { error } = await (createServiceClient().from('dashboard_users') as any)
    .update({
      discord_user_id: identity.discordUserId,
      discord_username: identity.username,
      discord_linked_at: now,
      updated_at: now,
    })
    .eq('user_id', me.userId)

  if (error) {
    // 23505 = that Discord account is already linked to another team member.
    return finish(request, error.code === '23505' ? 'taken' : 'error')
  }

  // Apply any access rules right away; if they aren't verified in the
  // server yet this simply waits and can be re-checked from the profile.
  await emitAutomationEvent(ACCESS_SYNC, me.userId)

  logActivity({
    action: 'discord_linked',
    targetType: 'dashboard_user',
    targetId: me.userId,
    details: { discordUsername: identity.username },
  }).catch(() => {})

  return finish(request, 'linked')
}
