'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { normalizeUrl } from '@/lib/normalizeUrl'
import type { Application, AgentScreeningResult } from '@/lib/types/database'
import { useDashboardSearch } from '@/lib/dashboard/useDashboardSearch'
import DashboardSearchBox from '@/components/dashboard/DashboardSearchBox'
import { useDashboard } from '@/components/dashboard/DashboardContext'
import { logActivityAction } from '@/app/actions/activityLog'
import RebuttalPanel from './RebuttalPanel'
import {
  deleteApplication,
  dispatchEmailsAction,
  startBulkScreenAction,
  getBulkScreenJobStatus,
  getScreeningResultsForApplications,
  getFreshFeedbackLetter,
  markApplicationReviewed,
  archiveApplication,
  unarchiveApplication,
  type BulkScreenOutcome,
  type ReviewedInfo,
  type ArchivedInfo,
} from './actions'

const BULK_SCREEN_JOB_STORAGE_KEY = 'nextrium-active-bulk-screen-job'

interface EmailSender {
  id: string
  name: string
  email: string
  is_default: boolean
}

interface RebuttalStatus {
  reportId: string
  rebuttalSubmitted: boolean
  rebuttalLocked: boolean
}

interface ApplicationsClientProps {
  applications: Application[]
  senders: EmailSender[]
  initialScreeningResults?: Record<string, AgentScreeningResult>
  rebuttalStatuses?: Record<string, RebuttalStatus>
}

type SortField = 'name' | 'role' | 'evaluation_track' | 'composite_score' | 'consensus_tier' | 'recommendation' | 'rebuttal' | 'screened_at'
type SortDir   = 'asc' | 'desc'

const STATUS_OPTIONS: Application['status'][] = ['pending', 'reviewed', 'shortlisted', 'rejected', 'accepted']

// Must match the `name` field of each track in agents-engine's EVALUATION_TRACKS
// (src/lib/evaluationTracks.ts) — this is what gets sent as `forceTrack`.
const EVALUATION_TRACK_OPTIONS = [
  'Technical Engineering',
  'Product and Design',
  'Operations',
  'Community and Events',
  'Research and Strategy',
]

const STATUS_STYLES: Record<Application['status'], { bg: string; color: string }> = {
  pending:     { bg: 'rgba(219,103,39,0.1)',  color: 'var(--orange)'  },
  reviewed:    { bg: 'rgba(74,111,165,0.1)',  color: 'var(--slate)'   },
  shortlisted: { bg: 'rgba(212,168,67,0.1)',  color: 'var(--gold)'    },
  rejected:    { bg: 'rgba(232,69,69,0.1)',   color: 'var(--error)'   },
  accepted:    { bg: 'rgba(34,193,122,0.1)',  color: 'var(--success)' },
}

const SCREENING_STEPS = [
  'Parsing resume and application details…',
  'Running Layer 1 resume scorecard (Gemini + DeepSeek ensemble)…',
  'Cross-checking GitHub, portfolio, and LinkedIn footprint…',
  'Running Layer 2 live artifact verification…',
  'Reconciling dual-layer consensus score…',
  'Drafting recruiter briefing and interview questions…',
]

function asDisplayText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  if (typeof value === 'object' && 'url' in (value as any)) return String((value as any).url ?? '')
  return String(value)
}

function getScoreColor(score: number): { color: string; bg: string; border: string } {
  if (score >= 85) return { color: '#22c17a', bg: 'rgba(34,193,122,0.1)', border: 'rgba(34,193,122,0.3)' }
  if (score >= 70) return { color: '#d4a843', bg: 'rgba(212,168,67,0.1)', border: 'rgba(212,168,67,0.3)' }
  if (score >= 50) return { color: '#4a6fa5', bg: 'rgba(74,111,165,0.1)', border: 'rgba(74,111,165,0.3)' }
  return { color: '#e84545', bg: 'rgba(232,69,69,0.1)', border: 'rgba(232,69,69,0.3)' }
}

