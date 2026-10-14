import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import SectionTag from '@/components/shared/SectionTag'
import CTABox from '@/components/ui/CTABox'
import Link from 'next/link'
import CareersApplicationForm from './CareersApplicationForm'
import { createClient } from '@nextrium/supabase/server'
import type { Role } from '@nextrium/supabase/database'



export const metadata = {
  title: 'Careers',
  description: 'Open roles at NexTrium. We are building products, infrastructure, and ventures for emerging markets. Join us.',
}

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<Role['type'], string> = {
  full_time:  'Full-time',
  contract:   'Contract',
  volunteer:  'Volunteer',
  internship: 'Internship',
}

const VALUES = [
  {
    title: 'We build things that matter',
    description: 'Every role here connects to a product or a community that needs to exist. No busy work.',
  },
  {
    title: 'Remote and async by default',
    description: 'We are based in Lagos and operate globally. You work where and when you are most effective.',
  },
  {
    title: 'You own your work',
    description: 'We hire people we trust and give them the space to do what they do well. No micromanagement.',
  },
]

const PLEDGE_POINTS = [
  'You have read and understood that NexTrium is pre-revenue and compensation is deferred.',
  'You understand that your contribution will be formally documented and recognised.',
  'You agree to keep all internal product, technical, and strategic information confidential.',
  'You understand that intellectual property created during your contribution belongs to NexTrium unless separately agreed in writing.',
  'You are applying because you believe in the mission, not because you expect immediate financial return.',
  'You understand that this is a Founding Team Contributor role and carries no co-founder status, equity, or shareholding.',
]

async function getContributorRoles(): Promise<Role[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('is_active', true)
    .lt('sort_order', 100)
    .or(`closes_at.is.null,closes_at.gt.${new Date().toISOString()}`)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data
}

async function getExecutiveRoles(): Promise<Role[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('is_active', true)
    .gte('sort_order', 100)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data
}

function formatCloseDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

