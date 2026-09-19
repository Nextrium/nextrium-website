'use client'

import { useState, useMemo } from 'react'
import type { Application, TeamMember } from '@/lib/types/database'
import { logActivityAction } from '@/app/actions/activityLog'

interface EmailSender {
  id: string
  name: string
  email: string
  is_default: boolean
}

type RecipientSource = 'applicants' | 'team' | 'manual'

interface SendResult {
  email: string
  success: boolean
  error?: string
}

export default function EmailComposeClient({
  senders,
  applicants,
  teamMembers,
}: {
  senders: EmailSender[]
  applicants: Application[]
  teamMembers: TeamMember[]
}) {
  const defaultSender = senders.find((s) => s.is_default) ?? senders[0]

  const [senderId,   setSenderId]   = useState(defaultSender?.id ?? '')
  const [source,       setSource]       = useState<RecipientSource>('applicants')
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [manualText,   setManualText]   = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [subject,    setSubject]    = useState('')
  const [message,    setMessage]    = useState('')
  const [sending,         setSending]         = useState(false)
  const [results,         setResults]         = useState<SendResult[] | null>(null)
  const [sendError,       setSendError]       = useState('')
  const [attachmentFiles, setAttachmentFiles] = useState<{ name: string; content: string }[]>([])

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll(ids: string[]) {
    setSelectedIds(new Set(ids))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  const filteredApplicants = useMemo(() => {
    if (statusFilter === 'all') return applicants
    if (statusFilter === 'human-reviewed') return applicants.filter((a) => !!(a as any).last_reviewed_by_email)
    if (statusFilter === 'track-review') return applicants.filter((a) => !!(a as any).needs_track_assignment)
    return applicants.filter((a) => a.status === statusFilter)
  }, [applicants, statusFilter])

  const manualRecipients = useMemo(() => {
    return manualText
      .split(/[\n,]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes('@'))
      .map((email) => ({ name: email.split('@')[0], email }))
  }, [manualText])

  const recipients = useMemo(() => {
    if (source === 'manual') return manualRecipients
    if (source === 'applicants') {
      return filteredApplicants
        .filter((a) => selectedIds.has(a.id))
        .map((a) => ({ name: a.name, email: a.email, role: a.role_title ?? '' }))
    }
    if (source === 'team') {
      return teamMembers
        .filter((t) => selectedIds.has(t.slug))
        .filter((t) => !!t.email)
        .map((t) => ({ name: t.name, email: t.email as string }))
    }
    return []
  }, [source, selectedIds, manualRecipients, applicants, teamMembers])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    setAttachmentFiles((prev) => [...prev, ...encoded])
  }

  function removeFile(index: number) {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSend() {
    if (!subject.trim() || !message.trim() || recipients.length === 0) return
    setSending(true)
    setResults(null)
    setSendError('')

    try {
      const res  = await fetch('/api/email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          subject,
          message,
          recipients,
          sender_id:       senderId,
          fileAttachments: attachmentFiles,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send.')
      setResults(data.results)
      logActivityAction({
        action: 'email_sent',
        targetType: 'email',
        details: { subject, recipientCount: recipients.length },
      }).catch(() => {})
      setSubject('')
      setMessage('')
      clearSelection()
      setManualText('')
      setAttachmentFiles([])
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <style>{`
        .email-layout { display: grid; grid-template-columns: 340px 1fr; gap: 24px; align-items: start; }
        .email-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; }
        .email-panel-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); margin-bottom: 14px; }
        .email-select { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 13px; padding: 9px 12px; outline: none; width: 100%; margin-bottom: 16px; }
        .source-tabs { display: flex; gap: 0; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.08); }
        .source-tab { flex: 1; padding: 8px; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; text-align: center; cursor: pointer; background: none; border: none; color: var(--grey-mid); transition: all 0.15s ease; }
        .source-tab.active { background: rgba(219,103,39,0.1); color: var(--orange); }
        .recipient-list { display: flex; flex-direction: column; gap: 0; max-height: 360px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.06); }
        .recipient-row { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; }
        .recipient-row:last-child { border-bottom: none; }
        .recipient-row:hover { background: rgba(255,255,255,0.02); }
        .recipient-row input { accent-color: var(--orange); cursor: pointer; }
        .recipient-name { font-size: 12px; color: var(--white); }
        .recipient-email { font-size: 10px; color: var(--grey-dark); }
        .recipient-actions { display: flex; gap: 8px; margin-bottom: 10px; }
        .recipient-action-btn { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--orange); background: none; border: 1px solid rgba(219,103,39,0.3); padding: 6px 10px; cursor: pointer; }
        .manual-textarea { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 13px; padding: 10px 12px; outline: none; width: 100%; min-height: 140px; resize: vertical; }
        .compose-input { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 11px 14px; outline: none; width: 100%; margin-bottom: 16px; }
        .compose-textarea { min-height: 280px; resize: vertical; }
        .compose-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
        .recipient-count { font-family: var(--font-mono); font-size: 11px; color: var(--orange); margin-bottom: 16px; }
        .send-btn { padding: 13px 22px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; border: 1px solid var(--orange); background: var(--orange); color: var(--white); transition: all 0.15s ease; }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .results-box { margin-top: 16px; padding: 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); }
        .results-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; font-size: 12px; }
        .error-box { padding: 10px 14px; font-size: 12px; background: rgba(232,69,69,0.08); border: 1px solid rgba(232,69,69,0.3); color: var(--error); margin-bottom: 16px; }
        @media (max-width: 900px) { .email-layout { grid-template-columns: 1fr; } }
      `}</style>

      <div className="email-layout">
        <div className="email-panel">
          <div className="email-panel-title">Send as</div>
          <select className="email-select" value={senderId} onChange={(e) => setSenderId(e.target.value)}>
            {senders.map((s) => (
              <option key={s.id} value={s.id}>{s.name} &lt;{s.email}&gt;</option>
            ))}
          </select>

          <div className="email-panel-title">Recipients</div>
          <div className="source-tabs">
            <button type="button" className={`source-tab ${source === 'applicants' ? 'active' : ''}`} onClick={() => { setSource('applicants'); clearSelection() }}>Applicants</button>
            <button type="button" className={`source-tab ${source === 'team' ? 'active' : ''}`} onClick={() => { setSource('team'); clearSelection(); setStatusFilter('all') }}>Team</button>
            <button type="button" className={`source-tab ${source === 'manual' ? 'active' : ''}`} onClick={() => { setSource('manual'); clearSelection(); setStatusFilter('all') }}>Manual list</button>
          </div>

          {source === 'applicants' && (
            <>
              <select
                className="email-select"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); clearSelection() }}
                style={{ marginBottom: '10px' }}
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="human-reviewed">Human Reviewed</option>
                <option value="track-review">Needs Track Assignment</option>
              </select>
              <div className="recipient-actions">
                <button type="button" className="recipient-action-btn" onClick={() => selectAll(filteredApplicants.map((a) => a.id))}>Select all</button>
                <button type="button" className="recipient-action-btn" onClick={clearSelection}>Clear</button>
              </div>
              <div className="recipient-list">
                {filteredApplicants.map((a) => (
                  <label key={a.id} className="recipient-row">
                    <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelected(a.id)} />
                    <div>
                      <div className="recipient-name">{a.name}</div>
                      <div className="recipient-email">{a.email} · {a.role_title ?? 'Open application'}</div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          {source === 'team' && (
            <>
              <div className="recipient-actions">
                <button type="button" className="recipient-action-btn" onClick={() => selectAll(teamMembers.filter((t) => !!t.email).map((t) => t.slug))}>Select all</button>
                <button type="button" className="recipient-action-btn" onClick={clearSelection}>Clear</button>
              </div>
              <div className="recipient-list">
                {teamMembers.filter((t) => !!t.email).map((t) => (
                  <label key={t.slug} className="recipient-row">
                    <input type="checkbox" checked={selectedIds.has(t.slug)} onChange={() => toggleSelected(t.slug)} />
                    <div>
                      <div className="recipient-name">{t.name}</div>
                      <div className="recipient-email">{t.email}</div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          {source === 'manual' && (
            <textarea
              className="manual-textarea"
              placeholder={`Paste email addresses, one per line or comma-separated\n\nexample1@email.com\nexample2@email.com`}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
            />
          )}
        </div>

        <div className="email-panel">
          {sendError && <div className="error-box">{sendError}</div>}

          <div className="compose-label">Subject</div>
          <input className="compose-input" type="text" placeholder="Email subject" value={subject} onChange={(e) => setSubject(e.target.value)} />

          <div className="compose-label">
            <span>Message</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--grey-dark)', textTransform: 'none', letterSpacing: 'normal' }}>Variables: {'{{name}}'} · {'{{role}}'} · {'{{email}}'}</span>
          </div>
          <textarea className="compose-input compose-textarea" placeholder={`Hi {{name}},\n\nWrite your message here...`} value={message} onChange={(e) => setMessage(e.target.value)} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            <div className="compose-label">
              <span>Attachments</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--grey-dark)' }}>File uploads</div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', background: 'none', border: '1px solid rgba(219,103,39,0.3)', color: 'var(--orange)', padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                + Attach files
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
              {attachmentFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {attachmentFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '12px', color: 'var(--off-white)' }}>{f.name}</span>
                      <button type="button" onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '12px', padding: '0 4px' }}>✕</button>
                    </div>
                  ))}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--grey-mid)', padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    + Add more files
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="recipient-count">{recipients.length} recipient{recipients.length !== 1 ? 's' : ''} selected</div>

          <button
            type="button"
            className="send-btn"
            onClick={handleSend}
            disabled={sending || !subject.trim() || !message.trim() || recipients.length === 0}
          >
            {sending ? 'Sending...' : `Send to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`}
          </button>

          {results && (
            <div className="results-box">
              {results.map((r, i) => (
                <div key={i} className="results-row">
                  <span style={{ color: 'var(--off-white)' }}>{r.email}</span>
                  <span style={{ color: r.success ? 'var(--success)' : 'var(--error)' }}>{r.success ? 'Sent' : 'Failed'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}