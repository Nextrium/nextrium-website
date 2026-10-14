'use client'

import { useState } from 'react'
import { normalizeUrl, isValidUrl } from '@nextrium/utils/normalizeUrl'

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export default function ExecutiveApplicationForm({
  roleId,
  roleSlug,
}: {
  roleId: string
  roleSlug: string
}) {
  const [formState, setFormState] = useState<FormState>('idle')
  const [submitError, setSubmitError] = useState('')
  const isCTO = roleSlug === 'chief-technology-officer'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const form     = e.currentTarget
    const formData = new FormData(form)

    const linkedinRaw = String(formData.get('linkedin_url') ?? '')
    const githubRaw    = String(formData.get('github_url') ?? '')

    if (linkedinRaw.trim() && !isValidUrl(linkedinRaw)) {
      setSubmitError('LinkedIn link doesn’t look like a valid URL.')
      setFormState('error')
      return
    }
    if (githubRaw.trim() && !isValidUrl(githubRaw)) {
      setSubmitError('GitHub link doesn’t look like a valid URL.')
      setFormState('error')
      return
    }

    formData.set('linkedin_url', normalizeUrl(linkedinRaw))
    if (githubRaw.trim()) formData.set('github_url', normalizeUrl(githubRaw))

    setSubmitError('')
    setFormState('submitting')

    formData.append('role_id', roleId)
    formData.append('application_type', 'executive')

    try {
      const res  = await fetch('/api/applications', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong.')
      setFormState('success')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '')
      setFormState('error')
    }
  }

  return (
    <>
      <style>{`
        .exec-form { display: flex; flex-direction: column; gap: 20px; width: 100%; background: var(--navy); border: 1px solid rgba(255,255,255,0.08); padding: 40px; position: relative; overflow: hidden; }
        .exec-form::before, .exec-form::after { content: ''; position: absolute; width: 16px; height: 16px; border-color: var(--orange); border-style: solid; z-index: 1; }
        .exec-form::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .exec-form::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .exec-form-group { display: flex; flex-direction: column; gap: 8px; }
        .exec-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .exec-form-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); }
        .exec-form-label-optional { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; color: var(--grey-dark); margin-left: 8px; }
        .exec-form-input { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 12px 16px; outline: none; transition: border-color 0.15s ease; width: 100%; }
        .exec-form-input:focus { border-color: var(--orange); }
        .exec-form-input::placeholder { color: var(--grey-dark); }
        .exec-form-textarea { resize: vertical; min-height: 140px; }
        .exec-form-submit { font-family: var(--font-dm); font-size: 14px; color: var(--white); background: var(--orange); border: 1px solid var(--orange); padding: 16px 24px; cursor: pointer; transition: background 0.15s ease; display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; }
        .exec-form-submit:hover:not(:disabled) { background: var(--orange-f, #C4521A); }
        .exec-form-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .exec-error { padding: 10px 14px; font-size: 12px; background: rgba(232,69,69,0.08); border: 1px solid rgba(232,69,69,0.3); color: var(--error); }
        .exec-success { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; padding: 40px 16px; }
        .exec-success-icon { width: 56px; height: 56px; background: rgba(34,193,122,0.1); border: 1px solid rgba(34,193,122,0.2); display: flex; align-items: center; justify-content: center; font-size: 24px; color: var(--success); }
        .exec-success-title { font-family: var(--font-exo2); font-weight: 800; font-size: 26px; color: var(--white); letter-spacing: -0.5px; }
        .exec-success-desc { font-size: 14px; color: var(--grey-mid); line-height: 1.7; max-width: 360px; }
        @media (max-width: 600px) { .exec-form-row { grid-template-columns: 1fr; } .exec-form { padding: 28px; } }
      `}</style>

      {formState === 'success' ? (
        <div className="exec-form">
          <div className="exec-success">
            <div className="exec-success-icon">✓</div>
            <div className="exec-success-title">Received.</div>
            <p className="exec-success-desc">
              This is a leadership decision and we will take the time it deserves. We will be in touch directly within two weeks.
            </p>
          </div>
        </div>
      ) : (
        <form className="exec-form" onSubmit={handleSubmit} noValidate>
          {formState === 'error' && (
            <div className="exec-error">{submitError || 'Something went wrong. Please try again.'}</div>
          )}

          <div className="exec-form-row">
            <div className="exec-form-group">
              <label className="exec-form-label" htmlFor="exec-name">Full name</label>
              <input className="exec-form-input" id="exec-name" name="name" type="text" placeholder="Your full name" required />
            </div>
            <div className="exec-form-group">
              <label className="exec-form-label" htmlFor="exec-email">Email address</label>
              <input className="exec-form-input" id="exec-email" name="email" type="email" placeholder="your@email.com" required />
            </div>
          </div>

          <div className="exec-form-group">
            <label className="exec-form-label" htmlFor="exec-linkedin">LinkedIn profile</label>
            <input className="exec-form-input" id="exec-linkedin" name="linkedin_url" type="url" placeholder="https://linkedin.com/in/..." required />
          </div>

          {isCTO && (
            <div className="exec-form-group">
              <label className="exec-form-label" htmlFor="exec-github">GitHub profile <span className="exec-form-label-optional">optional</span></label>
              <input className="exec-form-input" id="exec-github" name="github_url" type="url" placeholder="https://github.com/yourusername" />
            </div>
          )}

          <div className="exec-form-group">
            <label className="exec-form-label" htmlFor="exec-statement">Why are you the right person to lead this function at NexTrium right now?</label>
            <textarea className="exec-form-input exec-form-textarea" id="exec-statement" name="statement" placeholder="Be direct. Tell us what you would bring, what you have done that proves it, and why now." required />
          </div>

          <button type="submit" className="exec-form-submit" disabled={formState === 'submitting'}>
            <span>{formState === 'submitting' ? 'Sending...' : 'Send application'}</span>
            <span>{formState === 'submitting' ? '...' : '→'}</span>
          </button>
        </form>
      )}
    </>
  )
}