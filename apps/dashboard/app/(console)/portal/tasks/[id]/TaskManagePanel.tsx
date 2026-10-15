'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { decidePortalExtension, deletePortalTask, unassignPortalTask } from '../actions'

interface Props {
  taskId: string
  status: string
  extensionPending: boolean
  /** The deadline a grant would give, for the button label. */
  extendedTo: string | null
  canUnassign: boolean
  canDelete: boolean
}

export default function TaskManagePanel({ taskId, status, extensionPending, extendedTo, canUnassign, canDelete }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'unassign' | 'delete' | null>(null)
  const [reason, setReason] = useState('')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  if (!extensionPending && !canUnassign && !canDelete && !result) return null

  async function run(label: string, fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, after?: () => void) {
    setBusy(label)
    setResult(null)
    const res = await fn()
    setBusy(null)
    setConfirm(null)
    setResult(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error })
    if (res.ok) (after ?? (() => router.refresh()))()
  }

  return (
    <div className="pt-panel">
      <div className="pt-panel-title">Manage</div>
      {result && <div className={`pt-alert ${result.ok ? 'success' : 'error'}`} role={result.ok ? 'status' : 'alert'}>{result.text}</div>}

      {extensionPending && (
        <>
          <span className="pt-hint">The contributor asked for an extension{extendedTo ? ` (to ${extendedTo})` : ''}.</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="pt-btn" disabled={!!busy} onClick={() => run('grant', () => decidePortalExtension(taskId, true))}>{busy === 'grant' ? 'Granting…' : 'Grant extension'}</button>
            <button type="button" className="pt-btn ghost" disabled={!!busy} onClick={() => run('decline', () => decidePortalExtension(taskId, false))}>{busy === 'decline' ? 'Declining…' : 'Decline'}</button>
          </div>
        </>
      )}

      {canUnassign && (confirm === 'unassign' ? (
        <>
          <label className="pt-hint" htmlFor="pt-unassign-reason">Note for the contributor (optional)</label>
          <textarea id="pt-unassign-reason" className="pt-input pt-textarea" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
          <span className="pt-hint">The task goes back to the open board. The contributor is emailed and can claim other tasks straight away.</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="pt-btn danger" disabled={!!busy} onClick={() => run('unassign', () => unassignPortalTask(taskId, reason))}>{busy === 'unassign' ? 'Unassigning…' : 'Yes, unassign'}</button>
            <button type="button" className="pt-btn ghost" disabled={!!busy} onClick={() => setConfirm(null)}>Keep</button>
          </div>
        </>
      ) : (
        <button type="button" className="pt-btn danger" disabled={!!busy} onClick={() => setConfirm('unassign')}>Unassign</button>
      ))}
      {status === 'assigned' && !canUnassign && <span className="pt-hint">A submission is waiting for review, so this task cannot be unassigned.</span>}

      {canDelete && (confirm === 'delete' ? (
        <>
          <span className="pt-hint">Delete this task for good? It has no submissions. This cannot be undone.</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="pt-btn danger" disabled={!!busy} onClick={() => run('delete', () => deletePortalTask(taskId), () => router.push('/portal/tasks'))}>{busy === 'delete' ? 'Deleting…' : 'Yes, delete'}</button>
            <button type="button" className="pt-btn ghost" disabled={!!busy} onClick={() => setConfirm(null)}>Keep</button>
          </div>
        </>
      ) : (
        <button type="button" className="pt-btn danger" disabled={!!busy} onClick={() => setConfirm('delete')}>Delete task</button>
      ))}
    </div>
  )
}
