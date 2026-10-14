import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import SectionTag from '@/components/shared/SectionTag'
import CTABox from '@/components/ui/CTABox'
import Link from 'next/link'

export const metadata = {
  title: 'Services',
  description:
    'NexTrium delivers bespoke technology services. No fixed packages. Every engagement starts with a conversation.',
}

const SERVICES = [
  {
    num: '01',
    name: 'Product Development',
    description:
      'We design and build web, mobile, and enterprise applications from idea to production. Full-stack, cloud-native, and built to scale. We own the process so you can focus on the business.',
    deliverables: ['Web applications', 'Mobile applications', 'APIs and integrations', 'Cloud infrastructure'],
  },
  {
    num: '02',
    name: 'Research and Advisory',
    description:
      'Technology research, market feasibility studies, and strategic consulting. We go deep on a problem before recommending a direction. Our research is actionable, not decorative.',
    deliverables: ['Feasibility studies', 'Technology audits', 'Market research', 'Strategic roadmaps'],
  },
  {
    num: '03',
    name: 'Venture Building',
    description:
      'You have an idea. We turn it into a product. From problem definition to MVP to first users, we build your startup as a service. Equity arrangements available for the right opportunities.',
    deliverables: ['Problem validation', 'MVP development', 'Go-to-market strategy', 'Investor readiness'],
  },
  {
    num: '04',
    name: 'Digital Talent Development',
    description:
      'Training programmes, mentorship structures, and capacity building for individuals and teams. We teach people to build things, not just use them.',
    deliverables: ['Technical training', 'Team workshops', 'Mentorship programmes', 'Curriculum design'],
  },
  {
    num: '05',
    name: 'AI and Data',
    description:
      'Data strategy, AI integration, and emerging technology consulting. We help organisations understand what their data is worth and build systems that put it to work.',
    deliverables: ['Data architecture', 'AI integration', 'Analytics dashboards', 'Model deployment'],
  },
  {
    num: '06',
    name: 'Strategic Partnerships',
    description:
      'Connecting organisations to the right ecosystem, tools, capital, and collaborators. We operate across the Cardano, SingularityNET, and broader African tech ecosystem.',
    deliverables: ['Ecosystem introductions', 'Partnership facilitation', 'Grant strategy', 'Community building'],
  },
]

const HOW_WE_ENGAGE = [
  {
    num: '01',
    title: 'Conversation',
    description: 'We start with a call. No brief required. Tell us what you are trying to build and we listen.',
  },
  {
    num: '02',
    title: 'Proposal',
    description: 'We scope the work, define deliverables, and agree on terms. No retainers unless they make sense.',
  },
  {
    num: '03',
    title: 'Delivery',
    description: 'We build, report, and iterate. You stay informed without being overwhelmed.',
  },
]