export default function ApplicationsClient({
  applications: initial,
  senders,
  initialScreeningResults = {},
  rebuttalStatuses = {},
}: ApplicationsClientProps) {
  const { openCopilot } = useDashboard()
  // Status/rebuttal filtering is driven by the sidebar sub-navigation via
  // ?status=, so it's real navigation (bookmarkable, back-button aware)
  // rather than in-page tab state.
  const searchParams = useSearchParams()
  const statusTab = (searchParams.get('status') ?? 'all') as 'all' | Application['status'] | 'rebuttal' | 'human-reviewed' | 'track-review' | 'archived'
  const [applications, setApplications] = useState(initial)
  const [selected,     setSelected]     = useState<Application | null>(null)
  const [updating,     setUpdating]     = useState(false)
  const [markingReviewed, setMarkingReviewed] = useState(false)
  const [markReviewedError, setMarkReviewedError] = useState<string | null>(null)
  const [trackChoice, setTrackChoice] = useState('')
  const [deleting,      setDeleting]      = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [archiving,        setArchiving]        = useState(false)
  const [archiveError,     setArchiveError]      = useState<string | null>(null)
  const [archiveReasonBox, setArchiveReasonBox]  = useState(false)
  const [archiveReason,    setArchiveReason]     = useState('')

  // Table view state
  const [viewMode,        setViewMode]        = useState<'list' | 'table'>('list')
  const [sortField,       setSortField]       = useState<SortField>('screened_at')
  const [sortDir,         setSortDir]         = useState<SortDir>('desc')
  const [minScoreFilter,  setMinScoreFilter]  = useState<string>('')
  const [trackFilter,     setTrackFilter]     = useState<string[]>([])
  const [recFilter,       setRecFilter]       = useState<Application['status'][]>([])
  const [copiedReportUrl, setCopiedReportUrl] = useState(false)

  // AI Screening state
  const [screeningResults, setScreeningResults] = useState<Record<string, AgentScreeningResult>>(initialScreeningResults)
  const [batchScreening,   setBatchScreening]   = useState(false)
  const [batchProgress,    setBatchProgress]    = useState<{ current: number; total: number } | null>(null)
  const [batchJobId,       setBatchJobId]       = useState<string | null>(null)
  const [batchError,       setBatchError]       = useState<string | null>(null)
  const [batchTargetIds,   setBatchTargetIds]   = useState<string[]>([])
  const [selectMode,       setSelectMode]       = useState(false)
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set())
  const [trackDropdownOpen,  setTrackDropdownOpen]  = useState(false)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const listScrollRef = useRef<HTMLDivElement>(null)
  const [copiedQuestion,   setCopiedQuestion]   = useState<number | null>(null)
  const [showQuestions,    setShowQuestions]    = useState(false)
  const [screeningStep,    setScreeningStep]    = useState(0)

  useEffect(() => {
    if (!batchScreening) {
      setScreeningStep(0)
      return
    }
    const interval = setInterval(() => {
      setScreeningStep((prev) => (prev + 1) % SCREENING_STEPS.length)
    }, 2600)
    return () => clearInterval(interval)
  }, [batchScreening])

  const [bulkEmailSending, setBulkEmailSending] = useState(false)
  const [bulkEmailResult,  setBulkEmailResult]  = useState<{ sentCount: number; skippedCount: number; failedCount: number } | null>(null)
  const [bulkEmailError,   setBulkEmailError]   = useState<string | null>(null)
  const [perCandidateEmailSending, setPerCandidateEmailSending] = useState(false)
  const [loadingComposer, setLoadingComposer] = useState(false)
  const [loadingScreeningDetail, setLoadingScreeningDetail] = useState<string | null>(null)
  const [perCandidateEmailResult,  setPerCandidateEmailResult]  = useState<string | null>(null)

  const defaultSender = senders.find((s) => s.is_default) ?? senders[0]

  const [emailOpen,          setEmailOpen]          = useState(false)
  const [emailSenderId,      setEmailSenderId]      = useState(defaultSender?.id ?? '')
  const [emailSubject,       setEmailSubject]       = useState('')
  const [emailMessage,       setEmailMessage]       = useState('')
  const [emailSending,       setEmailSending]       = useState(false)
  const [emailResult,        setEmailResult]        = useState<'success' | 'error' | null>(null)
  const [emailAttachFiles,   setEmailAttachFiles]   = useState<{ name: string; content: string }[]>([])

  function applyReviewedInfo(id: string, reviewed: ReviewedInfo) {
    const patch = {
      first_reviewed_by_email: reviewed.firstReviewedByEmail,
      first_reviewed_at: reviewed.firstReviewedAt,
      last_reviewed_by_email: reviewed.lastReviewedByEmail,
      last_reviewed_at: reviewed.lastReviewedAt,
    }
    setApplications((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a))
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev))
  }

  function applyArchivedInfo(id: string, archived: ArchivedInfo) {
    const patch = {
      archived: archived.archived,
      archived_at: archived.archivedAt,
      archived_reason: archived.archivedReason,
      archived_by_email: archived.archivedByEmail,
    }
    setApplications((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a))
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev))
  }

  async function updateStatus(id: string, status: Application['status']) {
    setUpdating(true)
    const supabase = createClient()
    const { error } = await (supabase.from('applications') as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setApplications((prev) => prev.map((a) => a.id === id ? { ...a, status } : a))
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : null)
      logActivityAction({
        action: 'application_status_updated',
        targetType: 'application',
        targetId: id,
        details: { newStatus: status },
      }).catch(() => {})

      // A manual status change is exactly the kind of "a human looked at
      // this" moment the reviewed marker exists for.
      markApplicationReviewed(id).then(({ reviewed }) => {
        if (reviewed) applyReviewedInfo(id, reviewed)
      })
    }
    setUpdating(false)
  }

  // Stamps the reviewed marker on its own, with no accompanying status
  // change — for the case a reviewer looks at an application, agrees with
  // its current status as-is, and wants that confirmation on record without
  // pointlessly re-clicking the status it's already sitting at.
  async function handleMarkHumanReviewed(id: string) {
    setMarkingReviewed(true)
    setMarkReviewedError(null)
    const { reviewed, error } = await markApplicationReviewed(id)
    if (reviewed) {
      applyReviewedInfo(id, reviewed)
      logActivityAction({
        action: 'application_human_reviewed',
        targetType: 'application',
        targetId: id,
        details: { note: 'Reviewed with no status change needed' },
      }).catch(() => {})
    } else if (error) {
      setMarkReviewedError(error)
    }
    setMarkingReviewed(false)
  }

  async function handleArchive(id: string) {
    if (!archiveReasonBox) {
      setArchiveReasonBox(true)
      return
    }
    setArchiving(true)
    setArchiveError(null)
    const { archived, error } = await archiveApplication(id, archiveReason)
    if (archived) {
      applyArchivedInfo(id, archived)
      setArchiveReasonBox(false)
      setArchiveReason('')
    } else if (error) {
      setArchiveError(error)
    }
    setArchiving(false)
  }

  async function handleUnarchive(id: string) {
    setArchiving(true)
    setArchiveError(null)
    const { archived, error } = await unarchiveApplication(id)
    if (archived) {
      applyArchivedInfo(id, archived)
    } else if (error) {
      setArchiveError(error)
    }
    setArchiving(false)
  }

  async function handleDelete(id: string) {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    const { error } = await deleteApplication(id)
    if (!error) {
      setApplications((prev) => prev.filter((a) => a.id !== id))
      setSelected(null)
      setConfirmDelete(false)
    }
    setDeleting(false)
  }

  async function handleEmailFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const encoded = await Promise.all(
      files.map((file) => new Promise<{ name: string; content: string }>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]
          resolve({ name: file.name, content: base64 })
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      }))
    )
    setEmailAttachFiles((prev) => [...prev, ...encoded])
  }

  function removeEmailFile(index: number) {
    setEmailAttachFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Single-candidate screening (Run Screening / Rescan) goes through the
  // same durable job+polling system as bulk screening — reusing the exact
  // infrastructure that already handles the reality that a full dual-model,
  // dual-layer consensus screen can legitimately take well over a minute.
  // The previous synchronous single HTTP call had a 55s client timeout and
  // a 60s Vercel function ceiling, both shorter than real-world provider
  // latency; the client would give up while the engine kept running the
  // screening server-side, and a retry would then race a second, wasted
  // run against the same candidate. Routing through the job system removes
  // both timeouts entirely — the HTTP call to start it returns immediately,
  // and polling has no realistic duration limit.
  async function handleScreenCandidate(appId: string) {
    await runBulkScreenJob([appId])
  }

  async function handleAssignTrackAndScreen(appId: string, track: string) {
    await runBulkScreenJob([appId], { [appId]: track })
  }

  function applyBulkOutcomesToState(outcomes: BulkScreenOutcome[], freshRecords: Record<string, AgentScreeningResult>) {
    if (Object.keys(freshRecords).length > 0) {
      setScreeningResults((prev) => ({ ...prev, ...freshRecords }))
    }

    // A successful screen always clears needs_track_assignment server-side
    // (setNeedsTrackAssignment(id, false) runs on every successful persist);
    // an outcome that explicitly reports needsTrackAssignment sets it. Any
    // other failure (transient provider error, etc.) leaves the flag as-is.
    const patchApp = (a: Application): Application => {
      const outcome = outcomes.find((o) => o.applicationId === a.id)
      if (!outcome) return a
      const patch: Record<string, any> = {}
      if (outcome.statusUpdated) patch.status = outcome.statusUpdated
      if (outcome.success) patch.needs_track_assignment = false
      else if (outcome.needsTrackAssignment) patch.needs_track_assignment = true
      return Object.keys(patch).length > 0 ? { ...a, ...patch } : a
    }

    setApplications((prev) => prev.map(patchApp))
    setSelected((prev) => (prev ? patchApp(prev) : prev))
  }

  async function pollBulkScreenJob(jobId: string) {
    const mergedApplicationIds = new Set<string>()
    // A transient gateway blip on a single 3s status check (e.g. a stray 504)
    // used to be treated as fatal, permanently abandoning a job that Render
    // was still working through fine in the background. Tolerate a run of
    // failures before giving up — Render is the source of truth and doesn't
    // stop on its own, so the client should keep trying to reconnect rather
    // than assume one bad response means the job is dead.
    const MAX_CONSECUTIVE_POLL_FAILURES = 5
    let consecutiveFailures = 0

    while (true) {
      const { job, error } = await getBulkScreenJobStatus(jobId)

      if (error || !job) {
        consecutiveFailures += 1
        if (consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
          setBatchError(error || 'Lost connection to the bulk screening job.')
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 3000))
        continue
      }
      consecutiveFailures = 0

      setBatchProgress({ current: job.succeeded + job.failed, total: job.total })
      if (Array.isArray(job.application_ids) && job.application_ids.length > 0) {
        setBatchTargetIds(job.application_ids)
      }

      const newlySucceeded = job.results.filter(
        (r) => r.success && !mergedApplicationIds.has(r.applicationId)
      )
      const newlyFailed = job.results.filter((r) => !r.success && !mergedApplicationIds.has(r.applicationId))

      if (newlySucceeded.length > 0 || newlyFailed.length > 0) {
        newlySucceeded.forEach((r) => mergedApplicationIds.add(r.applicationId))
        newlyFailed.forEach((r) => mergedApplicationIds.add(r.applicationId))
        const freshRecords = newlySucceeded.length > 0
          ? await getScreeningResultsForApplications(newlySucceeded.map((r) => r.applicationId))
          : {}
        // Passing job.results (not just the newly-observed subset) is fine —
        // applyBulkOutcomesToState only touches applications whose id it
        // finds an outcome for, and re-applying an already-merged outcome
        // is a harmless no-op.
        applyBulkOutcomesToState(job.results, freshRecords)
      }

      if (job.status !== 'running') {
        if (job.status === 'failed') setBatchError(job.error || 'Bulk screening job failed.')
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 3000))
    }

    try {
      localStorage.removeItem(BULK_SCREEN_JOB_STORAGE_KEY)
    } catch {
      // localStorage unavailable — nothing to clean up
    }
    setBatchScreening(false)
    setBatchProgress(null)
    setBatchJobId(null)
    setBatchTargetIds([])
  }

  async function runBulkScreenJob(applicationIds: string[], trackOverrides?: Record<string, string>) {
    if (applicationIds.length === 0) return

    setBatchScreening(true)
    setBatchError(null)
    setBatchProgress({ current: 0, total: applicationIds.length })
    setBatchTargetIds(applicationIds)

    const { jobId, error } = await startBulkScreenAction(applicationIds, trackOverrides)

    if (error && !jobId) {
      setBatchError(error)
      setBatchScreening(false)
      setBatchProgress(null)
      return
    }

    setBatchJobId(jobId!)
    try {
      localStorage.setItem(BULK_SCREEN_JOB_STORAGE_KEY, jobId!)
    } catch {
      // localStorage unavailable — batch still runs, just won't resume across a reload
    }

    await pollBulkScreenJob(jobId!)
  }

  function handleBatchScreen() {
    const unscanned = applications.filter((a) => !screeningResults[a.id])
    return runBulkScreenJob(unscanned.map((a) => a.id))
  }

  function handleScreenSelected() {
    const ids = Array.from(selectedIds)
    setSelectMode(false)
    setSelectedIds(new Set())
    return runBulkScreenJob(ids)
  }

  // Resume polling an in-flight bulk screening job after a page reload,
  // since the job itself runs durably server-side regardless of this tab.
  useEffect(() => {
    let cancelled = false
    try {
      const savedJobId = localStorage.getItem(BULK_SCREEN_JOB_STORAGE_KEY)
      if (savedJobId) {
        setBatchScreening(true)
        setBatchJobId(savedJobId)
        ;(async () => {
          if (!cancelled) await pollBulkScreenJob(savedJobId)
        })()
      }
    } catch {
      // localStorage unavailable — nothing to resume
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleBulkEmail() {
    setBulkEmailSending(true)
    setBulkEmailError(null)
    setBulkEmailResult(null)
    try {
      const res = await dispatchEmailsAction([])
      if (res.error) {
        setBulkEmailError(res.error)
      } else {
        setBulkEmailResult({
          sentCount: res.sentCount ?? 0,
          skippedCount: res.skippedCount ?? 0,
          failedCount: res.failedCount ?? 0,
        })
        setScreeningResults((prev) => {
          const next = { ...prev }
          res.results?.forEach((r) => {
            if (r.status === 'sent' && r.applicationId && next[r.applicationId]) {
              next[r.applicationId] = { ...next[r.applicationId], email_sent: true }
            }
          })
          return next
        })
      }
    } catch (err: any) {
      setBulkEmailError(err.message || 'Email dispatch failed')
    } finally {
      setBulkEmailSending(false)
    }
  }

  async function handleSendFeedbackToSelected(applicationId: string) {
    setPerCandidateEmailSending(true)
    setPerCandidateEmailResult(null)
    try {
      const res = await dispatchEmailsAction([applicationId])
      if (res.error) {
        setPerCandidateEmailResult(`Failed: ${res.error}`)
        return
      }
      const outcome = res.results?.find((r) => r.applicationId === applicationId)
      if (outcome?.status === 'sent') {
        setPerCandidateEmailResult('✓ Sent successfully.')
        setScreeningResults((prev) =>
          prev[applicationId] ? { ...prev, [applicationId]: { ...prev[applicationId], email_sent: true } } : prev
        )
      } else {
        setPerCandidateEmailResult(`Failed: ${outcome?.reason || 'Could not send email to this candidate.'}`)
      }
    } catch (err: any) {
      setPerCandidateEmailResult(`Failed: ${err.message || 'Email dispatch failed'}`)
    } finally {
      setPerCandidateEmailSending(false)
    }
  }

  // Regenerates the letter fresh from the AI engine rather than reading
  // screening.full_result — that stored copy is frozen at original
  // screening time and never reflects later wording fixes or a
  // rebuttal-revised recommendation (see getFreshFeedbackLetter).
  async function handleLoadFeedbackToEmail() {
    if (!selected) return
    setLoadingComposer(true)
    setPerCandidateEmailResult(null)

    const { letter, error } = await getFreshFeedbackLetter(selected.id)
    setLoadingComposer(false)

    if (error || !letter) {
      setPerCandidateEmailResult(`Failed: ${error || 'Could not load feedback letter.'}`)
      return
    }

    setEmailSubject(letter.subject || `Update regarding your application for ${selected.role_title || 'Role'} at Nextrium`)

    // letter.body is the actual, complete message the AI engine builds
    // (compensation disclaimer, Discord invite, report link, etc. — see
    // generateApplicantFeedbackLetter) and is exactly what the server-side
    // dispatch path (buildEmailBody) sends. The composer was reassembling
    // its own shorter version from greeting/executiveFeedback/strengths/
    // growth/closingNote fields that generateApplicantFeedbackLetter
    // doesn't actually populate for any recommendation tier, which is why
    // "Load into Composer" only ever showed a two-line stub. Only fall
    // back to reconstructing when a letter genuinely has no body.
    const formattedMessage = letter.body || [
      letter.greeting || `Hi ${selected.name.split(' ')[0]},`,
      '',
      letter.executiveFeedback || '',
      ...(Array.isArray(letter.verifiedStrengthsHighlighted) && letter.verifiedStrengthsHighlighted.length > 0
        ? ['', 'Verified Strengths Highlighted:', ...letter.verifiedStrengthsHighlighted.map((s) => `• ${s}`)]
        : []),
      ...(Array.isArray(letter.growthOpportunitiesAndGaps) && letter.growthOpportunitiesAndGaps.length > 0
        ? ['', 'Areas for Development & Next Steps:', ...letter.growthOpportunitiesAndGaps.map((g) => `• ${g}`)]
        : []),
      '',
      letter.closingNote || 'Best regards,\nNextrium Talent Team',
    ].join('\n')

    setEmailMessage(formattedMessage)
    setEmailOpen(true)
    setEmailResult(null)
  }

  function handleCopyQuestion(text: string, index: number) {
    navigator.clipboard.writeText(text)
    setCopiedQuestion(index)
    setTimeout(() => setCopiedQuestion(null), 2000)
  }

  async function handleSendEmail() {
    if (!selected) return
    setEmailSending(true)
    setEmailResult(null)

    try {
      const res  = await fetch('/api/email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          subject:         emailSubject,
          message:         emailMessage,
          recipients:      [{ name: selected.name, email: selected.email, role: selected.role_title ?? '' }],
          sender_id:       emailSenderId,
          fileAttachments: emailAttachFiles,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send.')
      setEmailResult('success')
      setEmailSubject('')
      setEmailMessage('')
      setEmailAttachFiles([])
    } catch {
      setEmailResult('error')
    } finally {
      setEmailSending(false)
    }
  }

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = applications.filter((a) => a.status === s).length
    return acc
  }, {} as Record<Application['status'], number>)

  const unscannedCount = applications.filter((a) => !screeningResults[a.id]).length
  const pendingEmailCount = applications.filter((a) => screeningResults[a.id] && !screeningResults[a.id].email_sent).length
  const selectedScreening = selected ? screeningResults[selected.id] : null
  const selectedConsensus = selectedScreening ? ((selectedScreening.full_result as any)?.consensus || selectedScreening.full_result) : null
  const selectedLayer2    = selectedConsensus?.layer2ArtifactScorecard ?? null
  const selectedArtifacts = selectedConsensus?.inspectedArtifacts ?? null
  const selectedRebuttal  = selected ? rebuttalStatuses[selected.id] : null
  // When a rebuttal exists, its report id (already resolved to whichever
  // duplicate row actually carries the rebuttal — see getRebuttalStatuses
  // in page.tsx) takes priority over the latest live screening result's
  // report id, which can point at a newer, unrelated report row if this
  // candidate was rescreened after the rebuttal was filed.
  const selectedReportId  = (selectedRebuttal?.rebuttalSubmitted && selectedRebuttal.reportId)
    || selectedConsensus?.publicFeedbackReport?.reportId
    || selectedRebuttal?.reportId
    || null
  const selectedReportUrl = selectedReportId ? `https://www.nextrium.org/feedback/${selectedReportId}` : null

  const batchQueueIndex = selected ? batchTargetIds.indexOf(selected.id) : -1
  const batchCompletedCount = batchProgress?.current ?? 0
  const isInActiveBatch = batchScreening && batchQueueIndex !== -1
  const isCurrentlyBatchScreening = isInActiveBatch && batchQueueIndex === batchCompletedCount && !selectedScreening
  const isQueuedInBatch = isInActiveBatch && batchQueueIndex > batchCompletedCount
  const batchQueuePosition = isQueuedInBatch ? batchQueueIndex - batchCompletedCount : 0

  function handleCopyReportUrl() {
    if (!selectedReportUrl) return
    navigator.clipboard.writeText(selectedReportUrl)
    setCopiedReportUrl(true)
    setTimeout(() => setCopiedReportUrl(false), 2000)
  }

  const availableTracks = Array.from(
    new Set(Object.values(screeningResults).map((s) => s.evaluation_track).filter(Boolean))
  ) as string[]

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  const { query: searchQuery, setQuery: setSearchQuery, results: searchedApplications } = useDashboardSearch(
    applications,
    (app) => [app.name, app.email, app.role_title]
  )

  // Filtering only — deliberately does NOT sort. List view renders this
  // directly so newly submitted (unscreened) applications stay in the
  // server's natural newest-first order instead of being pushed to the
  // bottom by a screened_at sort they don't have a value for yet.
  const filteredApplications = searchedApplications.filter((app) => {
    // Archived is a closed-out, out-of-pipeline state — hidden from every
    // other view (including "All") so it doesn't clutter active work, and
    // only ever visible in its own dedicated tab.
    if (statusTab === 'archived') {
      if (!(app as any).archived) return false
    } else if ((app as any).archived) {
      return false
    } else if (statusTab === 'rebuttal') {
      if (!rebuttalStatuses[app.id]?.rebuttalSubmitted) return false
    } else if (statusTab === 'human-reviewed') {
      if (!(app as any).last_reviewed_by_email) return false
    } else if (statusTab === 'track-review') {
      if (!(app as any).needs_track_assignment) return false
    } else if (statusTab !== 'all') {
      if (app.status !== statusTab) return false
    }
    const screening = screeningResults[app.id]
    if (minScoreFilter.trim()) {
      const min = Number(minScoreFilter)
      if (!screening || screening.composite_score < min) return false
    }
    if (trackFilter.length > 0) {
      if (!screening || !trackFilter.includes(screening.evaluation_track)) return false
    }
    if (recFilter.length > 0) {
      if (!recFilter.includes(app.status)) return false
    }
    return true
  })

  // Table view only — explicit column-header sorting on top of the same
  // filtered set.
  const tableRows = [...filteredApplications].sort((a, b) => {
    const sa = screeningResults[a.id]
    const sb = screeningResults[b.id]
    let av: string | number = ''
    let bv: string | number = ''
    switch (sortField) {
      case 'name':             av = a.name; bv = b.name; break
      case 'role':             av = a.role_title ?? ''; bv = b.role_title ?? ''; break
      case 'evaluation_track': av = sa?.evaluation_track ?? ''; bv = sb?.evaluation_track ?? ''; break
      case 'composite_score':  av = sa?.composite_score ?? -1; bv = sb?.composite_score ?? -1; break
      case 'consensus_tier':   av = sa?.consensus_tier ?? ''; bv = sb?.consensus_tier ?? ''; break
      case 'recommendation':   av = sa?.recommendation ?? ''; bv = sb?.recommendation ?? ''; break
      case 'rebuttal':         av = rebuttalStatuses[a.id]?.rebuttalSubmitted ? 1 : 0; bv = rebuttalStatuses[b.id]?.rebuttalSubmitted ? 1 : 0; break
      case 'screened_at':      av = sa?.screened_at ?? ''; bv = sb?.screened_at ?? ''; break
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  // Reset scroll position when filters/search change — otherwise newly
  // included rows can land above or below the current scroll position,
  // making a "Clear filters" click look like it did nothing.
  useEffect(() => {
    listScrollRef.current?.scrollTo({ top: 0 })
  }, [statusTab, trackFilter, recFilter, minScoreFilter, searchQuery])

  function toggleTrackFilter(track: string) {
    setTrackFilter((prev) => prev.includes(track) ? prev.filter((t) => t !== track) : [...prev, track])
  }

  function toggleRecFilter(status: Application['status']) {
    setRecFilter((prev) => prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status])
  }

  function selectApp(app: Application) {
    if (selectMode) {
      toggleSelectedId(app.id)
      return
    }
    setSelected(app)
    setConfirmDelete(false)
    setArchiveReasonBox(false)
    setArchiveReason('')
    setArchiveError(null)
    setEmailOpen(false)
    setEmailResult(null)
    setEmailAttachFiles([])
    setPerCandidateEmailResult(null)

    // The initial page load intentionally excludes full_result (the full
    // evaluation dossier) from every row to keep that query cheap — it's
    // only ever needed for whichever one candidate is currently open. Fetch
    // it now if this candidate has a screening result but we don't have its
    // full_result yet.
    const existing = screeningResults[app.id]
    if (existing && !existing.full_result) {
      setLoadingScreeningDetail(app.id)
      getScreeningResultsForApplications([app.id]).then((records) => {
        if (records[app.id]) {
          setScreeningResults((prev) => ({ ...prev, [app.id]: records[app.id] }))
        }
        setLoadingScreeningDetail((current) => (current === app.id ? null : current))
      })
    }
  }

  // Refreshes one candidate's row in screeningResults from the database -
  // shared by anything that can change a candidate's score/tier out from
  // under the list (rebuttal resolution, a Co-Pilot chat delta) so the
  // list's badge doesn't keep showing whatever it last loaded.
  function refreshScreeningResult(id: string) {
    getScreeningResultsForApplications([id]).then((records) => {
      if (records[id]) {
        setScreeningResults((prev) => ({ ...prev, [id]: records[id] }))
      }
    })
  }

  function toggleSelectedId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectMode() {
    setSelectMode((prev) => {
      if (prev) setSelectedIds(new Set())
      return !prev
    })
  }

  return (
    <>
      <style>{`
        .apps-layout { display: grid; grid-template-columns: 1fr 480px; gap: 24px; align-items: start; }
        .apps-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); position: sticky; top: 24px; max-height: calc(100vh - 48px); display: flex; flex-direction: column; overflow: hidden; }
        .apps-list-scroll { flex: 1; overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none; }
        .apps-list-scroll::-webkit-scrollbar { display: none; }
        .apps-count-row { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .apps-count-item { flex: 1; padding: 12px 8px; text-align: center; border-right: 1px solid rgba(255,255,255,0.04); }
        .apps-count-item:last-child { border-right: none; }
        .apps-count-num { font-family: var(--font-exo2); font-weight: 800; font-size: 20px; color: var(--white); line-height: 1; }
        .apps-count-label { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-mid); margin-top: 4px; }
        
        .ai-banner-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; background: rgba(219,103,39,0.04); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .ai-banner-text { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--orange); display: flex; align-items: center; gap: 8px; white-space: nowrap; }
        .ai-btn-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
        .ai-btn { padding: 8px 14px; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.15s ease; white-space: nowrap; }
        .ai-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ai-btn-primary { border: 1px solid var(--orange); background: var(--orange); color: var(--white); }
        .ai-btn-primary:hover:not(:disabled) { background: #C4521A; border-color: #C4521A; }
        .ai-btn-secondary { border: 1px solid rgba(219,103,39,0.4); background: none; color: var(--orange); }
        .ai-btn-secondary:hover:not(:disabled) { background: rgba(219,103,39,0.08); }
        .ai-btn-toggle { border: 1px solid rgba(255,255,255,0.15); background: none; color: var(--grey-mid); }
        .ai-btn-toggle:hover:not(:disabled) { color: var(--white); border-color: rgba(255,255,255,0.3); }
        .ai-btn-toggle.active { border-color: var(--orange); background: rgba(219,103,39,0.12); color: var(--orange); }
        .ai-status-ok { font-family: var(--font-mono); font-size: 8px; color: var(--success); letter-spacing: 0.1em; white-space: nowrap; }
        .ai-progress-wrap { padding: 0 16px 12px; background: rgba(219,103,39,0.04); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .ai-progress-track { width: 100%; height: 4px; background: rgba(255,255,255,0.08); overflow: hidden; }
        .ai-progress-fill { height: 100%; background: var(--orange); transition: width 0.4s ease; }
        .ai-progress-label { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.08em; color: var(--grey-mid); margin-top: 6px; }

        .app-row { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: background 0.15s ease; }
        .app-row:last-child { border-bottom: none; }
        .app-row:hover { background: rgba(255,255,255,0.03); }
        .app-row.selected { background: rgba(219,103,39,0.06); border-left: 2px solid var(--orange); }
        .app-row-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
        .app-name { font-size: 14px; color: var(--white); font-weight: 500; }
        .app-role { font-size: 11px; color: var(--grey-mid); margin-bottom: 4px; }
        .app-date { font-size: 10px; color: var(--grey-mid); font-family: var(--font-mono); }
        .dash-badge { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; display: inline-block; white-space: nowrap; }
        .ai-score-badge { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; display: inline-block; white-space: nowrap; margin-left: 6px; }

        .detail-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); position: sticky; top: 24px; max-height: calc(100vh - 48px); overflow-y: auto; }
        .detail-header { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .detail-name { font-family: var(--font-exo2); font-weight: 700; font-size: 18px; color: var(--white); letter-spacing: -0.3px; margin-bottom: 4px; }
        .detail-email { font-size: 13px; color: var(--orange); }
        .reviewed-chip { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 8px; background: rgba(34,193,122,0.1); border: 1px solid rgba(34,193,122,0.3); color: var(--success); }
        .reviewed-first-note { display: block; margin-top: 4px; font-size: 10.5px; color: var(--grey-mid); }
        .mark-reviewed-btn { margin-top: 8px; padding: 6px 12px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(34,193,122,0.35); background: rgba(34,193,122,0.06); color: var(--success); transition: all 0.15s ease; }
        .mark-reviewed-btn:hover:not(:disabled) { background: rgba(34,193,122,0.15); }
        .mark-reviewed-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .track-review-banner { margin: 0 20px; padding: 14px 16px; background: rgba(212,168,67,0.08); border: 1px solid rgba(212,168,67,0.3); }
        .track-review-banner-title { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--warning); margin-bottom: 6px; }
        .track-review-banner-text { font-size: 12.5px; color: var(--grey-mid); line-height: 1.6; margin-bottom: 12px; }
        .track-review-banner-row { display: flex; gap: 8px; }
        .detail-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        .detail-section-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); margin-bottom: 8px; }
        .detail-text { font-size: 13px; color: var(--off-white); line-height: 1.7; }
        .detail-status-row { display: flex; flex-direction: column; gap: 6px; }
        .status-select-btn { padding: 9px 14px; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: none; color: var(--grey-mid); transition: all 0.15s ease; text-align: left; display: flex; align-items: center; justify-content: space-between; }
        .status-select-btn:hover { color: var(--white); border-color: rgba(255,255,255,0.2); }
        .status-select-btn.active { border-color: var(--orange); color: var(--white); background: rgba(219,103,39,0.08); }
        .status-select-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .detail-empty { padding: 48px 24px; text-align: center; font-size: 13px; color: var(--grey-mid); }
        .apps-empty-state { padding: 64px 32px; text-align: center; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .apps-empty-title { font-family: var(--font-exo2); font-weight: 700; font-size: 20px; color: var(--white); margin-bottom: 8px; }
        .apps-empty-desc { font-size: 14px; color: var(--grey-mid); }

        /* AI Scorecard Styles */
        .ai-box { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); padding: 16px; display: flex; flex-direction: column; gap: 14px; }
        .ai-box-header { display: flex; align-items: center; justify-content: space-between; }
        .ai-box-title { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.15em; text-transform: uppercase; color: #22c17a; display: flex; align-items: center; gap: 6px; }
        .ai-score-bar-bg { width: 100%; height: 6px; background: rgba(255,255,255,0.06); overflow: hidden; margin: 6px 0; }
        .ai-score-bar-fill { height: 100%; transition: width 0.4s ease; }
        .ai-quote-box { padding: 12px 14px; background: rgba(255,255,255,0.02); border-left: 2px solid #22c17a; font-size: 12.5px; color: var(--off-white); line-height: 1.6; }
        .rubric-row { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px; }
        .rubric-label { color: var(--grey-mid); }
        .rubric-val { font-family: var(--font-mono); font-size: 10.5px; color: var(--white); }
        .q-card { padding: 10px 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); }

        @keyframes screening-step-fade { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }
        .screening-step-text { animation: screening-step-fade 0.35s ease; }

        .track-badge { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 9px; display: inline-block; background: rgba(74,111,165,0.1); color: var(--slate); border: 1px solid rgba(74,111,165,0.3); }
        .rescan-btn { padding: 5px 10px; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); background: none; color: var(--grey-mid); transition: all 0.15s ease; }
        .rescan-btn:hover:not(:disabled) { color: var(--white); border-color: rgba(255,255,255,0.25); }
        .rescan-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .layer2-box { display: flex; flex-direction: column; gap: 10px; padding: 12px; background: rgba(74,111,165,0.03); border: 1px solid rgba(74,111,165,0.15); }
        .layer2-header { display: flex; align-items: center; justify-content: space-between; }
        .layer2-title { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--slate); }
        .layer2-status { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 8px; }
        .artifact-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 11.5px; }
        .artifact-row:last-child { border-bottom: none; }
        .artifact-label { color: var(--grey-mid); flex-shrink: 0; }
        .artifact-val { color: var(--off-white); text-align: right; }
        .artifact-val.ok { color: #22c17a; }
        .artifact-val.bad { color: var(--error); }

        .report-link-box { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); }
        .report-link-url { flex: 1; font-family: var(--font-mono); font-size: 11px; color: var(--off-white); word-break: break-all; }
        .report-copy-btn { padding: 6px 10px; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(219,103,39,0.3); background: rgba(219,103,39,0.08); color: var(--orange); flex-shrink: 0; transition: all 0.15s ease; }
        .report-copy-btn:hover { background: var(--orange); color: var(--white); }

        .rebuttal-indicator { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; padding: 6px 10px; display: inline-block; }
        .rebuttal-indicator.pending { background: rgba(219,103,39,0.12); color: var(--orange); border: 1px solid rgba(219,103,39,0.35); }
        .rebuttal-indicator.locked { background: rgba(255,255,255,0.03); color: var(--grey-mid); border: 1px solid rgba(255,255,255,0.1); }
        .rebuttal-indicator.none { background: rgba(255,255,255,0.02); color: var(--grey-mid); border: 1px solid rgba(255,255,255,0.06); }

        .view-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .view-toggle { display: flex; gap: 0; border: 1px solid rgba(255,255,255,0.1); }
        .view-toggle-btn { padding: 6px 14px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border: none; background: none; color: var(--grey-mid); transition: all 0.15s ease; }
        .view-toggle-btn.active { background: rgba(219,103,39,0.12); color: var(--orange); }
        .view-toggle-btn + .view-toggle-btn { border-left: 1px solid rgba(255,255,255,0.1); }

        .table-filters { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.01); }
        .table-filter-group { display: flex; align-items: center; gap: 6px; }
        .table-filter-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--grey-mid); }
        .table-filter-input { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-mono); font-size: 11px; padding: 5px 8px; outline: none; width: 70px; }
        .table-filter-chip { font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 9px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: none; color: var(--grey-mid); transition: all 0.15s ease; }
        .table-filter-chip.active { border-color: var(--orange); color: var(--orange); background: rgba(219,103,39,0.08); }

        .filter-dropdown-trigger { display: inline-flex; align-items: center; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 12px; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); background: var(--navy-mid); color: var(--white); transition: all 0.15s ease; }
        .filter-dropdown-trigger:hover { border-color: rgba(255,255,255,0.25); }
        .filter-dropdown-backdrop { position: fixed; inset: 0; z-index: 49; }
        .filter-dropdown-menu { position: absolute; top: calc(100% + 4px); left: 0; z-index: 50; min-width: 220px; max-height: 260px; overflow-y: auto; background: var(--navy); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 8px 24px rgba(0,0,0,0.4); padding: 6px; display: flex; flex-direction: column; }
        .filter-dropdown-item { display: flex; align-items: center; gap: 8px; padding: 7px 8px; font-size: 12px; color: var(--off-white); cursor: pointer; transition: background 0.15s ease; }
        .filter-dropdown-item:hover { background: rgba(255,255,255,0.04); }
        .filter-dropdown-item input { accent-color: var(--orange); cursor: pointer; }
        .filter-dropdown-clear { align-self: flex-end; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--orange); background: none; border: none; cursor: pointer; padding: 4px 8px; }

        .apps-table-wrap { overflow-x: auto; }
        .apps-table { width: 100%; border-collapse: collapse; }
        .apps-table th { text-align: left; padding: 10px 14px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--grey-mid); border-bottom: 1px solid rgba(255,255,255,0.08); cursor: pointer; white-space: nowrap; user-select: none; }
        .apps-table th:hover { color: var(--white); }
        .apps-table td { padding: 11px 14px; font-size: 12.5px; color: var(--off-white); border-bottom: 1px solid rgba(255,255,255,0.04); white-space: nowrap; }
        .apps-table tr.table-row { cursor: pointer; transition: background 0.15s ease; }
        .apps-table tr.table-row:hover { background: rgba(255,255,255,0.03); }
        .apps-table tr.table-row.selected { background: rgba(219,103,39,0.06); }
        .table-empty { padding: 48px 24px; text-align: center; font-size: 13px; color: var(--grey-mid); }

        @media (max-width: 1200px) { .apps-layout { grid-template-columns: 1fr; } .detail-panel { position: static; max-height: none; } .apps-panel { position: static; max-height: none; } .apps-list-scroll { overflow-y: visible; } }
      `}</style>

      {applications.length === 0 ? (
        <div className="apps-empty-state">
          <div className="apps-empty-title">No applications yet.</div>
          <div className="apps-empty-desc">Applications submitted through the careers page will appear here.</div>
        </div>
      ) : (
        <div className="apps-layout">
          <div className="apps-panel">
            <div className="apps-count-row">
              {STATUS_OPTIONS.map((s) => {
                const ss = STATUS_STYLES[s]
                return (
                  <div key={s} className="apps-count-item">
                    <div className="apps-count-num" style={{ color: ss.color }}>{counts[s]}</div>
                    <div className="apps-count-label">{s}</div>
                  </div>
                )
              })}
            </div>

            <div className="ai-banner-bar">
              <div className="ai-banner-text">
                <span>⚡ AI Screening Engine</span>
                {batchScreening && batchProgress && (
                  <span style={{ color: 'var(--white)', fontSize: '9px' }}>
                    ({batchProgress.current}/{batchProgress.total} evaluated)
                  </span>
                )}
              </div>
              <div className="ai-btn-row">
                {unscannedCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleBatchScreen}
                    disabled={batchScreening}
                    className="ai-btn ai-btn-primary"
                  >
                    {batchScreening ? 'Screening in progress...' : `⚡ Auto-Screen All (${unscannedCount})`}
                  </button>
                ) : (
                  <span className="ai-status-ok">✓ All Screened</span>
                )}
                {pendingEmailCount > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkEmail}
                    disabled={bulkEmailSending}
                    className="ai-btn ai-btn-secondary"
                  >
                    {bulkEmailSending ? 'Sending feedback emails...' : `📧 Send AI Feedback Emails (${pendingEmailCount})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleSelectMode}
                  disabled={batchScreening}
                  className={`ai-btn ai-btn-toggle ${selectMode ? 'active' : ''}`}
                >
                  {selectMode ? 'Cancel selection' : '☑ Select candidates'}
                </button>
              </div>
            </div>

            {batchScreening && batchProgress && (
              <div className="ai-progress-wrap">
                <div className="ai-progress-track">
                  <div
                    className="ai-progress-fill"
                    style={{ width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <div className="ai-progress-label">
                  <span>{batchProgress.current} of {batchProgress.total} screened</span>
                  <span>{batchProgress.total > 0 ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0}%</span>
                </div>
              </div>
            )}

            {selectMode && (
              <div className="ai-banner-bar">
                <div className="ai-banner-text">
                  <span>{selectedIds.size} candidate{selectedIds.size === 1 ? '' : 's'} selected</span>
                </div>
                <button
                  type="button"
                  onClick={handleScreenSelected}
                  disabled={selectedIds.size === 0 || batchScreening}
                  className="ai-btn ai-btn-primary"
                >
                  {batchScreening ? 'Screening in progress...' : `⚡ Screen Selected (${selectedIds.size})`}
                </button>
              </div>
            )}

            {(bulkEmailResult || bulkEmailError) && (
              <div style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)', color: bulkEmailError ? 'var(--error)' : '#22c17a' }}>
                {bulkEmailError
                  ? `Email dispatch failed: ${bulkEmailError}`
                  : `Dispatch complete: ${bulkEmailResult!.sentCount} sent, ${bulkEmailResult!.skippedCount} skipped, ${bulkEmailResult!.failedCount} failed.`}
              </div>
            )}

            {batchError && (
              <div style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--error)' }}>
                Bulk screening error: {batchError}
              </div>
            )}

            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <DashboardSearchBox
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search candidates by name, email, or role..."
                resultCount={filteredApplications.length}
              />
            </div>

            <div className="view-toggle-row">
              <div className="view-toggle">
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  List
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                >
                  Table
                </button>
              </div>
            </div>

            {viewMode === 'table' && (
              <div className="table-filters">
                <div className="table-filter-group">
                  <span className="table-filter-label">Min score</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="table-filter-input"
                    value={minScoreFilter}
                    onChange={(e) => setMinScoreFilter(e.target.value)}
                    placeholder="0"
                  />
                </div>
                {availableTracks.length > 0 && (
                  <div className="table-filter-group" style={{ position: 'relative' }}>
                    <span className="table-filter-label">Track</span>
                    <button
                      type="button"
                      className="filter-dropdown-trigger"
                      onClick={() => { setTrackDropdownOpen((v) => !v); setStatusDropdownOpen(false) }}
                    >
                      {trackFilter.length === 0 ? 'All tracks' : `${trackFilter.length} selected`}
                      <span style={{ marginLeft: '6px' }}>{trackDropdownOpen ? '▲' : '▼'}</span>
                    </button>
                    {trackDropdownOpen && (
                      <>
                        <div className="filter-dropdown-backdrop" onClick={() => setTrackDropdownOpen(false)} />
                        <div className="filter-dropdown-menu">
                          {trackFilter.length > 0 && (
                            <button type="button" className="filter-dropdown-clear" onClick={(e) => { e.stopPropagation(); setTrackFilter([]); setTrackDropdownOpen(false) }}>
                              Clear
                            </button>
                          )}
                          {availableTracks.map((track) => (
                            <label key={track} className="filter-dropdown-item">
                              <input
                                type="checkbox"
                                checked={trackFilter.includes(track)}
                                onChange={() => toggleTrackFilter(track)}
                              />
                              {track}
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="table-filter-group" style={{ position: 'relative' }}>
                  <span className="table-filter-label">Status</span>
                  <button
                    type="button"
                    className="filter-dropdown-trigger"
                    onClick={() => { setStatusDropdownOpen((v) => !v); setTrackDropdownOpen(false) }}
                  >
                    {recFilter.length === 0 ? 'All statuses' : `${recFilter.length} selected`}
                    <span style={{ marginLeft: '6px' }}>{statusDropdownOpen ? '▲' : '▼'}</span>
                  </button>
                  {statusDropdownOpen && (
                    <>
                      <div className="filter-dropdown-backdrop" onClick={() => setStatusDropdownOpen(false)} />
                      <div className="filter-dropdown-menu">
                        {recFilter.length > 0 && (
                          <button type="button" className="filter-dropdown-clear" onClick={(e) => { e.stopPropagation(); setRecFilter([]); setStatusDropdownOpen(false) }}>
                            Clear
                          </button>
                        )}
                        {STATUS_OPTIONS.map((s) => (
                          <label key={s} className="filter-dropdown-item">
                            <input
                              type="checkbox"
                              checked={recFilter.includes(s)}
                              onChange={() => toggleRecFilter(s)}
                            />
                            {s}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="apps-list-scroll" ref={listScrollRef}>
            {viewMode === 'list' && filteredApplications.length === 0 ? (
              <div className="table-empty">No applications match your filters.</div>
            ) : viewMode === 'list' ? (
              filteredApplications.map((app) => {
                const ss = STATUS_STYLES[app.status]
                const screening = screeningResults[app.id]
                const scoreConfig = screening ? getScoreColor(screening.composite_score) : null

                return (
                  <div
                    key={app.id}
                    className={`app-row ${selected?.id === app.id ? 'selected' : ''}`}
                    onClick={() => selectApp(app)}
                  >
                    <div className="app-row-top">
                      <span className="app-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {selectMode && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(app.id)}
                            onChange={() => toggleSelectedId(app.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ accentColor: '#22c17a', cursor: 'pointer' }}
                          />
                        )}
                        {app.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {(app as any).needs_track_assignment && (
                          <span
                            title="Needs a human to assign an evaluation track before screening"
                            style={{ color: 'var(--warning)', fontSize: '12px', marginRight: '6px' }}
                          >
                            ⚠
                          </span>
                        )}
                        {(app as any).last_reviewed_by_email && (
                          <span
                            title={`Reviewed by ${(app as any).last_reviewed_by_email}`}
                            style={{ color: 'var(--success)', fontSize: '12px', marginRight: '6px' }}
                          >
                            ✓
                          </span>
                        )}
                        <span className="dash-badge" style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}33` }}>
                          {app.status}
                        </span>
                        {(() => {
                          const rowQueueIndex = batchTargetIds.indexOf(app.id)
                          const rowInBatch = batchScreening && rowQueueIndex !== -1
                          const rowCurrentlyScreening = rowInBatch && rowQueueIndex === batchCompletedCount && !screening
                          const rowQueued = rowInBatch && rowQueueIndex > batchCompletedCount

                          if (rowCurrentlyScreening) {
                            return (
                              <span className="ai-score-badge" style={{ background: 'rgba(219,103,39,0.1)', color: 'var(--orange)', border: '1px solid rgba(219,103,39,0.3)' }}>
                                ⚡ Screening...
                              </span>
                            )
                          }
                          if (rowQueued) {
                            return (
                              <span className="ai-score-badge" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--grey-mid)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                ⏳ Queued
                              </span>
                            )
                          }
                          if (screening) {
                            return (
                              <span
                                className="ai-score-badge"
                                style={{
                                  background: scoreConfig?.bg,
                                  color: scoreConfig?.color,
                                  border: `1px solid ${scoreConfig?.border}`,
                                }}
                              >
                                ⚡ {screening.composite_score}%
                              </span>
                            )
                          }
                          return (
                            <span
                              className="ai-score-badge"
                              style={{
                                background: 'rgba(74,111,165,0.1)',
                                color: 'var(--slate)',
                                border: '1px solid rgba(74,111,165,0.3)',
                              }}
                            >
                              Unscreened
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="app-role">{app.role_title ?? 'Open application'}</div>
                    <div className="app-date">{new Date(app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                )
              })
            ) : (
              <div className="apps-table-wrap">
                {tableRows.length === 0 ? (
                  <div className="table-empty">No applications match the current filters.</div>
                ) : (
                  <table className="apps-table">
                    <thead>
                      <tr>
                        {selectMode && <th></th>}
                        <th onClick={() => handleSort('name')}>Candidate{sortIndicator('name')}</th>
                        <th onClick={() => handleSort('role')}>Role{sortIndicator('role')}</th>
                        <th onClick={() => handleSort('evaluation_track')}>Track{sortIndicator('evaluation_track')}</th>
                        <th onClick={() => handleSort('composite_score')}>Score{sortIndicator('composite_score')}</th>
                        <th onClick={() => handleSort('consensus_tier')}>Tier{sortIndicator('consensus_tier')}</th>
                        <th onClick={() => handleSort('recommendation')}>Status{sortIndicator('recommendation')}</th>
                        <th onClick={() => handleSort('rebuttal')}>Rebuttal{sortIndicator('rebuttal')}</th>
                        <th onClick={() => handleSort('screened_at')}>Screened{sortIndicator('screened_at')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((app) => {
                        const ss = STATUS_STYLES[app.status]
                        const screening = screeningResults[app.id]
                        const scoreConfig = screening ? getScoreColor(screening.composite_score) : null
                        const rebuttal = rebuttalStatuses[app.id]

                        return (
                          <tr
                            key={app.id}
                            className={`table-row ${selected?.id === app.id ? 'selected' : ''}`}
                            onClick={() => selectApp(app)}
                          >
                            {selectMode && (
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(app.id)}
                                  onChange={() => toggleSelectedId(app.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ accentColor: '#22c17a', cursor: 'pointer' }}
                                />
                              </td>
                            )}
                            <td>{app.name}</td>
                            <td>{app.role_title ?? 'Open application'}</td>
                            <td>{screening?.evaluation_track ?? '—'}</td>
                            <td>
                              {screening ? (
                                <span style={{ color: scoreConfig?.color, fontFamily: 'var(--font-mono)' }}>
                                  {screening.composite_score}%
                                </span>
                              ) : '—'}
                            </td>
                            <td>{screening?.consensus_tier ?? '—'}</td>
                            <td>
                              {(app as any).last_reviewed_by_email && (
                                <span
                                  title={`Reviewed by ${(app as any).last_reviewed_by_email}`}
                                  style={{ color: 'var(--success)', fontSize: '12px', marginRight: '6px' }}
                                >
                                  ✓
                                </span>
                              )}
                              <span className="dash-badge" style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}33` }}>
                                {app.status}
                              </span>
                            </td>
                            <td>
                              {rebuttal?.rebuttalLocked ? (
                                <span className="rebuttal-indicator locked">Closed</span>
                              ) : rebuttal?.rebuttalSubmitted ? (
                                <span className="rebuttal-indicator pending">Submitted</span>
                              ) : '—'}
                            </td>
                            <td>{screening ? new Date(screening.screened_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            </div>
          </div>

          <div className="detail-panel">
            {selected ? (
              <>
                <div className="detail-header">
                  <div className="detail-name">{selected.name}</div>
                  <div className="detail-email">{selected.email}</div>
                  {(selected as any).last_reviewed_by_email ? (
                    <div>
                      <span className="reviewed-chip">
                        ✓ Reviewed by {(selected as any).last_reviewed_by_email}
                      </span>
                      {(selected as any).first_reviewed_by_email &&
                        (selected as any).first_reviewed_by_email !== (selected as any).last_reviewed_by_email && (
                          <span className="reviewed-first-note">
                            First reviewed by {(selected as any).first_reviewed_by_email}
                          </span>
                        )}
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        className="mark-reviewed-btn"
                        onClick={() => handleMarkHumanReviewed(selected.id)}
                        disabled={markingReviewed}
                        title="Record that a human reviewed this application and confirmed its current status — no status change needed."
                      >
                        {markingReviewed ? 'Marking as reviewed…' : '✓ Mark as human reviewed'}
                      </button>
                      {markReviewedError && (
                        <span className="reviewed-first-note" style={{ color: 'var(--error)' }}>{markReviewedError}</span>
                      )}
                    </div>
                  )}
                </div>
                {(selected as any).needs_track_assignment && (
                  <div className="track-review-banner">
                    <div className="track-review-banner-title">⚠ Needs track assignment</div>
                    <p className="track-review-banner-text">
                      This role/title didn't confidently match any evaluation track, so screening was
                      skipped rather than guessing — pick the correct track below to run it.
                    </p>
                    <div className="track-review-banner-row">
                      <select
                        value={trackChoice}
                        onChange={(e) => setTrackChoice(e.target.value)}
                        style={{ flex: 1, background: 'var(--navy-mid)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--white)', fontFamily: 'var(--font-dm)', fontSize: '13px', padding: '9px 12px', outline: 'none' }}
                      >
                        <option value="">Select track…</option>
                        {EVALUATION_TRACK_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ai-btn ai-btn-primary"
                        disabled={!trackChoice || batchScreening}
                        onClick={() => handleAssignTrackAndScreen(selected.id, trackChoice)}
                      >
                        {batchScreening ? 'Screening…' : 'Assign & Screen'}
                      </button>
                    </div>
                  </div>
                )}
                <div className="detail-body">

                  {/* AI AGENT SCREENING SECTION */}
                  <div className="ai-box">
                    <div className="ai-box-header">
                      <div className="ai-box-title">
                        <span>⚡ AI Consensus Evaluation</span>
                        {selected && loadingScreeningDetail === selected.id && (
                          <span style={{ fontSize: '10px', color: 'var(--grey-mid)', fontWeight: 400 }}>Loading full evaluation…</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {selectedScreening && (
                          <button
                            type="button"
                            onClick={() =>
                              openCopilot({
                                domainType: 'hr_screening',
                                resourceId: selected.id,
                                reportId: selectedReportId,
                                candidateName: selected.name,
                                onDelta: () => refreshScreeningResult(selected.id),
                              })
                            }
                            className="rescan-btn"
                          >
                            💬 Ask Co-Pilot
                          </button>
                        )}
                        {selectedScreening && (
                          <button
                            type="button"
                            onClick={() => handleScreenCandidate(selected.id)}
                            disabled={batchScreening}
                            className="rescan-btn"
                          >
                            {isCurrentlyBatchScreening ? 'Rescanning...' : '🔄 Rescan'}
                          </button>
                        )}
                      </div>
                    </div>

                    {batchError && (
                      <div style={{ padding: '8px 12px', background: 'rgba(232,69,69,0.1)', border: '1px solid rgba(232,69,69,0.3)', color: 'var(--error)', fontSize: '11px' }}>
                        {batchError}
                      </div>
                    )}

                    {isQueuedInBatch ? (
                      <div style={{ padding: '24px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '13px', color: 'var(--orange)', fontWeight: 600 }}>
                          ⏳ Queued for screening
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--grey-mid)' }}>
                          Position {batchQueuePosition} of {batchTargetIds.length - batchCompletedCount} remaining in this batch
                        </div>
                      </div>
                    ) : isCurrentlyBatchScreening ? (
                      <div style={{ padding: '24px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '13px', color: '#22c17a', fontWeight: 600 }}>
                          Evaluating candidate...
                        </div>
                        <div
                          key={screeningStep}
                          className="screening-step-text"
                          style={{ fontSize: '11px', color: 'var(--grey-mid)' }}
                        >
                          {SCREENING_STEPS[screeningStep]}
                        </div>
                      </div>
                    ) : selectedScreening && selectedConsensus ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* Score Bar & Tier */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                              <span style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-exo2)', color: getScoreColor(selectedScreening.composite_score).color }}>
                                {selectedScreening.composite_score}%
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--grey-mid)' }}>Match Score</span>
                            </div>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '8px',
                                textTransform: 'uppercase',
                                padding: '3px 8px',
                                background: getScoreColor(selectedScreening.composite_score).bg,
                                color: getScoreColor(selectedScreening.composite_score).color,
                                border: `1px solid ${getScoreColor(selectedScreening.composite_score).border}`,
                              }}
                            >
                              {selectedScreening.recommendation}
                            </span>
                          </div>

                          <div className="ai-score-bar-bg">
                            <div
                              className="ai-score-bar-fill"
                              style={{
                                width: `${selectedScreening.composite_score}%`,
                                background: getScoreColor(selectedScreening.composite_score).color,
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--grey-mid)' }}>
                              Tier: <strong style={{ color: 'var(--white)' }}>{selectedScreening.consensus_tier}</strong>
                            </div>
                            {selectedScreening.evaluation_track && (
                              <span className="track-badge">{selectedScreening.evaluation_track}</span>
                            )}
                            {selectedRebuttal?.rebuttalLocked ? (
                              <span className="rebuttal-indicator locked">Rebuttal closed</span>
                            ) : selectedRebuttal?.rebuttalSubmitted ? (
                              <span className="rebuttal-indicator pending">⚠ Rebuttal submitted</span>
                            ) : selectedRebuttal ? (
                              <span className="rebuttal-indicator none">No rebuttal submitted</span>
                            ) : null}
                          </div>
                        </div>

                        {selectedRebuttal?.rebuttalSubmitted && selectedReportId && selected && (
                          <RebuttalPanel
                            reportId={selectedReportId}
                            applicationId={selected.id}
                            candidateName={selected.name}
                            onResolved={() => refreshScreeningResult(selected.id)}
                            onReviewed={(reviewed) => applyReviewedInfo(selected.id, reviewed)}
                          />
                        )}

                        {/* Public feedback report link */}
                        {selectedReportUrl && (
                          <div>
                            <div className="detail-section-title">Public feedback report</div>
                            <div className="report-link-box">
                              <span className="report-link-url">{selectedReportUrl}</span>
                              <button type="button" className="report-copy-btn" onClick={handleCopyReportUrl}>
                                {copiedReportUrl ? '✓ Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Executive Summary */}
                        {selectedConsensus.recruiterConsensusSummary && (
                          <div className="ai-quote-box">
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', textTransform: 'uppercase', color: '#22c17a', marginBottom: '4px', letterSpacing: '0.1em' }}>
                              Recruiter Briefing
                            </div>
                            {asDisplayText(selectedConsensus.recruiterConsensusSummary)}
                          </div>
                        )}

                        {/* Rubric Breakdown */}
                        {selectedConsensus.layer1ResumeScorecard?.rubricBreakdown && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', textTransform: 'uppercase', color: 'var(--grey-mid)', marginBottom: '4px', letterSpacing: '0.1em' }}>
                              Rubric Assessment Matrix
                            </div>
                            {Object.entries(selectedConsensus.layer1ResumeScorecard.rubricBreakdown).map(([key, item]: [string, any]) => (
                              <div key={key}>
                                <div className="rubric-row">
                                  <span className="rubric-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}</span>
                                  <span className="rubric-val">{item.score}/{item.weight}</span>
                                </div>
                                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                                  <div style={{ width: `${(item.score / item.weight) * 100}%`, height: '100%', background: '#22c17a' }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Core Strengths & Red Flags */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                          {Array.isArray(selectedConsensus.layer1ResumeScorecard?.coreStrengths) && selectedConsensus.layer1ResumeScorecard.coreStrengths.length > 0 && (
                            <div style={{ padding: '10px 12px', background: 'rgba(34,193,122,0.04)', border: '1px solid rgba(34,193,122,0.15)' }}>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', textTransform: 'uppercase', color: '#22c17a', marginBottom: '6px', letterSpacing: '0.1em' }}>
                                ✓ Verified Strengths
                              </div>
                              <ul style={{ margin: 0, paddingLeft: '14px', fontSize: '11.5px', color: 'var(--off-white)', lineHeight: '1.6' }}>
                                {selectedConsensus.layer1ResumeScorecard.coreStrengths.map((s: string, idx: number) => (
                                  <li key={idx}>{asDisplayText(s)}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {Array.isArray(selectedConsensus.layer1ResumeScorecard?.gapsAndRedFlags) && selectedConsensus.layer1ResumeScorecard.gapsAndRedFlags.length > 0 && (
                            <div style={{ padding: '10px 12px', background: 'rgba(232,69,69,0.04)', border: '1px solid rgba(232,69,69,0.2)' }}>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', textTransform: 'uppercase', color: 'var(--error)', marginBottom: '6px', letterSpacing: '0.1em' }}>
                                ⚠ Gaps / Considerations
                              </div>
                              <ul style={{ margin: 0, paddingLeft: '14px', fontSize: '11.5px', color: 'var(--off-white)', lineHeight: '1.6' }}>
                                {selectedConsensus.layer1ResumeScorecard.gapsAndRedFlags.map((g: string, idx: number) => (
                                  <li key={idx}>{asDisplayText(g)}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Layer 2: Live Artifact Verification */}
                        {selectedLayer2 && (
                          <div className="layer2-box">
                            <div className="layer2-header">
                              <span className="layer2-title">🔍 Layer 2 — Artifact Verification</span>
                              <span
                                className="layer2-status"
                                style={{
                                  background: getScoreColor(selectedLayer2.artifactVerificationScore).bg,
                                  color: getScoreColor(selectedLayer2.artifactVerificationScore).color,
                                  border: `1px solid ${getScoreColor(selectedLayer2.artifactVerificationScore).border}`,
                                }}
                              >
                                {selectedLayer2.artifactVerificationScore}% · {selectedLayer2.verificationStatus}
                              </span>
                            </div>

                            {selectedLayer2.reputationSummary && (
                              <div style={{ fontSize: '11.5px', color: 'var(--off-white)', lineHeight: '1.6' }}>
                                {asDisplayText(selectedLayer2.reputationSummary)}
                              </div>
                            )}

                            {selectedLayer2.rubricBreakdown && Object.keys(selectedLayer2.rubricBreakdown).length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {Object.entries(selectedLayer2.rubricBreakdown).map(([key, item]: [string, any]) => (
                                  <div key={key}>
                                    <div className="rubric-row">
                                      <span className="rubric-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}</span>
                                      <span className="rubric-val">{item.score}/{item.weight}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                                      <div style={{ width: `${(item.score / item.weight) * 100}%`, height: '100%', background: 'var(--slate)' }} />
                                    </div>
                                    {item.reasoning && (
                                      <div style={{ fontSize: '10.5px', color: 'var(--grey-mid)', marginTop: '2px' }}>{item.reasoning}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {Array.isArray(selectedLayer2.verifiedStrengths) && selectedLayer2.verifiedStrengths.length > 0 && (
                              <div style={{ padding: '10px 12px', background: 'rgba(34,193,122,0.04)', border: '1px solid rgba(34,193,122,0.15)' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', textTransform: 'uppercase', color: '#22c17a', marginBottom: '6px', letterSpacing: '0.1em' }}>
                                  ✓ Verified Public Artifacts
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '14px', fontSize: '11.5px', color: 'var(--off-white)', lineHeight: '1.6' }}>
                                  {selectedLayer2.verifiedStrengths.map((s: string, idx: number) => (
                                  <li key={idx}>{asDisplayText(s)}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {Array.isArray(selectedLayer2.artifactGapsAndRisks) && selectedLayer2.artifactGapsAndRisks.length > 0 && (
                              <div style={{ padding: '10px 12px', background: 'rgba(232,69,69,0.04)', border: '1px solid rgba(232,69,69,0.2)' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', textTransform: 'uppercase', color: 'var(--error)', marginBottom: '6px', letterSpacing: '0.1em' }}>
                                  ⚠ Artifact Gaps / Risks
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '14px', fontSize: '11.5px', color: 'var(--off-white)', lineHeight: '1.6' }}>
                                  {selectedLayer2.artifactGapsAndRisks.map((g: string, idx: number) => (
                                  <li key={idx}>{asDisplayText(g)}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {selectedArtifacts && (
                              <div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', textTransform: 'uppercase', color: 'var(--grey-mid)', marginBottom: '4px', letterSpacing: '0.1em' }}>
                                  Inspected Artifacts
                                </div>
                                <div>
                                  {selectedArtifacts.github && (
                                    <div className="artifact-row">
                                      <span className="artifact-label">GitHub — {selectedArtifacts.github.username}</span>
                                      <span className={`artifact-val ${selectedArtifacts.github.profileFound ? 'ok' : 'bad'}`}>
                                        {selectedArtifacts.github.profileFound
                                          ? `${selectedArtifacts.github.publicRepoCount} repos · ${selectedArtifacts.github.followersCount} followers`
                                          : 'Profile not found'}
                                      </span>
                                    </div>
                                  )}
                                  {selectedArtifacts.portfolioCheck && (
                                    <div className="artifact-row">
                                      <span className="artifact-label">Portfolio</span>
                                      <span className={`artifact-val ${selectedArtifacts.portfolioCheck.accessible ? 'ok' : 'bad'}`}>
                                        {selectedArtifacts.portfolioCheck.accessible ? `Reachable (${selectedArtifacts.portfolioCheck.statusCode ?? 'OK'})` : asDisplayText(selectedArtifacts.portfolioCheck.note || selectedArtifacts.portfolioCheck.error || 'Unreachable')}
                                      </span>
                                    </div>
                                  )}
                                  {selectedArtifacts.linkedinCheck && (
                                    <div className="artifact-row">
                                      <span className="artifact-label">LinkedIn</span>
                                      <span className={`artifact-val ${selectedArtifacts.linkedinCheck.accessible ? 'ok' : 'bad'}`}>
                                        {selectedArtifacts.linkedinCheck.accessible ? 'Reachable' : asDisplayText(selectedArtifacts.linkedinCheck.note || selectedArtifacts.linkedinCheck.error || 'Unreachable')}
                                      </span>
                                    </div>
                                  )}
                                  {selectedArtifacts.designCheck && (
                                    <div className="artifact-row">
                                      <span className="artifact-label">Design portfolio</span>
                                      <span className={`artifact-val ${selectedArtifacts.designCheck.accessible ? 'ok' : 'bad'}`}>
                                        {selectedArtifacts.designCheck.accessible ? 'Reachable' : asDisplayText(selectedArtifacts.designCheck.note || selectedArtifacts.designCheck.error || 'Unreachable')}
                                      </span>
                                    </div>
                                  )}
                                  {selectedArtifacts.publishedWorkCheck && (
                                    <div className="artifact-row">
                                      <span className="artifact-label">Published work</span>
                                      <span className={`artifact-val ${selectedArtifacts.publishedWorkCheck.accessible ? 'ok' : 'bad'}`}>
                                        {selectedArtifacts.publishedWorkCheck.accessible ? 'Reachable' : asDisplayText(selectedArtifacts.publishedWorkCheck.note || selectedArtifacts.publishedWorkCheck.error || 'Unreachable')}
                                      </span>
                                    </div>
                                  )}
                                  {selectedArtifacts.blogCheck && (
                                    <div className="artifact-row">
                                      <span className="artifact-label">Blog</span>
                                      <span className={`artifact-val ${selectedArtifacts.blogCheck.accessible ? 'ok' : 'bad'}`}>
                                        {selectedArtifacts.blogCheck.accessible ? 'Reachable' : asDisplayText(selectedArtifacts.blogCheck.note || selectedArtifacts.blogCheck.error || 'Unreachable')}
                                      </span>
                                    </div>
                                  )}
                                  {Array.isArray(selectedArtifacts.otherLinks) && selectedArtifacts.otherLinks.map((link: any, i: number) => (
                                    <div className="artifact-row" key={i}>
                                      <span className="artifact-label">{asDisplayText(link.url)}</span>
                                      <span className={`artifact-val ${link.accessible ? 'ok' : 'bad'}`}>
                                        {link.accessible ? 'Reachable' : asDisplayText(link.note || link.error || 'Unreachable')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tailored Interview Questions */}
                        {Array.isArray(selectedConsensus.combinedInterviewQuestions) && selectedConsensus.combinedInterviewQuestions.length > 0 && (
                          <div>
                            <button
                              type="button"
                              onClick={() => setShowQuestions(!showQuestions)}
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: 'var(--white)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '8px',
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>Tailored Interview Questions ({selectedConsensus.combinedInterviewQuestions.length})</span>
                              <span>{showQuestions ? '▲ Hide' : '▼ View'}</span>
                            </button>

                            {showQuestions && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                {selectedConsensus.combinedInterviewQuestions.map((q: any, qIdx: number) => (
                                  <div key={qIdx} className="q-card">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', color: 'var(--orange)' }}>
                                        {asDisplayText(q.category)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyQuestion(q.question, qIdx)}
                                        style={{ background: 'none', border: 'none', color: copiedQuestion === qIdx ? '#22c17a' : 'var(--grey-mid)', fontSize: '10px', cursor: 'pointer' }}
                                      >
                                        {copiedQuestion === qIdx ? '✓ Copied' : 'Copy'}
                                      </button>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--white)', marginBottom: '4px' }}>
                                      {asDisplayText(q.question)}
                                    </div>
                                    {q.idealAnswerCriteria && (
                                      <div style={{ fontSize: '10.5px', color: 'var(--slate)', fontStyle: 'italic' }}>
                                        Criteria: {asDisplayText(q.idealAnswerCriteria)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Quick AI Action: Load AI Feedback into Email */}
                        {selectedConsensus.applicantFeedbackLetter && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => handleSendFeedbackToSelected(selected.id)}
                                disabled={perCandidateEmailSending}
                                className="ai-btn ai-btn-primary"
                                style={{ flex: 1 }}
                              >
                                {perCandidateEmailSending ? 'Sending...' : '📧 Send AI Feedback Email'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLoadFeedbackToEmail()}
                                disabled={loadingComposer}
                                className="ai-btn ai-btn-secondary"
                                style={{ flex: 1 }}
                              >
                                {loadingComposer ? 'Loading...' : '📋 Load into Composer'}
                              </button>
                            </div>
                            {perCandidateEmailResult && (
                              <div style={{ fontSize: '11px', color: perCandidateEmailResult.startsWith('Failed') ? 'var(--error)' : 'var(--success)' }}>
                                {perCandidateEmailResult}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--grey-mid)', lineHeight: '1.5' }}>
                          This applicant has not been screened yet. Run automated dual-layer evaluation to generate scorecards, rubric matrices, and tailored interview questions.
                        </div>
                        <button
                          type="button"
                          onClick={() => handleScreenCandidate(selected.id)}
                          disabled={batchScreening}
                          className="ai-btn ai-btn-primary"
                        >
                          ⚡ Run AI Consensus Screening
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="detail-section-title">Applied for</div>
                    <div className="detail-text">{selected.role_title ?? 'Open application'}</div>
                  </div>

                  {((selected as any).phone || (selected as any).location) && (
                    <div>
                      <div className="detail-section-title">Contact</div>
                      {(selected as any).phone && <div className="detail-text">{(selected as any).phone}</div>}
                      {(selected as any).location && <div className="detail-text" style={{ color: 'var(--grey-mid)', fontSize: '12px' }}>{(selected as any).location}</div>}
                    </div>
                  )}

                  {((selected as any).linkedin_url || (selected as any).portfolio_url || (selected as any).github_url || (selected as any).design_url || (selected as any).published_work_url) && (
                    <div>
                      <div className="detail-section-title">Links</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(selected as any).linkedin_url && (
                          <a href={normalizeUrl((selected as any).linkedin_url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--orange)' }}>LinkedIn ↗</a>
                        )}
                        {(selected as any).portfolio_url && (
                          <a href={normalizeUrl((selected as any).portfolio_url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--orange)' }}>Portfolio ↗</a>
                        )}
                        {(selected as any).github_url && (
                          <a href={normalizeUrl((selected as any).github_url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--orange)' }}>GitHub ↗</a>
                        )}
                        {(selected as any).design_url && (
                          <a href={normalizeUrl((selected as any).design_url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--orange)' }}>Design portfolio ↗</a>
                        )}
                        {(selected as any).published_work_url && (
                          <a href={normalizeUrl((selected as any).published_work_url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--orange)' }}>Published work ↗</a>
                        )}
                      </div>
                    </div>
                  )}

                  {(selected as any).project_links && Array.isArray((selected as any).project_links) && (selected as any).project_links.length > 0 && (
                    <div>
                      <div className="detail-section-title">Project links</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {((selected as any).project_links as { url: string; description: string }[]).map((link, i) => (
                          <div key={i} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <a href={normalizeUrl(link.url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--orange)', display: 'block', marginBottom: '4px' }}>{link.url} ↗</a>
                            {link.description && <div style={{ fontSize: '12px', color: 'var(--grey-mid)' }}>{link.description}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(selected as any).currently_building && (
                    <div>
                      <div className="detail-section-title">Currently building</div>
                      <div className="detail-text">{(selected as any).currently_building}</div>
                    </div>
                  )}

                  {selected.cover_note && (
                    <div>
                      <div className="detail-section-title">Cover note</div>
                      <div className="detail-text">{selected.cover_note}</div>
                    </div>
                  )}

                  {selected.cv_url && (
                    <div>
                      <div className="detail-section-title">CV / Resume</div>
                      <a
                        href={`/api/cv-download?path=${encodeURIComponent(selected.cv_url)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '13px', color: 'var(--orange)', textDecoration: 'underline' }}
                      >
                        Download CV ↗
                      </a>
                    </div>
                  )}

                  <div>
                    <div className="detail-section-title">Update status</div>
                    <div className="detail-status-row">
                      {STATUS_OPTIONS.map((s) => {
                        const ss = STATUS_STYLES[s]
                        return (
                          <button key={s} type="button"
                            className={`status-select-btn ${selected.status === s ? 'active' : ''}`}
                            onClick={() => updateStatus(selected.id, s)}
                            disabled={updating || selected.status === s}
                          >
                            <span>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                            {selected.status === s && <span style={{ color: ss.color }}>✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--grey-mid)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                    Received {new Date(selected.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                    {!emailOpen ? (
                      <button
                        type="button"
                        onClick={() => { setEmailOpen(true); setEmailResult(null) }}
                        style={{ width: '100%', padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', border: '1px solid rgba(219,103,39,0.3)', background: 'none', color: 'var(--orange)', transition: 'all 0.15s ease', textAlign: 'left' }}
                      >
                        Send email to applicant
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--grey-mid)' }}>
                            Email to {selected.name.split(' ')[0]}
                          </div>
                          <button
                            type="button"
                            onClick={() => { setEmailOpen(false); setEmailResult(null) }}
                            style={{ background: 'none', border: 'none', color: 'var(--grey-mid)', cursor: 'pointer', fontSize: '14px' }}
                          >
                            ✕
                          </button>
                        </div>

                        {emailResult === 'success' && (
                          <div style={{ padding: '10px 14px', fontSize: '12px', background: 'rgba(34,193,122,0.08)', border: '1px solid rgba(34,193,122,0.2)', color: 'var(--success)' }}>
                            Email sent successfully to {selected.email}
                          </div>
                        )}

                        {emailResult === 'error' && (
                          <div style={{ padding: '10px 14px', fontSize: '12px', background: 'rgba(232,69,69,0.08)', border: '1px solid rgba(232,69,69,0.3)', color: 'var(--error)' }}>
                            Failed to send. Please try again.
                          </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--grey-mid)' }}>Send as</div>
                          <select
                            value={emailSenderId}
                            onChange={(e) => setEmailSenderId(e.target.value)}
                            style={{ background: 'var(--navy-mid)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--white)', fontFamily: 'var(--font-dm)', fontSize: '13px', padding: '9px 12px', outline: 'none', width: '100%' }}
                          >
                            {senders.map((s) => (
                              <option key={s.id} value={s.id}>{s.name} &lt;{s.email}&gt;</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--grey-mid)' }}>Subject</div>
                          <input
                            type="text"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            placeholder="Email subject"
                            style={{ background: 'var(--navy-mid)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--white)', fontFamily: 'var(--font-dm)', fontSize: '13px', padding: '9px 12px', outline: 'none', width: '100%' }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--grey-mid)' }}>Message</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--grey-mid)' }}>Variables: {'{{name}}'} · {'{{role}}'} · {'{{email}}'}</div>
                          </div>
                          <textarea
                            value={emailMessage}
                            onChange={(e) => setEmailMessage(e.target.value)}
                            placeholder={`Hi {{name}},\n\nWrite your message here...`}
                            rows={7}
                            style={{ background: 'var(--navy-mid)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--white)', fontFamily: 'var(--font-dm)', fontSize: '13px', padding: '9px 12px', outline: 'none', width: '100%', resize: 'vertical' }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '4px' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--grey-mid)' }}>File uploads</div>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', background: 'none', border: '1px solid rgba(219,103,39,0.3)', color: 'var(--orange)', padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            + Attach files
                            <input
                              type="file"
                              multiple
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                              onChange={handleEmailFileChange}
                              style={{ display: 'none' }}
                            />
                          </label>
                          {emailAttachFiles.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {emailAttachFiles.map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--off-white)' }}>{f.name}</span>
                                  <button type="button" onClick={() => removeEmailFile(i)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '11px', padding: '0 4px' }}>✕</button>
                                </div>
                              ))}
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--grey-mid)', padding: '4px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                + Add more files
                                <input
                                  type="file"
                                  multiple
                                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                  onChange={handleEmailFileChange}
                                  style={{ display: 'none' }}
                                />
                              </label>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleSendEmail}
                          disabled={emailSending || !emailSubject.trim() || !emailMessage.trim()}
                          style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', border: '1px solid var(--orange)', background: 'var(--orange)', color: 'var(--white)', transition: 'all 0.15s ease', opacity: emailSending || !emailSubject.trim() || !emailMessage.trim() ? 0.5 : 1 }}
                        >
                          {emailSending ? 'Sending...' : `Send to ${selected.email}`}
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid rgba(212,168,67,0.15)', paddingTop: '16px' }}>
                    {(selected as any).archived ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--warning)', lineHeight: '1.6' }}>
                          Archived{(selected as any).archived_by_email ? ` by ${(selected as any).archived_by_email}` : ''}
                          {(selected as any).archived_at ? ` on ${new Date((selected as any).archived_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.
                          Screening, rescreening, and all email are blocked for this candidate.
                          {(selected as any).archived_reason && (
                            <div style={{ marginTop: '6px', color: 'var(--grey-mid)' }}>Reason: {(selected as any).archived_reason}</div>
                          )}
                        </div>
                        {archiveError && <div style={{ fontSize: '11.5px', color: 'var(--error)' }}>{archiveError}</div>}
                        <button
                          type="button"
                          onClick={() => handleUnarchive(selected.id)}
                          disabled={archiving}
                          style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', border: '1px solid rgba(212,168,67,0.35)', background: 'rgba(212,168,67,0.06)', color: 'var(--warning)', transition: 'all 0.15s ease', opacity: archiving ? 0.6 : 1 }}
                        >
                          {archiving ? 'Unarchiving…' : 'Unarchive'}
                        </button>
                      </div>
                    ) : !archiveReasonBox ? (
                      <button
                        type="button"
                        onClick={() => setArchiveReasonBox(true)}
                        style={{ width: '100%', padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', border: '1px solid rgba(212,168,67,0.3)', background: 'none', color: 'var(--warning)', transition: 'all 0.15s ease', textAlign: 'left' }}
                      >
                        Archive & stop contacting
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--warning)', lineHeight: '1.5' }}>
                          Blocks all future screening, rescreening, and email to this candidate. Reversible via Unarchive.
                        </div>
                        <textarea
                          value={archiveReason}
                          onChange={(e) => setArchiveReason(e.target.value)}
                          placeholder="Reason (optional) — e.g. declined via email, cited lack of incentives"
                          style={{ width: '100%', minHeight: '56px', background: 'var(--navy-mid)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--white)', fontFamily: 'var(--font-dm)', fontSize: '12.5px', padding: '8px 10px', outline: 'none', resize: 'vertical' }}
                        />
                        {archiveError && <div style={{ fontSize: '11.5px', color: 'var(--error)' }}>{archiveError}</div>}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => { setArchiveReasonBox(false); setArchiveReason(''); setArchiveError(null) }}
                            disabled={archiving}
                            style={{ flex: 1, padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'none', color: 'var(--grey-mid)', transition: 'all 0.15s ease' }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchive(selected.id)}
                            disabled={archiving}
                            style={{ flex: 1, padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', border: '1px solid var(--warning)', background: 'var(--warning)', color: 'var(--navy-deep)', transition: 'all 0.15s ease', opacity: archiving ? 0.6 : 1 }}
                          >
                            {archiving ? 'Archiving…' : 'Confirm archive'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid rgba(232,69,69,0.15)', paddingTop: '16px' }}>
                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        style={{ width: '100%', padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', border: '1px solid rgba(232,69,69,0.3)', background: 'none', color: 'var(--error)', transition: 'all 0.15s ease', textAlign: 'left' }}
                      >
                        Delete application
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--error)', lineHeight: '1.5' }}>
                          This cannot be undone. The applicant will not be notified.
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            disabled={deleting}
                            style={{ flex: 1, padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'none', color: 'var(--grey-mid)', transition: 'all 0.15s ease' }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(selected.id)}
                            disabled={deleting}
                            style={{ flex: 1, padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', border: '1px solid var(--error)', background: 'rgba(232,69,69,0.1)', color: 'var(--error)', transition: 'all 0.15s ease' }}
                          >
                            {deleting ? 'Deleting...' : 'Confirm delete'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="detail-empty">Select an application to view details.</div>
            )}
          </div>
        </div>
      )}
    </>
  )
}