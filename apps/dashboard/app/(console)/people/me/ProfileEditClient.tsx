'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveProfile, unlinkDiscord, syncMyDiscordAccess, type AccessCheckResult } from '../actions'
import { saveContributorProfile } from '@/lib/contributions/profileActions'
import { splitSkills } from '@nextrium/contributions-core/profile'
import ContributorFields, { type ContributorFieldsValue } from './ContributorFields'
import { profileHasChanges, type ProfileValues } from '@/lib/dashboard/profileForm'
import { CATEGORY_LABELS, isCategory } from '@nextrium/contributions-core/constants'
import { brand } from '@nextrium/brand'

const DISCORD_NOTICES: Record<string, { text: string; ok: boolean }> = {
  linked:      { text: 'Discord connected.', ok: true },
  denied:      { text: 'You cancelled the Discord connection.', ok: false },
  taken:       { text: 'That Discord account is already connected to another team member.', ok: false },
  unavailable: { text: 'Discord connection is not set up yet. Ask an administrator.', ok: false },
  error:       { text: 'We could not complete the Discord connection. Please try again.', ok: false },
}

const HANDLE_FIELDS = [
  { key: 'twitter',  label: 'Twitter / X', placeholder: '@handle' },
  { key: 'linkedin', label: 'LinkedIn',    placeholder: 'linkedin.com/in/...' },
  { key: 'github',   label: 'GitHub',      placeholder: '@handle' },
  { key: 'website',  label: 'Website',     placeholder: 'https://...' },
]

