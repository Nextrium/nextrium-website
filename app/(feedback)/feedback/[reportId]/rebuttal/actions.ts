'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath }      from 'next/cache'

export async function submitRebuttal(
  reportId:           string,
  disputedDimensions: string[],
  evidenceStatement:  string,
  evidenceUrls:       string[]
): Promise<{ error?: string }> {
  try {
    const supabase = createServiceClient()

    const { data: report, error: reportError } = await (supabase
      .from('screening_reports') as any)
      .select('rebuttal_submitted, rebuttal_locked, created_at, application_id')
      .eq('id', reportId)
      .single()

    if (reportError || !report) return { error: 'Report not found.' }
    if (report.rebuttal_submitted) {
      return { error: 'A rebuttal has already been submitted for this report.' }
    }
    if (report.rebuttal_locked) {
      return { error: 'This report is locked and no longer accepts rebuttals.' }
    }
    if (!evidenceStatement.trim()) {
      return { error: 'Evidence statement is required.' }
    }
    if (disputedDimensions.length === 0) {
      return { error: 'Please select at least one disputed dimension.' }
    }
    if (evidenceStatement.length > 2000) {
      return { error: 'Evidence statement must be under 2000 characters.' }
    }

    const invalidUrls = (evidenceUrls ?? []).filter((url) => {
      try { new URL(url); return false } catch { return true }
    })
    if (invalidUrls.length > 0) {
      return { error: 'One or more evidence URLs are not valid.' }
    }

    const { error: insertError } = await (supabase
      .from('screening_rebuttals') as any)
      .insert({
        report_id:           reportId,
        disputed_dimensions: disputedDimensions,
        evidence_statement:  evidenceStatement.trim(),
        evidence_urls:       evidenceUrls.filter((u) => u.trim()),
        application_date:    report.created_at,
      })

    if (insertError) {
      return { error: 'Failed to submit rebuttal. Please try again.' }
    }

    await (supabase.from('screening_reports') as any)
      .update({ rebuttal_submitted: true })
      .eq('id', reportId)

    // Notify operations team via existing email route
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.nextrium.org'
    const senderId = process.env.NEXTRIUM_OPERATIONS_SENDER_ID ?? ''

    // The email route only accepts server-to-server calls that carry the
    // shared key (or a staff session); without it this notification is
    // refused and the .catch below hides that.
    const serverKey = process.env.AGENTS_ENGINE_API_KEY
    await fetch(`${siteUrl}/api/email`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(serverKey ? { Authorization: `Bearer ${serverKey}` } : {}),
      },
      body: JSON.stringify({
        subject:    `Rebuttal received for report ${reportId}`,
        message:    `A rebuttal has been submitted for evaluation report ${reportId}.\n\nDisputed dimensions:\n${disputedDimensions.join('\n')}\n\nEvidence statement:\n${evidenceStatement}\n\nPlease log into the Nextrium dashboard to review the original screening dossier alongside the submitted rebuttal.`,
        recipients: [{ name: 'Nextrium Operations', email: 'operations@nextrium.org' }],
        sender_id:  senderId,
      }),
    }).catch(() => {})

    revalidatePath(`/feedback/${reportId}`)
    return {}
  } catch {
    return { error: 'Something went wrong. Please try again.' }
  }
}