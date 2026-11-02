'use server'

import { fetchAgentsEngine } from '@nextrium/agents-engine'
import { getAuthorizedReport } from '@/lib/reportSession'

export async function submitReportRating(
  reportId: string,
  ratingStars: number,
  rationale: string
): Promise<{ error?: string }> {
  const report = await getAuthorizedReport(reportId)
  if (!report) return { error: 'Please verify your access to this report, then try again.' }

  const res = await fetchAgentsEngine('/api/v1/agents/hr/report-rating', {
    method: 'POST',
    body: JSON.stringify({ reportId: report.id, ratingStars, rationale }),
  })

  if (!res.ok) {
    return { error: res.error }
  }

  return {}
}
