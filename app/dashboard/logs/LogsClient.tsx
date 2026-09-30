'use client'

import { useState, useEffect, Fragment } from 'react'
import {
  getTeamActivityLogs,
  getAgentRunTrace,
  type TeamActivityLog,
  type AgentRunSummary,
  type AgentRunLogLine,
} from './actions'
import { useDashboardSearch } from '@/lib/dashboard/useDashboardSearch'
import DashboardSearchBox from '@/components/dashboard/DashboardSearchBox'

const ACTION_LABELS: Record<string, string> = {
  sign_in: 'Signed in',
  sign_out: 'Signed out',
  application_deleted: 'Deleted application',
  application_screened: 'Screened candidate',
  application_rescanned: 'Rescanned candidate',
  application_status_updated: 'Updated status',
  application_human_reviewed: 'Marked as human reviewed',
  feedback_emails_dispatched: 'Dispatched feedback emails',
  bulk_screen_started: 'Started bulk screening',
  rebuttal_accept: 'Accepted rebuttal',
  rebuttal_refine: 'Sent rebuttal for refinement',
  rebuttal_decline: 'Declined rebuttal',
  team_user_invited: 'Invited team member',
  team_user_role_updated: 'Updated team member role',
  team_user_removed: 'Removed team member',
  post_created: 'Created post',
  post_updated: 'Updated post',
  post_published: 'Published post',
  post_deleted: 'Deleted post',
  event_created: 'Created event',
  event_updated: 'Updated event',
  event_deleted: 'Deleted event',
  product_created: 'Created product',
  product_updated: 'Updated product',
  product_deleted: 'Deleted product',
  role_created: 'Created open role',
  role_published: 'Published open role',
  role_updated: 'Updated open role',
  role_deleted: 'Deleted open role',
  community_project_created: 'Created community project',
  community_project_updated: 'Updated community project',
  community_project_deleted: 'Deleted community project',
  team_member_added: 'Added team member (public page)',
  team_member_updated: 'Updated team member (public page)',
  team_member_removed: 'Removed team member (public page)',
  contact_status_updated: 'Updated contact status',
  email_sent: 'Sent email',
  task_created: 'Created task',
  task_updated: 'Updated task',
  task_cancelled: 'Cancelled task',
  task_assigned: 'Assigned task',
  task_unassigned: 'Unassigned task',
  task_extension_granted: 'Granted task extension',
  task_extension_denied: 'Denied task extension',
  task_extension_requested: 'Requested task extension',
  contribution_submitted: 'Submitted contribution',
  contribution_resubmitted: 'Resubmitted contribution',
  contribution_verified: 'Verified contribution',
  contribution_changes_requested: 'Requested changes',
  contribution_rejected: 'Rejected contribution',
  contribution_review_retried: 'Retried automated review',
}

const ACTION_COLORS: Record<string, string> = {
  sign_in: 'var(--success)',
  sign_out: 'var(--grey-mid)',
  application_deleted: 'var(--error)',
  application_screened: 'var(--orange)',
  application_rescanned: 'var(--orange)',
  application_status_updated: 'var(--slate)',
  application_human_reviewed: 'var(--success)',
  feedback_emails_dispatched: 'var(--orange)',
  bulk_screen_started: 'var(--orange)',
  rebuttal_accept: 'var(--success)',
  rebuttal_refine: 'var(--gold)',
  rebuttal_decline: 'var(--error)',
  team_user_invited: 'var(--success)',
  team_user_role_updated: 'var(--slate)',
  team_user_removed: 'var(--error)',
  post_created: 'var(--slate)',
  post_updated: 'var(--slate)',
  post_published: 'var(--success)',
  post_deleted: 'var(--error)',
  event_created: 'var(--slate)',
  event_updated: 'var(--slate)',
  event_deleted: 'var(--error)',
  product_created: 'var(--slate)',
  product_updated: 'var(--slate)',
  product_deleted: 'var(--error)',
  role_created: 'var(--slate)',
  role_published: 'var(--success)',
  role_updated: 'var(--slate)',
  role_deleted: 'var(--error)',
  community_project_created: 'var(--slate)',
  community_project_updated: 'var(--slate)',
  community_project_deleted: 'var(--error)',
  team_member_added: 'var(--success)',
  team_member_updated: 'var(--slate)',
  team_member_removed: 'var(--error)',
  contact_status_updated: 'var(--slate)',
  email_sent: 'var(--orange)',
  task_created: 'var(--slate)',
  task_updated: 'var(--slate)',
  task_cancelled: 'var(--error)',
  task_assigned: 'var(--success)',
  task_unassigned: 'var(--slate)',
  task_extension_granted: 'var(--success)',
  task_extension_denied: 'var(--error)',
  task_extension_requested: 'var(--orange)',
  contribution_submitted: 'var(--success)',
  contribution_resubmitted: 'var(--success)',
  contribution_verified: 'var(--success)',
  contribution_changes_requested: 'var(--orange)',
  contribution_rejected: 'var(--error)',
  contribution_review_retried: 'var(--slate)',
}

