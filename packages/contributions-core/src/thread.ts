// Pure rules for two-way feedback threads, attempt caps, resubmission
// feedback payloads, chronological timelines, and follow-up task prefills.
// Shared across the internal team dashboard and the community contributor portal.
import { escapeHtml } from './emails'
import type { ReviewedStatus } from './reviewMapping'

export const MAX_ATTEMPTS = 3
export const MESSAGE_MAX = 4000
export const MAX_MESSAGES_PER_THREAD = 50
export const PREVIOUS_FEEDBACK_NOTE_MAX = 1500

export type ThreadAuthorRole = 'staff' | 'contributor'
export type ThreadMessageKind =
  | 'feedback'
  | 'reply'
  | 'decision_verified'
  | 'decision_changes'
  | 'decision_rejected'

export interface ThreadMessage {
  id: string
  submission_number: number
  author_role: ThreadAuthorRole
  author_user_id?: string | null
  author_name: string
  kind: ThreadMessageKind
  body: string
  created_at: string
}

export interface AttemptSnapshot {
  id: string
  submission_number: number
  title: string
  description: string
  evidence_url: string | null
  submitted_at: string
  created_at?: string
}

export interface TimelineReview {
  id: string
  submission_number: number
  source: 'service' | 'staff'
  decision: string
  overall_score: number | null
  checks: Record<string, boolean> | null
  feedback: {
    summary?: string
    issues?: { check: string; message: string }[]
    what_to_do?: string
    resubmission_assessment?: {
      summary?: string
      previous_issues_resolved?: { check: string; status: string; explanation: string }[]
    }
  } | null
  code_audit: unknown
  created_at: string
}

export type TimelineEntry =
  | { type: 'attempt'; id: string; timestamp: string; submissionNumber: number; attempt: AttemptSnapshot }
  | { type: 'review'; id: string; timestamp: string; submissionNumber: number; review: TimelineReview }
  | { type: 'message'; id: string; timestamp: string; submissionNumber: number; message: ThreadMessage }

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/** Validates and cleans a thread message or feedback note. Plain text only. */
export function parseMessageBody(raw: unknown): { body: string } | { error: string } {
  if (typeof raw !== 'string') return { error: 'Write a message first.' }
  const cleaned = raw.replace(/\r\n/g, '\n').replace(CONTROL_CHARS, '').trim()
  if (!cleaned) return { error: 'Write a message first.' }
  if (cleaned.length > MESSAGE_MAX) return { error: `Messages must be ${MESSAGE_MAX.toLocaleString()} characters or fewer.` }
  return { body: cleaned }
}

/** True when another resubmission attempt is still allowed under the 3-attempt cap. */
export function canRequestMoreChanges(submissionCount: number): boolean {
  return Number.isFinite(submissionCount) && submissionCount < MAX_ATTEMPTS
}

/** True when a team member may submit or resubmit work for their open task. */
export function canResubmitTeam(
  taskOpen: boolean,
  contribution: { status: string; submission_count: number } | null | undefined,
): boolean {
  if (!taskOpen) return false
  if (!contribution) return true
  return contribution.status === 'changes_requested' && canRequestMoreChanges(contribution.submission_count)
}

/**
 * Authorization & state check for posting to a submission thread.
 * Contributors get a generic not-found message when they don't own the submission.
 */
export function canPostThreadMessage(p: {
  authorRole: ThreadAuthorRole
  isOwner: boolean
  threadClosed: boolean
  messageCount: number
}): { ok: true } | { ok: false; error: string } {
  if (p.authorRole === 'contributor' && !p.isOwner) {
    return { ok: false, error: 'That submission could not be found.' }
  }
  if (p.threadClosed) {
    return {
      ok: false,
      error: p.authorRole === 'staff'
        ? 'Reopen the thread before posting another message.'
        : 'This conversation has been closed by the team.',
    }
  }
  if (p.messageCount >= MAX_MESSAGES_PER_THREAD) {
    return { ok: false, error: 'This thread has reached its message limit.' }
  }
  return { ok: true }
}

/**
 * Escalates an automated "changes_requested" result on the final attempt
 * (attempt 3 of 3) to human review so a contributor is never stranded with
 * changes requested and zero attempts remaining.
 */
export function resolveReviewedStatus(mappedStatus: ReviewedStatus, submissionCount: number): ReviewedStatus {
  if (mappedStatus === 'changes_requested' && submissionCount >= MAX_ATTEMPTS) {
    return 'needs_human'
  }
  return mappedStatus
}

