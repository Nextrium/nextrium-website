'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Post } from '@nextrium/supabase/database'
import { MAX_PINS, PIN_SITES, applyPinOp, type PinOp, type PinSite } from '@/lib/dashboard/pins'
import { setPostPins } from './pinActions'

type Pins = Record<PinSite, string[]>

/** Shared state for the panel and the per-row pin buttons. */
export function usePins(initial: Pins) {
  const router = useRouter()
  const [pins, setPins] = useState<Pins>(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function change(site: PinSite, op: PinOp, done: string) {
    const next = applyPinOp(pins[site], op)
    if ('error' in next) { setMessage({ ok: false, text: next.error }); return }
    setBusy(`${site}:${op.id}`); setMessage(null)
    const res = await setPostPins(site, next.ids)
    setBusy(null)
    if (!res.ok) { setMessage({ ok: false, text: res.error }); return }
    setPins({ ...pins, [site]: next.ids })
    setMessage({ ok: true, text: done })
    router.refresh()
  }
  return { pins, busy, message, change }
}

export default function PinnedPanel({ posts, state }: { posts: Post[]; state: ReturnType<typeof usePins> }) {
  const { pins, busy, message, change } = state
  const byId = new Map(posts.map((p) => [p.id, p]))
  return (
    <section className="pin-panel" aria-labelledby="pin-panel-title">
      <div className="pin-panel-head">
        <h2 id="pin-panel-title" className="pin-panel-title">Pinned posts</h2>
        <span className="pin-panel-note">Up to {MAX_PINS} per site, shown first in this order. The Nextrium blog can pin any brand&apos;s post; a brand&apos;s own site only its own.</span>
      </div>
      {message && <div className={`pin-msg ${message.ok ? 'ok' : 'bad'}`} role={message.ok ? 'status' : 'alert'}>{message.text}</div>}
      <div className="pin-sites">
        {(Object.keys(PIN_SITES) as PinSite[]).map((site) => (
          <div key={site} className="pin-site">
            <div className="pin-site-name">{PIN_SITES[site]} <span className="pin-count">{pins[site].length}/{MAX_PINS}</span></div>
            {pins[site].length === 0 ? (
              <div className="pin-empty">Nothing pinned. The newest posts show first.</div>
            ) : (
              <ol className="pin-list">
                {pins[site].map((id, i) => {
                  const p = byId.get(id)
                  const label = p ? p.title : 'A post that no longer exists'
                  const working = busy === `${site}:${id}`
                  return (
                    <li key={id} className="pin-item">
                      <span className="pin-pos">{i + 1}</span>
                      <span className="pin-title">{label}{p && !p.is_published ? ' (unpublished, hidden)' : ''}</span>
                      <span className="pin-actions">
                        <button type="button" className="pin-btn" aria-label={`Move "${label}" up`} disabled={!!busy || i === 0} onClick={() => change(site, { kind: 'move', id, by: -1 }, 'Order saved.')}>↑</button>
                        <button type="button" className="pin-btn" aria-label={`Move "${label}" down`} disabled={!!busy || i === pins[site].length - 1} onClick={() => change(site, { kind: 'move', id, by: 1 }, 'Order saved.')}>↓</button>
                        <button type="button" className="pin-btn text" disabled={!!busy} onClick={() => change(site, { kind: 'unpin', id }, `Unpinned from the ${PIN_SITES[site]}.`)}>{working ? 'Saving…' : 'Unpin'}</button>
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export const PIN_CSS = `
  .pin-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 14px; }
  .pin-panel-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 16px; }
  .pin-panel-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); margin: 0; font-weight: 400; }
  .pin-panel-note { font-size: 12px; color: var(--grey-mid); }
  .pin-sites { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
  .pin-site { border: 1px solid rgba(255,255,255,0.06); padding: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .pin-site-name { font-size: 13px; color: var(--white); font-weight: 600; }
  .pin-count { font-family: var(--font-mono); font-size: 9px; color: var(--grey-mid); margin-left: 6px; }
  .pin-empty { font-size: 12px; color: var(--grey-mid); }
  .pin-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .pin-item { display: grid; grid-template-columns: 20px 1fr auto; align-items: center; gap: 10px; padding: 8px 10px; background: rgba(255,255,255,0.02); }
  .pin-pos { font-family: var(--font-mono); font-size: 11px; color: var(--orange-w); }
  .pin-title { font-size: 13px; color: var(--off-white); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .pin-actions { display: flex; gap: 4px; }
  .pin-btn { min-width: 28px; height: 26px; padding: 0 8px; background: none; border: 1px solid rgba(255,255,255,0.12); color: var(--off-white); cursor: pointer; font-size: 12px; }
  .pin-btn.text { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-mid); }
  .pin-btn:disabled { opacity: 0.4; cursor: default; }
  .pin-btn:focus-visible { outline: 1px solid var(--orange); outline-offset: 1px; }
  .pin-row-btn { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--orange-w); background: none; border: 1px solid color-mix(in srgb, var(--orange) 35%, transparent); padding: 5px 8px; cursor: pointer; white-space: nowrap; }
  .pin-row-btn.on { color: var(--grey-mid); border-color: rgba(255,255,255,0.12); }
  .pin-row-btn:disabled { opacity: 0.4; cursor: default; }
  .pin-row-btn:focus-visible { outline: 1px solid var(--orange); outline-offset: 1px; }
  .pin-row-actions { display: flex; flex-wrap: wrap; gap: 6px; }
  .pin-msg { padding: 8px 12px; font-size: 12px; border: 1px solid; }
  .pin-msg.ok { color: var(--success); border-color: color-mix(in srgb, var(--success) 30%, transparent); background: color-mix(in srgb, var(--success) 8%, transparent); }
  .pin-msg.bad { color: var(--error); border-color: color-mix(in srgb, var(--error) 30%, transparent); background: color-mix(in srgb, var(--error) 8%, transparent); }
`
