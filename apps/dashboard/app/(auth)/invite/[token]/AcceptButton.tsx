'use client'

import { useState } from 'react'
import { acceptInvitation } from './actions'

export default function AcceptButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setBusy(true); setError(null)
    // Succeeds by redirecting to the password page; only a refusal comes back.
    const res = await acceptInvitation(token)
    setBusy(false)
    if (res?.error) setError(res.error)
  }

  return (
    <>
      {error && <div className="invite-alert" role="alert">{error}</div>}
      <button type="button" className="invite-btn" onClick={accept} disabled={busy}>
        {busy ? 'Signing you in…' : 'Accept invitation'}
      </button>
    </>
  )
}
