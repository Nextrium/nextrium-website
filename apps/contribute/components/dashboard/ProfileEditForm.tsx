'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { brand } from '@nextrium/brand'
import { updateProfile, type WorkState } from '@/app/actions/work'
import { AVAILABILITY, LIMITS, TIMEZONES } from '@/lib/registration'
import type { MyProfile } from '@/lib/contributorData'
import { C, F, tint } from '@/lib/theme'

const IDLE: WorkState = { status: 'idle' }
const input: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: C.void, border: `1px solid ${C.border}`,
  borderRadius: 8, color: C.light, fontFamily: F.body, fontSize: 13,
}
const hint: React.CSSProperties = { textTransform: 'none', letterSpacing: 0, color: C.dim }

export default function ProfileEditForm({ me }: { me: MyProfile }) {
  const [editing, setEditing] = useState(false)
  const [state, action, saving] = useActionState(updateProfile, IDLE)
  const [notify, setNotify] = useState(me.notification_email)

  const router = useRouter()
  useEffect(() => {
    if (state.status !== 'done') return
    setEditing(false)
    router.refresh()
  }, [state, router])

  const tz = me.timezone && (TIMEZONES as readonly string[]).includes(me.timezone) ? me.timezone : TIMEZONES[0]
  const hours = AVAILABILITY.some((a) => a.value === me.availability_hours_per_week) ? me.availability_hours_per_week! : 5

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="p-5 rounded-xl border" style={{ background: C.depth, borderColor: C.border }}>
        <p style={{ fontFamily: F.body, fontWeight: 500, fontSize: 11, color: C.dim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Fixed fields</p>
        <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 12, color: C.mute, lineHeight: 1.65 }}>
          Name, email, contributor type and categories cannot be changed here. To update them, contact the core team at{' '}
          <a href={`mailto:${brand.emails.contributors}`} style={{ color: C.accent }}>{brand.emails.contributors}</a>.
        </p>
      </div>

      {state.status === 'done' && !editing && (
        <p role="status" className="p-4 rounded-xl border" style={{ fontFamily: F.body, fontSize: 13, color: C.teal, background: tint('--teal-l', 8), borderColor: tint('--teal-l', 25) }}>
          {state.message}
        </p>
      )}

      {!editing ? (
        <button type="button" onClick={() => setEditing(true)} className="btn-outline" style={{ fontSize: 13, alignSelf: 'flex-start', cursor: 'pointer' }}>
          Edit profile
        </button>
      ) : (
        <form action={action} className="flex flex-col gap-5 p-6 rounded-2xl border" style={{ background: C.depth, borderColor: C.border }}>
          <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 15, color: C.light }}>Edit profile</p>

          <div>
            <label className="field-label" htmlFor="pf-bio">Bio</label>
            <textarea id="pf-bio" name="bio" defaultValue={me.bio ?? ''} rows={3} required maxLength={LIMITS.bio} className="portal-input" style={{ ...input, resize: 'vertical' }} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="pf-location">Location</label>
              <input id="pf-location" name="location" defaultValue={me.location ?? ''} required maxLength={LIMITS.location} className="portal-input" style={input} />
            </div>
            <div>
              <label className="field-label" htmlFor="pf-timezone">Timezone</label>
              <select id="pf-timezone" name="timezone" defaultValue={tz} className="portal-input" style={input}>
                {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="pf-skills">Skills <span style={hint}>(comma separated)</span></label>
            <input id="pf-skills" name="skills" defaultValue={(me.skills ?? []).join(', ')} className="portal-input" style={input} />
          </div>

          <div>
            <label className="field-label" htmlFor="pf-availability">Availability</label>
            <select id="pf-availability" name="availability_hours_per_week" defaultValue={hours} className="portal-input" style={input}>
              {AVAILABILITY.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="pf-github">GitHub handle</label>
              <input id="pf-github" name="github_handle" defaultValue={me.github_handle ?? ''} className="portal-input" style={input} />
            </div>
            <div>
              <label className="field-label" htmlFor="pf-twitter">Twitter / X handle</label>
              <input id="pf-twitter" name="twitter_handle" defaultValue={me.twitter_handle ?? ''} className="portal-input" style={input} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="pf-linkedin">LinkedIn URL</label>
              <input id="pf-linkedin" name="linkedin_url" type="url" defaultValue={me.linkedin_url ?? ''} maxLength={LIMITS.url} className="portal-input" style={input} />
            </div>
            <div>
              <label className="field-label" htmlFor="pf-portfolio">Portfolio URL</label>
              <input id="pf-portfolio" name="portfolio_url" type="url" defaultValue={me.portfolio_url ?? ''} maxLength={LIMITS.url} className="portal-input" style={input} />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="pf-wallet">Wallet address <span style={hint}>(optional)</span></label>
            <input id="pf-wallet" name="wallet_address" defaultValue={me.wallet_address ?? ''} maxLength={LIMITS.wallet} className="portal-input" style={{ ...input, fontFamily: F.mono, fontSize: 12 }} />
          </div>

          <label className="flex items-center gap-3 p-4 rounded-xl border" style={{ background: notify ? tint('--orange', 10) : C.void, borderColor: notify ? C.core : C.border, cursor: 'pointer' }}>
            <input type="checkbox" name="notification_email" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ accentColor: 'var(--orange)', width: 16, height: 16 }} />
            <span>
              <span style={{ display: 'block', fontFamily: F.display, fontWeight: 600, fontSize: 13, color: notify ? C.accent : C.light }}>Email reminders</span>
              <span style={{ display: 'block', fontFamily: F.body, fontWeight: 300, fontSize: 11.5, color: C.mute }}>Deadline reminders for your claimed tasks, sent to {me.email}</span>
            </span>
          </label>

          {state.status === 'error' && <p role="alert" style={{ fontFamily: F.body, fontSize: 13, color: C.danger }}>{state.message}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary" style={{ fontSize: 13, opacity: saving ? 0.7 : 1, cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-outline" style={{ fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
