import { isEngineId } from './engineId'
import { safeHref } from './safeHref'

// The Copilot request is checked here before it reaches the agents-engine, so
// the engine only ever sees one domain, real ids and bounded text.
export const COPILOT_DOMAIN = 'hr_screening'
const MAX_PROMPT = 4000
const MAX_PASTED = 20000
const MAX_URLS = 10
const MAX_SNIPPETS = 5
const MAX_SNIPPET = 20000

export interface CopilotRequest {
  domainType: typeof COPILOT_DOMAIN
  resourceId: string
  reportId?: string
  prompt: string
  pastedText?: string
  manualUrls?: string[]
  documentSnippets?: Array<{ name: string; content: string }>
  manualOverrides?: { compositeScore?: number; recommendation?: string }
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function parseCopilotRequest(raw: unknown): { request: CopilotRequest } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Nothing to send.' }
  const r = raw as Record<string, unknown>
  if (r.domainType !== undefined && r.domainType !== COPILOT_DOMAIN) return { error: 'That Copilot is not available.' }
  if (!isEngineId(r.resourceId)) return { error: 'That candidate could not be found.' }
  if (r.reportId != null && !isEngineId(r.reportId)) return { error: 'That report could not be found.' }

  const prompt = text(r.prompt, MAX_PROMPT)
  if (!prompt) return { error: 'Write a message first.' }
  const pastedText = text(r.pastedText, MAX_PASTED) || undefined

  if (r.manualUrls !== undefined && !Array.isArray(r.manualUrls)) return { error: 'Links must be a list.' }
  const urls = (r.manualUrls as unknown[] | undefined) ?? []
  if (urls.length > MAX_URLS) return { error: `Add at most ${MAX_URLS} links.` }
  const manualUrls: string[] = []
  for (const u of urls) {
    const safe = safeHref(u)
    if (!safe) return { error: 'Each link must be a full http(s) address.' }
    manualUrls.push(safe)
  }

  if (r.documentSnippets !== undefined && !Array.isArray(r.documentSnippets)) return { error: 'Documents must be a list.' }
  const docs = (r.documentSnippets as unknown[] | undefined) ?? []
  if (docs.length > MAX_SNIPPETS) return { error: `Add at most ${MAX_SNIPPETS} documents.` }
  const documentSnippets = docs.map((d) => {
    const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>
    return { name: text(o.name, 200) || 'Document', content: text(o.content, MAX_SNIPPET) }
  }).filter((d) => d.content)

  let manualOverrides: CopilotRequest['manualOverrides']
  if (r.manualOverrides != null) {
    if (typeof r.manualOverrides !== 'object') return { error: 'The override is not valid.' }
    const o = r.manualOverrides as Record<string, unknown>
    const score = o.compositeScore
    if (score !== undefined && (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 100)) {
      return { error: 'The score must be a whole number from 0 to 100.' }
    }
    const recommendation = text(o.recommendation, 100) || undefined
    if (score !== undefined || recommendation) manualOverrides = { compositeScore: score as number | undefined, recommendation }
  }

  return {
    request: {
      domainType: COPILOT_DOMAIN,
      resourceId: r.resourceId as string,
      ...(r.reportId != null ? { reportId: r.reportId as string } : {}),
      prompt,
      ...(pastedText ? { pastedText } : {}),
      ...(manualUrls.length ? { manualUrls } : {}),
      ...(documentSnippets.length ? { documentSnippets } : {}),
      ...(manualOverrides ? { manualOverrides } : {}),
    },
  }
}
