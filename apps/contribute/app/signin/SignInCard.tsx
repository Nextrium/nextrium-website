'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { sendSignInLink, type SignInState } from '@/app/actions/auth'
import { C, F, tint } from '@/lib/theme'
import IconBadge from '@/components/IconBadge'

const IDLE: SignInState = { status: 'idle' }

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  background: C.void,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  color: C.light,
  fontFamily: F.body,
  fontSize: 14,
}

export default function SignInCard({ next }: { next: string }) {
  const [state, action, sending] = useActionState(sendSignInLink, IDLE)
  const [signupState, signupAction, signupSending] = useActionState(sendSignInLink, IDLE)
  const [email, setEmail] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [showSignup, setShowSignup] = useState(false)
  // Set when the person asks to start over, so the last result stops showing.
  const [dismissed, setDismissed] = useState(false)
  const [signupDismissed, setSignupDismissed] = useState(false)

  const sent = state.status === 'sent' && !dismissed
  const signupSent = signupState.status === 'sent' && !signupDismissed

  return (
    <>
      <div
        className="w-full max-w-md rounded-2xl border p-10 relative"
        style={{ background: tint('--navy', 85), borderColor: C.border, backdropFilter: 'blur(20px)' }}
      >
        {sent ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <IconBadge token="--orange" size={56}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 11l6 6L20 3" />
              </svg>
            </IconBadge>
            <div className="flex flex-col gap-2">
              <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 20, color: C.light }}>Check your email</p>
              <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 14, color: C.mute, lineHeight: 1.7 }}>
                We sent a sign in link to{' '}
                <span style={{ color: C.accent }}>{state.status === 'sent' ? state.email : ''}</span>. Click it to access your contributor dashboard.
              </p>
            </div>
            <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
              The link expires in 60 minutes and can only be used once. Open it in this browser.
            </p>
            <button type="button" onClick={() => { setDismissed(true); setEmail('') }} className="btn-outline" style={{ fontSize: 13, cursor: 'pointer' }}>
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1 mb-8">
              <h1 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 26, letterSpacing: '-0.02em', color: C.light, lineHeight: 1.15 }}>
                Sign in to contribute
              </h1>
              <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 14, color: C.mute, lineHeight: 1.65 }}>
                Enter your email and we will send you a sign in link. No password needed.
              </p>
            </div>

            <form action={(fd) => { setDismissed(false); action(fd) }} className="flex flex-col gap-3">
              <input type="hidden" name="next" value={next} />
              <label htmlFor="signin-email" className="sr-only">Email address</label>
              <input
                id="signin-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
                className="portal-input"
                style={inputStyle}
              />
              {state.status === 'error' && !dismissed && (
                <p role="alert" style={{ fontFamily: F.body, fontSize: 12, color: C.danger }}>{state.message}</p>
              )}
              <button type="submit" disabled={sending} className="btn-primary w-full justify-center" style={{ opacity: sending ? 0.7 : 1, cursor: 'pointer' }}>
                {sending ? 'Sending link...' : 'Send sign in link'}
              </button>
            </form>

            <div className="mt-6 pt-6 flex flex-col gap-3" style={{ borderTop: `1px solid ${C.border}` }}>
              <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 12, color: C.dim, textAlign: 'center', lineHeight: 1.6 }}>
                New here? Register as a contributor first.
              </p>
              <button
                type="button"
                onClick={() => { setShowSignup(true); setSignupDismissed(true); setSignupEmail('') }}
                className="btn-outline justify-center"
                style={{ fontSize: 13, width: '100%', cursor: 'pointer' }}
              >
                Register as contributor
              </button>
              <Link href="/" className="link-quiet" style={{ textAlign: 'center', marginTop: 4 }}>
                Back to contribute overview
              </Link>
            </div>
          </>
        )}
      </div>

      {showSignup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: tint('--navy-deep', 92), backdropFilter: 'blur(16px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSignup(false) }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="signup-title"
        >
          <div className="w-full max-w-md rounded-2xl border overflow-hidden" style={{ background: C.depth, borderColor: C.border }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: C.border }}>
              <div>
                <p id="signup-title" style={{ fontFamily: F.display, fontWeight: 600, fontSize: 18, color: C.light }}>Create your account</p>
                <p style={{ fontFamily: F.body, fontSize: 12, color: C.mute, marginTop: 4 }}>Enter your email to receive a verification link</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowSignup(false)}
                style={{ color: C.mute, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}
              >
                &times;
              </button>
            </div>

            <div className="p-6">
              {signupSent ? (
                <div className="flex flex-col items-center gap-4 text-center py-4">
                  <IconBadge token="--orange" size={64}>
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round">
                      <path d="M3 7l11 9 11-9M3 7h22v16H3z" />
                    </svg>
                  </IconBadge>
                  <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 18, color: C.light }}>Check your email</p>
                  <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 14, color: C.mute, lineHeight: 1.7 }}>
                    We sent a verification link to{' '}
                    <span style={{ color: C.accent }}>{signupState.status === 'sent' ? signupState.email : ''}</span>. Click it to verify your email and start your registration.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setSignupDismissed(true); setSignupEmail('') }}
                    style={{ fontFamily: F.body, fontSize: 12, color: C.dim, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginTop: 4 }}
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <form action={(fd) => { setSignupDismissed(false); signupAction(fd) }} className="flex flex-col gap-4">
                  <input type="hidden" name="next" value="/dashboard" />
                  <div>
                    <label htmlFor="signup-email" className="field-label">Email address</label>
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      maxLength={254}
                      autoFocus
                      className="portal-input"
                      style={inputStyle}
                    />
                  </div>

                  {signupState.status === 'error' && !signupDismissed && (
                    <p role="alert" style={{ fontFamily: F.body, fontSize: 13, color: C.danger }}>{signupState.message}</p>
                  )}

                  <div className="p-4 rounded-xl" style={{ background: tint('--orange', 6), border: `1px solid ${tint('--orange', 15)}` }}>
                    <p style={{ fontFamily: F.body, fontSize: 12, color: C.accent, lineHeight: 1.65 }}>
                      After clicking the link in your email you will be directed to complete your contributor application. The core team reviews all applications before activation.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={signupSending || !signupEmail.trim()}
                    className="btn-primary justify-center"
                    style={{ opacity: signupSending || !signupEmail.trim() ? 0.5 : 1, cursor: 'pointer' }}
                  >
                    {signupSending ? 'Sending link...' : 'Send verification link'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