export default async function CareersPage() {
  const contributorRoles = await getContributorRoles()
  const executiveRoles   = await getExecutiveRoles()
  const hasRoles         = contributorRoles.length > 0

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .careers-hero { background: var(--navy-deep); padding-top: calc(var(--nav-height) + 80px); padding-bottom: 80px; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .careers-hero-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 50% 60% at 90% 10%, rgba(219,103,39,0.09) 0%, transparent 55%), radial-gradient(ellipse 40% 50% at 5% 90%, rgba(34,193,122,0.06) 0%, transparent 50%); }
        .careers-hero-grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.03; background-image: linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px); background-size: 72px 72px; }
        .careers-hero-inner { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: end; }
        .careers-headline { font-family: var(--font-exo2); font-weight: 900; font-size: clamp(48px, 8vw, 88px); line-height: 0.95; letter-spacing: -2.5px; color: var(--white); margin-bottom: 0; animation: fadeUp 0.7s ease both; animation-delay: 0.1s; }
        .careers-headline em { font-style: normal; color: var(--orange); }
        .careers-hero-desc { font-weight: 300; font-size: clamp(15px, 1.6vw, 18px); color: var(--grey-mid); line-height: 1.75; animation: fadeUp 0.7s ease both; animation-delay: 0.25s; padding-bottom: 8px; }
        .values-section { background: var(--off-white); padding: var(--section-py) 0; }
        .values-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--grey-light); }
        .value-card { background: var(--white); padding: 40px 32px; display: flex; flex-direction: column; gap: 14px; position: relative; }
        .value-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--orange); transform: scaleX(0); transform-origin: left; transition: transform var(--transition-slow); }
        .value-card:hover::before { transform: scaleX(1); }
        .value-title { font-family: var(--font-exo2); font-weight: 700; font-size: 18px; color: var(--navy-deep); letter-spacing: -0.2px; line-height: 1.25; }
        .value-desc { font-size: 14px; color: var(--grey-dark); line-height: 1.75; }
        .pledge-section { background: var(--off-white); padding: var(--section-py) 0; border-bottom: 1px solid var(--grey-light); }
        .pledge-wrap { display: flex; flex-direction: column; gap: 48px; }
        .pledge-header { display: flex; flex-direction: column; gap: 0; }
        .pledge-title { font-family: var(--font-exo2); font-weight: 800; font-size: clamp(28px, 3.5vw, 44px); color: var(--navy-deep); letter-spacing: -1px; line-height: 1.05; }
        .pledge-body { display: flex; flex-direction: column; gap: 40px; }
        .pledge-intro { display: flex; flex-direction: column; gap: 16px; max-width: 100%; }
        .pledge-intro p { font-size: 16px; color: var(--grey-dark); line-height: 1.8; }
        .pledge-blocks { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--grey-light); }
        .pledge-block { background: var(--white); padding: 32px; display: flex; flex-direction: column; gap: 12px; position: relative; }
        .pledge-block::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--orange); transform: scaleX(0); transform-origin: left; transition: transform var(--transition-slow); }
        .pledge-block:hover::before { transform: scaleX(1); }
        .pledge-block-title { font-family: var(--font-exo2); font-weight: 700; font-size: 16px; color: var(--navy-deep); letter-spacing: -0.2px; }
        .pledge-block-text { font-size: 14px; color: var(--grey-dark); line-height: 1.75; }
        .pledge-confirmation { background: var(--navy-deep); padding: 40px; display: flex; flex-direction: column; gap: 24px; }
        .pledge-confirmation-title { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--orange); }
        .pledge-points { display: flex; flex-direction: column; gap: 0; }
        .pledge-point { display: grid; grid-template-columns: 48px 1fr; gap: 16px; align-items: start; padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .pledge-point:first-child { border-top: 1px solid rgba(255,255,255,0.06); }
        .pledge-point-num { font-family: var(--font-mono); font-size: 10px; color: var(--orange); letter-spacing: 0.15em; padding-top: 2px; }
        .pledge-point-text { font-size: 14px; color: var(--grey-mid); line-height: 1.7; }
        .roles-section { background: var(--navy-deep); padding: var(--section-py) 0; }
        .roles-list { display: flex; flex-direction: column; gap: 1px; background: rgba(255,255,255,0.06); }
        .role-row { background: var(--navy); display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: center; padding: 32px 40px; text-decoration: none; transition: background var(--transition-base); position: relative; }
        .role-row::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--orange); transform: scaleY(0); transform-origin: bottom; transition: transform var(--transition-slow); }
        .role-row:hover { background: var(--navy-mid); }
        .role-row:hover::before { transform: scaleY(1); }
        .role-title { font-family: var(--font-exo2); font-weight: 700; font-size: clamp(17px, 2vw, 22px); color: var(--white); letter-spacing: -0.2px; margin-bottom: 8px; }
        .role-badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .role-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.15em; text-transform: uppercase; padding: 3px 8px; border: 1px solid rgba(255,255,255,0.12); color: var(--grey-mid); }
        .role-badge-team { color: var(--orange); border-color: rgba(219,103,39,0.3); }
        .role-arrow { font-size: 20px; color: var(--grey-dark); flex-shrink: 0; transition: color var(--transition-base), transform var(--transition-base); }
        .role-row:hover .role-arrow { color: var(--orange); transform: translate(3px, -3px); }
        .roles-empty { background: var(--navy); padding: 80px 40px; position: relative; overflow: hidden; }
        .roles-empty-grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.03; background-image: linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px); background-size: 48px 48px; }
        .roles-empty-corner-tl { position: absolute; top: -1px; left: -1px; width: 16px; height: 16px; border-top: 2px solid var(--orange); border-left: 2px solid var(--orange); }
        .roles-empty-corner-br { position: absolute; bottom: -1px; right: -1px; width: 16px; height: 16px; border-bottom: 2px solid var(--orange); border-right: 2px solid var(--orange); }
        .roles-empty-inner { position: relative; z-index: 1; }
        .roles-empty-title { font-family: var(--font-exo2); font-weight: 800; font-size: clamp(24px, 3vw, 36px); color: var(--white); letter-spacing: -0.5px; margin-bottom: 16px; line-height: 1.15; }
        .roles-empty-title em { font-style: normal; color: var(--orange); }
        .roles-empty-desc { font-size: 15px; color: var(--grey-mid); line-height: 1.75; max-width: 480px; margin-bottom: 32px; }
        .exec-section { background: var(--navy-deep); padding: var(--section-py) 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .exec-section-desc { font-size: 15px; color: var(--grey-mid); line-height: 1.75; max-width: 720px; margin-top: 16px; }
        .exec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(255,255,255,0.06); }
        .exec-card { background: var(--navy); padding: 40px; display: flex; flex-direction: column; gap: 16px; text-decoration: none; position: relative; transition: background var(--transition-base); }
        .exec-card::before, .exec-card::after { content: ''; position: absolute; width: 12px; height: 12px; border-color: rgba(219,103,39,0); border-style: solid; transition: border-color var(--transition-slow); }
        .exec-card::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .exec-card::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .exec-card:hover { background: var(--navy-mid); }
        .exec-card:hover::before, .exec-card:hover::after { border-color: var(--orange); }
        .exec-card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .exec-card-badge { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); border: 1px solid rgba(219,103,39,0.3); padding: 4px 10px; }
        .exec-card-type { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-dark); }
        .exec-card-title { font-family: var(--font-exo2); font-weight: 800; font-size: 26px; color: var(--white); letter-spacing: -0.5px; }
        .exec-card-excerpt { font-size: 14px; color: var(--grey-mid); line-height: 1.7; flex: 1; }
        .exec-card-arrow { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); }
        .open-app-section { background: var(--navy); padding: var(--section-py) 0; }
        .open-app-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
        .open-app-title { font-family: var(--font-exo2); font-weight: 800; font-size: clamp(28px, 3.5vw, 44px); color: var(--white); letter-spacing: -1px; line-height: 1.05; margin-bottom: 16px; }
        .open-app-title em { font-style: normal; color: var(--orange); }
        .open-app-desc { font-size: 15px; color: var(--grey-mid); line-height: 1.75; }
        @media (max-width: 900px) { .careers-hero-inner { grid-template-columns: 1fr; gap: 32px; } .values-grid { grid-template-columns: 1fr; } .pledge-blocks { grid-template-columns: 1fr; } .pledge-confirmation { padding: 28px; } .role-row { grid-template-columns: 1fr; gap: 12px; padding: 24px; } .exec-grid { grid-template-columns: 1fr; } .open-app-grid { grid-template-columns: 1fr; gap: 48px; } }
      `}</style>

      <Navbar />

      <section className="careers-hero">
        <div className="careers-hero-glow" />
        <div className="careers-hero-grid" />
        <div className="container">
          <div className="careers-hero-inner">
            <div>
              <SectionTag label="Careers" />
              <h1 className="careers-headline">
                Build what<br />matters.<br /><em>With us.</em>
              </h1>
            </div>
            <p className="careers-hero-desc">
              NexTrium is a small team building products for underserved markets. We move fast, own our work, and care about what we ship. If that sounds like your kind of environment, read on.
            </p>
          </div>
        </div>
      </section>

      <section className="values-section">
        <div className="container">
          <div style={{ marginBottom: '48px' }}>
            <SectionTag label="How we work" />
            <h2 className="section-title-dark">What it is like<br />to work here.</h2>
          </div>
          <div className="values-grid">
            {VALUES.map((v) => (
              <div key={v.title} className="value-card">
                <div className="value-title">{v.title}</div>
                <div className="value-desc">{v.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pledge-section">
        <div className="container">
          <div className="pledge-wrap">
            <div className="pledge-header">
              <SectionTag label="Before you apply" />
              <h2 className="pledge-title">Read this first.</h2>
            </div>
            <div className="pledge-body">
              <div className="pledge-intro">
                <p>NexTrium Global Innovations Ltd is an early-stage technology company incorporated in Nigeria in April 2026. We build products, infrastructure, and ventures designed to address real problems in underserved markets. Our work spans decentralised systems, financial inclusion, trust infrastructure, and community-driven technology. The products we are building today are the beginning of a much larger body of work.</p>
                <p>We are pre-revenue. We do not have the money to pay salaries right now. We are being honest about that because we believe the people who join us deserve to know exactly what they are walking into.</p>
              </div>
              <div className="pledge-blocks">
                <div className="pledge-block">
                  <div className="pledge-block-title">What this is</div>
                  <p className="pledge-block-text">This is an opportunity to join the founding team of a company that is building something real. The work you do here will matter. It will ship. It will be used by real people. Your name will be on it. Contributors who join at this stage are not employees. You are early team members: people who are choosing to build with us before the money arrives, because they believe the work is worth doing.</p>
                </div>
                <div className="pledge-block">
                  <div className="pledge-block-title">What we commit to you</div>
                  <p className="pledge-block-text">We will document every contribution formally. Your role, your work, your commitment, and the terms of your recognition will be written down and signed. When NexTrium generates revenue or raises funding, early contributors will be the first people we bring into a formal compensation conversation. This is not a vague promise; it will be in your contributor agreement. You will be credited publicly as a founding team member with a direct line to the founders.</p>
                </div>
                <div className="pledge-block">
                  <div className="pledge-block-title">What we ask of you</div>
                  <p className="pledge-block-text">Genuine commitment to the role you are applying for. Confidentiality: the work we are doing is not yet fully public and we need to protect it. Honesty: if something is not working, tell us. The same standard of work you would bring to any paid role, because the people who will eventually use what we build deserve that.</p>
                </div>
                <div className="pledge-block">
                  <div className="pledge-block-title">What this is not</div>
                  <p className="pledge-block-text">This is not a co-founder arrangement. Equity, shareholding, and co-founder status are not on the table at this stage. We are not making promises we cannot keep. What we are offering is formal recognition, documented contribution, and a real place in the founding story of a company that intends to grow into something significant.</p>
                </div>
              </div>
              <div className="pledge-confirmation">
                <div className="pledge-confirmation-title">By submitting an application you confirm that:</div>
                <div className="pledge-points">
                  {PLEDGE_POINTS.map((point, i) => (
                    <div key={i} className="pledge-point">
                      <span className="pledge-point-num">{String(i + 1).padStart(2, '0')}</span>
                      <span className="pledge-point-text">{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="roles-section">
        <div className="container">
          <div style={{ marginBottom: '48px' }}>
            <SectionTag label="Open roles" />
            <h2 className="section-title">
              {hasRoles ? 'We are hiring.' : 'Nothing open right now.'}
            </h2>
          </div>
          {hasRoles ? (
            <div className="roles-list">
              {contributorRoles.map((role) => (
                <Link key={role.slug} href={`/careers/${role.slug}`} className="role-row">
                  <div>
                    <div className="role-title">{role.title}</div>
                    <div className="role-badges">
                      <span className="role-badge role-badge-team">{role.team}</span>
                      <span className="role-badge">{TYPE_LABELS[role.type]}</span>
                      <span className="role-badge">{role.location}</span>
                      {role.closes_at && (
                        <span className="role-badge">Closes {formatCloseDate(role.closes_at)}</span>
                      )}
                    </div>
                  </div>
                  <span className="role-arrow">↗</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="roles-empty">
              <div className="roles-empty-grid" />
              <div className="roles-empty-corner-tl" />
              <div className="roles-empty-corner-br" />
              <div className="roles-empty-inner">
                <div className="roles-empty-title">
                  No open roles right now.<br />Send your CV <em>anyway.</em>
                </div>
                <p className="roles-empty-desc">
                  We review speculative applications. If your skills align with where we are going, we will be in touch when something opens up.
                </p>
                <CTABox href="#open-application" label="Send an open application" variant="dark" />
              </div>
            </div>
          )}
        </div>
      </section>

      {executiveRoles.length > 0 && (
        <section className="exec-section">
          <div className="container">
            <div style={{ marginBottom: '48px' }}>
              <SectionTag label="Leadership team" />
              <h2 className="section-title">Founding executives.</h2>
              <p className="exec-section-desc">
                These are strategic leadership positions for people who want to shape NexTrium at the highest level, not just contribute to it. We are looking for two people: a Chief Technology Officer and a Chief Product Officer, to join the founding leadership team alongside the CEO and COO.
              </p>
            </div>
            <div className="exec-grid">
              {executiveRoles.map((role: Role) => (
                <Link key={role.slug} href={`/careers/${role.slug}`} className="exec-card">
                  <div className="exec-card-top">
                    <span className="exec-card-badge">{role.team}</span>
                    <span className="exec-card-type">{role.type === 'contract' ? 'Contract · Equity-based' : TYPE_LABELS[role.type]}</span>
                  </div>
                  <div className="exec-card-title">{role.title}</div>
                  <p className="exec-card-excerpt">{role.description?.slice(0, 140)}...</p>
                  <span className="exec-card-arrow">Learn more →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="open-app-section" id="open-application">
        <div className="container">
          <div className="open-app-grid">
            <div>
              <SectionTag label="Open application" />
              <div className="open-app-title">
                Join the<br /><em>founding team.</em>
              </div>
              <p className="open-app-desc">
                Whether or not you see your specific role listed, if you believe in what we are building, we want to hear from you. We keep a record of every strong candidate and reach out when the right moment arrives.
              </p>
            </div>
            <CareersApplicationForm />
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}