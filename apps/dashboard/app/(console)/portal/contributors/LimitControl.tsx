'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MAX_CLAIMS_RANGE } from '@/lib/portal/teamRules'
import { setMaxClaims } from './actions'

/** Admin control for how many tasks a contributor may run at once. */
export default function LimitControl({ contributorId, current }: { contributorId: string; current: number }) {
  const router = useRouter()
  const [value, setValue] = useState(current)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const options = Array.from({ length: MAX_CLAIMS_RANGE.max - MAX_CLAIMS_RANGE.min + 1 }, (_, i) => MAX_CLAIMS_RANGE.min + i)

  async function save() {
    setBusy(true)
    setResult(null)
    const res = await setMaxClaims(contributorId, value)
    setBusy(false)
    setResult(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error })
    if (res.ok) router.refresh()
  }

  return (
    <div className="pt-panel">
      <div className="pt-panel-title">Running-task limit</div>
      {result && <div className={`pt-alert ${result.ok ? 'success' : 'error'}`} role={result.ok ? 'status' : 'alert'}>{result.text}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select aria-label="Tasks at once" className="pt-input" style={{ minWidth: 0, width: 90 }} value={value} onChange={(e) => setValue(Number(e.target.value))}>
          {options.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button type="button" className="pt-btn ghost" disabled={busy || value === current} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <span className="pt-hint">Tasks this contributor may hold at once. The usual limit is 2.</span>
    </div>
  )
}
