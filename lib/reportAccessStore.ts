import { createServiceClient } from '@/lib/supabase/server'
import type { ApplicantLookup, CodeStore } from './reportAccessFlow'

const TABLE = 'report_access_codes'

// The table isn't in the generated types, so this uses the untyped client.
function db() {
  return createServiceClient() as any
}

// A failed count reads as "limit reached": when the store can't be checked,
// no new code is issued.
const UNKNOWN_COUNT = Number.MAX_SAFE_INTEGER

export function createCodeStore(): CodeStore {
  return {
    async countByEmailSince(emailHash, sinceIso) {
      const { count, error } = await db().from(TABLE).select('id', { count: 'exact', head: true })
        .eq('email_hash', emailHash).gte('created_at', sinceIso)
      return error || count == null ? UNKNOWN_COUNT : count
    },

    async countByIpSince(ipHash, sinceIso) {
      const { count, error } = await db().from(TABLE).select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash).gte('created_at', sinceIso)
      return error || count == null ? UNKNOWN_COUNT : count
    },

    async insert(row) {
      const { data, error } = await db().from(TABLE).insert(row).select('id').single()
      return error || !data ? null : data.id
    },

    async markSent(id) {
      await db().from(TABLE).update({ sent: true }).eq('id', id)
    },

    async findUsable(emailHash, nowIso) {
      const { data } = await db().from(TABLE).select('id, code_hash, attempts')
        .eq('email_hash', emailHash).eq('sent', true).is('used_at', null).gt('expires_at', nowIso)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      return data ?? null
    },

    // Only succeeds if the stored count is still what the caller read.
    async bumpAttempts(id, expectedAttempts) {
      const { data, error } = await db().from(TABLE).update({ attempts: expectedAttempts + 1 })
        .eq('id', id).eq('attempts', expectedAttempts).select('id')
      return !error && Array.isArray(data) && data.length === 1
    },

    // Only succeeds for the call that first marks the code used.
    async markUsed(id) {
      const { data, error } = await db().from(TABLE).update({ used_at: new Date().toISOString() })
        .eq('id', id).is('used_at', null).select('id')
      return !error && Array.isArray(data) && data.length === 1
    },
  }
}

/** The email address and archived flag of the application a report belongs to. */
export async function lookupApplicantForReport(reportId: string): Promise<ApplicantLookup | null> {
  const { data: report } = await db().from('screening_reports').select('application_id')
    .eq('id', reportId.toUpperCase()).maybeSingle()
  if (!report?.application_id) return null

  const { data: application } = await db().from('applications').select('email, archived')
    .eq('id', report.application_id).maybeSingle()
  return application?.email ? { email: application.email, archived: !!application.archived } : null
}

/** Sends through the existing email route, which adds the sender identity, branding and logging. */
export async function sendCodeEmail(email: string, code: string): Promise<boolean> {
  const key = process.env.AGENTS_ENGINE_API_KEY
  if (!key) return false
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.nextrium.org'

  try {
    const res = await fetch(`${siteUrl}/api/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        subject: 'Your Nextrium report access code',
        message: `Hello,\n\nYour verification code is ${code}.\n\nIt expires in 10 minutes. If you did not request it, you can ignore this email.`,
        recipients: [{ name: 'Applicant', email }],
      }),
    })
    if (!res.ok) return false
    const body = await res.json().catch(() => null)
    return body?.results?.[0]?.success === true
  } catch {
    return false
  }
}
