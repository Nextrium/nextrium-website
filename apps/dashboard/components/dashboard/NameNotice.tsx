'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveDisplayName } from '@/lib/contributions/profileActions'
import { DISPLAY_NAME_MAX } from '@nextrium/contributions-core/profile'

/**
 * Asks someone who hasn't chosen a leaderboard name to add one. Shown only to
 * the person themselves; `shownAs` is what others see for them today.
 */
export default function NameNotice({ shownAs }: { shownAs: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await saveDisplayName(name)
      if (res.error) { setError(res.error); return }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (saved) {
    return <div role="status" style={{ ...box, borderColor: 'color-mix(in srgb, var(--success) 30%, transparent)', color: 'var(--success)' }}>Saved. The leaderboard now shows your name.</div>
  }

  return (
    <form onSubmit={save} style={box} aria-labelledby="name-notice-title">
      <div id="name-notice-title" style={{ color: 'var(--off-white)', fontWeight: 600, fontSize: 13 }}>Choose the name shown on the leaderboard</div>
      <div style={{ color: 'var(--grey-mid)', fontSize: 12, lineHeight: 1.5 }}>
        Other members currently see you as <strong style={{ color: 'var(--off-white)' }}>{shownAs}</strong>.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label htmlFor="name-notice-input" className="sr-only" style={srOnly}>Leaderboard name</label>
        <input
          id="name-notice-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={DISPLAY_NAME_MAX}
          placeholder="e.g. Glory A." autoComplete="name"
          style={{ flex: '1 1 200px', minWidth: 0, padding: '8px 12px', background: 'var(--navy-dark, transparent)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--off-white)', fontSize: 13 }}
        />
        <button type="submit" disabled={busy || !name.trim()} className="mt-btn" style={{ padding: '8px 16px', fontSize: 13, background: 'var(--orange)', color: '#fff', border: 'none', cursor: busy ? 'wait' : 'pointer', opacity: busy || !name.trim() ? 0.6 : 1 }}>
          {busy ? 'Saving…' : 'Save name'}
        </button>
      </div>
      {error && <div role="alert" style={{ color: 'var(--error)', fontSize: 12 }}>{error}</div>}
    </form>
  )
}

const box: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', marginBottom: 20,
  border: '1px solid color-mix(in srgb, var(--orange) 35%, transparent)',
  background: 'color-mix(in srgb, var(--orange) 6%, transparent)',
}
const srOnly: React.CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }
