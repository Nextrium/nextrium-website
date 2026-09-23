'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ContactSubmission } from '@/lib/types/database'
import { useDashboardSearch } from '@/lib/dashboard/useDashboardSearch'
import DashboardSearchBox from '@/components/dashboard/DashboardSearchBox'
import { logActivityAction } from '@/app/actions/activityLog'

interface ContactClientProps {
  submissions: ContactSubmission[]
}

const STATUS_OPTIONS: ContactSubmission['status'][] = ['new', 'read', 'replied', 'archived']

const STATUS_STYLES: Record<ContactSubmission['status'], { bg: string; color: string }> = {
  new:      { bg: 'rgba(219,103,39,0.1)', color: 'var(--orange)'  },
  read:     { bg: 'rgba(74,111,165,0.1)', color: 'var(--slate)'   },
  replied:  { bg: 'rgba(34,193,122,0.1)', color: 'var(--success)' },
  archived: { bg: 'rgba(46,63,84,0.4)',   color: 'var(--grey-mid)'},
}

const SUBJECT_LABELS: Record<ContactSubmission['subject_type'], string> = {
  services:    'Services',
  partnership: 'Partnership',
  investment:  'Investment',
  press:       'Press',
  general:     'General',
}

export default function ContactClient({ submissions: initial }: ContactClientProps) {
  const [submissions, setSubmissions] = useState(initial)
  const [selected,    setSelected]    = useState<ContactSubmission | null>(null)
  const [updating,    setUpdating]    = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  async function updateStatus(id: string, status: ContactSubmission['status']) {
    setUpdating(true)
    setUpdateError(null)
    const supabase = createClient()
    // .select() returns the rows actually changed. Without it a blocked
    // update (row-level security matching nothing) looks like success.
    const { data, error } = await (supabase.from('contact_submissions') as any).update({ status }).eq('id', id).select('id')
    if (error || !data?.length) {
      setUpdateError('Could not update this message\'s status. You may not have permission, or it was changed elsewhere. Refresh and try again.')
    } else {
      setSubmissions((prev) => prev.map((s) => s.id === id ? { ...s, status } : s))
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : null)
      logActivityAction({
        action: 'contact_status_updated',
        targetType: 'contact_submission',
        targetId: id,
        details: { newStatus: status },
      }).catch(() => {})
    }
    setUpdating(false)
  }

  const newCount = submissions.filter((s) => s.status === 'new').length

  const { query: searchQuery, setQuery: setSearchQuery, results: searchedSubmissions } = useDashboardSearch(
    submissions,
    (s) => [s.first_name, s.last_name, s.email, s.organisation, s.message]
  )

  return (
    <>
      <style>{`
        .contact-layout { display: grid; grid-template-columns: 1fr 380px; gap: 24px; align-items: start; }
        .contact-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .contact-panel-header { padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; }
        .contact-panel-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); }
        .contact-new-count { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--orange); background: rgba(219,103,39,0.1); border: 1px solid rgba(219,103,39,0.2); padding: 3px 8px; }
        .contact-row { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: background 0.15s ease; }
        .contact-row:last-child { border-bottom: none; }
        .contact-row:hover { background: rgba(255,255,255,0.03); }
        .contact-row.selected { background: rgba(219,103,39,0.06); border-left: 2px solid var(--orange); }
        .contact-row.status-new { border-left: 2px solid var(--orange); }
        .contact-row-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
        .contact-name { font-size: 14px; color: var(--white); font-weight: 500; }
        .contact-subject { font-size: 11px; color: var(--grey-mid); margin-bottom: 4px; }
        .contact-preview { font-size: 12px; color: var(--grey-mid); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; display: inline-block; white-space: nowrap; }
        .detail-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); position: sticky; top: 24px; }
        .detail-header { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .detail-name { font-family: var(--font-exo2); font-weight: 700; font-size: 18px; color: var(--white); letter-spacing: -0.3px; margin-bottom: 4px; }
        .detail-email-link { font-size: 13px; color: var(--orange); text-decoration: none; }
        .detail-email-link:hover { text-decoration: underline; }
        .detail-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .detail-section-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); margin-bottom: 8px; }
        .detail-text { font-size: 13px; color: var(--off-white); line-height: 1.75; white-space: pre-wrap; }
        .detail-status-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .status-pill { padding: 6px 12px; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: none; color: var(--grey-mid); transition: all 0.15s ease; }
        .status-pill:hover { color: var(--white); border-color: rgba(255,255,255,0.2); }
        .status-pill.active { border-color: var(--orange); color: var(--white); background: rgba(219,103,39,0.08); }
        .status-pill:disabled { opacity: 0.5; cursor: not-allowed; }
        .reply-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; background: var(--orange); color: var(--white); border: none; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; text-decoration: none; transition: background 0.15s ease; }
        .reply-btn:hover { background: var(--orange-f, #C4521A); }
        .detail-empty { padding: 48px 24px; text-align: center; font-size: 13px; color: var(--grey-mid); }
        .contact-empty-state { padding: 64px 32px; text-align: center; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .contact-empty-title { font-family: var(--font-exo2); font-weight: 700; font-size: 20px; color: var(--white); margin-bottom: 8px; }
        .contact-empty-desc { font-size: 14px; color: var(--grey-mid); }
        @media (max-width: 1100px) { .contact-layout { grid-template-columns: 1fr; } .detail-panel { position: static; } }
      `}</style>

      {submissions.length === 0 ? (
        <div className="contact-empty-state">
          <div className="contact-empty-title">No messages yet.</div>
          <div className="contact-empty-desc">Contact form submissions will appear here.</div>
        </div>
      ) : (
        <div className="contact-layout">
          <div className="contact-panel">
            <div className="contact-panel-header">
              <span className="contact-panel-title">{submissions.length} message{submissions.length !== 1 ? 's' : ''}</span>
              {newCount > 0 && <span className="contact-new-count">{newCount} new</span>}
            </div>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <DashboardSearchBox
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search messages by name, email, or organisation..."
                resultCount={searchedSubmissions.length}
              />
            </div>
            {searchedSubmissions.length === 0 ? (
              <div className="detail-empty">No messages match your search.</div>
            ) : searchedSubmissions.map((sub) => {
              const ss = STATUS_STYLES[sub.status]
              return (
                <div
                  key={sub.id}
                  className={`contact-row ${selected?.id === sub.id ? 'selected' : ''} ${sub.status === 'new' ? 'status-new' : ''}`}
                  onClick={() => setSelected(sub)}
                >
                  <div className="contact-row-top">
                    <span className="contact-name">{sub.first_name} {sub.last_name}</span>
                    <span className="dash-badge" style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}33` }}>
                      {sub.status}
                    </span>
                  </div>
                  <div className="contact-subject">
                    {SUBJECT_LABELS[sub.subject_type]}{sub.organisation ? ` · ${sub.organisation}` : ''}
                  </div>
                  <div className="contact-preview">{sub.message}</div>
                  <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--grey-mid)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(sub.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="detail-panel">
            {selected ? (
              <>
                <div className="detail-header">
                  <div className="detail-name">{selected.first_name} {selected.last_name}</div>
                  <a href={`mailto:${selected.email}`} className="detail-email-link">{selected.email}</a>
                  {selected.organisation && (
                    <div style={{ fontSize: '12px', color: 'var(--grey-mid)', marginTop: '4px' }}>{selected.organisation}</div>
                  )}
                </div>
                <div className="detail-body">
                  <div>
                    <div className="detail-section-title">Subject</div>
                    <div className="detail-text">{SUBJECT_LABELS[selected.subject_type]}</div>
                  </div>
                  <div>
                    <div className="detail-section-title">Message</div>
                    <div className="detail-text">{selected.message}</div>
                  </div>
                  <div>
                    <a href={`mailto:${selected.email}?subject=Re: Your message to NexTrium`} className="reply-btn">
                      Reply via email ↗
                    </a>
                  </div>
                  <div>
                    <div className="detail-section-title">Status</div>
                    {updateError && <div style={{ fontSize: '11.5px', color: 'var(--error)', marginBottom: '8px' }}>{updateError}</div>}
                    <div className="detail-status-row">
                      {STATUS_OPTIONS.map((s) => (
                        <button key={s} type="button"
                          className={`status-pill ${selected.status === s ? 'active' : ''}`}
                          onClick={() => updateStatus(selected.id, s)}
                          disabled={updating || selected.status === s}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--grey-mid)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                    Received {new Date(selected.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </>
            ) : (
              <div className="detail-empty">Select a message to view details.</div>
            )}
          </div>
        </div>
      )}
    </>
  )
}