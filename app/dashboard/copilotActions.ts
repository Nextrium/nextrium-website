'use server'

import { fetchAgentsEngine } from '@/lib/agentsEngine'
import { roleDenial, STAFF_ROLES } from '@/lib/dashboard/requireRole'

export interface CopilotChatParams {
  domainType?: string
  resourceId: string
  reportId?: string | null
  prompt: string
  pastedText?: string
  manualUrls?: string[]
  documentSnippets?: Array<{ name: string; content: string }>
  manualOverrides?: { compositeScore?: number; recommendation?: string }
}

export interface CopilotChatResult {
  error?: string
  reply?: string
  evidenceApplied?: boolean
  delta?: {
    previousScore?: number
    newScore?: number
    scoreDelta?: number
    previousRecommendation?: string
    newRecommendation?: string
    modifiedDimensions?: Array<{ dimension: string; before: number; after: number; reason: string }>
    summary?: string
  }
}

export async function sendCopilotChat(params: CopilotChatParams): Promise<CopilotChatResult> {
  const denied = await roleDenial(STAFF_ROLES)
  if (denied) return { error: denied }

  const res = await fetchAgentsEngine('/api/v1/agents/copilot/chat', {
    method: 'POST',
    body: JSON.stringify({ domainType: 'hr_screening', ...params }),
  })

  if (!res.ok) {
    return { error: res.error }
  }

  return {
    reply: res.data.data?.reply,
    evidenceApplied: res.data.data?.evidenceApplied,
    delta: res.data.data?.delta,
  }
}

export interface CopilotHistoryMessage {
  id: string
  sender: 'recruiter' | 'copilot_agent' | 'system' | 'candidate'
  message_type: string
  content: string
  resulting_delta?: Record<string, unknown>
  created_at: string
}

export async function getCopilotHistory(
  domainType: string,
  resourceId: string
): Promise<{ history: CopilotHistoryMessage[]; error?: string }> {
  const denied = await roleDenial(STAFF_ROLES)
  if (denied) return { history: [], error: denied }

  const res = await fetchAgentsEngine(
    `/api/v1/agents/copilot/history/${encodeURIComponent(domainType)}/${encodeURIComponent(resourceId)}`,
    { method: 'GET' }
  )

  if (!res.ok) {
    return { history: [], error: res.error }
  }

  return { history: res.data.history ?? [] }
}
