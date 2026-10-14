import { NextResponse, type NextRequest } from 'next/server'
import { brand } from '@nextrium/brand'

const DASHBOARD = (process.env.NEXT_PUBLIC_DASHBOARD_URL ?? brand.urls.dashboard).replace(/\/+$/, '')

/** 307 to the same path on the dashboard's domain, keeping the query string. */
export function toDashboard(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(`${DASHBOARD}${path}${request.nextUrl.search}`, 307)
}
