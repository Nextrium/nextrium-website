'use client'

import { useState } from 'react'
import Link from 'next/link'
import SectionTag from '@/components/shared/SectionTag'
import type { NTEvent } from '@nextrium/supabase/database'

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: 'all',       label: 'All'       },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'workshop',  label: 'Workshop'  },
  { value: 'summit',    label: 'Summit'    },
  { value: 'community', label: 'Community' },
]

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

function getYoutubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

function getCardImage(event: NTEvent): string | null {
  if (event.cover_image_url) return event.cover_image_url
  if (event.youtube_url) {
    const id = getYoutubeId(event.youtube_url)
    if (id) return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
  }
  return null
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

interface EventsClientProps {
  events: NTEvent[]
}

export default function EventsClient({ events }: EventsClientProps) {
  const [active, setActive] = useState('all')

  const filtered = active === 'all'
    ? events
    : events.filter((e) => e.event_type === active)

  const upcoming  = filtered.filter((e) => e.status === 'upcoming' || e.status === 'ongoing')
  const completed = filtered.filter((e) => e.status === 'completed' || e.status === 'cancelled')

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }

        .events-hero { background: var(--navy-deep); padding-top: calc(var(--nav-height) + 80px); padding-bottom: 80px; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .events-hero-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 55% 50% at 88% 12%, rgba(219,103,39,0.10) 0%, transparent 58%), radial-gradient(ellipse 40% 55% at 6% 88%, rgba(212,168,67,0.07) 0%, transparent 52%); }
        .events-hero-grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.03; background-image: linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px); background-size: 72px 72px; }
        .events-hero-inner { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: end; }
        .events-headline { font-family: var(--font-exo2); font-weight: 900; font-size: clamp(48px, 8vw, 88px); line-height: 0.95; letter-spacing: -2.5px; color: var(--white); margin-bottom: 0; animation: fadeUp 0.7s ease both; animation-delay: 0.1s; }
        .events-headline em { font-style: normal; color: var(--orange); }
        .events-hero-desc { font-weight: 300; font-size: clamp(15px, 1.6vw, 18px); color: var(--grey-mid); line-height: 1.75; animation: fadeUp 0.7s ease both; animation-delay: 0.25s; padding-bottom: 8px; }

        .events-section { background: var(--navy-deep); padding: 80px 0; }
        .filter-bar { display: flex; align-items: center; gap: 2px; margin-bottom: 48px; flex-wrap: wrap; }
        .filter-btn { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; padding: 10px 18px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: var(--grey-mid); cursor: pointer; transition: all var(--transition-base); }
        .filter-btn:hover { color: var(--white); border-color: rgba(255,255,255,0.25); }
        .filter-btn.active { background: var(--orange); color: var(--white); border-color: var(--orange); }

        .events-group-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--grey-dark); margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .events-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 64px; }

        /* ── Event card ── */
        .event-card { background: var(--navy); text-decoration: none; display: flex; flex-direction: column; position: relative; transition: transform var(--transition-base); overflow: hidden; }
        .event-card::before, .event-card::after { content: ''; position: absolute; width: 12px; height: 12px; border-color: rgba(219,103,39,0); border-style: solid; transition: border-color var(--transition-slow); z-index: 2; }
        .event-card::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .event-card::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .event-card:hover::before, .event-card:hover::after { border-color: var(--orange); }
        .event-card:hover { transform: translateY(-4px); }

        /* Card media */
        .event-card-media { width: 100%; aspect-ratio: 16/9; position: relative; overflow: hidden; flex-shrink: 0; }
        .event-card-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform var(--transition-slow); }
        .event-card:hover .event-card-media img { transform: scale(1.04); }

        /* Brand pattern fallback */
        .event-card-pattern {
          width: 100%; height: 100%;
          background-color: var(--pattern-color, #0D233D);
          position: relative; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
        }
        .event-card-pattern::before {
          content: '';
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(219,103,39,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(219,103,39,0.12) 1px, transparent 1px);
          background-size: 32px 32px;
        }
        .event-card-pattern::after {
          content: '';
          position: absolute;
          width: 120px; height: 120px;
          border: 2px solid rgba(219,103,39,0.2);
          border-radius: 50%;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 0 24px rgba(219,103,39,0.06), 0 0 0 48px rgba(219,103,39,0.03);
        }
        .event-card-pattern-mark {
          position: relative; z-index: 1;
          font-family: var(--font-exo2); font-weight: 900;
          font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(219,103,39,0.6);
        }

        /* Card overlay badges */
        .event-card-badges {
          position: absolute; top: 12px; left: 12px;
          display: flex; gap: 6px; z-index: 2;
        }
        .event-type-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.15em; text-transform: uppercase; padding: 4px 8px; background: rgba(7,22,40,0.85); color: var(--orange); border: 1px solid rgba(219,103,39,0.4); backdrop-filter: blur(4px); }
        .event-status-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.15em; text-transform: uppercase; padding: 4px 8px; backdrop-filter: blur(4px); }

        /* Card body */
        .event-card-body { padding: 24px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
        .event-card-title { font-family: var(--font-exo2); font-weight: 700; font-size: clamp(16px, 2vw, 20px); color: var(--white); letter-spacing: -0.3px; line-height: 1.25; }
        .event-card-meta { font-size: 12px; color: var(--grey-mid); line-height: 1.5; }
        .event-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); }
        .event-card-hub { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--teal); }
        .event-card-arrow { font-size: 16px; color: var(--grey-dark); transition: color var(--transition-base), transform var(--transition-base); }
        .event-card:hover .event-card-arrow { color: var(--orange); transform: translate(3px, -3px); }

        .events-empty { padding: 80px 0; text-align: center; }
        .events-empty-title { font-family: var(--font-exo2); font-weight: 700; font-size: 22px; color: var(--white); margin-bottom: 12px; }
        .events-empty-sub { font-size: 14px; color: var(--grey-mid); }

        @media (max-width: 900px) { .events-hero-inner { grid-template-columns: 1fr; gap: 32px; } .events-grid { grid-template-columns: 1fr; } }
        @media (max-width: 600px) { .filter-btn { padding: 8px 12px; font-size: 8px; } }
      `}</style>

      <section className="events-hero">
        <div className="events-hero-glow" />
        <div className="events-hero-grid" />
        <div className="container">
          <div className="events-hero-inner">
            <div>
              <SectionTag label="Events" />
              <h1 className="events-headline">
                Where the<br />community<br /><em>gathers.</em>
              </h1>
            </div>
            <p className="events-hero-desc">
              Hackathons, workshops, and community sessions organised by NexTrium and the Hub. Every event is designed to produce something real.
            </p>
          </div>
        </div>
      </section>

      <section className="events-section">
        <div className="container">
          <div className="filter-bar" role="group" aria-label="Filter events by type">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                className={`filter-btn ${active === f.value ? 'active' : ''}`}
                onClick={() => setActive(f.value)}
                aria-pressed={active === f.value}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="events-empty">
              <div className="events-empty-title">No events in this category.</div>
              <div className="events-empty-sub">Check back soon or view all events.</div>
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div>
                  <div className="events-group-title">Upcoming</div>
                  <div className="events-grid">
                    {upcoming.map((event) => <EventCard key={event.slug} event={event} />)}
                  </div>
                </div>
              )}
              {completed.length > 0 && (
                <div>
                  <div className="events-group-title">Past events</div>
                  <div className="events-grid">
                    {completed.map((event) => <EventCard key={event.slug} event={event} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  )
}

function EventCard({ event }: { event: NTEvent }) {
  const image  = getCardImage(event)
  const ss     = STATUS_STYLES[event.status]

  return (
    <Link href={`/events/${event.slug}`} className="event-card">
      <div className="event-card-media">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={event.title} />
        ) : (
          <div
            className="event-card-pattern"
            style={{ '--pattern-color': event.cover_color ?? '#0D233D' } as React.CSSProperties}
          >
            <span className="event-card-pattern-mark">NexTrium</span>
          </div>
        )}
        <div className="event-card-badges">
          <span className="event-type-badge">{TYPE_LABELS[event.event_type]}</span>
          <span
            className="event-status-badge"
            style={{ background: `rgba(7,22,40,0.85)`, color: ss.color, border: `1px solid ${ss.color}55` }}
          >
            {event.status}
          </span>
        </div>
      </div>

      <div className="event-card-body">
        <div className="event-card-title">{event.title}</div>
        <div className="event-card-meta">
          {formatDate(event.start_date)}<br />{event.location}
        </div>
        <div className="event-card-footer">
          <span className="event-card-hub">{event.is_hub_event ? 'Hub event' : 'NexTrium'}</span>
          <span className="event-card-arrow">↗</span>
        </div>
      </div>
    </Link>
  )
}