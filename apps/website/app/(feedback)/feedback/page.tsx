'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FeedbackLandingPage() {
  const router            = useRouter()
  const [id,    setId]    = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = id.trim().toUpperCase()
    if (!clean.match(/^NXT-\d{4}-\d{4}$/)) {
      setError('Please enter a valid report ID in the format NXT-YYYY-XXXX.')
      return
    }
    router.push(`/feedback/${clean}`)
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .fb-page { min-height: 100vh; background: var(--navy-deep); display: flex;
          align-items: center; justify-content: center; padding: 24px; }
        .fb-card { background: var(--navy); border: 1px solid rgba(255,255,255,0.08);
          width: 100%; max-width: 440px; padding: 40px 36px; position: relative; }
        .fb-corner-tl { position: absolute; top: -1px; left: -1px; width: 18px;
          height: 18px; border-top: 2px solid var(--orange);
          border-left: 2px solid var(--orange); }
        .fb-corner-br { position: absolute; bottom: -1px; right: -1px; width: 18px;
          height: 18px; border-bottom: 2px solid var(--orange);
          border-right: 2px solid var(--orange); }
        .fb-brand { font-family: var(--font-mono); font-size: 10px;
          letter-spacing: 0.2em; text-transform: uppercase; color: var(--orange);
          margin-bottom: 28px; }
        .fb-title { font-family: var(--font-exo2); font-weight: 700; font-size: 26px;
          color: var(--white); margin-bottom: 8px; line-height: 1.2; }
        .fb-subtitle { font-family: var(--font-dm); font-size: 13px;
          color: var(--grey-mid); line-height: 1.7; margin-bottom: 28px; }
        .fb-label { font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid);
          margin-bottom: 8px; display: block; }
        .fb-input { width: 100%; background: var(--navy-mid);
          border: 1px solid rgba(255,255,255,0.08); color: var(--white);
          font-family: var(--font-mono); font-size: 14px; padding: 12px 14px;
          outline: none; letter-spacing: 0.08em;
          transition: border-color 0.15s ease; }
        .fb-input:focus { border-color: var(--orange); }
        .fb-input::placeholder { color: var(--grey-dark); }
        .fb-error { font-family: var(--font-dm); font-size: 12px;
          color: var(--error); margin-top: 6px; }
        .fb-btn { width: 100%; margin-top: 20px; padding: 13px;
          background: var(--orange); border: none; color: var(--white);
          font-family: var(--font-mono); font-size: 10px; cursor: pointer;
          letter-spacing: 0.15em; text-transform: uppercase;
          transition: background 0.15s ease; }
        .fb-btn:hover { background: #C4521A; }
        .fb-note { font-family: var(--font-dm); font-size: 11px;
          color: var(--grey-mid); margin-top: 20px; line-height: 1.6;
          text-align: center; }
      `}</style>

      <div className="fb-page">
        <div className="fb-card">
          <div className="fb-corner-tl" />
          <div className="fb-corner-br" />
          <div className="fb-brand">Nextrium Global Innovations Ltd</div>
          <div className="fb-title">View your evaluation report</div>
          <p className="fb-subtitle">
            Enter the report ID from your application status email to view
            the findings from your evaluation.
          </p>
          <form onSubmit={handleSubmit}>
            <label className="fb-label" htmlFor="reportId">Report ID</label>
            <input
              className="fb-input"
              id="reportId"
              type="text"
              placeholder="NXT-2026-XXXX"
              value={id}
              onChange={(e) => { setId(e.target.value); setError('') }}
            />
            {error && <div className="fb-error">{error}</div>}
            <button type="submit" className="fb-btn">View report</button>
          </form>
          <p className="fb-note">
            Your report ID was included in the email you received from
            careers@nextrium.org after your application was reviewed.
          </p>
        </div>
      </div>
    </>
  )
}