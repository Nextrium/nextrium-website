'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getAgentMetrics, type AgentMetrics } from './actions'
import { startBulkScreenAction } from '../applications/actions'

interface AgentDefinition {
  id: string
  name: string
  description: string
  status: 'active' | 'coming-soon'
}

const AGENTS: AgentDefinition[] = [
  {
    id: 'hr-screening',
    name: 'HR Screening Workflow',
    description: 'Dual-layer consensus screening, public feedback reports, and rebuttal handling.',
    status: 'active',
  },
  {
    id: 'support-agent',
    name: 'Support Agent',
    description: 'Automated applicant and community support triage.',
    status: 'coming-soon',
  },
  {
    id: 'ops-agent',
    name: 'Operations Agent',
    description: 'Workflow automation across roles, events, and content operations.',
    status: 'coming-soon',
  },
]

function getTierColor(tier: string): string {
  const norm = tier.toLowerCase()
  if (norm.includes('public projects path') || norm.includes('reject') || norm.includes('not a fit')) {
    return '#e84545'
  }
  if (norm.includes('founding team ready') || norm.includes('strong')) {
    return '#22c17a'
  }
  if (norm.includes('further review required') || norm.includes('recruiter screen') || norm.includes('shortlist')) {
    return '#d4a843'
  }
  if (norm.includes('ecosystem entry') || norm.includes('under consideration') || norm.includes('hold')) {
    return '#4a6fa5'
  }
  return '#8A9BB0'
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function AIEngineClient({
  initialMetrics,
  initialError,
}: {
  initialMetrics: AgentMetrics | null
  initialError: string | null
}) {
  const [selectedAgentId, setSelectedAgentId] = useState('hr-screening')
  const [metrics,   setMetrics]   = useState<AgentMetrics | null>(initialMetrics)
  const [error,     setError]     = useState<string | null>(initialError)
  // The page no longer awaits this metrics fetch server-side (it calls out
  // to the Render-hosted agents-engine and can take up to ~50s on a cold
  // start) — it renders immediately with null metrics instead, and this
  // fetches them client-side right after mount so first paint is instant.
  const [refreshing, setRefreshing] = useState(initialMetrics === null && !initialError)
  const [selectedFailedIds, setSelectedFailedIds] = useState<Set<string>>(new Set())
  const [retrying,   setRetrying]   = useState(false)
  const [retryResult, setRetryResult] = useState<string | null>(null)

  const selectedAgent = AGENTS.find((a) => a.id === selectedAgentId)!

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    const res = await getAgentMetrics()
    if (res.error) setError(res.error)
    else setMetrics(res.metrics ?? null)
    setRefreshing(false)
  }

  useEffect(() => {
    if (initialMetrics === null && !initialError) {
      handleRefresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleFailedSelection(applicationId: string) {
    setSelectedFailedIds((prev) => {
      const next = new Set(prev)
      if (next.has(applicationId)) next.delete(applicationId)
      else next.add(applicationId)
      return next
    })
  }

  async function handleRetrySelected() {
    if (selectedFailedIds.size === 0) return
    setRetrying(true)
    setRetryResult(null)
    const { jobId, error: startError } = await startBulkScreenAction(Array.from(selectedFailedIds))
    setRetrying(false)
    if (startError && !jobId) {
      setRetryResult(`Failed to start retry: ${startError}`)
      return
    }
    setRetryResult(`Retry job started (${jobId}). Check the Applications page for live progress, or refresh metrics shortly.`)
    setSelectedFailedIds(new Set())
  }

  const tierEntries = metrics ? Object.entries(metrics.tierDistribution).sort((a, b) => b[1] - a[1]) : []
  const maxTierCount = tierEntries.length > 0 ? Math.max(...tierEntries.map(([, n]) => n)) : 1
  const maxRatingCount = metrics ? Math.max(1, ...Object.values(metrics.ratings.distribution)) : 1

  return (
    <>
      <style>{`
        .engine-layout { display: grid; grid-template-columns: 300px 1fr; gap: 24px; align-items: start; }
        .engine-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .engine-panel-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); padding: 16px 16px 10px; }
        .agent-row { padding: 14px 16px; border-top: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: background 0.15s ease; }
        .agent-row:hover { background: rgba(255,255,255,0.03); }
        .agent-row.active { background: rgba(219,103,39,0.06); border-left: 2px solid var(--orange); }
        .agent-row.coming-soon { cursor: default; opacity: 0.5; }
        .agent-name { font-size: 13.5px; color: var(--white); font-weight: 500; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .agent-desc { font-size: 11.5px; color: var(--grey-mid); margin-top: 4px; line-height: 1.5; }
        .agent-tag { font-family: var(--font-mono); font-size: 7px; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 6px; flex-shrink: 0; }
        .agent-tag.active { background: rgba(34,193,122,0.1); color: #22c17a; border: 1px solid rgba(34,193,122,0.3); }
        .agent-tag.soon { background: rgba(255,255,255,0.04); color: var(--grey-mid); border: 1px solid rgba(255,255,255,0.08); }

        .metrics-header { display: flex; align-items: center; justify-content: space-between; padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .metrics-title { font-family: var(--font-exo2); font-weight: 700; font-size: 18px; color: var(--white); }
        .metrics-subtitle { font-size: 12.5px; color: var(--grey-mid); margin-top: 2px; }
        .refresh-btn { padding: 8px 14px; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); background: none; color: var(--grey-mid); transition: all 0.15s ease; }
        .refresh-btn:hover:not(:disabled) { color: var(--white); border-color: rgba(255,255,255,0.25); }
        .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .metrics-body { padding: 20px; display: flex; flex-direction: column; gap: 24px; }
        .tile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .tile { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); padding: 16px; }
        .tile-value { font-family: var(--font-exo2); font-weight: 800; font-size: 26px; color: var(--white); line-height: 1; }
        .tile-label { font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--grey-mid); margin-top: 8px; }
        .tile-sub { font-size: 11px; color: var(--grey-mid); margin-top: 4px; }

        .section-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(219,103,39,0.2); }

        .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 12px; }
        .bar-label { width: 200px; flex-shrink: 0; color: var(--grey-mid); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bar-track { flex: 1; height: 8px; background: rgba(255,255,255,0.05); overflow: hidden; }
        .bar-fill { height: 100%; background: var(--orange); }
        .bar-count { font-family: var(--font-mono); font-size: 11px; color: var(--white); width: 28px; text-align: right; flex-shrink: 0; }

        .failed-row { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12.5px; min-width: 0; }
        .failed-row:last-child { border-bottom: none; }
        .failed-row-top { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .failed-name { color: var(--white); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .failed-date { color: var(--grey-mid); font-family: var(--font-mono); font-size: 10px; flex-shrink: 0; }
        .failed-reason-text {
          color: var(--error); font-size: 11.5px; line-height: 1.5; padding-left: 26px;
          overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
          -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word;
        }
        .failed-reason-pill {
          display: inline-flex; align-items: center; gap: 6px; margin-left: 26px; width: fit-content;
          padding: 4px 10px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.06em;
          text-transform: uppercase; background: rgba(212,168,67,0.1); border: 1px solid rgba(212,168,67,0.3);
          color: var(--warning); text-decoration: none; transition: all 0.15s ease;
        }
        .failed-reason-pill:hover { background: rgba(212,168,67,0.2); border-color: rgba(212,168,67,0.5); }
        .retry-btn { padding: 9px 16px; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(219,103,39,0.4); background: rgba(219,103,39,0.08); color: var(--orange); transition: all 0.15s ease; margin-top: 12px; }
        .retry-btn:hover:not(:disabled) { background: var(--orange); color: var(--white); }
        .retry-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .empty-note { font-size: 12.5px; color: var(--grey-mid); padding: 12px 0; }
        .error-note { font-size: 12.5px; color: var(--error); padding: 12px 16px; background: rgba(232,69,69,0.08); border: 1px solid rgba(232,69,69,0.2); }
        .retry-note { font-size: 12px; color: #22c17a; padding: 10px 12px; background: rgba(34,193,122,0.06); border: 1px solid rgba(34,193,122,0.2); margin-top: 10px; }

        @media (max-width: 900px) { .engine-layout { grid-template-columns: 1fr; } }
      `}</style>

      <div className="engine-layout">
        <div className="engine-panel">
          <div className="engine-panel-title">Agents</div>
          {AGENTS.map((agent) => (
            <div
              key={agent.id}
              className={`agent-row ${agent.id === selectedAgentId ? 'active' : ''} ${agent.status === 'coming-soon' ? 'coming-soon' : ''}`}
              onClick={() => agent.status === 'active' && setSelectedAgentId(agent.id)}
            >
              <div className="agent-name">
                {agent.name}
                <span className={`agent-tag ${agent.status === 'active' ? 'active' : 'soon'}`}>
                  {agent.status === 'active' ? 'Active' : 'Coming soon'}
                </span>
              </div>
              <div className="agent-desc">{agent.description}</div>
            </div>
          ))}
        </div>

        <div className="engine-panel">
          <div className="metrics-header">
            <div>
              <div className="metrics-title">{selectedAgent.name}</div>
              <div className="metrics-subtitle">{selectedAgent.description}</div>
            </div>
            {selectedAgent.status === 'active' && (
              <button type="button" className="refresh-btn" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? 'Refreshing...' : '↻ Refresh'}
              </button>
            )}
          </div>

          {selectedAgent.status === 'coming-soon' ? (
            <div className="metrics-body">
              <div className="empty-note">This agent isn't available yet. Metrics will appear here once it ships.</div>
            </div>
          ) : error ? (
            <div className="metrics-body">
              <div className="error-note">Failed to load metrics: {error}</div>
            </div>
          ) : !metrics && refreshing ? (
            <div className="metrics-body">
              <div className="empty-note">Loading metrics — this can take up to a minute if the AI engine is waking up from idle…</div>
            </div>
          ) : !metrics ? (
            <div className="metrics-body">
              <div className="empty-note">No metrics available yet.</div>
            </div>
          ) : (
            <div className="metrics-body">
              <div className="tile-grid">
                <div className="tile">
                  <div className="tile-value" style={{ color: '#22c17a' }}>{metrics.completedScreenings}</div>
                  <div className="tile-label">Completed Screenings</div>
                  <div className="tile-sub">Avg score {metrics.averageScore}%</div>
                </div>
                <div className="tile">
                  <div className="tile-value" style={{ color: metrics.failedScreenings > 0 ? 'var(--error)' : 'var(--white)' }}>
                    {metrics.failedScreenings}
                  </div>
                  <div className="tile-label">Failed Screenings</div>
                  <div className="tile-sub">Last 10 batch jobs</div>
                </div>
                <div className="tile">
                  <div className="tile-value">{metrics.rebuttals.total}</div>
                  <div className="tile-label">Rebuttals Filed</div>
                  <div className="tile-sub">{metrics.rebuttals.pending} pending · {metrics.rebuttals.reviewed} reviewed</div>
                </div>
                <div className="tile">
                  <div className="tile-value">{metrics.ratings.total}</div>
                  <div className="tile-label">Ratings &amp; Feedback</div>
                  <div className="tile-sub">Avg {metrics.ratings.average || '—'} ★</div>
                </div>
                <div className="tile">
                  <div className="tile-value">{metrics.emailStats.sent}</div>
                  <div className="tile-label">Feedback Emails Sent</div>
                  <div className="tile-sub">{metrics.emailStats.pending} pending dispatch</div>
                </div>
                <div className="tile">
                  <div className="tile-value" style={{
                    color: metrics.lastJob?.status === 'running' ? '#22c17a'
                      : metrics.lastJob?.status === 'failed' ? 'var(--error)' : 'var(--white)',
                    fontSize: '16px',
                  }}>
                    {metrics.lastJob ? metrics.lastJob.status.toUpperCase() : 'No jobs yet'}
                  </div>
                  <div className="tile-label">Last Batch Job</div>
                  <div className="tile-sub">{metrics.lastJob ? formatDate(metrics.lastJob.finishedAt || metrics.lastJob.startedAt) : '—'}</div>
                </div>
              </div>

              {tierEntries.length > 0 && (
                <div>
                  <div className="section-title">Consensus Tier Distribution</div>
                  {tierEntries.map(([tier, count]) => (
                    <div className="bar-row" key={tier}>
                      <span className="bar-label">{tier}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${(count / maxTierCount) * 100}%`, background: getTierColor(tier) }} />
                      </div>
                      <span className="bar-count">{count}</span>
                    </div>
                  ))}
                </div>
              )}

              {metrics.ratings.total > 0 && (
                <div>
                  <div className="section-title">Rating Distribution</div>
                  {['5', '4', '3', '2', '1'].map((star) => (
                    <div className="bar-row" key={star}>
                      <span className="bar-label">{star} ★</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{
                          width: `${(metrics.ratings.distribution[star] / maxRatingCount) * 100}%`,
                          background: '#22c17a',
                        }} />
                      </div>
                      <span className="bar-count">{metrics.ratings.distribution[star] ?? 0}</span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <div className="section-title">Failed Screenings ({metrics.failedList.length})</div>
                {metrics.failedList.length === 0 ? (
                  <div className="empty-note">No failed screenings in the last 10 batch jobs.</div>
                ) : (
                  <>
                    {metrics.failedList.map((f) => (
                      <div className="failed-row" key={`${f.jobId}-${f.applicationId}`}>
                        <div className="failed-row-top">
                          <input
                            type="checkbox"
                            checked={selectedFailedIds.has(f.applicationId)}
                            onChange={() => toggleFailedSelection(f.applicationId)}
                            disabled={f.needsTrackAssignment}
                            title={f.needsTrackAssignment ? 'Assign a track before retrying — a plain retry will hit the same block.' : undefined}
                            style={{ accentColor: 'var(--orange)', cursor: f.needsTrackAssignment ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                          />
                          <span className="failed-name">{f.candidateName}</span>
                          <span className="failed-date">{formatDate(f.occurredAt)}</span>
                        </div>
                        {f.needsTrackAssignment ? (
                          <Link href="/dashboard/applications?status=track-review" className="failed-reason-pill">
                            ⚠ Needs track assignment — assign one to screen
                          </Link>
                        ) : (
                          <div className="failed-reason-text" title={f.error || 'Unknown error'}>
                            {f.error || 'Unknown error'}
                          </div>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="retry-btn"
                      onClick={handleRetrySelected}
                      disabled={selectedFailedIds.size === 0 || retrying}
                    >
                      {retrying ? 'Starting retry...' : `⚡ Retry Selected (${selectedFailedIds.size})`}
                    </button>
                    {retryResult && <div className="retry-note">{retryResult}</div>}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
