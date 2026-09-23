import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { SESSION_TTL_MS, hashEmail, safeEqualHex, signSession, verifySession } from './reportAccess'

export const REPORT_SESSION_COOKIE = 'nx-report-session'

/** The verified email hash from the applicant's session cookie, or null. */
export async function getReportSession(): Promise<{ emailHash: string } | null> {
  const store = await cookies()
  return verifySession(store.get(REPORT_SESSION_COOKIE)?.value)
}

export async function startReportSession(emailHash: string): Promise<void> {
  const { token } = signSession(emailHash)
  const store = await cookies()
  store.set(REPORT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/feedback',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })
}

/**
 * The full report row, but only when the caller holds a valid session for the
 * same email address as the application the report belongs to. Everything
 * else (no session, unknown report, someone else's report) returns null, so
 * callers can't tell those cases apart.
 */
export async function getAuthorizedReport(reportId: string): Promise<Record<string, any> | null> {
  const session = await getReportSession()
  if (!session) return null

  const db = createServiceClient() as any
  const { data: report } = await db.from('screening_reports').select('*')
    .eq('id', String(reportId).toUpperCase()).maybeSingle()
  if (!report?.application_id) return null

  const { data: application } = await db.from('applications').select('email')
    .eq('id', report.application_id).maybeSingle()
  if (!application?.email) return null

  return safeEqualHex(hashEmail(application.email), session.emailHash) ? report : null
}
