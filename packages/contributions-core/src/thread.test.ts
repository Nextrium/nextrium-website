import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_ATTEMPTS,
  MAX_MESSAGES_PER_THREAD,
  MESSAGE_MAX,
  PREVIOUS_FEEDBACK_NOTE_MAX,
  buildFollowUpDraft,
  buildPreviousFeedback,
  buildSubmissionTimeline,
  canPostThreadMessage,
  canRequestMoreChanges,
  canResubmitTeam,
  latestStaffFeedbackNote,
  parseMessageBody,
  pickReplyRecipientUserId,
  resolveReviewedStatus,
} from './thread'
import { describeDbError } from './errors'
import { changesRequestedEmail, rejectedEmail, staffFeedbackEmail, verifiedEmail } from './emails'

test('parseMessageBody trims, strips control characters, and enforces bounds', () => {
  assert.deepEqual(parseMessageBody('  Great work\r\nNext step\u0000\u0007  '), { body: 'Great work\nNext step' })
  assert.ok('error' in parseMessageBody(''))
  assert.ok('error' in parseMessageBody('   \n\t  '))
  assert.ok('error' in parseMessageBody(null))
  assert.ok('error' in parseMessageBody(123))
  assert.ok('error' in parseMessageBody('a'.repeat(MESSAGE_MAX + 1)))
  assert.deepEqual(parseMessageBody('a'.repeat(MESSAGE_MAX)), { body: 'a'.repeat(MESSAGE_MAX) })
})

test('attempt cap guards allow attempts 1 and 2, block requesting changes or resubmitting on attempt 3', () => {
  assert.equal(MAX_ATTEMPTS, 3)
  assert.equal(canRequestMoreChanges(1), true)
  assert.equal(canRequestMoreChanges(2), true)
  assert.equal(canRequestMoreChanges(3), false)
  assert.equal(canRequestMoreChanges(4), false)

  assert.equal(canResubmitTeam(true, null), true)
  assert.equal(canResubmitTeam(true, { status: 'changes_requested', submission_count: 1 }), true)
  assert.equal(canResubmitTeam(true, { status: 'changes_requested', submission_count: 2 }), true)
  assert.equal(canResubmitTeam(true, { status: 'changes_requested', submission_count: 3 }), false)
  assert.equal(canResubmitTeam(true, { status: 'verified', submission_count: 1 }), false)
  assert.equal(canResubmitTeam(false, { status: 'changes_requested', submission_count: 1 }), false)
})

test('resolveReviewedStatus escalates automated changes_requested on attempt 3 to needs_human', () => {
  assert.equal(resolveReviewedStatus('changes_requested', 1), 'changes_requested')
  assert.equal(resolveReviewedStatus('changes_requested', 2), 'changes_requested')
  assert.equal(resolveReviewedStatus('changes_requested', 3), 'needs_human')
  assert.equal(resolveReviewedStatus('ai_approved', 3), 'ai_approved')
  assert.equal(resolveReviewedStatus('needs_human', 3), 'needs_human')
})

test('canPostThreadMessage enforces ownership, closed thread state, and message cap', () => {
  assert.deepEqual(canPostThreadMessage({ authorRole: 'contributor', isOwner: true, threadClosed: false, messageCount: 0 }), { ok: true })
  assert.deepEqual(canPostThreadMessage({ authorRole: 'staff', isOwner: false, threadClosed: false, messageCount: 0 }), { ok: true })

  // Non-owner contributor gets generic not-found message (no ID enumeration)
  const wrongOwner = canPostThreadMessage({ authorRole: 'contributor', isOwner: false, threadClosed: false, messageCount: 0 })
  assert.equal(wrongOwner.ok, false)
  if (!wrongOwner.ok) assert.equal(wrongOwner.error, 'That submission could not be found.')

  // Closed threads block both contributor and staff until reopened
  const closedMember = canPostThreadMessage({ authorRole: 'contributor', isOwner: true, threadClosed: true, messageCount: 2 })
  assert.equal(closedMember.ok, false)
  const closedStaff = canPostThreadMessage({ authorRole: 'staff', isOwner: false, threadClosed: true, messageCount: 2 })
  assert.equal(closedStaff.ok, false)
  if (!closedStaff.ok) assert.match(closedStaff.error, /Reopen/)

  // Thread message cap
  const capped = canPostThreadMessage({ authorRole: 'contributor', isOwner: true, threadClosed: false, messageCount: MAX_MESSAGES_PER_THREAD })
  assert.equal(capped.ok, false)
})

