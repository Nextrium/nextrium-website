import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import SectionTag from '@/components/shared/SectionTag'
import CTABox from '@/components/ui/CTABox'
import Link from 'next/link'
import { createClient } from '@nextrium/supabase/server'
import { normalizeUrl } from '@nextrium/utils/normalizeUrl'
import type { NTEvent, CommunityProject } from '@nextrium/supabase/database'

export const metadata = {
  title: 'NexTrium Hub',
  description: 'The Hub is NexTrium\'s community and innovation programme. Hackathons, workshops, and build sprints that produce real products from real teams.',
}

const WHAT_HAPPENS = [
  {
    num: '01',
    title: 'Events',
    description: 'We organise hackathons, workshops, and community sessions that bring builders together around real problems. Every event is designed to produce something, not just discuss it.',
  },
  {
    num: '02',
    title: 'Collaboration',
    description: 'Teams from different backgrounds work together on products that none of them could ship alone. We create the structure. They bring the ideas and the drive.',
  },
  {
    num: '03',
    title: 'Community projects',
    description: 'Products built through Hub events are owned by the teams that built them. NexTrium provides the platform, the mentorship, and where possible, the infrastructure.',
  },
]


const TYPE_LABELS: Record<NTEvent['event_type'], string> = {
  hackathon: 'Hackathon',
  workshop:  'Workshop',
  summit:    'Summit',
  community: 'Community',
  other:     'Event',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric'
  })
}

