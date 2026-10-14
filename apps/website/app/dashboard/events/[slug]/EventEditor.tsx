'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@nextrium/supabase/client'
import { normalizeUrl } from '@nextrium/utils/normalizeUrl'
import Header from '@/components/dashboard/Header'
import CoverImageUpload from '@/components/dashboard/CoverImageUpload'
import type { NTEvent } from '@nextrium/supabase/database'
import { logActivityAction } from '@/app/actions/activityLog'

interface EventEditorProps {
  event: NTEvent | null
}

const EVENT_TYPES: { value: NTEvent['event_type']; label: string }[] = [
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'workshop',  label: 'Workshop'  },
  { value: 'summit',    label: 'Summit'    },
  { value: 'community', label: 'Community' },
  { value: 'other',     label: 'Other'     },
]

const STATUS_OPTIONS: { value: NTEvent['status']; label: string }[] = [
  { value: 'upcoming',  label: 'Upcoming'  },
  { value: 'ongoing',   label: 'Ongoing'   },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function slugify(str: string): string {
  return str.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)
}

export default function EventEditor({ event }: EventEditorProps) {
  const router = useRouter()
  const isNew  = !event

  const [title,       setTitle]       = useState(event?.title             ?? '')
  const [slug,        setSlug]        = useState(event?.slug              ?? '')
  const [description, setDescription] = useState(event?.description       ?? '')
  const [eventType,   setEventType]   = useState<NTEvent['event_type']>(event?.event_type ?? 'hackathon')
  const [status,      setStatus]      = useState<NTEvent['status']>(event?.status ?? 'upcoming')
  const [startDate,   setStartDate]   = useState(event?.start_date?.slice(0, 10) ?? '')
  const [endDate,     setEndDate]     = useState(event?.end_date?.slice(0, 10)   ?? '')
  const [location,    setLocation]    = useState(event?.location           ?? '')
  const [isHubEvent,  setIsHubEvent]  = useState(event?.is_hub_event       ?? true)
  const [coverColor,  setCoverColor]  = useState(event?.cover_color        ?? '#DB6727')
  const [coverImage,  setCoverImage]  = useState(event?.cover_image_url    ?? '')
  const [gallery,     setGallery]     = useState<string[]>(event?.gallery   ?? [])
  const [youtubeUrl,       setYoutubeUrl]       = useState(event?.youtube_url        ?? '')
  const [registrationUrl,  setRegistrationUrl]  = useState(event?.registration_url  ?? '')
  const [socialLinks,      setSocialLinks]      = useState((event?.social_links ?? []).join('\n'))

  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  async function handleSave() {
    setError(null); setSuccess(null)
    if (!title.trim())      { setError('Title is required.');      return }
    if (!slug.trim())       { setError('Slug is required.');       return }
    if (!description.trim()){ setError('Description is required.'); return }
    if (!startDate)         { setError('Start date is required.'); return }
    if (!location.trim())   { setError('Location is required.');   return }

    setSaving(true)
    const supabase = createClient()
    const now      = new Date().toISOString()

    const payload = {
      title:           title.trim(),
      slug:            slug.trim(),
      description:     description.trim(),
      event_type:      eventType,
      status,
      start_date:      startDate,
      end_date:        endDate || null,
      location:        location.trim(),
      is_hub_event:    isHubEvent,
      cover_color:     coverColor,
      cover_image_url: normalizeUrl(coverImage) || null,
      gallery,
      youtube_url:      normalizeUrl(youtubeUrl) || null,
      registration_url: normalizeUrl(registrationUrl) || null,
      social_links:     socialLinks.split('\n').map((s) => s.trim()).filter(Boolean).map(normalizeUrl),
      updated_at:       now,
    }

    try {
      if (isNew) {
        const { error: err } = await (supabase.from('events') as any).insert({ ...payload, created_at: now })
        if (err) throw err
        setSuccess('Event created.')
        logActivityAction({
          action: 'event_created',
          targetType: 'event',
          targetId: payload.slug,
          details: { title: payload.title },
        }).catch(() => {})
        router.push(`/dashboard/events/${payload.slug}`)
        router.refresh()
      } else {
        const { error: err } = await (supabase.from('events') as any).update(payload).eq('slug', event!.slug)
        if (err) throw err
        setSuccess('Event saved.')
        logActivityAction({
          action: 'event_updated',
          targetType: 'event',
          targetId: payload.slug,
          details: { title: payload.title },
        }).catch(() => {})
        router.refresh()
        if (slug !== event!.slug) router.push(`/dashboard/events/${payload.slug}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!event) return
    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) return
    setDeleting(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('events').delete().eq('slug', event.slug)
    if (err) { setError(err.message); setDeleting(false); return }
    logActivityAction({
      action: 'event_deleted',
      targetType: 'event',
      targetId: event.slug,
      details: { title: event.title },
    }).catch(() => {})
    router.push('/dashboard/events')
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
        {saving ? 'Saving...' : isNew ? 'Create event' : 'Save changes'}
      </button>
    </div>
  )

  return (
    <>
      <style>{`
        .event-editor-layout { display: grid; grid-template-columns: 1fr 280px; gap: 24px; align-items: start; }
        .event-editor-main { display: flex; flex-direction: column; gap: 20px; }
        .event-editor-sidebar { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }
        .editor-field { display: flex; flex-direction: column; gap: 8px; }
        .editor-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); }
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
        .color-field { display: flex; align-items: center; gap: 12px; }
        .color-preview { width: 40px; height: 40px; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; }
        .editor-alert { padding: 10px 14px; font-size: 12px; border: 1px solid; margin-bottom: 8px; }
        .editor-alert-error { background: rgba(232,69,69,0.08); border-color: rgba(232,69,69,0.3); color: var(--error); }
        .editor-alert-success { background: rgba(34,193,122,0.08); border-color: rgba(34,193,122,0.3); color: var(--success); }
        @media (max-width: 1100px) { .event-editor-layout { grid-template-columns: 1fr; } .event-editor-sidebar { position: static; } }
      `}</style>

      <Header
        title={isNew ? 'New event' : 'Edit event'}
        description={isNew ? 'Create a new Hub event' : event?.slug}
        action={ActionButtons}
      />

      <div className="dash-content">
        {error   && <div className="editor-alert editor-alert-error">{error}</div>}
        {success && <div className="editor-alert editor-alert-success">{success}</div>}

        <div className="event-editor-layout">
          <div className="event-editor-main">
            <div className="editor-field">
              <label className="editor-label" htmlFor="title">Event title</label>
              <input className="editor-input" id="title" type="text"
                placeholder="e.g. Cardano Africa Tech Summit Hackathon"
                value={title}
                onChange={(e) => { setTitle(e.target.value); if (isNew) setSlug(slugify(e.target.value)) }}
                style={{ fontSize: '18px', fontFamily: 'var(--font-exo2)', fontWeight: 700 }}
              />
            </div>

            <div className="editor-field">
              <label className="editor-label" htmlFor="description">Description</label>
              <textarea className="editor-textarea" id="description"
                placeholder="Full event description shown on the event detail page"
                value={description} onChange={(e) => setDescription(e.target.value)} rows={6} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="editor-field">
                <label className="editor-label" htmlFor="start_date">Start date</label>
                <input className="editor-input" id="start_date" type="date"
                  value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="editor-field">
                <label className="editor-label" htmlFor="end_date">End date (optional)</label>
                <input className="editor-input" id="end_date" type="date"
                  value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="editor-field">
              <label className="editor-label" htmlFor="location">Location</label>
              <input className="editor-input" id="location" type="text"
                placeholder="e.g. Lagos, Nigeria"
                value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>

            </div>

          <div className="event-editor-sidebar">
            <div className="editor-panel">
              <div className="editor-panel-title">Settings</div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="slug">Slug</label>
                <input className="editor-input" id="slug" type="text" placeholder="event-slug"
                  value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
              </div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="registration_url">Registration URL</label>
                <input
                  className="editor-input"
                  id="registration_url"
                  type="url"
                  placeholder="https://lu.ma/..."
                  value={registrationUrl}
                  onChange={(e) => setRegistrationUrl(e.target.value)}
                />
              </div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="social_links">Social media links</label>
                <textarea
                  className="editor-textarea"
                  id="social_links"
                  placeholder={`One URL per line\nhttps://x.com/...\nhttps://linkedin.com/...`}
                  value={socialLinks}
                  onChange={(e) => setSocialLinks(e.target.value)}
                  rows={4}
                />
                <span style={{ fontSize: '11px', color: 'var(--grey-dark)' }}>One URL per line. X, LinkedIn, YouTube, or any platform.</span>
              </div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="event_type">Type</label>
                <select className="editor-select" id="event_type" value={eventType}
                  onChange={(e) => setEventType(e.target.value as NTEvent['event_type'])}>
                  {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="status">Status</label>
                <select className="editor-select" id="status" value={status}
                  onChange={(e) => setStatus(e.target.value as NTEvent['status'])}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="editor-toggle">
                <span className="editor-toggle-label">Hub event</span>
                <label className="editor-toggle-switch">
                  <input type="checkbox" checked={isHubEvent} onChange={(e) => setIsHubEvent(e.target.checked)} />
                  <span className="editor-toggle-track" />
                </label>
              </div>
            </div>

            <div className="editor-panel">
              <div className="editor-panel-title">Cover media</div>

              <div className="editor-field">
                <label className="editor-label">Cover image</label>
                <CoverImageUpload
                  value={coverImage}
                  onChange={setCoverImage}
                  folder="events"
                />
              </div>

              <div className="editor-field">
                <label className="editor-label">Photo gallery</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {gallery.map((url, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--navy-mid)', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Gallery ${i + 1}`} style={{ width: '64px', height: '48px', objectFit: 'cover', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '11px', color: 'var(--grey-mid)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
                      <button
                        type="button"
                        onClick={() => setGallery(gallery.filter((_, idx) => idx !== i))}
                        style={{ background: 'none', border: '1px solid rgba(232,69,69,0.3)', color: 'var(--error)', cursor: 'pointer', padding: '4px 8px', fontSize: '10px', flexShrink: 0 }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <CoverImageUpload
                    value=""
                    onChange={(url) => { if (url) setGallery((prev) => [...prev, url]) }}
                    folder="events/gallery"
                  />
                  <span style={{ fontSize: '11px', color: 'var(--grey-dark)' }}>
                    Each upload adds a photo to the gallery. Upload multiple times to add more.
                  </span>
                </div>
              </div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="youtube_url">YouTube video URL</label>
                <input
                  className="editor-input"
                  id="youtube_url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
                <span style={{ fontSize: '11px', color: 'var(--grey-dark)' }}>
                  If set, the video will be used as the event cover instead of the image.
                </span>
              </div>
            </div>

            <div className="editor-panel">
              <div className="editor-panel-title">Cover color</div>
              <div className="editor-field">
                <div className="color-field">
                  <div className="color-preview" style={{ background: coverColor }} />
                  <input className="editor-input" type="text" placeholder="#DB6727"
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
                  <div>Created: {new Date(event!.created_at).toLocaleDateString('en-GB')}</div>
                  <div>Updated: {new Date(event!.updated_at).toLocaleDateString('en-GB')}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}