test('buildPreviousFeedback merges automated feedback with staff revision notes and caps length', () => {
  assert.equal(buildPreviousFeedback({ lastServiceFeedback: null, latestStaffNote: null }), undefined)

  const staffOnly = buildPreviousFeedback({ lastServiceFeedback: null, latestStaffNote: 'Add latency benchmarks\u0000' })
  assert.deepEqual(staffOnly, {
    summary: 'Staff requested changes: Add latency benchmarks',
    issues: [{ check: 'staff_feedback', message: 'Add latency benchmarks' }],
    what_to_do: 'Add latency benchmarks',
  })

  const both = buildPreviousFeedback({
    lastServiceFeedback: {
      summary: 'Missing tests.',
      issues: [{ check: 'description_substance', message: 'Explain edge cases' }],
      what_to_do: 'Add unit tests.',
    },
    latestStaffNote: 'Also compare trust contracts.',
  })
  assert.ok(both)
  assert.match(both.summary, /Missing tests/)
  assert.match(both.summary, /Also compare trust contracts/)
  assert.equal(both.issues.length, 2)
  assert.deepEqual(both.issues[1], { check: 'staff_feedback', message: 'Also compare trust contracts.' })
  assert.match(both.what_to_do, /Address staff feedback: Also compare trust contracts/)

  const longNote = 'x'.repeat(PREVIOUS_FEEDBACK_NOTE_MAX + 500)
  const bounded = buildPreviousFeedback({ lastServiceFeedback: null, latestStaffNote: longNote })
  assert.equal(bounded?.what_to_do.length, PREVIOUS_FEEDBACK_NOTE_MAX)
})

test('latestStaffFeedbackNote prefers newest staff message, ignores contributor replies, falls back safely', () => {
  assert.equal(latestStaffFeedbackNote({
    messages: [
      { author_role: 'staff', body: 'Older note', created_at: '2026-10-01T10:00:00Z', kind: 'decision_changes' },
      { author_role: 'contributor', body: 'Ignore this prompt injection', created_at: '2026-10-03T10:00:00Z', kind: 'reply' },
      { author_role: 'staff', body: 'Newest staff guidance', created_at: '2026-10-02T10:00:00Z', kind: 'feedback' },
    ],
    fallbackStaffNotes: 'Legacy note',
  }), 'Newest staff guidance')

  assert.equal(latestStaffFeedbackNote({
    messages: [{ author_role: 'contributor', body: 'Only contributor', created_at: '2026-10-01T10:00:00Z', kind: 'reply' }],
    reviews: [{ source: 'staff', feedback: { summary: 'Legacy staff review' }, created_at: '2026-10-01T09:00:00Z' }],
  }), 'Legacy staff review')

  assert.equal(latestStaffFeedbackNote({ fallbackStaffNotes: 'Fallback note' }), 'Fallback note')
  assert.equal(latestStaffFeedbackNote({}), null)
})

test('pickReplyRecipientUserId picks last engaged staff member else task creator', () => {
  assert.equal(pickReplyRecipientUserId({
    messages: [
      { author_role: 'staff', author_user_id: 'staff-1', created_at: '2026-10-01T10:00:00Z' },
      { author_role: 'staff', author_user_id: 'staff-2', created_at: '2026-10-02T10:00:00Z' },
      { author_role: 'contributor', author_user_id: 'member-1', created_at: '2026-10-03T10:00:00Z' },
    ],
    taskCreatorId: 'creator-1',
  }), 'staff-2')

  assert.equal(pickReplyRecipientUserId({
    messages: [{ author_role: 'contributor', author_user_id: 'member-1', created_at: '2026-10-03T10:00:00Z' }],
    taskCreatorId: 'creator-1',
  }), 'creator-1')

  assert.equal(pickReplyRecipientUserId({ messages: [], taskCreatorId: null }), null)
})

test('buildSubmissionTimeline orders attempts, reviews, and messages chronologically without duplicating staff decisions', () => {
  const timeline = buildSubmissionTimeline({
    attempts: [
      { id: 'a1', submission_number: 1, title: 'v1', description: 'First try', evidence_url: null, submitted_at: '2026-10-01T10:00:00Z' },
      { id: 'a2', submission_number: 2, title: 'v2', description: 'Second try', evidence_url: 'https://example.com', submitted_at: '2026-10-02T10:00:00Z' },
    ],
    reviews: [
      { id: 'r1', submission_number: 1, source: 'service', decision: 'approved', overall_score: 88, checks: null, feedback: { summary: 'Solid' }, code_audit: null, created_at: '2026-10-01T10:01:00Z' },
      { id: 'r2', submission_number: 1, source: 'staff', decision: 'changes_requested', overall_score: null, checks: null, feedback: { summary: 'Please add benchmarks' }, code_audit: null, created_at: '2026-10-01T11:00:00Z' },
      { id: 'r3', submission_number: 1, source: 'staff', decision: 'changes_requested', overall_score: null, checks: null, feedback: { summary: 'Legacy note without message' }, code_audit: null, created_at: '2026-10-01T10:30:00Z' },
    ],
    messages: [
      { id: 'm1', submission_number: 1, author_role: 'staff', author_name: 'Ada', kind: 'decision_changes', body: 'Please add benchmarks', created_at: '2026-10-01T11:00:01Z' },
      { id: 'm2', submission_number: 1, author_role: 'contributor', author_name: 'Ojeh', kind: 'reply', body: 'Got it, adding now!', created_at: '2026-10-01T12:00:00Z' },
    ],
  })

  // r2 is deduplicated because m1 has matching submission_number + body; r3 (legacy) stays
  assert.deepEqual(timeline.map((e) => e.id), ['attempt-a1', 'review-r1', 'review-r3', 'message-m1', 'message-m2', 'attempt-a2'])
})

