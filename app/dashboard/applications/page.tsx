import { createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
import ApplicationsClient from './ApplicationsClient'
import type { Application, AgentScreeningResult, ScreeningReport } from '@/lib/types/database'

export const metadata = { title: 'Applications' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface EmailSender {
  id: string
  name: string
  email: string
  is_default: boolean
}

async function getApplications(): Promise<Application[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('applications')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? []
}

async function getSenders(): Promise<EmailSender[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('email_senders')
    .select('*')
    .order('is_default', { ascending: false })
  return (data ?? []) as EmailSender[]
}

// full_result (the full consensus dossier — dimension scores, interview
// questions, the feedback letter, etc.) is a sizeable JSON blob per row and
// is only ever read for the single currently-selected candidate, never for
// list/table rendering, sorting, or filtering (those all use the plain
// columns below). Excluding it here means this query's payload no longer
// grows with the size of every candidate's evaluation, only with the
// number of candidates - ApplicationsClient lazily fetches the full row
// (via getScreeningResultsForApplications) only when a candidate is
// selected. See selectApp() in ApplicationsClient.tsx.
const SCREENING_LIST_COLUMNS = 'id, application_id, input_hash, evaluation_track, composite_score, consensus_tier, recommendation, screened_at, email_sent, webhook_sent, last_emailed_recommendation'

async function getScreeningResults(): Promise<Record<string, AgentScreeningResult>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('agent_screening_results')
    .select(SCREENING_LIST_COLUMNS)
    .order('screened_at', { ascending: false })

  if (error) {
    console.warn('[ApplicationsPage] Could not fetch screening results:', error.message)
    return {}
  }

  const map: Record<string, AgentScreeningResult> = {}
  data?.forEach((row: any) => {
    // Keep most recent screening result per application
    if (!map[row.application_id]) {
      map[row.application_id] = row as AgentScreeningResult
    }
  })
  return map
}

async function getRebuttalStatuses(): Promise<Record<string, { reportId: string; rebuttalSubmitted: boolean; rebuttalLocked: boolean }>> {
  const supabase = createServiceClient()
  const { data, error } = await (supabase.from('screening_reports') as any)
    .select('id, application_id, rebuttal_submitted, rebuttal_locked, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[ApplicationsPage] Could not fetch screening reports:', error.message)
    return {}
  }

  // An application can have more than one screening_reports row (a
  // candidate rescreened after a report ID drift used to insert a second
  // row instead of updating the first — see generateReportId in
  // agents-engine, fixed separately). Rows are ordered newest-first, so the
  // newest one wins by default (the usual, correct case) — except if the
  // newest row has no rebuttal but an older one does, in which case the
  // older, rebuttal-bearing row's id is what a rebuttal-detail lookup will
  // actually find a match against, so it takes priority.
  const map: Record<string, { reportId: string; rebuttalSubmitted: boolean; rebuttalLocked: boolean }> = {}
  ;(data as ScreeningReport[] ?? []).forEach((row) => {
    const existing = map[row.application_id]
    if (existing && !(!existing.rebuttalSubmitted && row.rebuttal_submitted)) return

    map[row.application_id] = {
      reportId:          row.id,
      rebuttalSubmitted: row.rebuttal_submitted,
      rebuttalLocked:    row.rebuttal_locked,
    }
  })
  return map
}

export default async function ApplicationsPage() {
  const [applications, senders, screeningResults, rebuttalStatuses] = await Promise.all([
    getApplications(),
    getSenders(),
    getScreeningResults(),
    getRebuttalStatuses(),
  ])
  return (
    <>
      <Header title="Applications" description="Review and manage job applications" />
      <div className="dash-content">
        <ApplicationsClient
          applications={applications}
          senders={senders}
          initialScreeningResults={screeningResults}
          rebuttalStatuses={rebuttalStatuses}
        />
      </div>
    </>
  )
}