'use client'

import { startTransition, useActionState, useState } from 'react'
import Link from 'next/link'
import { submitApplication, type ApplyState } from '@/app/actions/register'
import { AVAILABILITY, CATEGORIES, LIMITS, MAX_CATEGORIES, TIMEZONES } from '@/lib/registration'
import { C, F, GRADIENT, tint } from '@/lib/theme'

export interface RegisterInitial {
  name: string
  contributor_type: string | null
  team_name: string | null
  location: string | null
  timezone: string | null
  categories: string[]
  skills: string[] | null
  availability_hours_per_week: number | null
  bio: string | null
  github_handle: string | null
  twitter_handle: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  wallet_address: string | null
  notification_email: boolean | null
}

type Step = 1 | 2 | 3

const IDLE: ApplyState = { status: 'idle' }

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  background: C.void,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: C.light,
  fontFamily: F.body,
  fontSize: 13,
}

const hint: React.CSSProperties = { textTransform: 'none', letterSpacing: 0, color: C.dim }

function Check({ on, size = 14 }: { on: boolean; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex-shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: size > 14 ? 4 : 3, border: `2px solid ${on ? C.core : C.dim}`, background: on ? C.core : 'transparent', transition: 'all 0.2s' }}
    >
      {on && (
        <svg width={size - 6} height={size - 6} viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <path d="M1.5 5l2.5 2.5 4.5-5" />
        </svg>
      )}
    </span>
  )
}