export default function ProfileEditClient({
  isFirstTime,
  initialBio,
  initialHandles,
  discordUsername,
  discordAvailable,
  discordNotice,
  contributor = null,
  contributorOptional = false,
}: {
  isFirstTime: boolean
  initialBio: string
  initialHandles: Record<string, string>
  discordUsername: string | null
  discordAvailable: boolean
  discordNotice: string | null
  /** Contributor preferences, shown to everyone who can contribute. */
  contributor?: ContributorFieldsValue | null
  /** Staff may leave the contributor section empty; members must fill it in. */
  contributorOptional?: boolean
}) {
  const router = useRouter()
  const [disconnecting, setDisconnecting] = useState(false)
  const [discordError, setDiscordError] = useState('')
  const notice = discordNotice ? DISCORD_NOTICES[discordNotice] : null
  const [checking, setChecking] = useState(false)
  const [accessResults, setAccessResults] = useState<AccessCheckResult[] | null>(null)

  async function handleCheckAccess() {
    setChecking(true)
    setDiscordError('')
    const res = await syncMyDiscordAccess()
    setChecking(false)
    if (res.error) { setDiscordError(res.error); return }
    setAccessResults(res.results ?? [])
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    setDiscordError('')
    const res = await unlinkDiscord()
    setDisconnecting(false)
    if (res.error) { setDiscordError(res.error); return }
    router.replace('/people/me')
    router.refresh()
  }
  const [bio, setBio] = useState(initialBio)
  const [handles, setHandles] = useState<Record<string, string>>(initialHandles)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [contrib, setContrib] = useState<ContributorFieldsValue | null>(contributor)
  // Onboarding opens straight into the form; afterwards the profile is shown read-only until Edit.
  const [editing, setEditing] = useState(isFirstTime)
  const [saved, setSaved] = useState<ProfileValues>({ bio: initialBio, handles: initialHandles, contributor })
  const [success, setSuccess] = useState('')
  const current: ProfileValues = { bio, handles, contributor: contrib }
  const dirty = profileHasChanges(saved, current)

  function startEditing() {
    setSuccess('')
    setError('')
    setEditing(true)
  }

  function cancelEditing() {
    setBio(saved.bio)
    setHandles(saved.handles)
    setContrib(saved.contributor as ContributorFieldsValue | null)
    setError('')
    setEditing(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    // Contributor preferences first, so onboarding (completed by saveProfile)
    // only finishes once they are valid.
    // The display name may be pre-filled from an application, so it alone doesn't opt staff in.
    const contribFilled = !!contrib && (contrib.categories.length > 0 || contrib.skillsText.trim() !== '')
    if (contrib && (!contributorOptional || contribFilled)) {
      const c = await saveContributorProfile({
        displayName: contrib.displayName,
        categories: contrib.categories,
        skills: splitSkills(contrib.skillsText),
        availabilityHoursPerWeek: contrib.availability === '' ? null : Number(contrib.availability),
        notifyEmail: contrib.notifyEmail,
      })
      if (c.error) { setSaving(false); setError(c.error); return }
    }
    const res = await saveProfile({ bio, socialHandles: handles })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    if (isFirstTime) {
      router.push('/people')
      router.refresh()
      return
    }
    setSaved(current)
    setEditing(false)
    setSuccess('Profile updated.')
    router.refresh()
  }

  return (
    <>
      <style>{`
        .profile-form-wrap { max-width: 560px; }
        .profile-form-card { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 28px; }
        .profile-form-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); margin-bottom: 8px; display: block; }
        .profile-form-input, .profile-form-textarea { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 13px; padding: 10px 12px; outline: none; width: 100%; margin-bottom: 18px; }
        .profile-form-textarea { min-height: 90px; resize: vertical; }
        .profile-form-section-title { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--white); margin: 22px 0 14px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.06); }
        .profile-form-submit { padding: 12px 24px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; border: 1px solid var(--orange); background: var(--orange); color: var(--white); }
        .profile-form-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .profile-form-error { padding: 10px 14px; font-size: 12px; background: color-mix(in srgb, var(--error) 8%, transparent); border: 1px solid color-mix(in srgb, var(--error) 30%, transparent); color: var(--error); margin-bottom: 16px; }
        .profile-form-ok { padding: 10px 14px; font-size: 12px; background: color-mix(in srgb, var(--success) 8%, transparent); border: 1px solid color-mix(in srgb, var(--success) 30%, transparent); color: var(--success); margin-bottom: 16px; }
        .profile-discord-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
        .profile-discord-name { font-size: 13px; color: var(--off-white); line-height: 1.5; max-width: 60ch; }
        .profile-discord-btn { padding: 9px 16px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: 1px solid color-mix(in srgb, var(--orange) 40%, transparent); background: none; color: var(--orange); text-decoration: none; white-space: nowrap; }
        .profile-discord-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .profile-form-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
        .profile-form-cancel { padding: 12px 20px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(255,255,255,0.15); background: none; color: var(--off-white); }
        .profile-form-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
        .profile-view-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
        .profile-view-text { font-size: 13px; color: var(--off-white); line-height: 1.6; margin: 0 0 4px; white-space: pre-wrap; }
        .profile-view-list { margin: 0; display: grid; gap: 10px; }
        .profile-view-list > div { display: grid; grid-template-columns: 130px 1fr; gap: 12px; }
        .profile-view-list dt { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-mid); padding-top: 3px; }
        .profile-view-list dd { margin: 0; font-size: 13px; color: var(--off-white); overflow-wrap: anywhere; }
        @media (max-width: 480px) { .profile-view-list > div { grid-template-columns: 1fr; gap: 2px; } }
        .profile-access-list { display: flex; flex-direction: column; gap: 6px; margin: -10px 0 22px; padding: 12px 14px; border: 1px solid rgba(255,255,255,0.06); background: var(--navy-mid); }
      `}</style>

      <div className="profile-form-wrap">
        {success && <div className="profile-form-ok">{success}</div>}

        {editing ? (
          <form className="profile-form-card" onSubmit={handleSubmit}>
            {error && <div className="profile-form-error">{error}</div>}

            <label className="profile-form-label" htmlFor="profile-bio">Bio</label>
            <textarea
              id="profile-bio"
              className="profile-form-textarea"
              placeholder="A short intro — what you work on, what you're into."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />

            <div className="profile-form-section-title">Social handles (optional)</div>
            {HANDLE_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="profile-form-label" htmlFor={`profile-${f.key}`}>{f.label}</label>
                <input
                  id={`profile-${f.key}`}
                  className="profile-form-input"
                  type="text"
                  placeholder={f.placeholder}
                  value={handles[f.key] ?? ''}
                  onChange={(e) => setHandles((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}

            {contrib && <ContributorFields value={contrib} onChange={setContrib} optional={contributorOptional} />}

            <div className="profile-form-actions">
              {/* Onboarding can always continue (a profile may stay empty); later edits need a real change. */}
              <button type="submit" className="profile-form-submit" disabled={saving || (!isFirstTime && !dirty)}>
                {saving ? 'Saving...' : isFirstTime ? 'Save & continue' : 'Save changes'}
              </button>
              {!isFirstTime && (
                <button type="button" className="profile-form-cancel" onClick={cancelEditing} disabled={saving}>Cancel</button>
              )}
            </div>
          </form>
        ) : (
          <div className="profile-form-card">
            <div className="profile-view-head">
              <span className="profile-form-label" style={{ margin: 0 }}>Your profile</span>
              <button type="button" className="profile-discord-btn" onClick={startEditing}>Edit profile</button>
            </div>

            <span className="profile-form-label">Bio</span>
            <p className="profile-view-text">{saved.bio.trim() || 'No bio yet.'}</p>

            <div className="profile-form-section-title">Social handles</div>
            {HANDLE_FIELDS.some((f) => saved.handles[f.key]?.trim()) ? (
              <dl className="profile-view-list">
                {HANDLE_FIELDS.filter((f) => saved.handles[f.key]?.trim()).map((f) => (
                  <div key={f.key}><dt>{f.label}</dt><dd>{saved.handles[f.key]}</dd></div>
                ))}
              </dl>
            ) : (
              <p className="profile-view-text">None added.</p>
            )}

            {saved.contributor && (
              <>
                <div className="profile-form-section-title">Contributing</div>
                <dl className="profile-view-list">
                  <div><dt>Display name</dt><dd>{saved.contributor.displayName.trim() || 'Not set'}</dd></div>
                  <div><dt>Areas</dt><dd>{saved.contributor.categories.length
                    ? saved.contributor.categories.map((c) => (isCategory(c) ? CATEGORY_LABELS[c] : c)).join(', ')
                    : 'None chosen'}</dd></div>
                  <div><dt>Skills</dt><dd>{saved.contributor.skillsText.trim() || 'None added'}</dd></div>
                  <div><dt>Hours per week</dt><dd>{saved.contributor.availability.trim() || 'Not set'}</dd></div>
                  <div><dt>Task emails</dt><dd>{saved.contributor.notifyEmail ? 'On' : 'Off'}</dd></div>
                </dl>
              </>
            )}
          </div>
        )}

        <div className="profile-form-card" style={{ marginTop: 16 }}>
          <div className="profile-form-section-title" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>Discord</div>
          {notice && (
            <div className={notice.ok ? 'profile-form-ok' : 'profile-form-error'}>{notice.text}</div>
          )}
          {discordError && <div className="profile-form-error">{discordError}</div>}
          {discordUsername ? (
            <>
            <div className="profile-discord-row">
              <span className="profile-discord-name">Connected as <strong>{discordUsername}</strong></span>
              <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" className="profile-discord-btn" onClick={handleCheckAccess} disabled={checking}>
                  {checking ? 'Checking...' : 'Check my Discord access'}
                </button>
                <button type="button" className="profile-discord-btn" onClick={handleDisconnect} disabled={disconnecting}>
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </span>
            </div>
            {accessResults && (
              <div className="profile-access-list">
                {accessResults.length === 0 ? (
                  <div className="profile-discord-name">No Discord access rules apply to you yet.</div>
                ) : accessResults.map((r, i) => (
                  <div key={i} className="profile-discord-name">
                    <strong>{r.status === 'success' || r.status === 'skipped' ? '✓' : r.status === 'waiting' ? '…' : '✕'}</strong>{' '}
                    {r.name} — {r.detail}
                  </div>
                ))}
              </div>
            )}
            </>
          ) : (
            <div className="profile-discord-row">
              <span className="profile-discord-name">
                Join and verify in the {brand.community.discordServer} first, then connect your account here so you can be added to your track's private channel.
              </span>
              {discordAvailable ? (
                <a className="profile-discord-btn" href="/api/discord/link">Connect Discord</a>
              ) : (
                <span className="profile-discord-name">Not available yet.</span>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
