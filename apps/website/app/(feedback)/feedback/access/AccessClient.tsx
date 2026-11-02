'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { brand } from '@nextrium/brand'
import { requestReportCode, verifyReportCode } from './actions'

export default function AccessClient({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await requestReportCode(reportId, email)
    setBusy(false)
    if (!result.ok) { setError(result.message); return }
    setNotice(result.message)
    setCode('')
    setStep('code')
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const result = await verifyReportCode(email, code)
    if (!result.ok) {
      setBusy(false)
      setError(result.message ?? 'That code is invalid or has expired. Request a new one.')
      return
    }
    router.replace(`/feedback/${reportId}`)
    router.refresh()
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .fa-page { min-height: 100vh; background: var(--navy-deep); display: flex; align-items: center; justify-content: center; padding: 24px; }
        .fa-card { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); width: 100%; max-width: 440px; padding: 40px 36px; position: relative; }
        .fa-corner-tl { position: absolute; top: -1px; left: -1px; width: 18px; height: 18px; border-top: 2px solid var(--orange); border-left: 2px solid var(--orange); }
        .fa-corner-br { position: absolute; bottom: -1px; right: -1px; width: 18px; height: 18px; border-bottom: 2px solid var(--orange); border-right: 2px solid var(--orange); }
        .fa-brand { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--orange); margin-bottom: 28px; }
        .fa-title { font-family: var(--font-exo2); font-weight: 700; font-size: 26px; color: var(--white); margin-bottom: 8px; line-height: 1.2; }
        .fa-subtitle { font-family: var(--font-dm); font-size: 13px; color: var(--grey-mid); line-height: 1.7; margin-bottom: 28px; }
        .fa-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); margin-bottom: 8px; display: block; }
        .fa-input { width: 100%; background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-mono); font-size: 14px; padding: 12px 14px; outline: none; }
        .fa-input:focus { border-color: var(--orange); }
        .fa-error { font-family: var(--font-dm); font-size: 12px; color: var(--error); margin-top: 6px; }
        .fa-btn { width: 100%; margin-top: 20px; padding: 13px; background: var(--orange); border: none; color: var(--white); font-family: var(--font-mono); font-size: 10px; cursor: pointer; letter-spacing: 0.15em; text-transform: uppercase; }
        .fa-btn:hover { background: var(--orange-f); }
        .fa-btn:disabled { opacity: 0.6; cursor: default; }
        .fa-link { display: block; width: 100%; margin-top: 14px; background: none; border: none; color: var(--orange); font-family: var(--font-dm); font-size: 12px; cursor: pointer; }
        .fa-note { font-family: var(--font-dm); font-size: 11px; color: var(--grey-mid); margin-top: 20px; line-height: 1.6; text-align: center; }
      `}</style>

      <div className="fa-page">
        <div className="fa-card">
          <div className="fa-corner-tl" />
          <div className="fa-corner-br" />
          <div className="fa-brand">{brand.legalName}</div>
          <div className="fa-title">Verify your access</div>

          {step === 'email' ? (
            <form onSubmit={handleEmail}>
              <p className="fa-subtitle">
                Report {reportId} is private. Enter the email address you applied with and we&apos;ll send you a one-time code.
              </p>
              <label className="fa-label" htmlFor="accessEmail">Email address</label>
              <input className="fa-input" id="accessEmail" type="email" autoComplete="email" required value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} />
              {error && <div className="fa-error" role="alert">{error}</div>}
              <button type="submit" className="fa-btn" disabled={busy}>{busy ? 'Sending' : 'Send code'}</button>
            </form>
          ) : (
            <form onSubmit={handleCode}>
              <p className="fa-subtitle">{notice}</p>
              <label className="fa-label" htmlFor="accessCode">6-digit code</label>
              <input className="fa-input" id="accessCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => { setCode(e.target.value.trim()); setError('') }} />
              {error && <div className="fa-error" role="alert">{error}</div>}
              <button type="submit" className="fa-btn" disabled={busy}>{busy ? 'Checking' : 'View report'}</button>
              <button type="button" className="fa-link" onClick={() => { setStep('email'); setError('') }}>Use a different email or request a new code</button>
            </form>
          )}

          <p className="fa-note">Didn&apos;t get a code? Check your spam folder, or contact {brand.emails.careers}.</p>
        </div>
      </div>
    </>
  )
}
