// Server-side validation for a member's submission. Limits match the review
// service contract (title ≤ 200, description ≤ 10,000, evidence URL ≤ 2,048).
export const SUBMISSION_TITLE_MAX = 200
export const SUBMISSION_DESCRIPTION_MAX = 10_000
export const SUBMISSION_MIN_WORDS = 50
export const EVIDENCE_URL_MAX = 2_048

export interface SubmissionInput {
  title: string
  description: string
  evidenceUrl: string
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function parseSubmission(raw: unknown): { submission: SubmissionInput } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Invalid submission.' }
  const r = raw as Record<string, unknown>

  const title = typeof r.title === 'string' ? r.title.trim() : ''
  if (!title) return { error: 'Give your submission a title.' }
  if (title.length > SUBMISSION_TITLE_MAX) return { error: `Keep the title under ${SUBMISSION_TITLE_MAX} characters.` }

  const description = typeof r.description === 'string' ? r.description.trim() : ''
  if (description.length > SUBMISSION_DESCRIPTION_MAX) return { error: `Keep the description under ${SUBMISSION_DESCRIPTION_MAX.toLocaleString()} characters.` }
  if (wordCount(description) < SUBMISSION_MIN_WORDS) {
    return { error: `Describe what you did in at least ${SUBMISSION_MIN_WORDS} words — what you built or produced, how, and how it meets the brief.` }
  }

  const evidenceUrl = typeof r.evidenceUrl === 'string' ? r.evidenceUrl.trim() : ''
  if (!evidenceUrl) return { error: 'Add a link to your work (a PR, repository, document or design file).' }
  if (evidenceUrl.length > EVIDENCE_URL_MAX) return { error: 'That link is too long.' }
  let url: URL
  try { url = new URL(evidenceUrl) } catch { return { error: 'That link is not a valid URL.' } }
  if (url.protocol !== 'https:') return { error: 'The link must start with https://' }

  return { submission: { title, description, evidenceUrl: url.toString() } }
}
