'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@nextrium/supabase/client'
import { normalizeUrl } from '@nextrium/utils/normalizeUrl'
import Header from '@/components/dashboard/Header'
import { logActivityAction } from '@/app/actions/activityLog'

const STATUS_OPTIONS = ['active', 'prototype', 'completed', 'abandoned']

function slugify(str: string): string {
  return str.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)
}

export default function CommunityProjectEditor({ project }: { project: any }) {
  const router = useRouter()
  const isNew  = !project

  const [name,        setName]        = useState(project?.name        ?? '')
  const [slug,        setSlug]        = useState(project?.slug        ?? '')
  const [team,        setTeam]        = useState(project?.team        ?? '')
  const [event,       setEvent]       = useState(project?.event       ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [tags,        setTags]        = useState((project?.tags ?? []).join(', '))
  const [status,      setStatus]      = useState(project?.status      ?? 'active')
  const [websiteUrl,  setWebsiteUrl]  = useState(project?.website_url ?? '')
  const [githubUrl,   setGithubUrl]   = useState(project?.github_url  ?? '')
  const [coverColor,  setCoverColor]  = useState(project?.cover_color ?? '#0D233D')
  const [isFeatured,  setIsFeatured]  = useState(project?.is_featured ?? false)
  const [sortOrder,   setSortOrder]   = useState(project?.sort_order  ?? 0)

  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  async function handleSave() {
    setError(null); setSuccess(null)
    if (!name.trim())        { setError('Name is required.');        return }
    if (!slug.trim())        { setError('Slug is required.');        return }
    if (!team.trim())        { setError('Team is required.');        return }
    if (!event.trim())       { setError('Event is required.');       return }
    if (!description.trim()) { setError('Description is required.'); return }

    setSaving(true)
    const supabase = createClient()
    const now      = new Date().toISOString()

    const payload = {
      name:        name.trim(),
      slug:        slug.trim(),
      team:        team.trim(),
      event:       event.trim(),
      description: description.trim(),
      tags:        tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      status,
      website_url: normalizeUrl(websiteUrl) || null,
      github_url:  normalizeUrl(githubUrl)  || null,
      cover_color: coverColor,
      is_featured: isFeatured,
      sort_order:  Number(sortOrder),
      updated_at:  now,
    }

    try {
      if (isNew) {
        const { error: err } = await (supabase.from('community_projects') as any).insert({ ...payload, created_at: now })
        if (err) throw err
        setSuccess('Project created.')
        logActivityAction({
          action: 'community_project_created',
          targetType: 'community_project',
          targetId: payload.slug,
          details: { name: payload.name },
        }).catch(() => {})
        router.push(`/dashboard/community-projects/${payload.slug}`)
        router.refresh()
      } else {
        const { error: err } = await (supabase.from('community_projects') as any).update(payload).eq('slug', project.slug)
        if (err) throw err
        setSuccess('Project saved.')
        logActivityAction({
          action: 'community_project_updated',
          targetType: 'community_project',
          targetId: payload.slug,
          details: { name: payload.name },
        }).catch(() => {})
        router.refresh()
        if (slug !== project.slug) router.push(`/dashboard/community-projects/${payload.slug}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!project) return
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    setDeleting(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('community_projects').delete().eq('slug', project.slug)
    if (err) { setError(err.message); setDeleting(false); return }
    logActivityAction({
      action: 'community_project_deleted',
      targetType: 'community_project',
      targetId: project.slug,
      details: { name: project.name },
    }).catch(() => {})
    router.push('/dashboard/community-projects')
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
        {saving ? 'Saving...' : isNew ? 'Create project' : 'Save changes'}
      </button>
    </div>
  )

  return (
    <>
      <style>{`
        .proj-editor-layout { display: grid; grid-template-columns: 1fr 280px; gap: 24px; align-items: start; }
        .proj-editor-main { display: flex; flex-direction: column; gap: 20px; }
        .proj-editor-sidebar { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }
        .editor-field { display: flex; flex-direction: column; gap: 8px; }
        .editor-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #B0BEC5; }
        .editor-input { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; transition: border-color 0.15s ease; }
        .editor-input:focus { border-color: var(--orange); }
        .editor-input::placeholder { color: #4A5C6E; }
        .editor-textarea { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: #D0D8E4; font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; resize: vertical; min-height: 140px; line-height: 1.6; transition: border-color 0.15s ease; }
        .editor-textarea:focus { border-color: var(--orange); }
        .editor-textarea::placeholder { color: #4A5C6E; }
        .editor-select { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; cursor: pointer; }
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
        .color-field { display: flex; align-items: center; gap: 12px; }
        .color-preview { width: 40px; height: 40px; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; }
        .editor-alert { padding: 10px 14px; font-size: 12px; border: 1px solid; margin-bottom: 8px; }
        .editor-alert-error { background: rgba(232,69,69,0.08); border-color: rgba(232,69,69,0.3); color: var(--error); }
        .editor-alert-success { background: rgba(34,193,122,0.08); border-color: rgba(34,193,122,0.3); color: var(--success); }
        @media (max-width: 1100px) { .proj-editor-layout { grid-template-columns: 1fr; } .proj-editor-sidebar { position: static; } }
      `}</style>

      <Header
        title={isNew ? 'New community project' : 'Edit project'}
        description={isNew ? 'Add a project built by a Hub team' : project?.slug}
        action={ActionButtons}
      />

      <div className="dash-content">
        {error   && <div className="editor-alert editor-alert-error">{error}</div>}
        {success && <div className="editor-alert editor-alert-success">{success}</div>}

        <div className="proj-editor-layout">
          <div className="proj-editor-main">
            <div className="editor-field">
              <label className="editor-label">Project name</label>
              <input className="editor-input" type="text" placeholder="e.g. AgriDatum"
                value={name}
                onChange={(e) => { setName(e.target.value); if (isNew) setSlug(slugify(e.target.value)) }}
                style={{ fontSize: '20px', fontFamily: 'var(--font-exo2)', fontWeight: 700 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="editor-field">
                <label className="editor-label">Team name</label>
                <input className="editor-input" type="text" placeholder="e.g. Team OSWEB"
                  value={team} onChange={(e) => setTeam(e.target.value)} />
              </div>
              <div className="editor-field">
                <label className="editor-label">Event</label>
                <input className="editor-input" type="text" placeholder="e.g. CATS Hackathon 2025"
                  value={event} onChange={(e) => setEvent(e.target.value)} />
              </div>
            </div>

            <div className="editor-field">
              <label className="editor-label">Description</label>
              <textarea className="editor-textarea"
                placeholder="What the project does and why it matters"
                value={description} onChange={(e) => setDescription(e.target.value)} rows={6} />
            </div>

            <div className="editor-field">
              <label className="editor-label">Tags</label>
              <input className="editor-input" type="text"
                placeholder="Agriculture, Data, Cardano"
                value={tags} onChange={(e) => setTags(e.target.value)} />
              <span style={{ fontSize: '11px', color: 'var(--grey-dark)' }}>Comma separated</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="editor-field">
                <label className="editor-label">Website URL</label>
                <input className="editor-input" type="url" placeholder="https://"
                  value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
              </div>
              <div className="editor-field">
                <label className="editor-label">GitHub URL</label>
                <input className="editor-input" type="url" placeholder="https://github.com/..."
                  value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="proj-editor-sidebar">
            <div className="editor-panel">
              <div className="editor-panel-title">Settings</div>

              <div className="editor-field">
                <label className="editor-label">Slug</label>
                <input className="editor-input" type="text" placeholder="project-slug"
                  value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
              </div>

              <div className="editor-field">
                <label className="editor-label">Status</label>
                <select className="editor-select" value={status}
                  onChange={(e) => setStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="editor-field">
                <label className="editor-label">Sort order</label>
                <input className="editor-input" type="number" min="0"
                  value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
              </div>

              <div className="editor-toggle">
                <span className="editor-toggle-label">Featured</span>
                <label className="editor-toggle-switch">
                  <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
                  <span className="editor-toggle-track" />
                </label>
              </div>
            </div>

            <div className="editor-panel">
              <div className="editor-panel-title">Accent color</div>
              <div className="editor-field">
                <div className="color-field">
                  <div className="color-preview" style={{ background: coverColor }} />
                  <input className="editor-input" type="text" placeholder="#0D233D"
                    value={coverColor} onChange={(e) => setCoverColor(e.target.value)} />
                </div>
                <input type="color" value={coverColor} onChange={(e) => setCoverColor(e.target.value)}
                  style={{ width: '100%', height: '36px', border: 'none', cursor: 'pointer', background: 'none' }} />
              </div>
            </div>

            {!isNew && (
              <div className="editor-panel">
                <div className="editor-panel-title">Info</div>
                <div style={{ fontSize: '12px', color: 'var(--grey-mid)', lineHeight: 1.8 }}>
                  <div>Created: {new Date(project.created_at).toLocaleDateString('en-GB')}</div>
                  <div>Updated: {new Date(project.updated_at).toLocaleDateString('en-GB')}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}