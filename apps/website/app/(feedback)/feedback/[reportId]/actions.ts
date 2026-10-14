'use server'

import { fetchAgentsEngine } from '@/lib/agentsEngine'

export async function submitReportRating(
  reportId: string,
  ratingStars: number,
  rationale: string
): Promise<{ error?: string }> {
  const res = await fetchAgentsEngine('/api/v1/agents/hr/report-rating', {
    method: 'POST',
    body: JSON.stringify({ reportId, ratingStars, rationale }),
  })

  if (!res.ok) {
    return { error: res.error }
  }

  return {}
}
