import { notFound } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import SectionTag from '@/components/shared/SectionTag'
import CTABox from '@/components/ui/CTABox'
import { createClient } from '@nextrium/supabase/server'
import { normalizeUrl } from '@nextrium/utils/normalizeUrl'
import type { NTEvent } from '@nextrium/supabase/database'

interface Props {
  params: Promise<{ slug: string }>
}

async function getEvent(slug: string): Promise<NTEvent | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error || !data) return null
  return data
}

async function getRelatedEvents(slug: string, eventType: string): Promise<NTEvent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_published', true)
    .eq('event_type', eventType)
    .neq('slug', slug)
    .limit(2)
  if (error || !data) return []
  return data
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const event = await getEvent(slug)
  if (!event) return { title: 'Event not found' }
  return { title: event.title, description: event.description.slice(0, 160) }
}

const TYPE_LABELS: Record<NTEvent['event_type'], string> = {
  hackathon: 'Hackathon',
  workshop:  'Workshop',
  summit:    'Summit',
  community: 'Community',
  other:     'Event',
}

const STATUS_STYLES: Record<NTEvent['status'], { bg: string; color: string }> = {
  upcoming:  { bg: 'rgba(74,111,165,0.1)',  color: 'var(--slate)'   },
  ongoing:   { bg: 'rgba(212,168,67,0.1)',  color: 'var(--gold)'    },
  completed: { bg: 'rgba(34,193,122,0.1)',  color: 'var(--success)' },
  cancelled: { bg: 'rgba(232,69,69,0.1)',   color: 'var(--error)'   },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null
  try {
    // Handle youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
    if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`

    // Handle youtube.com/watch?v=VIDEO_ID
    const longMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
    if (longMatch) return `https://www.youtube.com/embed/${longMatch[1]}`

    // Handle youtube.com/embed/VIDEO_ID -- already an embed URL
    if (url.includes('/embed/')) return url

    return null
  } catch {
    return null
  }
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params
  const event = await getEvent(slug)
  if (!event) notFound()

  const related    = await getRelatedEvents(slug, event.event_type)
  const ss         = STATUS_STYLES[event.status]
  const embedUrl   = event.youtube_url ? getYoutubeEmbedUrl(event.youtube_url) : null
  const hasGallery = event.gallery && event.gallery.length > 0

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }

        .event-hero { background: var(--navy-deep); padding-top: calc(var(--nav-height) + 80px); padding-bottom: 0; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .event-hero-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 50% 60% at 90% 10%, rgba(219,103,39,0.09) 0%, transparent 55%), radial-gradient(ellipse 40% 50% at 5% 90%, rgba(212,168,67,0.07) 0%, transparent 50%); }
        .event-hero-grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.03; background-image: linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px); background-size: 72px 72px; }
        .event-hero-inner { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: end; padding-bottom: 80px; }
        .event-hero-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; animation: fadeUp 0.6s ease both; }
        .event-type-badge { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; padding: 4px 10px; color: var(--orange); border: 1px solid rgba(219,103,39,0.3); }
        .event-status-badge { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; padding: 4px 10px; }
        .event-title { font-family: var(--font-exo2); font-weight: 900; font-size: clamp(36px, 6vw, 72px); line-height: 0.97; letter-spacing: -2px; color: var(--white); animation: fadeUp 0.7s ease both; animation-delay: 0.1s; }
        .event-hero-right { animation: fadeUp 0.7s ease both; animation-delay: 0.25s; padding-bottom: 8px; }
        .event-details { display: flex; flex-direction: column; gap: 0; }
        .event-detail-row { display: grid; grid-template-columns: 120px 1fr; gap: 16px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .event-detail-row:first-child { border-top: 1px solid rgba(255,255,255,0.06); }
        .event-detail-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); padding-top: 2px; }
        .event-detail-value { font-size: 14px; color: var(--off-white); }

        /* Cover image */
        .event-cover { width: 100%; max-height: 520px; object-fit: cover; display: block; }
        .event-cover-wrap { width: 100%; overflow: hidden; background: var(--navy-mid); position: relative; }

        .event-body-section { background: var(--off-white); padding: var(--section-py) 0; }
        .event-body-grid { display: grid; grid-template-columns: 1fr 320px; gap: 80px; align-items: start; }
        .event-desc-title { font-family: var(--font-exo2); font-weight: 800; font-size: clamp(24px, 3vw, 36px); color: var(--navy-deep); letter-spacing: -0.5px; line-height: 1.15; margin-bottom: 24px; }
        .event-desc { font-size: 16px; color: var(--grey-dark); line-height: 1.85; white-space: pre-wrap; }

        /* YouTube embed */
        .event-youtube-wrap { width: 100%; aspect-ratio: 16/9; margin-bottom: 32px; background: #000; }
        .event-youtube-wrap iframe { width: 100%; height: 100%; border: none; display: block; }

        .event-sidebar { display: flex; flex-direction: column; gap: 16px; position: sticky; top: calc(var(--nav-height) + 32px); }
        .event-sidebar-panel { background: var(--white); border: 1px solid var(--grey-light); padding: 24px; }
        .event-sidebar-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--grey-light); }
        .event-sidebar-detail { display: flex; flex-direction: column; gap: 12px; }
        .event-sidebar-row { display: flex; flex-direction: column; gap: 4px; }
        .event-sidebar-label { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); }
        .event-sidebar-value { font-size: 13px; color: var(--grey-dark); }
        .event-register-btn { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; background: var(--orange); color: var(--white); text-decoration: none; font-family: var(--font-dm); font-size: 14px; transition: background var(--transition-base); }
        .event-register-btn:hover { background: var(--orange-f, #C4521A); }
        .event-social-links { display: flex; flex-direction: column; gap: 8px; }
        .event-social-link { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px; border: 1px solid var(--grey-light); color: var(--grey-dark); text-decoration: none; font-size: 12px; transition: all var(--transition-base); }
        .event-social-link:hover { border-color: var(--navy); color: var(--navy-deep); }

        /* Gallery */
        .gallery-section { background: var(--navy-deep); padding: var(--section-py) 0; }
        .gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
        .gallery-item { aspect-ratio: 4/3; overflow: hidden; background: var(--navy-mid); cursor: pointer; }
        .gallery-item img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform var(--transition-slow); }
        .gallery-item:hover img { transform: scale(1.05); }
        .gallery-item:first-child { grid-column: span 2; aspect-ratio: 16/9; }

        /* Lightbox */
        .lightbox { position: fixed; inset: 0; z-index: 200; background: rgba(7,22,40,0.96); display: flex; align-items: center; justify-content: center; padding: 24px; }
        .lightbox img { max-width: 100%; max-height: 90vh; object-fit: contain; display: block; }
        .lightbox-close { position: absolute; top: 24px; right: 24px; background: none; border: 1px solid rgba(255,255,255,0.2); color: var(--white); font-size: 18px; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
        .lightbox-close:hover { border-color: var(--orange); color: var(--orange); }

        .related-section { background: var(--navy-deep); padding: var(--section-py) 0; }
        .related-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(255,255,255,0.06); }
        .related-card { background: var(--navy); padding: 32px; display: flex; flex-direction: column; gap: 14px; text-decoration: none; transition: background var(--transition-base); position: relative; }
        .related-card::before, .related-card::after { content: ''; position: absolute; width: 10px; height: 10px; border-color: rgba(219,103,39,0); border-style: solid; transition: border-color var(--transition-slow); }
        .related-card::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .related-card::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .related-card:hover { background: var(--navy-mid); }
        .related-card:hover::before, .related-card:hover::after { border-color: var(--orange); }
        .related-title { font-family: var(--font-exo2); font-weight: 700; font-size: 18px; color: var(--white); letter-spacing: -0.2px; line-height: 1.3; flex: 1; }
        .related-meta { font-size: 12px; color: var(--grey-mid); }
        .related-arrow { font-size: 16px; color: var(--grey-dark); align-self: flex-end; transition: color var(--transition-base), transform var(--transition-base); }
        .related-card:hover .related-arrow { color: var(--orange); transform: translate(3px, -3px); }
        .back-link { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); text-decoration: none; transition: color var(--transition-base); margin-bottom: 40px; }
        .back-link:hover { color: var(--orange); }
        .related-cta-row { border-top: 1px solid rgba(255,255,255,0.06); }
        .related-cta-row a { max-width: 100% !important; width: 100% !important; }

        @media (max-width: 900px) { .event-hero-inner { grid-template-columns: 1fr; gap: 40px; } .event-body-grid { grid-template-columns: 1fr; gap: 40px; } .event-sidebar { position: static; } .related-grid { grid-template-columns: 1fr; } .gallery-grid { grid-template-columns: 1fr 1fr; } .gallery-item:first-child { grid-column: span 2; } }
        @media (max-width: 600px) { .event-detail-row { grid-template-columns: 1fr; gap: 2px; } .gallery-grid { grid-template-columns: 1fr; } .gallery-item:first-child { grid-column: span 1; aspect-ratio: 4/3; } }
      `}</style>

      <Navbar />

      <section className="event-hero">
        <div className="event-hero-glow" />
        <div className="event-hero-grid" />
        <div className="container">
          <Link href="/events" className="back-link">← Back to events</Link>
          <div className="event-hero-inner">
            <div>
              <div className="event-hero-meta">
                <span className="event-type-badge">{TYPE_LABELS[event.event_type]}</span>
                <span className="event-status-badge" style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}33` }}>
                  {event.status}
                </span>
                {event.is_hub_event && (
                  <span className="event-type-badge" style={{ color: 'var(--teal)', borderColor: 'rgba(10,139,139,0.3)' }}>Hub event</span>
                )}
              </div>
              <h1 className="event-title">{event.title}</h1>
            </div>
            <div className="event-hero-right">
              <div className="event-details">
                {([
                  ['Date', formatDate(event.start_date) + (event.end_date && event.end_date !== event.start_date ? ` to ${formatDate(event.end_date)}` : '')],
                  ['Location', event.location],
                  ['Type', TYPE_LABELS[event.event_type]],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="event-detail-row">
                    <span className="event-detail-label">{label}</span>
                    <span className="event-detail-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {event.cover_image_url && (
          <div className="container" style={{ paddingBottom: '40px' }}>
            <div className="event-cover-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={event.cover_image_url} alt={event.title} className="event-cover" />
            </div>
          </div>
        )}
      </section>

      <section className="event-body-section">
        <div className="container">
          <div className="event-body-grid">
            <div>
              <SectionTag label="About this event" />
              <div className="event-desc-title">
                {event.status === 'completed' ? 'What happened.' : 'What to expect.'}
              </div>

              {embedUrl && (
                <div className="event-youtube-wrap">
                  <iframe
                    src={embedUrl}
                    title={event.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              <p className="event-desc">{event.description}</p>
            </div>

            <div className="event-sidebar">
              <div className="event-sidebar-panel">
                <div className="event-sidebar-title">Event details</div>
                <div className="event-sidebar-detail">
                  <div className="event-sidebar-row">
                    <span className="event-sidebar-label">Date</span>
                    <span className="event-sidebar-value">{formatDate(event.start_date)}</span>
                  </div>
                  {event.end_date && event.end_date !== event.start_date && (
                    <div className="event-sidebar-row">
                      <span className="event-sidebar-label">End date</span>
                      <span className="event-sidebar-value">{formatDate(event.end_date)}</span>
                    </div>
                  )}
                  <div className="event-sidebar-row">
                    <span className="event-sidebar-label">Location</span>
                    <span className="event-sidebar-value">{event.location}</span>
                  </div>
                  <div className="event-sidebar-row">
                    <span className="event-sidebar-label">Type</span>
                    <span className="event-sidebar-value">{TYPE_LABELS[event.event_type]}</span>
                  </div>
                  <div className="event-sidebar-row">
                    <span className="event-sidebar-label">Status</span>
                    <span className="event-sidebar-value" style={{ color: ss.color }}>{event.status}</span>
                  </div>
                </div>
              </div>

              {event.registration_url && (
                <a href={normalizeUrl(event.registration_url)} className="event-register-btn" target="_blank" rel="noopener noreferrer">
                  <span>Register now</span><span>↗</span>
                </a>
              )}

              {event.social_links && event.social_links.length > 0 && (
                <div className="event-sidebar-panel">
                  <div className="event-sidebar-title">Follow this event</div>
                  <div className="event-social-links">
                    {event.social_links.map((url) => {
                      const normalized = normalizeUrl(url)
                      const domain = normalized.replace('https://', '').replace('http://', '').split('/')[0]
                      return (
                        <a key={url} href={normalized} className="event-social-link" target="_blank" rel="noopener noreferrer">
                          <span>{domain}</span><span>↗</span>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {hasGallery && (
        <section className="gallery-section">
          <div className="container">
            <div style={{ marginBottom: '40px' }}>
              <SectionTag label="Photo gallery" />
              <h2 className="section-title">From the event.</h2>
            </div>
            <div className="gallery-grid">
              {event.gallery!.map((url, i) => (
                <div key={i} className="gallery-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`${event.title} photo ${i + 1}`} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="related-section">
          <div className="container">
            <div style={{ marginBottom: '40px' }}>
              <SectionTag label="More events" />
              <h2 className="section-title">Keep exploring.</h2>
            </div>
            <div className="related-grid">
              {related.map((e) => (
                <Link key={e.slug} href={`/events/${e.slug}`} className="related-card">
                  <span className="event-type-badge" style={{ display: 'inline-block', width: 'fit-content' }}>{TYPE_LABELS[e.event_type]}</span>
                  <div className="related-title">{e.title}</div>
                  <div className="related-meta">{formatDate(e.start_date)} · {e.location}</div>
                  <span className="related-arrow">↗</span>
                </Link>
              ))}
            </div>
            <div className="related-cta-row">
              <CTABox href="/events" label="View all events" variant="dark" fullWidth />
            </div>
          </div>
        </section>
      )}

      <Footer />
    </>
  )
}