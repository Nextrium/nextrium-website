'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'
import { hashIp } from '@/lib/reportAccess'
import { issueCode, redeemCode } from '@/lib/reportAccessFlow'
import { createCodeStore, lookupApplicantForReport, sendCodeEmail } from '@/lib/reportAccessStore'
import { startReportSession } from '@/lib/reportSession'

const REPORT_ID = /^[A-Za-z0-9-]{4,40}$/
const REQUESTED = 'If that address matches the application for this report, a code is on its way. It expires in 10 minutes.'
const UNAVAILABLE = 'Verification is temporarily unavailable. Please try again later.'

async function clientIp(): Promise<string> {
  const h = await headers()
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown'
}

/** Asks for a code. The reply is the same whether or not the address matches. */
export async function requestReportCode(reportId: string, email: string): Promise<{ ok: boolean; message: string }> {
  try {
    if (!REPORT_ID.test(reportId ?? '')) return { ok: true, message: REQUESTED }

    const result = await issueCode(
      { store: createCodeStore(), lookup: lookupApplicantForReport, deliver: sendCodeEmail },
      { reportId, email: String(email ?? ''), ipHash: hashIp(await clientIp()) },
    )
    if (result.status === 'invalid_email') return { ok: false, message: 'Enter a valid email address.' }

    const pending = result.pending
    if (pending) {
      after(async () => {
        try { await pending() } catch (err) { console.error('[requestReportCode] delivery failed:', err instanceof Error ? err.message : err) }
      })
    }
    return { ok: true, message: REQUESTED }
  } catch (err) {
    console.error('[requestReportCode]', err instanceof Error ? err.message : err)
    return { ok: false, message: UNAVAILABLE }
  }
}

/** Checks the code and, if it is right, starts a one-hour session for that address. */
export async function verifyReportCode(email: string, code: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const result = await redeemCode(
      { store: createCodeStore() },
      { email: String(email ?? ''), code: String(code ?? '').trim() },
    )
    if (!result.ok) return { ok: false, message: 'That code is invalid or has expired. Request a new one.' }

    await startReportSession(result.emailHash)
    return { ok: true }
  } catch (err) {
    console.error('[verifyReportCode]', err instanceof Error ? err.message : err)
    return { ok: false, message: UNAVAILABLE }
  }
}