export default function RegisterForm({ email, initial, revisionNotes }: { email: string; initial: RegisterInitial | null; revisionNotes: string | null }) {
  const [step, setStep] = useState<Step>(1)
  const [state, dispatch, submitting] = useActionState(submitApplication, IDLE)
  const isResubmission = initial !== null

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    contributor_type: initial?.contributor_type === 'team' ? 'team' : 'individual',
    team_name: initial?.team_name ?? '',
    location: initial?.location ?? '',
    timezone: initial?.timezone && (TIMEZONES as readonly string[]).includes(initial.timezone) ? initial.timezone : TIMEZONES[0],
    categories: (initial?.categories ?? []).filter((c) => CATEGORIES.some((k) => k.id === c)).slice(0, MAX_CATEGORIES),
    skills: (initial?.skills ?? []).join(', '),
    availability_hours_per_week: AVAILABILITY.some((a) => a.value === initial?.availability_hours_per_week) ? (initial?.availability_hours_per_week as number) : 5,
    bio: initial?.bio ?? '',
    github_handle: initial?.github_handle ?? '',
    twitter_handle: initial?.twitter_handle ?? '',
    linkedin_url: initial?.linkedin_url ?? '',
    portfolio_url: initial?.portfolio_url ?? '',
    wallet_address: initial?.wallet_address ?? '',
    notification_email: initial?.notification_email ?? true,
  })

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const canProceedStep1 = Boolean(
    form.name.trim().length >= 2 && form.location.trim().length >= 2 && (form.contributor_type === 'individual' || form.team_name.trim())
  )
  const canProceedStep2 = form.categories.length > 0 && Boolean(form.bio.trim())

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    for (const [k, v] of Object.entries(form)) {
      if (k === 'categories') (v as string[]).forEach((c) => fd.append('categories', c))
      else if (k === 'notification_email') { if (v) fd.append(k, 'on') }
      else fd.append(k, String(v))
    }
    startTransition(() => dispatch(fd))
  }

  return (
    <div className="bg-void pt-20 pb-28">
      <div className="max-w-2xl mx-auto px-8 lg:px-14">

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/" className="link-quiet" style={{ fontSize: 13 }}>Contribute</Link>
            <span style={{ color: C.dim }}>/</span>
            <span style={{ fontFamily: F.body, fontSize: 13, color: C.mute }}>Register</span>
          </div>
          <h1 className="mb-3" style={{ fontFamily: F.display, fontWeight: 600, fontSize: 'clamp(28px,4vw,52px)', letterSpacing: '-0.025em', lineHeight: 1.08, color: C.light }}>
            {isResubmission ? 'Update your application' : 'Contributor registration'}
          </h1>
          <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 15, color: C.mute, lineHeight: 1.75 }}>
            Tell us about yourself and your area of expertise. The core team reviews all applications before activation.
          </p>
        </div>

        {isResubmission && revisionNotes && (
          <div className="p-5 rounded-2xl border mb-10" style={{ background: C.depth, borderColor: tint('--slate-l', 30) }}>
            <p style={{ fontFamily: F.body, fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.info, marginBottom: 8 }}>
              Feedback from the core team
            </p>
            <p style={{ fontFamily: F.body, fontSize: 14, color: C.light, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{revisionNotes}</p>
          </div>
        )}

        {/* Step indicator */}
        <ol className="flex items-center gap-3 mb-10 flex-wrap" aria-label="Application steps">
          {([1, 2, 3] as Step[]).map((s) => (
            <li key={s} className="flex items-center gap-3" aria-current={step === s ? 'step' : undefined}>
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 32,
                  height: 32,
                  background: step === s ? GRADIENT : step > s ? tint('--orange', 20) : C.depth,
                  border: `1px solid ${step >= s ? C.core : C.border}`,
                  transition: 'all 0.3s',
                }}
              >
                {step > s ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                ) : (
                  <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 12, color: step === s ? 'white' : C.mute }}>{s}</span>
                )}
              </div>
              <span style={{ fontFamily: F.body, fontSize: 12, color: step === s ? C.accent : C.mute }}>
                {s === 1 ? 'Identity' : s === 2 ? 'Expertise' : 'Links'}
              </span>
              {s < 3 && <div style={{ width: 32, height: 1, background: step > s ? C.core : C.border, transition: 'background 0.3s' }} />}
            </li>
          ))}
        </ol>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="p-8 rounded-2xl border" style={{ background: C.depth, borderColor: C.border }}>

            {/* Step 1 — Identity */}
            {step === 1 && (
              <div className="flex flex-col gap-5">
                <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 16, color: C.light, marginBottom: 4 }}>Tell us who you are</p>

                <div>
                  <span className="field-label" id="type-label">Contributor type</span>
                  <div className="flex gap-3" role="radiogroup" aria-labelledby="type-label">
                    {(['individual', 'team'] as const).map((t) => {
                      const on = form.contributor_type === t
                      return (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => update('contributor_type', t)}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: 8,
                            border: `1px solid ${on ? C.core : C.border}`,
                            background: on ? tint('--orange', 12) : C.void,
                            color: on ? C.accent : C.mute,
                            fontFamily: F.body,
                            fontSize: 13,
                            fontWeight: 500,
                            textTransform: 'capitalize',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          {t}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="field-label" htmlFor="reg-name">{form.contributor_type === 'team' ? 'Your name' : 'Full name'}</label>
                    <input id="reg-name" type="text" placeholder="Adunola Fashola" autoComplete="name" maxLength={LIMITS.name} value={form.name} onChange={(e) => update('name', e.target.value)} required className="portal-input" style={inputStyle} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="reg-email">Email address</label>
                    <input id="reg-email" type="email" value={email} readOnly aria-describedby="reg-email-hint" className="portal-input" style={{ ...inputStyle, color: C.mute, cursor: 'default' }} />
                    <p id="reg-email-hint" style={{ fontFamily: F.body, fontSize: 11, color: C.dim, marginTop: 5 }}>The email you signed in with.</p>
                  </div>
                </div>

                {form.contributor_type === 'team' && (
                  <div>
                    <label className="field-label" htmlFor="reg-team">Team name</label>
                    <input id="reg-team" type="text" placeholder="Lagos Dev Collective" maxLength={LIMITS.teamName} value={form.team_name} onChange={(e) => update('team_name', e.target.value)} className="portal-input" style={inputStyle} />
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="field-label" htmlFor="reg-location">Location</label>
                    <input id="reg-location" type="text" placeholder="Lagos, Nigeria" maxLength={LIMITS.location} value={form.location} onChange={(e) => update('location', e.target.value)} required className="portal-input" style={inputStyle} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="reg-timezone">Timezone</label>
                    <select id="reg-timezone" value={form.timezone} onChange={(e) => update('timezone', e.target.value)} className="portal-input" style={inputStyle}>
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button type="button" onClick={() => setStep(2)} disabled={!canProceedStep1} className="btn-primary justify-center" style={{ opacity: canProceedStep1 ? 1 : 0.4, marginTop: 8, cursor: canProceedStep1 ? 'pointer' : 'not-allowed' }}>
                  Continue to expertise
                </button>
              </div>
            )}

            {/* Step 2 — Expertise */}
            {step === 2 && (
              <div className="flex flex-col gap-5">
                <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 16, color: C.light, marginBottom: 4 }}>What do you bring?</p>

                <fieldset>
                  <legend className="field-label">
                    Categories <span style={hint}>(select up to {MAX_CATEGORIES})</span>
                  </legend>
                  <div className="flex flex-col gap-2">
                    {CATEGORIES.map((c) => {
                      const selected = form.categories.includes(c.id)
                      const maxReached = form.categories.length >= MAX_CATEGORIES && !selected
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="checkbox"
                          aria-checked={selected}
                          disabled={maxReached}
                          onClick={() => update('categories', selected ? form.categories.filter((x) => x !== c.id) : [...form.categories, c.id])}
                          className="flex items-start gap-3 p-4 rounded-xl border text-left"
                          style={{
                            background: selected ? tint('--orange', 10) : C.void,
                            borderColor: selected ? C.core : C.border,
                            cursor: maxReached ? 'not-allowed' : 'pointer',
                            opacity: maxReached ? 0.4 : 1,
                            transition: 'all 0.2s',
                          }}
                        >
                          <span className="mt-0.5"><Check on={selected} /></span>
                          <span>
                            <span style={{ display: 'block', fontFamily: F.display, fontWeight: 600, fontSize: 13, color: selected ? C.accent : C.light, marginBottom: 2 }}>{c.label}</span>
                            <span style={{ display: 'block', fontFamily: F.body, fontWeight: 300, fontSize: 11.5, color: C.mute, lineHeight: 1.5 }}>{c.desc}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {form.categories.length === MAX_CATEGORIES && (
                    <p style={{ fontFamily: F.body, fontSize: 11, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>
                      Maximum reached. To change categories later contact the core team.
                    </p>
                  )}
                </fieldset>

                <div>
                  <label className="field-label" htmlFor="reg-skills">
                    Skills <span style={hint}>(comma separated)</span>
                  </label>
                  <input id="reg-skills" type="text" placeholder="TypeScript, React, Figma, Research..." value={form.skills} onChange={(e) => update('skills', e.target.value)} className="portal-input" style={inputStyle} />
                </div>

                <div>
                  <label className="field-label" htmlFor="reg-availability">Availability</label>
                  <select id="reg-availability" value={form.availability_hours_per_week} onChange={(e) => update('availability_hours_per_week', Number(e.target.value))} className="portal-input" style={inputStyle}>
                    {AVAILABILITY.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="reg-bio">Bio</label>
                  <textarea
                    id="reg-bio"
                    placeholder="Tell us about your background, what you have built, and why you want to contribute."
                    value={form.bio}
                    onChange={(e) => update('bio', e.target.value)}
                    required
                    rows={4}
                    maxLength={LIMITS.bio}
                    className="portal-input"
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>

                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setStep(1)} className="btn-outline" style={{ fontSize: 13, cursor: 'pointer' }}>Back</button>
                  <button type="button" onClick={() => setStep(3)} disabled={!canProceedStep2} className="btn-primary flex-1 justify-center" style={{ opacity: canProceedStep2 ? 1 : 0.4, cursor: canProceedStep2 ? 'pointer' : 'not-allowed' }}>
                    Continue to links
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Links */}
            {step === 3 && (
              <div className="flex flex-col gap-5">
                <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 16, color: C.light, marginBottom: 4 }}>Where can we find your work?</p>
                <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 13, color: C.mute, lineHeight: 1.65, marginTop: -8 }}>
                  All fields are optional but help the core team review your application faster.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="field-label" htmlFor="reg-github">GitHub handle</label>
                    <input id="reg-github" type="text" placeholder="yourhandle" value={form.github_handle} onChange={(e) => update('github_handle', e.target.value)} className="portal-input" style={inputStyle} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="reg-twitter">Twitter / X handle</label>
                    <input id="reg-twitter" type="text" placeholder="yourhandle" value={form.twitter_handle} onChange={(e) => update('twitter_handle', e.target.value)} className="portal-input" style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label className="field-label" htmlFor="reg-linkedin">LinkedIn URL</label>
                  <input id="reg-linkedin" type="url" placeholder="https://linkedin.com/in/yourprofile" maxLength={LIMITS.url} value={form.linkedin_url} onChange={(e) => update('linkedin_url', e.target.value)} className="portal-input" style={inputStyle} />
                </div>

                <div>
                  <label className="field-label" htmlFor="reg-portfolio">Portfolio URL</label>
                  <input id="reg-portfolio" type="url" placeholder="https://yourportfolio.com" maxLength={LIMITS.url} value={form.portfolio_url} onChange={(e) => update('portfolio_url', e.target.value)} className="portal-input" style={inputStyle} />
                </div>

                <div>
                  <label className="field-label" htmlFor="reg-wallet">
                    Wallet address <span style={hint}>(optional)</span>
                  </label>
                  <input id="reg-wallet" type="text" placeholder="addr1..." maxLength={LIMITS.wallet} value={form.wallet_address} onChange={(e) => update('wallet_address', e.target.value)} className="portal-input" style={{ ...inputStyle, fontFamily: F.mono, fontSize: 12 }} />
                  <p style={{ fontFamily: F.body, fontSize: 11, color: C.dim, marginTop: 5, lineHeight: 1.5 }}>You can add or update this later.</p>
                </div>

                <div>
                  <span className="field-label">Reminder notifications</span>
                  <p style={{ fontFamily: F.body, fontSize: 12, color: C.mute, marginBottom: 10, lineHeight: 1.6 }}>
                    Choose whether to receive deadline reminders for claimed tasks.
                  </p>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={form.notification_email}
                    onClick={() => update('notification_email', !form.notification_email)}
                    className="flex items-center gap-3 p-4 rounded-xl border text-left w-full"
                    style={{
                      background: form.notification_email ? tint('--orange', 10) : C.void,
                      borderColor: form.notification_email ? C.core : C.border,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Check on={form.notification_email} size={18} />
                    <span>
                      <span style={{ display: 'block', fontFamily: F.display, fontWeight: 600, fontSize: 13, color: form.notification_email ? C.accent : C.light, marginBottom: 2 }}>Email reminders</span>
                      <span style={{ display: 'block', fontFamily: F.body, fontWeight: 300, fontSize: 11.5, color: C.mute, lineHeight: 1.5 }}>Receive deadline reminders at your registered email address</span>
                    </span>
                  </button>
                </div>

                {state.status === 'error' && (
                  <div role="alert" className="p-4 rounded-xl border" style={{ background: tint('--error', 10), borderColor: tint('--error', 30) }}>
                    <p style={{ fontFamily: F.body, fontSize: 13, color: C.danger }}>{state.message}</p>
                  </div>
                )}

                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setStep(2)} className="btn-outline" style={{ fontSize: 13, cursor: 'pointer' }}>Back</button>
                  <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center" style={{ opacity: submitting ? 0.7 : 1, cursor: 'pointer' }}>
                    {submitting ? 'Submitting...' : isResubmission ? 'Resubmit application' : 'Submit application'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
