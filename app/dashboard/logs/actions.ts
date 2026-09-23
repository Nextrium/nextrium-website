'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { roleDenial, ADMIN_ONLY } from '@/lib/dashboard/requireRole'

export interface TeamActivityLog {
  id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown>
  created_at: string
}

export async function getTeamActivityLogs(params: {
  limit?: number
  before?: string
} = {}): Promise<{ logs: TeamActivityLog[]; error?: string }> {
  const denied = await roleDenial(ADMIN_ONLY)
  if (denied) return { logs: [], error: denied }

  try {
    const supabase = createServiceClient()
    let query = supabase
      .from('team_activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(params.limit ?? 50)

    if (params.before) {
      query = query.lt('created_at', params.before)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)

    return { logs: (data ?? []) as TeamActivityLog[] }
  } catch (err) {
    console.error('[getTeamActivityLogs] Error:', err)
    return { logs: [], error: err instanceof Error ? err.message : 'Failed to load activity logs.' }
  }
}

export interface AgentRunLogLine {
  id: string
  run_id: string
  application_id: string | null
  candidate_name: string | null
  step: string
  level: 'info' | 'warn' | 'error'
  message: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AgentRunSummary {
  runId: string
  applicationId: string | null
  candidateName: string | null
  startedAt: string
  finishedAt: string
  lineCount: number
  hasError: boolean
  hasWarn: boolean
}

/**
 * Fetches the most recent agent_run_logs rows and groups them into a
 * run-level summary (agent_run_logs itself has no separate "runs" table —
 * a run is just every row sharing a run_id). Scans a bounded recent window
 * rather than the whole table to keep this cheap as the log table grows.
 */
export async function getRecentAgentRuns(scanLimit = 1500): Promise<{ runs: AgentRunSummary[]; error?: string }> {
  const denied = await roleDenial(ADMIN_ONLY)
  if (denied) return { runs: [], error: denied }

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('agent_run_logs')
      .select('run_id, application_id, candidate_name, level, created_at')
      .order('created_at', { ascending: false })
      .limit(scanLimit)

    if (error) throw new Error(error.message)

    const byRun = new Map<string, AgentRunSummary>()
    ;(data ?? []).forEach((row: any) => {
      const existing = byRun.get(row.run_id)
      if (!existing) {
        byRun.set(row.run_id, {
          runId: row.run_id,
          applicationId: row.application_id,
          candidateName: row.candidate_name,
          startedAt: row.created_at,
          finishedAt: row.created_at,
          lineCount: 1,
          hasError: row.level === 'error',
          hasWarn: row.level === 'warn',
        })
      } else {
        existing.lineCount += 1
        if (row.created_at < existing.startedAt) existing.startedAt = row.created_at
        if (row.created_at > existing.finishedAt) existing.finishedAt = row.created_at
        if (row.level === 'error') existing.hasError = true
        if (row.level === 'warn') existing.hasWarn = true
      }
    })

    const runs = Array.from(byRun.values()).sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1))
    return { runs }
  } catch (err) {
    console.error('[getRecentAgentRuns] Error:', err)
    return { runs: [], error: err instanceof Error ? err.message : 'Failed to load agent run logs.' }
  }
}

export async function getAgentRunTrace(runId: string): Promise<{ lines: AgentRunLogLine[]; error?: string }> {
  const denied = await roleDenial(ADMIN_ONLY)
  if (denied) return { lines: [], error: denied }

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('agent_run_logs')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    return { lines: (data ?? []) as AgentRunLogLine[] }
  } catch (err) {
    console.error('[getAgentRunTrace] Error:', err)
    return { lines: [], error: err instanceof Error ? err.message : 'Failed to load run trace.' }
  }
}
