'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { closeSharedTask, extendSharedTask, setSharedCap, updateSharedCopies, withdrawSharedCopies } from '../actions'

export interface SharedCopyView { id: string; name: string; status: string; deadline: string | null; submitted: boolean }

interface Props {
  taskId: string
  closesAt: string
  maxClaimers: number | null
  progress: string
  copies: SharedCopyView[]
  /** The shared task's saved brief, for "save to copies". */
  brief: { title: string; description: string; category: string; complexity: string; links: { label: string; url: string }[]; tags: string }
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

/** Staff tools for a task open to several contributors. */
export default function SharedPanel({ taskId, closesAt, maxClaimers, progress, copies, brief }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirm, setConfirm] = useState<'close' | 'withdraw' | null>(null)
  const [cap, setCap] = useState(maxClaimers ? String(maxClaimers) : '')
  const [note, setNote] = useState('')
  const open = new Date(closesAt).getTime() > Date.now()
  const waiting = copies.filter((c) => c.status === 'assigned' && !c.submitted).length

  async function run(label: string, fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) {
    setBusy(label); setResult(null)
    const res = await fn()
    setBusy(null); setConfirm(null)
    setResult(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error })
    if (res.ok) router.refresh()
  }

  return (
    <div className="pt-panel" data-shared-panel>
      <div className="pt-panel-title">Open to several contributors</div>
      {result && <div className={`pt-alert ${result.ok ? 'success' : 'error'}`} role={result.ok ? 'status' : 'alert'}>{result.text}</div>}
      <dl className="pt-kv" style={{ gridTemplateColumns: '110px 1fr' }}>
        <dt>Claims</dt><dd>{open ? `Open until ${fmt(closesAt)}` : `Closed ${fmt(closesAt)}`}</dd>
        <dt>Places</dt><dd>{maxClaimers ? `${copies.length} of ${maxClaimers}` : `${copies.length} (no limit)`}</dd>
        <dt>Progress</dt><dd>{progress}</dd>
      </dl>

      {copies.length > 0 && (
        <ul className="pt-copies" aria-label="Who claimed">
          {copies.map((c) => (
            <li key={c.id}>
              <Link href={`/portal/tasks/${c.id}`}>{c.name}</Link>
              <span className="pt-hint">{c.status === 'completed' ? 'Completed' : c.submitted ? 'Submitted' : `Working · due ${fmt(c.deadline)}`}</span>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {open && (confirm === 'close' ? (
          <>
            <span className="pt-hint">Stop new claims now? Those who claimed keep their copies.</span>
            <button type="button" className="pt-btn danger" disabled={!!busy} onClick={() => run('close', () => closeSharedTask(taskId))}>{busy === 'close' ? 'Closing…' : 'Yes, close claims'}</button>
            <button type="button" className="pt-btn ghost" disabled={!!busy} onClick={() => setConfirm(null)}>Keep open</button>
          </>
        ) : (
          <button type="button" className="pt-btn ghost" disabled={!!busy} onClick={() => setConfirm('close')}>Close claims now</button>
        ))}
        <button type="button" className="pt-btn ghost" disabled={!!busy} onClick={() => run('ext24', () => extendSharedTask(taskId, 24))}>{open ? '+24 hours' : 'Reopen for 24 hours'}</button>
        <button type="button" className="pt-btn ghost" disabled={!!busy} onClick={() => run('ext72', () => extendSharedTask(taskId, 72))}>{open ? '+72 hours' : 'Reopen for 72 hours'}</button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="pt-hint" htmlFor="pt-shared-cap">Places</label>
          <input id="pt-shared-cap" className="pt-input" inputMode="numeric" style={{ width: 120 }} value={cap} placeholder="No limit" onChange={(e) => setCap(e.target.value)} />
        </div>
        <button type="button" className="pt-btn ghost" disabled={!!busy} onClick={() => run('cap', () => setSharedCap(taskId, cap))}>{busy === 'cap' ? 'Saving…' : 'Save places'}</button>
      </div>

      {waiting > 0 && (
        <>
          <button type="button" className="pt-btn ghost" disabled={!!busy} onClick={() => run('copies', () => updateSharedCopies(taskId, brief))}>
            {busy === 'copies' ? 'Updating…' : `Save the brief to ${waiting} cop${waiting === 1 ? 'y' : 'ies'} not yet submitted`}
          </button>
          {confirm === 'withdraw' ? (
            <>
              <label className="pt-hint" htmlFor="pt-withdraw-note">Note for the contributors (optional)</label>
              <textarea id="pt-withdraw-note" className="pt-input pt-textarea" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              <span className="pt-hint">Withdraws the {waiting} cop{waiting === 1 ? 'y' : 'ies'} nobody has submitted work for, and emails each person. Copies with submitted work carry on.</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="pt-btn danger" disabled={!!busy} onClick={() => run('withdraw', () => withdrawSharedCopies(taskId, note))}>{busy === 'withdraw' ? 'Withdrawing…' : 'Yes, withdraw'}</button>
                <button type="button" className="pt-btn ghost" disabled={!!busy} onClick={() => setConfirm(null)}>Keep</button>
              </div>
            </>
          ) : (
            <button type="button" className="pt-btn danger" disabled={!!busy} onClick={() => setConfirm('withdraw')}>Withdraw unsubmitted copies</button>
          )}
        </>
      )}
      <span className="pt-hint">Saving the task above changes the brief for future claimers only.</span>
    </div>
  )
}