export interface PreviousFeedbackPayload {
  summary: string
  issues: { check: string; message: string }[]
  what_to_do: string
}

/**
 * Builds the `previous_feedback` payload sent to the automated review service
 * on Attempt 2 and Attempt 3. Merges automated review findings with the latest
 * staff revision note (bounded and sanitized). Never includes contributor
 * replies, preventing prompt injection via thread replies.
 */
export function buildPreviousFeedback(p: {
  lastServiceFeedback?: {
    summary?: unknown
    issues?: unknown
    what_to_do?: unknown
  } | null
  latestStaffNote?: string | null
}): PreviousFeedbackPayload | undefined {
  const f = p.lastServiceFeedback
  const baseSummary = typeof f?.summary === 'string' ? f.summary.trim() : ''
  const baseIssues = Array.isArray(f?.issues)
    ? f.issues
        .filter((i: any) => i && typeof i.check === 'string' && typeof i.message === 'string')
        .map((i: any) => ({ check: i.check, message: i.message }))
    : []
  const baseWhatToDo = typeof f?.what_to_do === 'string' ? f.what_to_do.trim() : ''

  const cleanStaff = typeof p.latestStaffNote === 'string'
    ? p.latestStaffNote.replace(/\r\n/g, '\n').replace(CONTROL_CHARS, '').trim().slice(0, PREVIOUS_FEEDBACK_NOTE_MAX)
    : ''

  const hasService = !!baseSummary || baseIssues.length > 0 || !!baseWhatToDo
  if (!hasService && !cleanStaff) return undefined

  if (!cleanStaff) {
    return { summary: baseSummary, issues: baseIssues, what_to_do: baseWhatToDo }
  }

  const summary = baseSummary
    ? `${baseSummary}\n\nStaff revision notes: ${cleanStaff}`
    : `Staff requested changes: ${cleanStaff}`
  const issues = [...baseIssues, { check: 'staff_feedback', message: cleanStaff }]
  const what_to_do = baseWhatToDo
    ? `${baseWhatToDo}\n\nAddress staff feedback: ${cleanStaff}`
    : cleanStaff

  return { summary, issues, what_to_do }
}

/**
 * Returns the latest human staff note on a submission, preferring the thread
 * messages table, then legacy staff review rows, then contribution.staff_notes.
 */
export function latestStaffFeedbackNote(p: {
  messages?: Pick<ThreadMessage, 'author_role' | 'body' | 'created_at' | 'kind'>[]
  reviews?: Pick<TimelineReview, 'source' | 'feedback' | 'created_at'>[]
  fallbackStaffNotes?: string | null
}): string | null {
  const staffMessages = [...(p.messages ?? [])]
    .filter((m) => m.author_role === 'staff' && m.body.trim().length > 0)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (staffMessages[0]) return staffMessages[0].body.trim()

  const staffReviews = [...(p.reviews ?? [])]
    .filter((r) => r.source === 'staff' && typeof r.feedback?.summary === 'string' && r.feedback.summary.trim().length > 0)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (staffReviews[0]?.feedback?.summary) return staffReviews[0].feedback.summary.trim()

  const fb = typeof p.fallbackStaffNotes === 'string' ? p.fallbackStaffNotes.trim() : ''
  return fb || null
}

/**
 * Picks the primary staff reviewer to notify when a contributor replies:
 * the last staff member who posted in the thread, else the task creator.
 */
export function pickReplyRecipientUserId(p: {
  messages: { author_role: string; author_user_id?: string | null; created_at: string }[]
  taskCreatorId: string | null
}): string | null {
  const lastStaff = [...p.messages]
    .filter((m) => m.author_role === 'staff' && typeof m.author_user_id === 'string' && m.author_user_id.length > 0)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  return lastStaff?.author_user_id ?? p.taskCreatorId ?? null
}

const ENTRY_ORDER: Record<TimelineEntry['type'], number> = {
  attempt: 0,
  review: 1,
  message: 2,
}

export interface LegacyStaffNote {
  body: string | null | undefined
  status: string | null | undefined
  submissionNumber?: number | null
  timestamp?: string | null
}

/**
 * Builds a unified chronological timeline of submission attempts, automated
 * reviews, legacy staff reviews (not already represented in messages), legacy
 * `staff_notes`/`notes` written before threads existed, and two-way messages.
 */