const LEVEL_COLORS: Record<string, string> = {
  info: 'var(--grey-mid)',
  warn: 'var(--gold)',
  error: 'var(--error)',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function formatDuration(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (ms < 1000) return '<1s'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function summarizeDetails(log: TeamActivityLog): string {
  const d = log.details ?? {}
  switch (log.action) {
    case 'application_deleted':
      return [d.name, d.email].filter(Boolean).join(' · ') || '—'
    case 'application_screened':
    case 'application_rescanned':
      return `Score ${d.compositeScore ?? '—'}% · ${d.recommendation ?? '—'}`
    case 'application_status_updated':
      return `→ ${d.newStatus ?? '—'}`
    case 'application_human_reviewed':
      return (d.note as string) || 'No status change needed'
    case 'feedback_emails_dispatched':
      return `${d.sentCount ?? 0} sent, ${d.skippedCount ?? 0} skipped, ${d.failedCount ?? 0} failed`
    case 'bulk_screen_started':
      return `${d.applicationCount ?? '—'} candidate(s)`
    case 'rebuttal_accept':
    case 'rebuttal_refine':
    case 'rebuttal_decline':
      return d.updatedScore !== undefined ? `New score: ${d.updatedScore}%` : (d.recruiterNotes as string) || '—'
    case 'team_user_invited':
      return [d.email, d.role].filter(Boolean).join(' · ') || '—'
    case 'team_user_role_updated':
      return `→ ${d.newRole ?? '—'}`
    case 'post_created':
    case 'post_updated':
    case 'post_published':
    case 'post_deleted':
      return (d.title as string) || '—'
    case 'event_created':
    case 'event_updated':
    case 'event_deleted':
      return (d.title as string) || '—'
    case 'product_created':
    case 'product_updated':
    case 'product_deleted':
      return (d.name as string) || '—'
    case 'role_created':
    case 'role_published':
    case 'role_updated':
    case 'role_deleted':
      return (d.title as string) || '—'
    case 'community_project_created':
    case 'community_project_updated':
    case 'community_project_deleted':
      return (d.name as string) || '—'
    case 'team_member_added':
    case 'team_member_updated':
    case 'team_member_removed':
      return (d.name as string) || '—'
    case 'contact_status_updated':
      return `→ ${d.newStatus ?? '—'}`
    case 'task_created':
    case 'task_updated':
    case 'task_cancelled':
    case 'task_assigned':
    case 'task_unassigned':
    case 'task_extension_granted':
    case 'task_extension_denied':
    case 'task_extension_requested':
    case 'contribution_submitted':
    case 'contribution_resubmitted':
    case 'contribution_verified':
    case 'contribution_changes_requested':
    case 'contribution_rejected':
    case 'contribution_review_retried':
      return (d.title as string) || '—'
    case 'email_sent':
      return [d.subject, d.recipientCount !== undefined ? `${d.recipientCount} recipient(s)` : null].filter(Boolean).join(' · ') || '—'
    default:
      return Object.keys(d).length > 0 ? JSON.stringify(d) : '—'
  }
}

function RunTrace({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [lines, setLines] = useState<AgentRunLogLine[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    const res = await getAgentRunTrace(runId)
    if (res.error) setError(res.error)
    else setLines(res.lines)
    setLoading(false)
  }

  useEffect(() => { load() }, [runId])

  return (
    <div className="run-trace">
      <div className="run-trace-header">
        <span>Run trace — {runId.slice(0, 8)}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="run-trace-refresh" onClick={load} disabled={loading}>
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
          <button type="button" className="run-trace-close" onClick={onClose}>✕ Close</button>
        </div>
      </div>
      <div className="run-trace-body">
        {error && <div className="logs-error">Failed to load trace: {error}</div>}
        {!error && lines?.length === 0 && <div className="logs-empty">No log lines recorded for this run.</div>}
        {lines?.map((line) => (
          <div key={line.id} className="run-trace-line">
            <span className="run-trace-time">{new Date(line.created_at).toLocaleTimeString('en-GB')}</span>
            <span className="run-trace-level" style={{ color: LEVEL_COLORS[line.level] }}>[{line.level.toUpperCase()}]</span>
            <span className="run-trace-step">{line.step}</span>
            <span className="run-trace-message">{line.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LogsClient({
  initialLogs,
  initialError,
  initialRuns,
  initialRunsError,
}: {
  initialLogs: TeamActivityLog[]
  initialError: string | null
  initialRuns: AgentRunSummary[]
  initialRunsError: string | null
}) {
  const [activeTab, setActiveTab] = useState<'team' | 'agent'>('team')
  const [logs, setLogs]     = useState(initialLogs)
  const [error, setError]   = useState(initialError)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialLogs.length >= 50)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  const { query, setQuery, results } = useDashboardSearch(
    logs,
    (log) => [log.actor_email, ACTION_LABELS[log.action] ?? log.action, log.target_id, log.action]
  )

  const { query: runQuery, setQuery: setRunQuery, results: runResults } = useDashboardSearch(
    initialRuns,
    (run) => [run.candidateName, run.applicationId, run.runId]
  )

  async function handleLoadMore() {
    if (logs.length === 0) return
    setLoadingMore(true)
    const oldest = logs[logs.length - 1].created_at
    const res = await getTeamActivityLogs({ limit: 50, before: oldest })
    if (res.error) {
      setError(res.error)
    } else {
      setLogs((prev) => [...prev, ...res.logs])
      setHasMore(res.logs.length >= 50)
    }
    setLoadingMore(false)
  }

  return (
    <>
      <style>{`
        .logs-tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 20px; }
        .logs-tab { padding: 10px 20px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: none; background: none; color: var(--grey-mid); border-bottom: 2px solid transparent; transition: all 0.15s ease; }
        .logs-tab:hover { color: var(--white); }
        .logs-tab.active { color: var(--orange); border-bottom-color: var(--orange); }

        .logs-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .logs-search-row { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .logs-table { width: 100%; border-collapse: collapse; }
        .logs-table th { text-align: left; padding: 10px 16px; font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--grey-mid); border-bottom: 1px solid rgba(255,255,255,0.06); white-space: nowrap; }
        .logs-table td { padding: 11px 16px; font-size: 12.5px; color: var(--off-white); border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: top; }
        .logs-table tr:hover td { background: rgba(255,255,255,0.02); }
        .logs-table tr.clickable { cursor: pointer; }
        .logs-table tr:last-child td { border-bottom: none; }
        .logs-action-badge { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
        .logs-empty { padding: 48px 24px; text-align: center; font-size: 13px; color: var(--grey-mid); }
        .logs-load-more { display: block; width: 100%; padding: 12px; text-align: center; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border: none; border-top: 1px solid rgba(255,255,255,0.06); background: none; color: var(--grey-mid); transition: all 0.15s ease; }
        .logs-load-more:hover:not(:disabled) { color: var(--orange); }
        .logs-load-more:disabled { opacity: 0.5; cursor: not-allowed; }
        .logs-error { padding: 14px 16px; font-size: 12.5px; color: var(--error); background: rgba(232,69,69,0.08); border-bottom: 1px solid rgba(232,69,69,0.2); }

        .run-status-badge { font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 8px; }
        .run-status-ok { background: rgba(34,193,122,0.1); color: var(--success); border: 1px solid rgba(34,193,122,0.2); }
        .run-status-warn { background: rgba(212,168,67,0.1); color: var(--gold); border: 1px solid rgba(212,168,67,0.2); }
        .run-status-error { background: rgba(232,69,69,0.1); color: var(--error); border: 1px solid rgba(232,69,69,0.2); }

        .run-trace { border-top: 1px solid rgba(255,255,255,0.08); background: #050d18; }
        .run-trace-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--orange); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .run-trace-refresh, .run-trace-close { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); background: none; color: var(--grey-mid); padding: 4px 10px; transition: all 0.15s ease; }
        .run-trace-refresh:hover:not(:disabled), .run-trace-close:hover { color: var(--white); border-color: rgba(255,255,255,0.3); }
        .run-trace-body { max-height: 420px; overflow-y: auto; padding: 12px 16px; font-family: var(--font-mono); font-size: 11.5px; line-height: 1.9; }
        .run-trace-line { display: flex; gap: 10px; white-space: pre-wrap; word-break: break-word; }
        .run-trace-time { color: var(--grey-dark-2, #4a5b70); flex-shrink: 0; }
        .run-trace-level { flex-shrink: 0; }
        .run-trace-step { color: var(--slate); flex-shrink: 0; }
        .run-trace-message { color: var(--off-white); }
      `}</style>

      <div className="logs-tabs">
        <button type="button" className={`logs-tab ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')}>
          Team Activity
        </button>
        <button type="button" className={`logs-tab ${activeTab === 'agent' ? 'active' : ''}`} onClick={() => setActiveTab('agent')}>
          AI Agent Logs
        </button>
      </div>

      {activeTab === 'team' ? (
        <div className="logs-panel">
          <div className="logs-search-row">
            <DashboardSearchBox
              value={query}
              onChange={setQuery}
              placeholder="Search by actor, action, or target..."
              resultCount={results.length}
            />
          </div>

          {error && <div className="logs-error">Failed to load logs: {error}</div>}

          {results.length === 0 ? (
            <div className="logs-empty">No activity recorded yet.</div>
          ) : (
            <>
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--grey-mid)', whiteSpace: 'nowrap' }}>
                        {formatDate(log.created_at)}
                      </td>
                      <td>{log.actor_email ?? '—'}</td>
                      <td>
                        <span className="logs-action-badge" style={{ color: ACTION_COLORS[log.action] ?? 'var(--grey-mid)' }}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--grey-mid)' }}>
                        {log.target_type ? `${log.target_type}${log.target_id ? ` · ${log.target_id.slice(0, 8)}` : ''}` : '—'}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--grey-mid)' }}>{summarizeDetails(log)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasMore && !query && (
                <button type="button" className="logs-load-more" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="logs-panel">
          <div className="logs-search-row">
            <DashboardSearchBox
              value={runQuery}
              onChange={setRunQuery}
              placeholder="Search by candidate or application..."
              resultCount={runResults.length}
            />
          </div>

          {initialRunsError && <div className="logs-error">Failed to load agent runs: {initialRunsError}</div>}

          {runResults.length === 0 ? (
            <div className="logs-empty">
              No screening runs logged yet. Runs appear here once a candidate is screened
              (single or bulk) on an Agents Engine build with run logging enabled.
            </div>
          ) : (
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Candidate</th>
                  <th>Duration</th>
                  <th>Lines</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {runResults.map((run) => (
                  <Fragment key={run.runId}>
                    <tr
                      className="clickable"
                      onClick={() => setExpandedRunId(expandedRunId === run.runId ? null : run.runId)}
                    >
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--grey-mid)', whiteSpace: 'nowrap' }}>
                        {formatDate(run.startedAt)}
                      </td>
                      <td>{run.candidateName ?? 'Unknown candidate'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--grey-mid)' }}>
                        {formatDuration(run.startedAt, run.finishedAt)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--grey-mid)' }}>{run.lineCount}</td>
                      <td>
                        <span className={`run-status-badge ${run.hasError ? 'run-status-error' : run.hasWarn ? 'run-status-warn' : 'run-status-ok'}`}>
                          {run.hasError ? 'Error' : run.hasWarn ? 'Warning' : 'OK'}
                        </span>
                      </td>
                    </tr>
                    {expandedRunId === run.runId && (
                      <tr>
                        <td colSpan={5} style={{ padding: 0 }}>
                          <RunTrace runId={run.runId} onClose={() => setExpandedRunId(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  )
}
