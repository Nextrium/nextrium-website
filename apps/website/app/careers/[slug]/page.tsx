import { notFound } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import SectionTag from '@/components/shared/SectionTag'
import CareersApplicationForm from '../CareersApplicationForm'
import ExecutiveApplicationForm from '../ExecutiveApplicationForm'
import { createClient } from '@nextrium/supabase/server'
import type { Role } from '@nextrium/supabase/database'

interface Props {
  params: Promise<{ slug: string }>
}

async function getRole(slug: string): Promise<Role | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  if (error || !data) return null
  return data
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const role = await getRole(slug)
  if (!role) return { title: 'Role not found' }
  return { title: role.title, description: role.description }
}

const TYPE_LABELS: Record<Role['type'], string> = {
  full_time:  'Full-time',
  contract:   'Contract',
  volunteer:  'Volunteer',
  internship: 'Internship',
}

function formatCloseDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

export default async function RolePage({ params }: Props) {
  const { slug } = await params
  const role = await getRole(slug)
  if (!role) notFound()

  const isExecutive = (role.sort_order ?? 0) >= 100

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .role-hero { background: var(--navy-deep); padding-top: calc(var(--nav-height) + 80px); padding-bottom: 80px; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .role-hero-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 50% 60% at 90% 10%, rgba(219,103,39,0.09) 0%, transparent 55%), radial-gradient(ellipse 40% 50% at 5% 90%, rgba(34,193,122,0.06) 0%, transparent 50%); }
        .role-hero-grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.03; background-image: linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px); background-size: 72px 72px; }
        .role-hero-inner { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: end; }
        .role-hero-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; animation: fadeUp 0.6s ease both; }
        .role-badge { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; padding: 4px 10px; border: 1px solid rgba(255,255,255,0.12); color: var(--grey-mid); }
        .role-badge-team { color: var(--orange); border-color: rgba(219,103,39,0.3); }
        .role-title { font-family: var(--font-exo2); font-weight: 900; font-size: clamp(36px, 6vw, 72px); line-height: 0.97; letter-spacing: -2px; color: var(--white); animation: fadeUp 0.7s ease both; animation-delay: 0.1s; }
        .role-hero-right { animation: fadeUp 0.7s ease both; animation-delay: 0.25s; padding-bottom: 8px; }
        .role-details { display: flex; flex-direction: column; gap: 0; }
        .role-detail-row { display: grid; grid-template-columns: 120px 1fr; gap: 16px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .role-detail-row:first-child { border-top: 1px solid rgba(255,255,255,0.06); }
        .role-detail-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); padding-top: 2px; }
        .role-detail-value { font-size: 14px; color: var(--off-white); }
        .role-body-section { background: var(--off-white); padding: var(--section-py) 0; }
        .role-body-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
        .role-desc-title { font-family: var(--font-exo2); font-weight: 800; font-size: clamp(24px, 3vw, 36px); color: var(--navy-deep); letter-spacing: -0.5px; line-height: 1.15; margin-bottom: 24px; }
        .role-desc { font-size: 16px; color: var(--grey-dark); line-height: 1.8; margin-bottom: 40px; }
        .role-req-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); margin-bottom: 20px; }
        .role-requirements { display: flex; flex-direction: column; gap: 12px; }
        .role-req { display: flex; align-items: flex-start; gap: 12px; font-size: 15px; color: var(--grey-dark); line-height: 1.6; }
        .role-req::before { content: ''; width: 4px; height: 4px; flex-shrink: 0; background: var(--orange); border-radius: 50%; margin-top: 8px; }
        .apply-section { background: var(--navy-deep); padding: var(--section-py) 0; }
        .apply-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
        .apply-title { font-family: var(--font-exo2); font-weight: 800; font-size: clamp(28px, 3.5vw, 44px); color: var(--white); letter-spacing: -1px; line-height: 1.05; margin-bottom: 16px; }
        .apply-title em { font-style: normal; color: var(--orange); }
        .apply-desc { font-size: 15px; color: var(--grey-mid); line-height: 1.75; }
        .back-link { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); text-decoration: none; transition: color var(--transition-base); margin-bottom: 40px; }
        .back-link:hover { color: var(--orange); }
        @media (max-width: 900px) { .role-hero-inner { grid-template-columns: 1fr; gap: 40px; } .role-body-grid { grid-template-columns: 1fr; gap: 40px; } .apply-grid { grid-template-columns: 1fr; gap: 48px; } }
        @media (max-width: 600px) { .role-detail-row { grid-template-columns: 1fr; gap: 2px; } }
      `}</style>

      <Navbar />

      <section className="role-hero">
        <div className="role-hero-glow" />
        <div className="role-hero-grid" />
        <div className="container">
          <Link href="/careers" className="back-link">← Back to careers</Link>
          <div className="role-hero-inner">
            <div>
              <div className="role-hero-meta">
                <span className="role-badge role-badge-team">{role.team}</span>
                <span className="role-badge">{TYPE_LABELS[role.type]}</span>
                <span className="role-badge">{role.location}</span>
              </div>
              <h1 className="role-title">{role.title}</h1>
            </div>
            <div className="role-hero-right">
              <div className="role-details">
                {([
                  ['Team',     role.team],
                  ['Type',     TYPE_LABELS[role.type]],
                  ['Location', role.location],
                  ...(role.closes_at ? [['Closes', formatCloseDate(role.closes_at)]] : []),
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="role-detail-row">
                    <span className="role-detail-label">{label}</span>
                    <span className="role-detail-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="role-body-section">
        <div className="container">
          <div className="role-body-grid">
            <div>
              <SectionTag label="About the role" />
              <div className="role-desc-title">What you will be doing.</div>
              <p className="role-desc">{role.description}</p>
            </div>
            <div>
              <div className="role-req-title">What we are looking for</div>
              <div className="role-requirements">
                {role.requirements.map((req: string) => (
                  <div key={req} className="role-req">{req}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="apply-section" id="apply">
        <div className="container">
          <div className="apply-grid">
            <div>
              <SectionTag label="Apply" />
              <div className="apply-title">Ready to <em>apply?</em></div>
              <p className="apply-desc">
                {isExecutive
                  ? 'This is a leadership conversation, not a form to fill and forget. Tell us who you are and why this is the role for you. We will reach out directly to continue the conversation.'
                  : 'Fill in the form and attach your CV. We read every application and respond to everyone within two weeks.'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {isExecutive ? (
                <ExecutiveApplicationForm roleId={role.slug} roleSlug={role.slug} />
              ) : (
                <CareersApplicationForm roleId={role.slug} roleTeam={role.team} />
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}