'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestExtension } from '../actions'

export default function ExtensionRequest({ taskId, days }: { taskId: string; days: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <>
        <span className="mt-hint">You can ask once for {days} more day{days === 1 ? '' : 's'}, before the deadline.</span>
        <button type="button" className="mt-btn ghost" onClick={() => setOpen(true)}>Request an extension</button>
      </>
    )
  }

  async function submit() {
    setBusy(true); setError(null)
    const res = await requestExtension(taskId, reason)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }

  return (
    <>
      {error && <div className="mt-alert error">{error}</div>}
      <label className="mt-hint" htmlFor="ext-reason">Why do you need more time?</label>
      <textarea id="ext-reason" className="mt-input mt-textarea" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="mt-btn" disabled={busy} onClick={submit}>{busy ? 'Sending…' : 'Send request'}</button>
        <button type="button" className="mt-btn ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </>
  )
}
