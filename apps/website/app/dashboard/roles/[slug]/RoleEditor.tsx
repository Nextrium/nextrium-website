'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@nextrium/supabase/client'
import Header from '@/components/dashboard/Header'
import type { Role } from '@nextrium/supabase/database'
import { logActivityAction } from '@/app/actions/activityLog'

interface RoleEditorProps {
  role: Role | null
}

const TYPE_OPTIONS: { value: Role['type']; label: string }[] = [
  { value: 'full_time',  label: 'Full-time'  },
  { value: 'contract',   label: 'Contract'   },
  { value: 'volunteer',  label: 'Volunteer'  },
  { value: 'internship', label: 'Internship' },
]

function slugify(str: string): string {
  return str.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)
}

export default function RoleEditor({ role }: RoleEditorProps) {
  const router = useRouter()
  const isNew  = !role

  const [title,        setTitle]        = useState(role?.title        ?? '')
  const [slug,         setSlug]         = useState(role?.slug         ?? '')
  const [team,         setTeam]         = useState(role?.team         ?? '')
  const [type,         setType]         = useState<Role['type']>(role?.type ?? 'full_time')
  const [location,     setLocation]     = useState(role?.location     ?? 'Remote, Nigeria')
  const [description,  setDescription]  = useState(role?.description  ?? '')
  const [requirements, setRequirements] = useState((role?.requirements ?? []).join('\n'))
  const [isActive,     setIsActive]     = useState(role?.is_active    ?? true)
  const [sortOrder,    setSortOrder]    = useState(role?.sort_order   ?? 0)
  const [closesAt,     setClosesAt]     = useState(role?.closes_at?.slice(0, 10) ?? '')

  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  async function handleSave() {
    setError(null); setSuccess(null)
    if (!title.trim())       { setError('Title is required.');       return }
    if (!slug.trim())        { setError('Slug is required.');        return }
    if (!team.trim())        { setError('Team is required.');        return }
    if (!location.trim())    { setError('Location is required.');    return }
    if (!description.trim()) { setError('Description is required.'); return }

    setSaving(true)
    const supabase = createClient()
    const now      = new Date().toISOString()
    const reqArray = requirements.split('\n').map((r) => r.trim()).filter(Boolean)

    const payload = {
      title:        title.trim(),
      slug:         slug.trim(),
      team:         team.trim(),
      type,
      location:     location.trim(),
      description:  description.trim(),
      requirements: reqArray,
      is_active:    isActive,
      sort_order:   Number(sortOrder),
      closes_at:    closesAt || null,
      updated_at:   now,
    }

    try {
      if (isNew) {
        const { error: err } = await (supabase.from('roles') as any).insert({ ...payload, created_at: now })
        if (err) throw err
        setSuccess('Role created.')
        logActivityAction({
          action: payload.is_active ? 'role_published' : 'role_created',
          targetType: 'role',
          targetId: payload.slug,
          details: { title: payload.title },
        }).catch(() => {})
        router.push(`/dashboard/roles/${payload.slug}`)
        router.refresh()
      } else {
        const { error: err } = await (supabase.from('roles') as any).update(payload).eq('slug', role!.slug)
        if (err) throw err
        setSuccess('Role saved.')
        logActivityAction({
          action: payload.is_active && !role!.is_active ? 'role_published' : 'role_updated',
          targetType: 'role',
          targetId: payload.slug,
          details: { title: payload.title },
        }).catch(() => {})
        router.refresh()
        if (slug !== role!.slug) router.push(`/dashboard/roles/${payload.slug}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!role) return
    if (!confirm(`Delete "${role.title}"? This cannot be undone.`)) return
    setDeleting(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('roles').delete().eq('slug', role.slug)
    if (err) { setError(err.message); setDeleting(false); return }
    logActivityAction({
      action: 'role_deleted',
      targetType: 'role',
      targetId: role.slug,
      details: { title: role.title },
    }).catch(() => {})
    router.push('/dashboard/roles')
    router.refresh()
  }

  const ActionButtons = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {!isNew && (
        <button type="button" onClick={handleDelete} disabled={deleting}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 14px', background: 'none', border: '1px solid rgba(232,69,69,0.3)', color: 'var(--error)', cursor: 'pointer' }}>
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      )}
      <button type="button" onClick={handleSave} disabled={saving}
        style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 20px', background: 'var(--orange)', border: '1px solid var(--orange)', color: 'var(--white)', cursor: 'pointer' }}>
        {saving ? 'Saving...' : isNew ? 'Create role' : 'Save changes'}
      </button>
    </div>
  )

  return (
    <>
      <style>{`
        .role-editor-layout { display: grid; grid-template-columns: 1fr 280px; gap: 24px; align-items: start; }
        .role-editor-main { display: flex; flex-direction: column; gap: 20px; }
        .role-editor-sidebar { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }
        .editor-field { display: flex; flex-direction: column; gap: 8px; }
        .editor-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); }
        .editor-hint { font-size: 11px; color: var(--grey-dark); }
        .editor-input { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; transition: border-color 0.15s ease; }
        .editor-input:focus { border-color: var(--orange); }
        .editor-input::placeholder { color: var(--grey-dark); }
        .editor-textarea { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: var(--off-white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; resize: vertical; min-height: 120px; line-height: 1.6; transition: border-color 0.15s ease; }
        .editor-textarea:focus { border-color: var(--orange); }
        .editor-textarea::placeholder { color: var(--grey-dark); }
        .editor-select { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; cursor: pointer; transition: border-color 0.15s ease; }
        .editor-select:focus { border-color: var(--orange); }
        .editor-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .editor-panel-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .editor-toggle { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; }
        .editor-toggle-label { font-size: 13px; color: var(--off-white); }
        .editor-toggle-switch { position: relative; width: 40px; height: 22px; }
        .editor-toggle-switch input { opacity: 0; width: 0; height: 0; }
        .editor-toggle-track { position: absolute; cursor: pointer; inset: 0; background: rgba(255,255,255,0.1); transition: 0.15s ease; border-radius: 11px; }
        .editor-toggle-track::before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: var(--grey-mid); transition: 0.15s ease; border-radius: 50%; }
        input:checked + .editor-toggle-track { background: var(--orange); }
        input:checked + .editor-toggle-track::before { transform: translateX(18px); background: var(--white); }
        .editor-alert { padding: 10px 14px; font-size: 12px; border: 1px solid; margin-bottom: 8px; }
        .editor-alert-error { background: rgba(232,69,69,0.08); border-color: rgba(232,69,69,0.3); color: var(--error); }
        .editor-alert-success { background: rgba(34,193,122,0.08); border-color: rgba(34,193,122,0.3); color: var(--success); }
        @media (max-width: 1100px) { .role-editor-layout { grid-template-columns: 1fr; } .role-editor-sidebar { position: static; } }
      `}</style>

      <Header
        title={isNew ? 'New role' : 'Edit role'}
        description={isNew ? 'Post a new open position' : role?.slug}
        action={ActionButtons}
      />

      <div className="dash-content">
        {error   && <div className="editor-alert editor-alert-error">{error}</div>}
        {success && <div className="editor-alert editor-alert-success">{success}</div>}

        <div className="role-editor-layout">
          <div className="role-editor-main">
            <div className="editor-field">
              <label className="editor-label" htmlFor="title">Role title</label>
              <input className="editor-input" id="title" type="text"
                placeholder="e.g. Full-stack Developer"
                value={title}
                onChange={(e) => { setTitle(e.target.value); if (isNew) setSlug(slugify(e.target.value)) }}
                style={{ fontSize: '20px', fontFamily: 'var(--font-exo2)', fontWeight: 700 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="editor-field">
                <label className="editor-label" htmlFor="team">Team</label>
                <select className="editor-select" value={team} onChange={(e) => setTeam(e.target.value)}>
                  <option value="">Select team</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Product and Design">Product and Design</option>
                  <option value="Research and Strategy">Research and Strategy</option>
                  <option value="Community and Hub">Community and Hub</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>
              <div className="editor-field">
                <label className="editor-label" htmlFor="location">Location</label>
                <input className="editor-input" id="location" type="text"
                  placeholder="e.g. Remote, Nigeria"
                  value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
            </div>

            <div className="editor-field">
              <label className="editor-label" htmlFor="description">Description</label>
              <textarea className="editor-textarea" id="description"
                placeholder="What the person will be doing in this role"
                value={description} onChange={(e) => setDescription(e.target.value)} rows={6} />
            </div>

            <div className="editor-field">
              <label className="editor-label" htmlFor="requirements">Requirements</label>
              <textarea className="editor-textarea" id="requirements"
                placeholder="One requirement per line"
                value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={8} />
              <span className="editor-hint">One requirement per line. Each line becomes a bullet on the public page.</span>
            </div>
          </div>

          <div className="role-editor-sidebar">
            <div className="editor-panel">
              <div className="editor-panel-title">Settings</div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="slug">Slug</label>
                <input className="editor-input" id="slug" type="text" placeholder="role-slug"
                  value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
              </div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="type">Employment type</label>
                <select className="editor-select" id="type" value={type}
                  onChange={(e) => setType(e.target.value as Role['type'])}>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="closes_at">Closing date</label>
                <input className="editor-input" id="closes_at" type="date"
                  value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
                <span className="editor-hint">Leave empty for open-ended</span>
              </div>

              <div className="editor-toggle">
                <span className="editor-toggle-label">Active</span>
                <label className="editor-toggle-switch">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  <span className="editor-toggle-track" />
                </label>
              </div>

              <div className="editor-field">
                <label className="editor-label">Sort order</label>
                <input
                  className="editor-input"
                  type="number"
                  min="0"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                />
              </div>
            </div>

            {!isNew && (
              <div className="editor-panel">
                <div className="editor-panel-title">Info</div>
                <div style={{ fontSize: '12px', color: 'var(--grey-mid)', lineHeight: 1.8 }}>
                  <div>Created: {new Date(role!.created_at).toLocaleDateString('en-GB')}</div>
                  <div>Updated: {new Date(role!.updated_at).toLocaleDateString('en-GB')}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}