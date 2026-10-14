'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@nextrium/supabase/client'
import NTMark from '@nextrium/brand/NTMark'

export default function SetPasswordClient() {
  const router = useRouter()
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [ready,       setReady]       = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login?error=invalid_invite')
      } else {
        setReady(true)
      }
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!password.trim())        { setError('Password is required.'); return }
    if (password.length < 8)     { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm)    { setError('Passwords do not match.'); return }

    setSaving(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    await supabase.auth.signOut()
    router.push('/login?message=password_set')
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--navy-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.15em', color: 'var(--grey-mid)', textTransform: 'uppercase' }}>Verifying invite...</div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .setpw-page {
          min-height: 100vh; background: var(--navy-deep);
          display: flex; align-items: center; justify-content: center; padding: 24px;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 72px 72px;
        }
        .setpw-card {
          width: 100%; max-width: 400px; background: var(--navy);
          border: 1px solid rgba(255,255,255,0.08); position: relative; overflow: hidden;
        }
        .setpw-corner-tl { position: absolute; top: -1px; left: -1px; width: 16px; height: 16px; border-top: 2px solid var(--orange); border-left: 2px solid var(--orange); }
        .setpw-corner-br { position: absolute; bottom: -1px; right: -1px; width: 16px; height: 16px; border-bottom: 2px solid var(--orange); border-right: 2px solid var(--orange); }
        .setpw-header { padding: 32px 32px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 12px; }
        .setpw-title { font-family: var(--font-exo2); font-weight: 800; font-size: 20px; color: var(--white); letter-spacing: -0.3px; }
        .setpw-subtitle { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); margin-top: 4px; }
        .setpw-body { padding: 32px; }
        .setpw-form { display: flex; flex-direction: column; gap: 16px; }
        .setpw-group { display: flex; flex-direction: column; gap: 8px; }
        .setpw-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); }
        .setpw-input { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 12px 16px; outline: none; width: 100%; transition: border-color 0.15s ease; }
        .setpw-input:focus { border-color: var(--orange); }
        .setpw-input::placeholder { color: var(--grey-dark); }
        .setpw-error { font-size: 12px; color: var(--error); background: rgba(232,69,69,0.08); border: 1px solid rgba(232,69,69,0.2); padding: 10px 14px; }
        .setpw-submit { background: var(--orange); color: var(--white); border: 1px solid var(--orange); padding: 14px 24px; font-family: var(--font-dm); font-size: 14px; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s ease; }
        .setpw-submit:hover:not(:disabled) { background: var(--orange-f, #C4521A); }
        .setpw-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .setpw-note { font-size: 12px; color: var(--grey-dark); line-height: 1.6; }
      `}</style>

      <div className="setpw-page">
        <div className="setpw-card">
          <div className="setpw-corner-tl" />
          <div className="setpw-corner-br" />
          <div className="setpw-header">
            <NTMark size={36} />
            <div>
              <div className="setpw-title">Set your password</div>
              <div className="setpw-subtitle">Nextrium Dashboard</div>
            </div>
          </div>
          <div className="setpw-body">
            <form className="setpw-form" onSubmit={handleSubmit} noValidate>
              {error && <div className="setpw-error">{error}</div>}
              <div className="setpw-group">
                <label className="setpw-label" htmlFor="password">New password</label>
                <input className="setpw-input" id="password" type="password"
                  placeholder="Minimum 8 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="setpw-group">
                <label className="setpw-label" htmlFor="confirm">Confirm password</label>
                <input className="setpw-input" id="confirm" type="password"
                  placeholder="Repeat your password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <button type="submit" className="setpw-submit" disabled={saving}>
                <span>{saving ? 'Setting password...' : 'Set password and continue'}</span>
                <span>{saving ? '...' : '→'}</span>
              </button>
              <div className="setpw-note">
                After setting your password you will be taken to the login page to sign in.
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}