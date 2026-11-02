'use server'

import { createServiceClient } from '@nextrium/supabase/server'
import { revalidatePath }      from 'next/cache'
import { brand } from '@nextrium/brand'
import { parseRebuttalInput } from '@/lib/rebuttalInput'
import { getAuthorizedReport } from '@/lib/reportSession'

const ALREADY_SUBMITTED = 'A rebuttal has already been submitted for this report.'

export async function submitRebuttal(
  reportId:           string,
  disputedDimensions: string[],
  evidenceStatement:  string,
  evidenceUrls:       string[]
): Promise<{ error?: string }> {
  try {
    const report = await getAuthorizedReport(reportId)
    if (!report) return { error: 'Please verify your access to this report, then try again.' }

    if (report.rebuttal_submitted) {
      return { error: ALREADY_SUBMITTED }
    }
    if (report.rebuttal_locked) {
      return { error: 'This report is locked and no longer accepts rebuttals.' }
    }

    const input = parseRebuttalInput(disputedDimensions, evidenceStatement, evidenceUrls)
    if ('error' in input) return { error: input.error }

    const supabase = createServiceClient()
    const markSubmitted = () => (supabase.from('screening_reports') as any)
      .update({ rebuttal_submitted: true })
      .eq('id', report.id)

    const { error: insertError } = await (supabase
      .from('screening_rebuttals') as any)
      .insert({
        report_id:           report.id,
        // The dashboard's rebuttal detail and the engine's rescreen look the
        // rebuttal up by application, so it must carry the report's app id.
        application_id:      report.application_id,
        disputed_dimensions: input.dimensions,
        evidence_statement:  input.statement,
        evidence_urls:       input.urls,
        application_date:    report.created_at,
      })

    if (insertError) {
      // The unique index stopped a second rebuttal: a simultaneous request won.
      // Setting the flag also repairs a report whose earlier update failed.
      if (insertError.code === '23505') {
        await markSubmitted()
        return { error: ALREADY_SUBMITTED }
      }
      return { error: 'Failed to submit rebuttal. Please try again.' }
    }

    const { error: flagError } = await markSubmitted()
    if (flagError) console.error('[submitRebuttal] could not mark report as submitted:', flagError.code)

    // Notify operations team via existing email route
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? brand.urls.website
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
        subject:    `Rebuttal received for report ${report.id}`,
        message:    `A rebuttal has been submitted for evaluation report ${report.id}.\n\nDisputed dimensions:\n${input.dimensions.join('\n')}\n\nEvidence statement:\n${input.statement}\n\nPlease log into the ${brand.name} dashboard to review the original screening dossier alongside the submitted rebuttal.`,
        recipients: [{ name: brand.teams.operations, email: brand.emails.operations }],
        sender_id:  senderId,
      }),
    }).catch(() => {})

    revalidatePath(`/feedback/${report.id}`)
    return {}
  } catch {
    return { error: 'Something went wrong. Please try again.' }
  }
}