import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import SectionTag from '@/components/shared/SectionTag'
import Link from 'next/link'
import { createClient } from '@nextrium/supabase/server'
import { normalizeUrl } from '@nextrium/utils/normalizeUrl'
import type { TeamMember } from '@nextrium/supabase/database'

export const metadata = {
  title: 'Our Team',
  description: 'Meet the core team behind NexTrium. The people building, organising, and growing the ecosystem.',
}

async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('team_members')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  return (data ?? []) as TeamMember[]
}

export default async function TeamPage() {
  const members = await getTeamMembers()

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .team-hero { background: var(--navy-deep); padding-top: calc(var(--nav-height) + 80px); padding-bottom: 80px; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .team-hero-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 50% 60% at 90% 10%, rgba(219,103,39,0.09) 0%, transparent 55%), radial-gradient(ellipse 40% 50% at 5% 90%, rgba(10,139,139,0.07) 0%, transparent 50%); }
        .team-hero-grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.03; background-image: linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px); background-size: 72px 72px; }
        .team-hero-inner { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: end; }
        .team-headline { font-family: var(--font-exo2); font-weight: 900; font-size: clamp(36px, 5vw, 72px); line-height: 1.0; letter-spacing: -2px; color: var(--white); animation: fadeUp 0.7s ease both; animation-delay: 0.1s; }
        .team-headline em { font-style: normal; color: var(--orange); }
        .team-hero-desc { font-weight: 300; font-size: clamp(15px, 1.6vw, 18px); color: var(--grey-mid); line-height: 1.75; animation: fadeUp 0.7s ease both; animation-delay: 0.25s; padding-bottom: 8px; }

        .team-section { background: var(--navy-deep); padding: 80px 0; }
        .team-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: var(--navy-deep); }

        .member-card { display: grid; grid-template-columns: 280px 1fr; background: var(--navy); position: relative; overflow: hidden; transition: background var(--transition-base); min-height: 280px; }
        .member-card:hover { background: var(--navy-mid); }
        .member-card::before, .member-card::after { content: ''; position: absolute; width: 12px; height: 12px; border-color: rgba(219,103,39,0); border-style: solid; transition: border-color var(--transition-slow); z-index: 2; }
        .member-card::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .member-card::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .member-card:hover::before, .member-card:hover::after { border-color: var(--orange); }

        .member-card-photo { overflow: hidden; background: var(--navy-mid); flex-shrink: 0; }
        .member-card-photo img { width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block; transition: transform var(--transition-slow); }
        .member-card:hover .member-card-photo img { transform: scale(1.04); }
        .member-card-photo-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--navy-mid) 0%, var(--navy) 100%); font-family: var(--font-exo2); font-weight: 900; font-size: 64px; color: rgba(219,103,39,0.3); }

        .member-card-body { padding: 40px; display: flex; flex-direction: column; gap: 12px; justify-content: center; }
        .member-card-role { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--orange); }
        .member-card-name { font-family: var(--font-exo2); font-weight: 700; font-size: clamp(20px, 2.5vw, 28px); color: var(--white); letter-spacing: -0.3px; line-height: 1.2; }
        .member-card-bio { font-size: 14px; color: rgba(255,255,255,0.55); line-height: 1.75; max-width: 520px; }
        .member-card-links { display: flex; gap: 0; flex-wrap: wrap; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 8px; }
        .member-card-link { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); text-decoration: none; padding: 7px 12px; border: 1px solid rgba(255,255,255,0.08); transition: all 0.15s ease; margin-right: -1px; }
        .member-card-link:hover { color: var(--white); border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.04); }
        .member-card-link-email { color: rgba(219,103,39,0.7); border-color: rgba(219,103,39,0.2); }
        .member-card-link-email:hover { color: var(--orange); border-color: var(--orange); background: rgba(219,103,39,0.06); }

        .team-founders-note { padding: 48px 0; border-top: 1px solid rgba(255,255,255,0.06); }
        .team-founders-note-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        .team-founders-note-text { font-size: 14px; color: var(--grey-mid); line-height: 1.7; max-width: 520px; }
        .team-founders-link { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); text-decoration: none; display: flex; align-items: center; gap: 8px; transition: gap 0.15s ease; }
        .team-founders-link:hover { gap: 14px; }

        .team-empty { padding: 80px 0; text-align: center; }
        .team-empty-title { font-family: var(--font-exo2); font-weight: 700; font-size: 22px; color: var(--white); margin-bottom: 12px; }
        .team-empty-sub { font-size: 14px; color: var(--grey-mid); }

        @media (max-width: 900px) { .team-hero-inner { grid-template-columns: 1fr; gap: 32px; } }
        @media (max-width: 768px) { .team-grid { grid-template-columns: 1fr; } .member-card { grid-template-columns: 1fr; min-height: auto; } .member-card-photo { min-height: 240px; } .member-card-body { padding: 28px; } }
      `}</style>

      <Navbar />

      <section className="team-hero">
        <div className="team-hero-glow" />
        <div className="team-hero-grid" />
        <div className="container">
          <div className="team-hero-inner">
            <div>
              <SectionTag label="Our team" />
              <h1 className="team-headline">
                The people<br />behind the <em>work.</em>
              </h1>
            </div>
            <p className="team-hero-desc">
              NexTrium is built by a small, focused team of builders, organisers, and practitioners. Everyone here works on things that matter.
            </p>
          </div>
        </div>
      </section>

      <section className="team-section">
        <div className="container">
          {members.length === 0 ? (
            <div className="team-empty">
              <div className="team-empty-title">Team page coming soon.</div>
              <div className="team-empty-sub">We are building this out. Check back soon.</div>
            </div>
          ) : (
            <div className="team-grid">
              {members.map((member) => (
                <div key={member.slug} className="member-card">
                  <div className="member-card-photo">
                    {member.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.photo_url} alt={member.name} />
                    ) : (
                      <div className="member-card-photo-placeholder">
                        {member.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="member-card-body">
                    <div className="member-card-role">{member.role}</div>
                    <div className="member-card-name">{member.name}</div>
                    {member.detail && (
                      <div className="member-card-bio">{member.detail}</div>
                    )}
                    <div className="member-card-links">
                      {member.github_url && (
                        <a href={normalizeUrl(member.github_url)} target="_blank" rel="noopener noreferrer" className="member-card-link">GitHub ↗</a>
                      )}
                      {member.linkedin_url && (
                        <a href={normalizeUrl(member.linkedin_url)} target="_blank" rel="noopener noreferrer" className="member-card-link">LinkedIn ↗</a>
                      )}
                      {member.twitter_url && (
                        <a href={normalizeUrl(member.twitter_url)} target="_blank" rel="noopener noreferrer" className="member-card-link">X ↗</a>
                      )}
                      {member.email && (
                        <a href={`mailto:${member.email}`} className="member-card-link member-card-link-email">Email ↗</a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="team-founders-note">
            <div className="team-founders-note-inner">
              <p className="team-founders-note-text">
                NexTrium is led by Abdulbasit Abdulrahman Adigun as Founder and CEO. Learn more about the company and its origin on the about page.
              </p>
              <Link href="/about#team" className="team-founders-link">
                <span>Meet the founders</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}