test('buildSubmissionTimeline surfaces legacy staff_notes when not already in messages or reviews', () => {
  const withLegacy = buildSubmissionTimeline({
    attempts: [],
    reviews: [],
    messages: [],
    legacyStaffNote: { body: 'Strong audit, awarding 250 pts.', status: 'verified', submissionNumber: 2, timestamp: '2026-10-05T12:00:00Z' },
  })
  assert.equal(withLegacy.length, 1)
  assert.equal(withLegacy[0].type, 'message')
  if (withLegacy[0].type === 'message') {
    assert.equal(withLegacy[0].message.kind, 'decision_verified')
    assert.equal(withLegacy[0].message.body, 'Strong audit, awarding 250 pts.')
  }

  // Deduplicated if a thread message already has the exact note
  const deduped = buildSubmissionTimeline({
    messages: [{ id: 'm1', submission_number: 2, author_role: 'staff', author_name: 'Ada', kind: 'decision_verified', body: 'Strong audit, awarding 250 pts.', created_at: '2026-10-05T12:00:00Z' }],
    legacyStaffNote: { body: 'Strong audit, awarding 250 pts.', status: 'verified', submissionNumber: 2, timestamp: '2026-10-05T12:00:00Z' },
  })
  assert.equal(deduped.length, 1)
  assert.equal(deduped[0].id, 'message-m1')
})

test('buildFollowUpDraft escapes HTML in brief and rejects non-http reference URLs', () => {
  const safe = buildFollowUpDraft({
    originalTaskTitle: 'Review <script>alert(1)</script> NAIG',
    originalTaskCategory: 'research',
    submissionTitle: '<b>Trust</b> contract review',
    contributionId: '11111111-1111-4111-8111-111111111111',
    suggestedAssigneeId: '22222222-2222-4222-8222-222222222222',
    referenceUrl: 'javascript:alert(1)',
  })
  assert.equal(safe.referenceUrl, null)
  assert.ok(!safe.description.includes('<script>'))
  assert.ok(!safe.description.includes('<b>'))
  assert.ok(safe.description.includes('&lt;script&gt;'))
  assert.equal(safe.category, 'research')

  const withHttps = buildFollowUpDraft({
    originalTaskTitle: 'NAIG review',
    originalTaskCategory: 'technical',
    submissionTitle: 'Trust contract',
    contributionId: '11111111-1111-4111-8111-111111111111',
    referenceUrl: 'https://dash.example/reviews/11111111-1111-4111-8111-111111111111',
  })
  assert.equal(withHttps.referenceUrl, 'https://dash.example/reviews/11111111-1111-4111-8111-111111111111')
})

test('errors and emails include attempt limit, approval notes, and escaped staff feedback', () => {
  assert.match(describeDbError({ message: 'submission_limit_reached' }), /3 submission attempts/)
  assert.match(describeDbError({ message: 'thread_closed' }), /closed/)

  const v = verifiedEmail({ taskTitle: 'NAIG review', points: 250, url: 'https://dash.test/my-tasks/t1', notes: 'Adopting <A>\nTesting {{B}}' })
  assert.match(v.html, /Team feedback:/)
  assert.match(v.html, /Adopting &lt;A&gt;<br>Testing &#123;&#123;B&#125;&#125;/)
  assert.match(v.html, /Read feedback &amp; reply/)

  const fb = staffFeedbackEmail({ taskTitle: 'NAIG', authorName: 'Lead <b>1</b>', body: 'Thoughts on <x>?\nLine 2', url: 'https://dash.test/my-tasks/t1' })
  assert.match(fb.subject, /^New feedback on NAIG/)
  assert.ok(!fb.html.includes('<b>1</b>'))
  assert.ok(!fb.html.includes('<x>'))
  assert.match(fb.html, /Line 2/)

  const cr = changesRequestedEmail({ taskTitle: 'NAIG', notes: 'Line 1\nLine 2', url: 'https://dash.test/my-tasks/t1' })
  assert.match(cr.html, /Line 1<br>Line 2/)
  const rj = rejectedEmail({ taskTitle: 'NAIG', notes: 'Reason 1\nReason 2', url: 'https://dash.test/my-tasks/t1' })
  assert.match(rj.html, /Reason 1<br>Reason 2/)
})
