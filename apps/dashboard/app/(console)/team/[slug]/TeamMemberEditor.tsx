'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@nextrium/supabase/client'
import { normalizeUrl } from '@nextrium/utils/normalizeUrl'
import Header from '@/components/dashboard/Header'
import CoverImageUpload from '@/components/dashboard/CoverImageUpload'
import type { TeamMember } from '@nextrium/supabase/database'
import { logActivityAction } from '@/app/actions/activityLog'
import { brand } from '@nextrium/brand'

function slugify(str: string): string {
  return str.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)
}

export default function TeamMemberEditor({ member }: { member: TeamMember | null }) {
  const router = useRouter()
  const isNew  = !member

  const [name,        setName]        = useState(member?.name         ?? '')
  const [slug,        setSlug]        = useState(member?.slug         ?? '')
  const [role,        setRole]        = useState(member?.role         ?? '')
  const [bio,         setBio]         = useState(member?.bio          ?? '')
  const [detail,      setDetail]      = useState(member?.detail       ?? '')
  const [photoUrl,    setPhotoUrl]    = useState(member?.photo_url    ?? '')
  const [email,       setEmail]       = useState(member?.email        ?? '')
  const [githubUrl,   setGithubUrl]   = useState(member?.github_url   ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(member?.linkedin_url ?? '')
  const [twitterUrl,  setTwitterUrl]  = useState(member?.twitter_url  ?? '')
  const [isActive,    setIsActive]    = useState(member?.is_active    ?? true)
  const [sortOrder,   setSortOrder]   = useState(member?.sort_order   ?? 0)

  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  async function handleSave() {
    setError(null); setSuccess(null)
    if (!name.trim()) { setError('Name is required.'); return }
    if (!slug.trim()) { setError('Slug is required.'); return }
    if (!role.trim()) { setError('Role is required.'); return }

    setSaving(true)
    const supabase = createClient()
    const now      = new Date().toISOString()

    const payload = {
      name:         name.trim(),
      slug:         slug.trim(),
      role:         role.trim(),
      bio:          bio.trim()         || null,
      detail:       detail.trim()      || null,
      photo_url:    normalizeUrl(photoUrl)    || null,
      email:        email.trim()       || null,
      github_url:   normalizeUrl(githubUrl)   || null,
      linkedin_url: normalizeUrl(linkedinUrl) || null,
      twitter_url:  normalizeUrl(twitterUrl)  || null,
      is_active:    isActive,
      sort_order:   Number(sortOrder),
      updated_at:   now,
    }

    try {
      if (isNew) {
        const { error: err } = await (supabase.from('team_members') as any).insert({ ...payload, created_at: now })
        if (err) throw err
        setSuccess('Member added.')
        logActivityAction({
          action: 'team_member_added',
          targetType: 'team_member',
          targetId: payload.slug,
          details: { name: payload.name },
        }).catch(() => {})
        router.push(`/team/${payload.slug}`)
        router.refresh()
      } else {
        const { error: err } = await (supabase.from('team_members') as any).update(payload).eq('slug', member!.slug)
        if (err) throw err
        setSuccess('Member saved.')
        logActivityAction({
          action: 'team_member_updated',
          targetType: 'team_member',
          targetId: payload.slug,
          details: { name: payload.name },
        }).catch(() => {})
        router.refresh()
        if (slug !== member!.slug) router.push(`/team/${payload.slug}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!member) return
    if (!confirm(`Remove "${member.name}" from the team? This cannot be undone.`)) return
    setDeleting(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('team_members').delete().eq('slug', member.slug)
    if (err) { setError(err.message); setDeleting(false); return }
    logActivityAction({
      action: 'team_member_removed',
      targetType: 'team_member',
      targetId: member.slug,
      details: { name: member.name },
    }).catch(() => {})
    router.push('/team')
    router.refresh()
  }

  const ActionButtons = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {!isNew && (
        <button type="button" onClick={handleDelete} disabled={deleting}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 14px', background: 'none', border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)', color: 'var(--error)', cursor: 'pointer' }}>
          {deleting ? 'Removing...' : 'Remove'}
        </button>
      )}
      <button type="button" onClick={handleSave} disabled={saving}
        style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 20px', background: 'var(--orange)', border: '1px solid var(--orange)', color: 'var(--white)', cursor: 'pointer' }}>
        {saving ? 'Saving...' : isNew ? 'Add member' : 'Save changes'}
      </button>
    </div>
  )

  return (
    <>
      <style>{`
        .team-editor-layout { display: grid; grid-template-columns: 1fr 280px; gap: 24px; align-items: start; }
        .team-editor-main { display: flex; flex-direction: column; gap: 20px; }
        .team-editor-sidebar { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }
        .editor-field { display: flex; flex-direction: column; gap: 8px; }
        .editor-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #B0BEC5; }
        .editor-input { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; transition: border-color 0.15s ease; }
        .editor-input:focus { border-color: var(--orange); }
        .editor-input::placeholder { color: #4A5C6E; }
        .editor-textarea { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: #D0D8E4; font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; resize: vertical; min-height: 100px; line-height: 1.6; transition: border-color 0.15s ease; }
        .editor-textarea:focus { border-color: var(--orange); }
        .editor-textarea::placeholder { color: #4A5C6E; }
        .editor-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .editor-panel-title { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #B0BEC5; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .editor-toggle { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; }
        .editor-toggle-label { font-size: 14px; color: #D0D8E4; }
        .editor-toggle-switch { position: relative; width: 40px; height: 22px; }
        .editor-toggle-switch input { opacity: 0; width: 0; height: 0; }
        .editor-toggle-track { position: absolute; cursor: pointer; inset: 0; background: rgba(255,255,255,0.1); transition: 0.15s ease; border-radius: 11px; }
        .editor-toggle-track::before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: var(--grey-mid); transition: 0.15s ease; border-radius: 50%; }
        input:checked + .editor-toggle-track { background: var(--orange); }
        input:checked + .editor-toggle-track::before { transform: translateX(18px); background: var(--white); }
        .editor-alert { padding: 10px 14px; font-size: 12px; border: 1px solid; margin-bottom: 8px; }
        .editor-alert-error { background: color-mix(in srgb, var(--error) 8%, transparent); border-color: color-mix(in srgb, var(--error) 30%, transparent); color: var(--error); }
        .editor-alert-success { background: color-mix(in srgb, var(--success) 8%, transparent); border-color: color-mix(in srgb, var(--success) 30%, transparent); color: var(--success); }
        @media (max-width: 1100px) { .team-editor-layout { grid-template-columns: 1fr; } .team-editor-sidebar { position: static; } }
      `}</style>

      <Header
        title={isNew ? 'Add team member' : 'Edit team member'}
        description={isNew ? 'Add a core team member to the public team page' : member?.slug}
        action={ActionButtons}
      />

      <div className="dash-content">
        {error   && <div className="editor-alert editor-alert-error">{error}</div>}
        {success && <div className="editor-alert editor-alert-success">{success}</div>}

        <div className="team-editor-layout">
          <div className="team-editor-main">
            <div className="editor-field">
              <label className="editor-label">Full name</label>
              <input className="editor-input" type="text" placeholder="e.g. Mubarak Oladimeji"
                value={name}
                onChange={(e) => { setName(e.target.value); if (isNew) setSlug(slugify(e.target.value)) }}
                style={{ fontSize: '20px', fontFamily: 'var(--font-exo2)', fontWeight: 700 }}
              />
            </div>

            <div className="editor-field">
              <label className="editor-label">Role / Title</label>
              <input className="editor-input" type="text" placeholder="e.g. Chief Operating Officer"
                value={role} onChange={(e) => setRole(e.target.value)} />
            </div>

            <div className="editor-field">
              <label className="editor-label">Quote</label>
              <textarea className="editor-textarea" rows={3}
                placeholder="A short quote or statement that represents this person"
                value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>

            <div className="editor-field">
              <label className="editor-label">Bio</label>
              <textarea className="editor-textarea" rows={5}
                placeholder="Full bio shown on the team page"
                value={detail} onChange={(e) => setDetail(e.target.value)} />
            </div>

            <div className="editor-field">
              <label className="editor-label">Photo</label>
              <CoverImageUpload value={photoUrl} onChange={setPhotoUrl} folder="team" />
            </div>

            <div className="editor-field">
              <label className="editor-label">Email</label>
              <input className="editor-input" type="email" placeholder={`name@${brand.emailDomain}`}
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div className="editor-field">
                <label className="editor-label">GitHub URL</label>
                <input className="editor-input" type="url" placeholder="https://github.com/..."
                  value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
              </div>
              <div className="editor-field">
                <label className="editor-label">LinkedIn URL</label>
                <input className="editor-input" type="url" placeholder="https://linkedin.com/in/..."
                  value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />
              </div>
              <div className="editor-field">
                <label className="editor-label">X (Twitter) URL</label>
                <input className="editor-input" type="url" placeholder="https://x.com/..."
                  value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="team-editor-sidebar">
            <div className="editor-panel">
              <div className="editor-panel-title">Settings</div>

              <div className="editor-field">
                <label className="editor-label">Slug</label>
                <input className="editor-input" type="text" placeholder="member-slug"
                  value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
              </div>

              <div className="editor-field">
                <label className="editor-label">Sort order</label>
                <input className="editor-input" type="number" min="0"
                  value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
              </div>

              <div className="editor-toggle">
                <span className="editor-toggle-label">Active</span>
                <label className="editor-toggle-switch">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  <span className="editor-toggle-track" />
                </label>
              </div>
            </div>

            {!isNew && (
              <div className="editor-panel">
                <div className="editor-panel-title">Info</div>
                <div style={{ fontSize: '12px', color: 'var(--grey-mid)', lineHeight: 1.8 }}>
                  <div>Added: {new Date(member!.created_at).toLocaleDateString('en-GB')}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}