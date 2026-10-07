'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { retryReview } from '../actions'

export default function RetryReview({ contributionId }: { contributionId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function retry() {
    setBusy(true); setError(null)
    const res = await retryReview(contributionId)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }
  return (
    <div className="mt-panel">
      <div className="mt-panel-title">Automated review</div>
      {error && <div className="mt-alert error">{error}</div>}
      <span className="mt-hint">The last automated review didn’t complete. Retry it, or decide without it below.</span>
      <button type="button" className="mt-btn" disabled={busy} onClick={retry}>{busy ? 'Reviewing… (up to a minute)' : 'Retry automated review'}</button>
    </div>
  )
}
