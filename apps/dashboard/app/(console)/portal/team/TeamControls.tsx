'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CORE_ROLES, CORE_ROLE_LABELS, DEPARTMENTS } from '@/lib/portal/teamRules'
import { addCoreMember, setCoreMemberActive, updateCoreMember } from './actions'

type Res = { ok: true; message: string } | { ok: false; error: string }

function useRun() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  async function run(fn: () => Promise<Res>, after?: () => void) {
    setBusy(true)
    setResult(null)
    const res = await fn()
    setBusy(false)
    setResult(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error })
    if (res.ok) { after?.(); router.refresh() }
  }
  return { busy, result, run }
}

export function MemberControls({ id, role, department, active }: { id: string; role: string; department: string; active: boolean }) {
  const [r, setR] = useState(role)
  const [d, setD] = useState(department)
  const { busy, result, run } = useRun()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <select aria-label="Role" className="pt-input" style={{ minWidth: 0 }} value={r} onChange={(e) => setR(e.target.value)}>
          {CORE_ROLES.map((x) => <option key={x} value={x}>{CORE_ROLE_LABELS[x]}</option>)}
        </select>
        <select aria-label="Department" className="pt-input" style={{ minWidth: 0, textTransform: 'capitalize' }} value={d} onChange={(e) => setD(e.target.value)}>
          {DEPARTMENTS.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <button type="button" className="pt-btn ghost" disabled={busy || (r === role && d === department)} onClick={() => run(() => updateCoreMember(id, r, d))}>Save</button>
        <button type="button" className={`pt-btn ${active ? 'danger' : 'ghost'}`} disabled={busy} onClick={() => run(() => setCoreMemberActive(id, !active))}>{active ? 'Deactivate' : 'Reactivate'}</button>
      </div>
      {result && <span className={`pt-alert ${result.ok ? 'success' : 'error'}`} role={result.ok ? 'status' : 'alert'}>{result.text}</span>}
    </div>
  )
}

export function AddMemberForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>('reviewer')
  const [department, setDepartment] = useState<string>('technical')
  const { busy, result, run } = useRun()
  return (
    <div className="pt-panel" style={{ maxWidth: 640 }}>
      <div className="pt-panel-title">Add a core team member</div>
      {result && <div className={`pt-alert ${result.ok ? 'success' : 'error'}`} role={result.ok ? 'status' : 'alert'}>{result.text}</div>}
      <label className="pt-hint" htmlFor="ct-name">Name</label>
      <input id="ct-name" className="pt-input" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
      <label className="pt-hint" htmlFor="ct-email">Email (the one they use on the portal)</label>
      <input id="ct-email" type="email" className="pt-input" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select aria-label="Role" className="pt-input" style={{ minWidth: 150 }} value={role} onChange={(e) => setRole(e.target.value)}>
          {CORE_ROLES.map((x) => <option key={x} value={x}>{CORE_ROLE_LABELS[x]}</option>)}
        </select>
        <select aria-label="Department" className="pt-input" style={{ minWidth: 150, textTransform: 'capitalize' }} value={department} onChange={(e) => setDepartment(e.target.value)}>
          {DEPARTMENTS.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <button type="button" className="pt-btn" disabled={busy || !name.trim() || !email.trim()} onClick={() => run(() => addCoreMember({ name, email, role, department }), () => { setName(''); setEmail('') })}>
        {busy ? 'Adding…' : 'Add member'}
      </button>
    </div>
  )
}