export function buildSubmissionTimeline(p: {
  attempts?: AttemptSnapshot[]
  reviews?: TimelineReview[]
  messages?: ThreadMessage[]
  legacyStaffNote?: LegacyStaffNote | null
}): TimelineEntry[] {
  const messages = p.messages ?? []
  const reviews = p.reviews ?? []
  const staffMessageKeys = new Set(
    messages
      .filter((m) => m.author_role === 'staff')
      .map((m) => `${m.submission_number}:${m.body.trim()}`),
  )
  const staffBodies = new Set<string>([
    ...messages.filter((m) => m.author_role === 'staff').map((m) => m.body.trim()),
    ...reviews
      .filter((r) => r.source === 'staff' && typeof r.feedback?.summary === 'string')
      .map((r) => r.feedback!.summary!.trim()),
  ])

  const entries: TimelineEntry[] = []

  for (const a of p.attempts ?? []) {
    entries.push({
      type: 'attempt',
      id: `attempt-${a.id}`,
      timestamp: a.submitted_at || a.created_at || '',
      submissionNumber: a.submission_number,
      attempt: a,
    })
  }

  for (const r of reviews) {
    // Avoid duplicating a staff decision that already appears as a thread message.
    if (r.source === 'staff') {
      const summary = (r.feedback?.summary ?? '').trim()
      if (summary && staffMessageKeys.has(`${r.submission_number}:${summary}`)) continue
    }
    entries.push({
      type: 'review',
      id: `review-${r.id}`,
      timestamp: r.created_at,
      submissionNumber: r.submission_number,
      review: r,
    })
  }

  for (const m of messages) {
    entries.push({
      type: 'message',
      id: `message-${m.id}`,
      timestamp: m.created_at,
      submissionNumber: m.submission_number,
      message: m,
    })
  }

  const legacyText = typeof p.legacyStaffNote?.body === 'string' ? p.legacyStaffNote.body.trim() : ''
  if (legacyText && !staffBodies.has(legacyText)) {
    const st = p.legacyStaffNote?.status
    const kind: ThreadMessageKind =
      st === 'verified' ? 'decision_verified'
      : st === 'rejected' ? 'decision_rejected'
      : st === 'changes_requested' ? 'decision_changes'
      : 'feedback'
    const submissionNumber = Math.max(1, p.legacyStaffNote?.submissionNumber ?? 1)
    const timestamp = p.legacyStaffNote?.timestamp ?? ''
    entries.push({
      type: 'message',
      id: 'message-legacy-staff-note',
      timestamp,
      submissionNumber,
      message: {
        id: 'legacy-staff-note',
        submission_number: submissionNumber,
        author_role: 'staff',
        author_name: 'Team',
        kind,
        body: legacyText,
        created_at: timestamp,
      },
    })
  }

  return entries.sort((a, b) => {
    const timeCmp = a.timestamp.localeCompare(b.timestamp)
    if (timeCmp !== 0) return timeCmp
    if (a.submissionNumber !== b.submissionNumber) return a.submissionNumber - b.submissionNumber
    return ENTRY_ORDER[a.type] - ENTRY_ORDER[b.type]
  })
}

export interface FollowUpPrefill {
  title: string
  description: string
  category: string
  sourceContributionId: string
  sourceTaskTitle: string
  sourceSubmissionTitle: string
  referenceUrl: string | null
  suggestedAssigneeId: string | null
}

/** Builds editable prefill values for spinning a submission into a follow-up task. */
export function buildFollowUpDraft(p: {
  originalTaskTitle: string
  originalTaskCategory: string
  submissionTitle: string
  contributionId: string
  suggestedAssigneeId?: string | null
  referenceUrl?: string | null
}): FollowUpPrefill {
  const cleanTask = p.originalTaskTitle.trim() || 'Previous task'
  const cleanSub = p.submissionTitle.trim() || 'Submitted work'
  const title = `Follow-up: ${cleanTask}`.slice(0, 200)
  const description =
    `<p>Follow-up task based on <strong>${escapeHtml(cleanTask)}</strong> (${escapeHtml(cleanSub)}).</p>` +
    `<p>Outline the specific deliverables, next steps, and acceptance criteria below:</p>`

  let safeRef: string | null = null
  if (p.referenceUrl) {
    try {
      const u = new URL(p.referenceUrl)
      if (u.protocol === 'https:' || u.protocol === 'http:') safeRef = u.toString()
    } catch {
      safeRef = null
    }
  }

  return {
    title,
    description,
    category: p.originalTaskCategory,
    sourceContributionId: p.contributionId,
    sourceTaskTitle: cleanTask,
    sourceSubmissionTitle: cleanSub,
    referenceUrl: safeRef,
    suggestedAssigneeId: p.suggestedAssigneeId ?? null,
  }
}
