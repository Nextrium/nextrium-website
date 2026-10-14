import { NextRequest, NextResponse } from 'next/server'
import { getVerifiedIdentity } from '@/lib/dashboard/getRole'
import { STATE_COOKIE, STATE_TTL_MS, buildAuthorizeUrl, canLinkDiscord, createState, readDiscordConfig } from '@/lib/discordLink'

// Starts linking the signed-in member's Discord account.
export async function GET(request: NextRequest) {
  const me = await getVerifiedIdentity()
  if (!me || !canLinkDiscord(me.role)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const config = readDiscordConfig()
  if (!config) {
    return NextResponse.redirect(new URL('/dashboard/people/me?discord=unavailable', request.url))
  }

  const { state, cookie } = createState(me.userId, config.clientSecret)
  const response = NextResponse.redirect(buildAuthorizeUrl(config, state))
  response.cookies.set(STATE_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/discord',
    maxAge: Math.floor(STATE_TTL_MS / 1000),
  })
  return response
}