export default function ServicesPage() {
  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .services-hero {
          background: var(--navy-deep);
          padding-top: calc(var(--nav-height) + 80px);
          padding-bottom: 80px;
          position: relative; overflow: hidden;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .services-hero-glow {
          position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 50% 60% at 90% 10%, rgba(219,103,39,0.09) 0%, transparent 55%),
            radial-gradient(ellipse 40% 50% at 5% 90%, rgba(74,111,165,0.07) 0%, transparent 50%);
        }
        .services-hero-grid {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.03;
          background-image:
            linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px);
          background-size: 72px 72px;
        }
        .services-hero-inner {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 80px; align-items: end;
        }
        .services-headline { font-family: var(--font-exo2); font-weight: 900; font-size: clamp(36px, 5vw, 72px); line-height: 1.0; letter-spacing: -2px; color: var(--white); animation: fadeUp 0.7s ease both; animation-delay: 0.1s; }
        .services-headline em { font-style: normal; color: var(--orange); }
        .services-hero-right {
          animation: fadeUp 0.7s ease both; animation-delay: 0.25s;
          padding-bottom: 8px;
        }
        .services-hero-desc {
          font-weight: 300; font-size: clamp(15px, 1.6vw, 18px);
          color: var(--grey-mid); line-height: 1.75; margin-bottom: 32px;
        }
        .services-list-section { background: var(--off-white); padding: var(--section-py) 0; }
        .services-list { display: flex; flex-direction: column; gap: 0; margin-bottom: 0; }
        .service-row {
          display: grid; grid-template-columns: 48px 1fr 280px;
          gap: 32px; align-items: start;
          padding: 48px 0;
          border-bottom: 1px solid var(--grey-light);
        }
        .service-row:first-child { border-top: 1px solid var(--grey-light); }
        .service-row-num {
          font-family: var(--font-mono); font-size: 11px;
          color: var(--orange); letter-spacing: 0.15em; padding-top: 4px;
        }
        .service-row-name {
          font-family: var(--font-exo2); font-weight: 700;
          font-size: clamp(20px, 2.5vw, 28px); color: var(--navy-deep);
          letter-spacing: -0.3px; margin-bottom: 16px; line-height: 1.15;
        }
        .service-row-desc { font-size: 15px; color: var(--grey-dark); line-height: 1.75; }
        .service-row-right { padding-top: 4px; width: 100%; }
        .service-deliverables-title {
          font-family: var(--font-mono); font-size: 8.5px;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--grey-mid); margin-bottom: 16px;
        }
        .service-deliverables { display: flex; flex-direction: column; gap: 10px; }
        .service-deliverable {
          display: flex; align-items: center; gap: 10px;
          font-size: 14px; color: var(--grey-dark);
        }
        .service-deliverable::before {
          content: ''; width: 4px; height: 4px;
          background: var(--orange); border-radius: 50%; flex-shrink: 0;
        }
        .engage-section { background: var(--navy-deep); padding: var(--section-py) 0; }
        .engage-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1px; background: rgba(255,255,255,0.06);
        }
        .engage-card {
          background: var(--navy); padding: 40px 32px; position: relative;
        }
        .engage-card::before, .engage-card::after {
          content: ''; position: absolute;
          width: 10px; height: 10px;
          border-color: rgba(219,103,39,0.3); border-style: solid;
        }
        .engage-card::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .engage-card::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .engage-num {
          font-family: var(--font-mono); font-size: 11px;
          color: var(--orange); letter-spacing: 0.15em;
          margin-bottom: 20px; display: block;
        }
        .engage-title {
          font-family: var(--font-exo2); font-weight: 700;
          font-size: 22px; color: var(--white);
          letter-spacing: -0.3px; margin-bottom: 16px;
        }
        .engage-desc { font-size: 14px; color: var(--grey-mid); line-height: 1.7; }
        .engage-cta-row { display: flex; border-top: 1px solid rgba(255,255,255,0.06); }
        .engage-cta-row a { max-width: 100% !important; width: 100% !important; }
        @media (max-width: 900px) {
          .services-hero-inner { grid-template-columns: 1fr; gap: 32px; }
          .service-row { grid-template-columns: 48px 1fr; gap: 24px; }
          .service-row-right { grid-column: 2; width: 100%; }
          .engage-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .service-row { grid-template-columns: 1fr; gap: 16px; padding: 32px 0; }
          .service-row-right { grid-column: 1; }
        }
      `}</style>

      <Navbar />

      <section className="services-hero">
        <div className="services-hero-glow" />
        <div className="services-hero-grid" />
        <div className="container">
          <div className="services-hero-inner">
            <div>
              <SectionTag label="How we work" />
              <h1 className="services-headline">
                We build what<br />others only describe.
              </h1>
            </div>
            <div className="services-hero-right">
              <p className="services-hero-desc">
                NexTrium delivers bespoke technology services. No fixed packages. Every engagement starts with a conversation about what you need to build. We listen first, then we scope, propose, and deliver.
              </p>
              <CTABox href="/contact?subject=services" label="Tell us what you're building" variant="dark" />
            </div>
          </div>
        </div>
      </section>

      <section className="services-list-section">
        <div className="container">
          <div className="services-list">
            {SERVICES.map((service) => (
              <div key={service.num} className="service-row">
                <span className="service-row-num">{service.num}</span>
                <div>
                  <div className="service-row-name">{service.name}</div>
                  <div className="service-row-desc">{service.description}</div>
                </div>
                <div className="service-row-right">
                  <div className="service-deliverables-title">What we deliver</div>
                  <div className="service-deliverables">
                    {service.deliverables.map((d) => (
                      <div key={d} className="service-deliverable">{d}</div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="engage-section">
        <div className="container">
          <div style={{ marginBottom: '48px' }}>
            <SectionTag label="How we engage" />
            <h2 className="section-title">Three steps.<br />No surprises.</h2>
          </div>
          <div className="engage-grid">
            {HOW_WE_ENGAGE.map((step) => (
              <div key={step.num} className="engage-card">
                <span className="engage-num">{step.num}</span>
                <div className="engage-title">{step.title}</div>
                <div className="engage-desc">{step.description}</div>
              </div>
            ))}
          </div>
          <div className="engage-cta-row">
            <CTABox href="/contact?subject=services" label="Start a conversation" variant="dark" fullWidth />
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}