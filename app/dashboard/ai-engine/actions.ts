'use server'

import { fetchAgentsEngine } from '@/lib/agentsEngine'

export interface FailedScreeningEntry {
  applicationId: string
  candidateName: string
  error?: string
  needsTrackAssignment?: boolean
  jobId: string
  occurredAt: string
}

export interface AgentMetrics {
  completedScreenings: number
  failedScreenings: number
  failedList: FailedScreeningEntry[]
  rebuttals: { total: number; pending: number; reviewed: number }
  ratings: { total: number; average: number; distribution: Record<string, number> }
  tierDistribution: Record<string, number>
  averageScore: number
  emailStats: { sent: number; pending: number }
  lastJob: {
    jobId: string
    status: 'running' | 'completed' | 'failed'
    startedAt: string
    finishedAt: string | null
    total: number
    succeeded: number
    failed: number
  } | null
}

export async function getAgentMetrics(): Promise<{ metrics?: AgentMetrics; error?: string }> {
  const res = await fetchAgentsEngine('/api/v1/agents/hr/metrics', { method: 'GET' })

  if (!res.ok) {
    return { error: res.error }
  }

  return { metrics: res.data.metrics }
}