async function getHubData() {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('is_hub_event', true)
    .eq('is_published', true)
    .order('start_date', { ascending: false })

  const { count: totalEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('is_hub_event', true)

  const { data: projects } = await (supabase as any)
    .from('community_projects')
    .select('*')
    .order('sort_order', { ascending: true })

  return {
    events:     events   ?? [] as NTEvent[],
    eventCount: totalEvents ?? 0,
    projects:   (projects ?? []) as CommunityProject[],
  }
}

export default async function HubPage() {
  const { events, eventCount, projects } = await getHubData()

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes countUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .hub-hero { background: var(--navy-deep); padding-top: calc(var(--nav-height) + 80px); padding-bottom: 80px; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .hub-hero-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 55% 50% at 88% 12%, rgba(219,103,39,0.10) 0%, transparent 58%), radial-gradient(ellipse 40% 55% at 6% 88%, rgba(212,168,67,0.07) 0%, transparent 52%); }
        .hub-hero-grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.03; background-image: linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px); background-size: 72px 72px; }
        .hub-hero-inner { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: end; }
        .hub-headline { font-family: var(--font-exo2); font-weight: 900; font-size: clamp(36px, 5vw, 72px); line-height: 1.0; letter-spacing: -2px; color: var(--white); animation: fadeUp 0.7s ease both; animation-delay: 0.1s; }
        .hub-headline em { font-style: normal; color: var(--orange); }
        .hub-hero-right { animation: fadeUp 0.7s ease both; animation-delay: 0.25s; padding-bottom: 8px; }
        .hub-hero-desc { font-weight: 300; font-size: clamp(15px, 1.6vw, 18px); color: var(--grey-mid); line-height: 1.75; margin-bottom: 40px; }
        .hub-stats-row { display: flex; gap: 48px; flex-wrap: wrap; }
        .hub-stat { animation: countUp 0.7s ease both; }
        .hub-stat:nth-child(1) { animation-delay: 0.1s; }
        .hub-stat:nth-child(2) { animation-delay: 0.25s; }
        .hub-stat:nth-child(3) { animation-delay: 0.4s; }
        .hub-stat-num { font-family: var(--font-exo2); font-weight: 900; font-size: 48px; letter-spacing: -2px; color: var(--orange); line-height: 1; }
        .hub-stat-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); margin-top: 6px; }
        .what-section { background: var(--off-white); padding: var(--section-py) 0; }
        .what-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--grey-light); }
        .what-card { background: var(--white); padding: 40px 32px; display: flex; flex-direction: column; gap: 16px; position: relative; }
        .what-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--orange); transform: scaleX(0); transform-origin: left; transition: transform var(--transition-slow); }
        .what-card:hover::before { transform: scaleX(1); }
        .what-num { font-family: var(--font-mono); font-size: 11px; color: var(--orange); letter-spacing: 0.15em; }
        .what-title { font-family: var(--font-exo2); font-weight: 700; font-size: 22px; color: var(--navy-deep); letter-spacing: -0.3px; }
        .what-desc { font-size: 14px; color: var(--grey-dark); line-height: 1.75; }
        .events-section { background: var(--navy); padding: var(--section-py) 0; }
        .events-list { display: flex; flex-direction: column; gap: 1px; background: rgba(255,255,255,0.06); margin-bottom: 0; }
        .event-row { background: var(--navy-mid); display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: center; padding: 28px 32px; text-decoration: none; transition: background var(--transition-base); position: relative; }
        .event-row::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--orange); transform: scaleY(0); transform-origin: bottom; transition: transform var(--transition-slow); }
        .event-row:hover { background: var(--navy-deep); }
        .event-row:hover::before { transform: scaleY(1); }
        .event-row-badges { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
        .event-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.15em; text-transform: uppercase; padding: 3px 8px; color: var(--orange); border: 1px solid rgba(219,103,39,0.3); }
        .event-completed-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.15em; text-transform: uppercase; padding: 3px 8px; color: var(--success); background: rgba(34,193,122,0.1); border: 1px solid rgba(34,193,122,0.2); }
        .event-upcoming-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.15em; text-transform: uppercase; padding: 3px 8px; color: var(--gold); background: rgba(212,168,67,0.1); border: 1px solid rgba(212,168,67,0.2); }
        .event-row-title { font-family: var(--font-exo2); font-weight: 700; font-size: clamp(16px, 2vw, 20px); color: var(--white); letter-spacing: -0.2px; margin-bottom: 4px; }
        .event-row-meta { font-size: 12px; color: var(--grey-mid); }
        .event-row-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
        .event-arrow { font-size: 18px; color: var(--grey-dark); transition: color var(--transition-base), transform var(--transition-base); }
        .event-row:hover .event-arrow { color: var(--orange); transform: translate(3px, -3px); }
        .events-cta-row { display: flex; border-top: 1px solid rgba(255,255,255,0.06); }
        .events-cta-row a { max-width: 100% !important; width: 100% !important; }
        .projects-section { background: var(--navy-deep); padding: var(--section-py) 0; }
        .projects-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: rgba(255,255,255,0.06); }
        .project-card { background: var(--navy); padding: 36px 32px; display: flex; flex-direction: column; gap: 16px; position: relative; }
        .project-card { background: var(--navy); padding: 36px 32px; display: flex; flex-direction: column; gap: 16px; position: relative; transition: background var(--transition-base); }
        .project-card:hover { background: var(--navy-mid); }
        .project-card::before, .project-card::after { content: ''; position: absolute; width: 12px; height: 12px; border-color: rgba(219,103,39,0); border-style: solid; transition: border-color var(--transition-slow); }
        .project-card::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .project-card::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .project-card:hover::before, .project-card:hover::after { border-color: var(--orange); }
        .project-accent { width: 32px; height: 3px; border-radius: 2px; margin-bottom: 4px; }
        .project-name { font-family: var(--font-exo2); font-weight: 700; font-size: 22px; color: var(--white); letter-spacing: -0.3px; }
        .project-team { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #9AAABB; margin-bottom: 4px; }
        .project-desc { font-size: 14px; color: #B0BEC5; line-height: 1.75; flex: 1; }
        .project-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
        .project-event { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #6B7E94; }
        .project-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
        .project-tag { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 9px; border: 1px solid rgba(255,255,255,0.12); color: #8A9BB0; }
        .involve-section { background: var(--navy-deep); padding: 80px 0; border-top: 2px solid var(--orange); }
        .involve-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .involve-statement { font-family: var(--font-exo2); font-weight: 800; font-size: clamp(28px, 3.5vw, 48px); color: var(--white); letter-spacing: -1.5px; line-height: 1.05; }
        .involve-statement em { font-style: normal; color: var(--orange); }
        .involve-right { display: flex; flex-direction: column; gap: 12px; }
        .involve-right a { max-width: 100% !important; width: 100% !important; }
        .hub-empty { padding: 48px 32px; text-align: center; background: var(--navy-mid); font-size: 14px; color: var(--grey-mid); }
        @media (max-width: 900px) { .hub-hero-inner { grid-template-columns: 1fr; gap: 40px; } .what-grid { grid-template-columns: 1fr; } .projects-grid { grid-template-columns: 1fr; } .involve-inner { grid-template-columns: 1fr; gap: 40px; } .event-row { grid-template-columns: 1fr; gap: 12px; padding: 24px; } .event-row-right { align-items: flex-start; flex-direction: row; } }
        @media (max-width: 600px) { .hub-stats-row { gap: 28px; } .hub-stat-num { font-size: 36px; } }
      `}</style>

      <Navbar />

      <section className="hub-hero">
        <div className="hub-hero-glow" />
        <div className="hub-hero-grid" />
        <div className="container">
          <div className="hub-hero-inner">
            <div>
              <SectionTag label="NexTrium Hub" />
              <h1 className="hub-headline">
                Where builders connect<br />and <em>work gets done.</em>
              </h1>
            </div>
            <div className="hub-hero-right">
              <p className="hub-hero-desc">
                The Hub is NexTrium&apos;s community and innovation programme. It brings builders together around real problems, creates the conditions for collaboration, and produces products that would not exist otherwise.
              </p>
              <div className="hub-stats-row">
                <div className="hub-stat">
                  <div className="hub-stat-num">{eventCount}+</div>
                  <div className="hub-stat-label">Events hosted</div>
                </div>
                <div className="hub-stat">
                  <div className="hub-stat-num">{projects.length}</div>
                  <div className="hub-stat-label">Community projects</div>
                </div>
                <div className="hub-stat">
                  <div className="hub-stat-num">2024</div>
                  <div className="hub-stat-label">Est.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="what-section">
        <div className="container">
          <div style={{ marginBottom: '48px' }}>
            <SectionTag label="What happens here" />
            <h2 className="section-title-dark">Three things.<br />All of them real.</h2>
          </div>
          <div className="what-grid">
            {WHAT_HAPPENS.map((item) => (
              <div key={item.num} className="what-card">
                <span className="what-num">{item.num}</span>
                <div className="what-title">{item.title}</div>
                <div className="what-desc">{item.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="events-section">
        <div className="container">
          <div style={{ marginBottom: '48px' }}>
            <SectionTag label="Hub events" />
            <h2 className="section-title">Every event<br />produces something.</h2>
          </div>
          {events.length === 0 ? (
            <div className="hub-empty">No hub events yet.</div>
          ) : (
            <div className="events-list">
              {events.map((event) => (
                <Link key={event.slug} href={`/events/${event.slug}`} className="event-row">
                  <div>
                    <div className="event-row-badges">
                      <span className="event-badge">{TYPE_LABELS[event.event_type]}</span>
                      <span className={event.status === 'completed' ? 'event-completed-badge' : 'event-upcoming-badge'}>
                        {event.status}
                      </span>
                    </div>
                    <div className="event-row-title">{event.title}</div>
                    <div className="event-row-meta">
                      {formatDate(event.start_date)} · {event.location}
                    </div>
                  </div>
                  <div className="event-row-right">
                    <span className="event-arrow">↗</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="events-cta-row">
            <CTABox href="/events" label="View all events" variant="dark" fullWidth />
          </div>
        </div>
      </section>

      <section className="projects-section">
        <div className="container">
          <div style={{ marginBottom: '48px' }}>
            <SectionTag label="Community projects" />
            <h2 className="section-title">Built by the community.<br />Owned by the teams.</h2>
          </div>
          {projects.length === 0 ? (
            <div className="hub-empty">No community projects yet.</div>
          ) : (
            <div className="projects-grid">
              {projects.map((project) => (
                <div key={project.slug} className="project-card">
                  <div className="project-accent" style={{ background: project.cover_color }} />
                  <div className="project-name">{project.name}</div>
                  <div className="project-team">{project.team}</div>
                  <div className="project-desc">{project.description}</div>
                  <div className="project-footer">
                    <span className="project-event">{project.event}</span>
                  </div>
                  <div className="project-tags">
                    {project.tags.map((tag: string) => (
                      <span key={tag} className="project-tag">{tag}</span>
                    ))}
                  </div>
                  {(project.website_url || project.github_url) && (
                    <div style={{ display: 'flex', gap: '12px', paddingTop: '12px' }}>
                      {project.website_url && (
                        <a href={normalizeUrl(project.website_url)} target="_blank" rel="noopener noreferrer"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--orange)', textDecoration: 'none' }}>
                          Website ↗
                        </a>
                      )}
                      {project.github_url && (
                        <a href={normalizeUrl(project.github_url)} target="_blank" rel="noopener noreferrer"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--grey-mid)', textDecoration: 'none' }}>
                          GitHub ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="involve-section">
        <div className="container">
          <div className="involve-inner">
            <div className="involve-statement">
              Ready to build<br />with the <em>community?</em>
            </div>
            <div className="involve-right">
              <CTABox href="/contact?subject=partnership" label="Get involved" variant="dark" />
              <CTABox href="/events" label="See upcoming events" variant="dark" />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}