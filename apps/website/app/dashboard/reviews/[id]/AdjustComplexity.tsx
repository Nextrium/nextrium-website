'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adjustTaskComplexity } from '../actions'
import { COMPLEXITIES, COMPLEXITY_LABELS, POINT_RANGES, type Category, type Complexity } from '@nextrium/contributions-core/constants'

export default function AdjustComplexity({ contributionId, category, complexity, scopeFlagged }: {
  contributionId: string
  category: Category
  complexity: Complexity
  scopeFlagged: boolean
}) {
  const router = useRouter()
  const [pick, setPick] = useState<Complexity>(complexity)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const range = POINT_RANGES[category][pick]

  async function save() {
    setBusy(true); setError(null); setDone(null)
    const res = await adjustTaskComplexity(contributionId, pick)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    setDone(`Complexity set to ${COMPLEXITY_LABELS[pick]}. Points range is now ${range.min}–${range.max}.`)
    router.refresh()
  }

  return (
    <div className="mt-panel">
      <div className="mt-panel-title">Task complexity</div>
      {scopeFlagged && (
        <div className="mt-alert warn">
          The automated review thinks the work doesn&apos;t match this task&apos;s complexity. That is for the team to judge, not the member:
          adjust the complexity here if needed, then decide. The automated score may be lower because of this check.
        </div>
      )}
      {error && <div className="mt-alert error">{error}</div>}
      {done && <div className="mt-alert success">{done}</div>}
      <label className="mt-hint" htmlFor="adjust-complexity">Complexity</label>
      <select id="adjust-complexity" className="mt-input" value={pick} onChange={(e) => setPick(e.target.value as Complexity)} disabled={busy}>
        {COMPLEXITIES.map((c) => <option key={c} value={c}>{COMPLEXITY_LABELS[c]} ({POINT_RANGES[category][c].min}–{POINT_RANGES[category][c].max} pts)</option>)}
      </select>
      <button type="button" className="mt-btn" onClick={save} disabled={busy || pick === complexity}>
        {busy ? 'Saving…' : 'Change complexity'}
      </button>
    </div>
  )
}
