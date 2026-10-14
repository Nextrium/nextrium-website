import Link from 'next/link'
import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import CTABox from '@/components/ui/CTABox'
import SectionTag from '@/components/shared/SectionTag'
import NTMark from '@nextrium/brand/Mark'
import { createServiceClient } from '@nextrium/supabase/server'
import type { Product, NTEvent, Post } from '@nextrium/supabase/database'

interface Service {
  num: string
  name: string
  description: string
}

const SERVICES: Service[] = [
  { num: '01', name: 'Product Development',        description: 'Web, mobile, and enterprise applications built from idea to deployment.' },
  { num: '02', name: 'Research and Advisory',      description: 'Technology research, feasibility studies, and strategic consulting.' },
  { num: '03', name: 'Venture Building',            description: 'From idea to MVP. We build your startup as a service.' },
  { num: '04', name: 'Digital Talent Development', description: 'Training, mentorship, and capacity building for individuals and teams.' },
  { num: '05', name: 'AI and Data',                description: 'Data analytics, AI integration, and emerging technology consulting.' },
  { num: '06', name: 'Strategic Partnerships',     description: 'Connecting organisations to the right ecosystem, tools, and capital.' },
]

const STATUS_LABELS: Record<Product['status'], string> = {
  in_development: 'In Development',
  beta: 'Beta',
  live: 'Live',
  sunset: 'Sunset',
}

async function getHomeData() {
  const supabase = createServiceClient()

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_featured', true)
    .order('sort_order', { ascending: true })
    .limit(3)

  const { data: posts } = await supabase
    .from('posts')
    .select('slug, title, excerpt, post_type, published_at, author')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(3)

  const { data: hubEvent } = await supabase
    .from('events')
    .select('*')
    .eq('is_hub_event', true)
    .order('start_date', { ascending: false })
    .limit(1)
    .single()

  const { count: eventCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('is_hub_event', true)

  const { count: projectCount } = await (supabase as any)
    .from('community_projects')
    .select('*', { count: 'exact', head: true })

  return {
    products:     (products     ?? []) as Product[],
    posts:        (posts        ?? []) as Post[],
    hubEvent:     hubEvent as NTEvent | null,
    eventCount:   eventCount  ?? 0,
    projectCount: projectCount ?? 0,
  }
}

const POST_TYPE_CLASS: Record<string, string> = {
  product_update: 'type-product',
  announcement:   'type-announcement',
  event_recap:    'type-event',
  editorial:      'type-editorial',
  research:       'type-research',
  recruitment:    'type-editorial',
}

export default async function HomePage() {
  const { products, posts, hubEvent, eventCount, projectCount } = await getHomeData()
  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero {
          min-height: 100vh;
          display: flex; flex-direction: column; justify-content: flex-end;
          padding-top: calc(var(--nav-height) + 80px); padding-bottom: 100px;
          position: relative; overflow: hidden; background: var(--navy-deep);
        }
        .hero-glow {
          position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 55% 45% at 85% 15%, rgba(219,103,39,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 35% 55% at 8% 85%, rgba(10,139,139,0.08) 0%, transparent 55%),
            radial-gradient(ellipse 40% 40% at 50% 50%, rgba(13,35,61,0.4) 0%, transparent 70%);
        }
        .hero-grid {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.035;
          background-image:
            linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px);
          background-size: 72px 72px;
        }
        .hero-content { position: relative; z-index: 1; }
        .hero-headline {
          font-family: var(--font-exo2); font-weight: 900;
          font-size: clamp(56px, 11vw, 108px);
          line-height: 0.93; letter-spacing: -3px;
          color: var(--white); margin-bottom: 28px;
          animation: fadeUp 0.8s ease both; animation-delay: 0.1s;
        }
        .hero-headline em { font-style: normal; color: var(--orange); }
        .hero-sub {
          font-weight: 300; font-size: clamp(15px, 1.6vw, 18px);
          color: var(--grey-mid); line-height: 1.7;
          max-width: 480px; margin-bottom: 52px;
          animation: fadeUp 0.8s ease both; animation-delay: 0.25s;
        }
        .hero-ctas {
          display: flex; flex-direction: row; gap: 0;
          width: 100%; max-width: 640px;
          animation: fadeUp 0.8s ease both; animation-delay: 0.4s;
        }
        .hero-cta-item {
          flex: 1; display: flex; align-items: center;
          justify-content: space-between; gap: 12px;
          padding: 16px 20px;
          border: 1px solid rgba(255,255,255,0.18); border-right: none;
          text-decoration: none; color: var(--white);
          font-size: 13px; font-family: var(--font-dm); font-weight: 400;
          transition: border-color var(--transition-base), background var(--transition-base);
          white-space: nowrap;
        }
        .hero-cta-item:last-child { border-right: 1px solid rgba(255,255,255,0.18); }
        .hero-cta-item:hover { border-color: var(--orange); background: rgba(219,103,39,0.07); z-index: 1; }
        .split-header {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 48px; align-items: end; margin-bottom: 56px;
        }
        .split-header-desc { font-size: 15px; color: var(--grey-mid); line-height: 1.75; padding-bottom: 6px; }
        .split-header-desc-dark { font-size: 15px; color: var(--grey-dark); line-height: 1.75; padding-bottom: 6px; }
        .builds-section {
          background: var(--navy-deep); padding: var(--section-py) 0;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .builds-stack { display: flex; flex-direction: column; gap: 1px; background: rgba(255,255,255,0.06); }
        .build-eco-card { display: grid; grid-template-columns: 1.3fr 0.7fr; min-height: 320px; text-decoration: none; position: relative; overflow: hidden; transition: filter var(--transition-base); }
        .build-eco-card::before, .build-eco-card::after { content: ''; position: absolute; width: 16px; height: 16px; border-color: rgba(219,103,39,0); border-style: solid; transition: border-color var(--transition-slow); z-index: 2; }
        .build-eco-card::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .build-eco-card::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .build-eco-card:hover::before, .build-eco-card:hover::after { border-color: var(--orange); }
        .build-eco-card:hover { filter: brightness(1.06); }
        .build-eco-left { display: flex; flex-direction: column; gap: 16px; padding: 48px; justify-content: center; }
        .build-eco-name { font-family: var(--font-exo2); font-weight: 800; font-size: clamp(24px, 3vw, 38px); color: var(--white); letter-spacing: -0.5px; line-height: 1.1; }
        .build-eco-desc { font-size: 15px; color: rgba(255,255,255,0.65); line-height: 1.7; max-width: 420px; }
        .build-eco-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .build-eco-tag { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 10px; border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.5); }
        .build-eco-cta { display: inline-flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); margin-top: 8px; padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.1); transition: gap var(--transition-base); }
        .build-eco-card:hover .build-eco-cta { gap: 16px; }
        .build-eco-right { display: flex; align-items: center; justify-content: center; padding: 48px; position: relative; overflow: hidden; }
        .build-eco-right::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 60% at 60% 50%, rgba(255,255,255,0.04) 0%, transparent 70%); pointer-events: none; }
        .build-eco-img { width: 100%; max-width: 320px; max-height: 220px; object-fit: contain; display: block; transition: transform var(--transition-slow); position: relative; z-index: 1; }
        .build-eco-card:hover .build-eco-img { transform: scale(1.05); }
        .build-status { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; padding: 4px 10px; display: inline-block; width: fit-content; }
        .status-in_development { background: rgba(212,168,67,0.15); color: var(--gold);    border: 1px solid rgba(212,168,67,0.3); }
        .status-live            { background: rgba(34,193,122,0.15); color: var(--success); border: 1px solid rgba(34,193,122,0.3); }
        .status-beta            { background: rgba(10,139,139,0.15); color: var(--teal);    border: 1px solid rgba(10,139,139,0.3); }
        .status-sunset          { background: rgba(232,69,69,0.15);  color: var(--error);   border: 1px solid rgba(232,69,69,0.3); }
        .builds-cta-row { display: flex; border-top: 1px solid rgba(255,255,255,0.06); }
        .builds-cta-row a { max-width: 100% !important; width: 100% !important; }
        .services-section { background: var(--off-white); padding: var(--section-py) 0; }
        .services-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .service-item {
          display: flex; align-items: flex-start; gap: 20px;
          padding: 20px 0; border-bottom: 1px solid var(--grey-light);
          text-decoration: none; transition: padding-left var(--transition-base);
        }
        .service-item:first-child { border-top: 1px solid var(--grey-light); }
        .service-item:hover { padding-left: 8px; }
        .service-num {
          font-family: var(--font-mono); font-size: 9px;
          color: var(--orange); letter-spacing: 0.12em;
          min-width: 28px; padding-top: 3px; flex-shrink: 0;
        }
        .service-name {
          font-family: var(--font-exo2); font-weight: 600;
          font-size: 16px; color: var(--navy-deep); margin-bottom: 3px;
        }
        .service-desc { font-size: 12px; color: var(--grey-dark); line-height: 1.6; }
        .service-arrow {
          margin-left: auto; font-size: 14px; color: var(--grey-mid);
          padding-top: 3px; flex-shrink: 0; transition: color var(--transition-base);
        }
        .service-item:hover .service-arrow { color: var(--orange); }
        .service-quote-wrap {
          position: relative; overflow: hidden;
          background: var(--navy-deep);
          border: 1px solid var(--grey-light);
          padding: 40px;
        }
        .service-quote-grid {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.04;
          background-image:
            linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .service-quote-corner-tl {
          position: absolute; top: -1px; left: -1px;
          width: 16px; height: 16px;
          border-top: 2px solid var(--orange); border-left: 2px solid var(--orange);
        }
        .service-quote-corner-br {
          position: absolute; bottom: -1px; right: -1px;
          width: 16px; height: 16px;
          border-bottom: 2px solid var(--orange); border-right: 2px solid var(--orange);
        }
        .service-quote-text {
          position: relative; z-index: 1;
          font-family: var(--font-exo2); font-weight: 700;
          font-size: 22px; color: var(--white); line-height: 1.3;
          letter-spacing: -0.3px; margin-bottom: 16px;
        }
        .service-quote-sub {
          position: relative; z-index: 1;
          font-size: 13px; color: var(--grey-mid); line-height: 1.7;
        }
        .services-cta { margin-top: 40px; }
        .services-cta a { max-width: 100% !important; width: 100% !important; }
        .hub-section { background: var(--navy); padding: var(--section-py) 0; }
        .hub-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
        .hub-stats { display: flex; gap: 40px; margin-bottom: 48px; }
        .hub-stat { animation: countUp 0.7s ease both; }
        .hub-stat:nth-child(1) { animation-delay: 0.1s; }
        .hub-stat:nth-child(2) { animation-delay: 0.25s; }
        .hub-stat:nth-child(3) { animation-delay: 0.4s; }
        .hub-stat-num {
          font-family: var(--font-exo2); font-weight: 900;
          font-size: 44px; letter-spacing: -2px; color: var(--orange); line-height: 1;
        }
        .hub-stat-label {
          font-family: var(--font-mono); font-size: 8.5px;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--grey-mid); margin-top: 6px;
        }
        .event-card {
          background: var(--navy-mid); padding: 32px;
          position: relative; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.06);
          animation: slideRight 0.8s ease both; animation-delay: 0.2s;
        }
        .event-card::after {
          content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, var(--orange), transparent);
        }
        .event-card-corner-tl, .event-card-corner-br {
          position: absolute; width: 14px; height: 14px;
          border-color: rgba(219,103,39,0.4); border-style: solid;
        }
        .event-card-corner-tl { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .event-card-corner-br { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .event-type {
          font-family: var(--font-mono); font-size: 8.5px;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--orange); margin-bottom: 12px;
        }
        .event-title {
          font-family: var(--font-exo2); font-weight: 700;
          font-size: 20px; color: var(--white); margin-bottom: 8px;
          letter-spacing: -0.3px; line-height: 1.25;
        }
        .event-meta { font-size: 12px; color: var(--grey-mid); margin-bottom: 14px; }
        .event-badge {
          display: inline-block; font-family: var(--font-mono);
          font-size: 7.5px; letter-spacing: 0.15em; text-transform: uppercase;
          padding: 4px 10px;
          background: rgba(34,193,122,0.1); color: var(--success);
          border: 1px solid rgba(34,193,122,0.2); margin-bottom: 16px;
        }
        .event-desc { font-size: 13px; color: var(--grey-mid); line-height: 1.65; margin-bottom: 24px; }
        .event-footer-row {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06);
        }
        .event-location { font-size: 12px; color: var(--grey-mid); }
        .hub-cta { margin-top: 40px; }
        .blog-section { background: var(--navy-deep); padding: var(--section-py) 0; }
        .blog-list { margin-bottom: 0; }
        .blog-list-item {
          display: grid; grid-template-columns: 160px 1fr auto;
          align-items: center; gap: 32px; padding: 24px 0;
          border-bottom: 1px dashed rgba(255,255,255,0.08);
          text-decoration: none;
          transition: background var(--transition-base), padding-left var(--transition-base);
        }
        .blog-list-item:first-child { border-top: 1px dashed rgba(255,255,255,0.08); }
        .blog-list-item:hover { background: rgba(255,255,255,0.02); padding-left: 8px; }
        .blog-date {
          font-family: var(--font-mono); font-size: 15px; font-weight: 700;
          color: var(--orange); letter-spacing: 0.02em; white-space: nowrap;
        }
        .blog-post-title {
          font-family: var(--font-exo2); font-weight: 600;
          font-size: 16px; color: var(--white); line-height: 1.3;
          margin-bottom: 4px; letter-spacing: -0.2px;
        }
        .blog-post-meta { font-size: 12px; color: var(--grey-mid); }
        .blog-post-type {
          font-family: var(--font-mono); font-size: 8px;
          letter-spacing: 0.12em; text-transform: uppercase;
          padding: 2px 7px; margin-right: 8px;
        }
        .blog-arrow {
          font-size: 18px; color: var(--grey-dark);
          transition: color var(--transition-base), transform var(--transition-base);
        }
        .blog-list-item:hover .blog-arrow { color: var(--orange); transform: translate(3px, -3px); }
        .blog-cta { margin-top: 40px; }
        .blog-cta a { max-width: 100% !important; width: 100% !important; }
        .type-editorial    { background: rgba(13,35,61,0.4);    color: var(--grey-mid); }
        .type-announcement { background: rgba(219,103,39,0.12); color: var(--orange); }
        .type-product      { background: rgba(10,139,139,0.12); color: var(--teal); }
        .type-research     { background: rgba(74,111,165,0.12); color: var(--slate); }
        .type-event        { background: rgba(212,168,67,0.12); color: var(--gold); }
        .company-strip {
          background: var(--navy-deep); padding: 80px 0;
          border-top: 2px solid var(--orange);
          position: relative; overflow: hidden;
        }
        .company-strip-bg {
          position: absolute; right: 0; top: 0; bottom: 0; width: 45%; opacity: 0.04;
          background-image:
            linear-gradient(rgba(219,103,39,0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(219,103,39,0.8) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .company-strip-inner {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 40px; position: relative; z-index: 1;
        }
        .company-statement {
          font-family: var(--font-exo2); font-weight: 800;
          font-size: clamp(32px, 4.5vw, 60px); letter-spacing: -2px;
          color: var(--white); line-height: 1.05;
        }
        .company-statement em { font-style: normal; color: var(--orange); }
        .company-details { display: flex; flex-direction: column; gap: 8px; text-align: right; }
        .company-detail-line {
          font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.18em; color: var(--grey-mid); text-transform: uppercase;
        }
        @media (max-width: 900px) {
          .hero-ctas { flex-direction: column; max-width: 100%; }
          .hero-cta-item { border-right: 1px solid rgba(255,255,255,0.18); border-bottom: none; }
          .hero-cta-item:last-child { border-bottom: 1px solid rgba(255,255,255,0.18); }
          .split-header    { grid-template-columns: 1fr; gap: 16px; }
          .build-eco-card { grid-template-columns: 1fr; min-height: auto; }
          .build-eco-right { min-height: 200px; padding: 32px; }
          .build-eco-left { padding: 32px; }
          .services-layout { grid-template-columns: 1fr; gap: 40px; }
          .hub-layout      { grid-template-columns: 1fr; gap: 48px; }
          .blog-list-item  { grid-template-columns: 100px 1fr auto; gap: 16px; }
          .company-strip-inner { flex-direction: column; align-items: flex-start; }
          .company-details { text-align: left; }
          .company-strip-bg { width: 100%; opacity: 0.02; }
        }
        @media (max-width: 640px) {
          .hero-headline { letter-spacing: -2px; }
          .blog-list-item { grid-template-columns: 1fr auto; }
          .blog-date { display: none; }
          .hub-stats { gap: 24px; }
          .hub-stat-num { font-size: 36px; }
        }
      `}</style>

      <Navbar />

      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-grid" />
        <div className="container hero-content">
          <h1 className="hero-headline">
            We build<br /><em>what&apos;s</em><br />next.
          </h1>
          <p className="hero-sub">
            An innovation company designing products, infrastructure, and ventures for emerging markets and beyond.
          </p>
          <div className="hero-ctas">
            <Link href="/#builds"  className="hero-cta-item"><span>See our builds</span><span aria-hidden="true">→</span></Link>
            <Link href="/services" className="hero-cta-item"><span>Our services</span><span aria-hidden="true">→</span></Link>
            <Link href="/about"    className="hero-cta-item"><span>About us</span><span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      {products.length > 0 && (
        <section className="builds-section" id="builds">
          <div className="container">
            <div className="split-header">
              <div>
                <SectionTag label="Current builds" />
                <h2 className="section-title">What we&apos;re<br />building now.</h2>
              </div>
              <p className="split-header-desc">
                {products.length} products in active development. Each one addresses a trust gap in an underserved market. The list will grow.
              </p>
            </div>

            <div className="builds-stack">
              {products.map((product, i) => (
                <Link
                  key={product.slug}
                  href={`/products/${product.slug}`}
                  className="build-eco-card"
                  style={{ background: i === 0 ? '#163352' : product.body_color }}
                >
                  <div className="build-eco-left">
                    <span className={`build-status status-${product.status}`}>
                      {STATUS_LABELS[product.status]}
                    </span>
                    <div className="build-eco-name">{product.name}</div>
                    <div className="build-eco-desc">{product.tagline}</div>
                    <div className="build-eco-tags">
                      {product.category.slice(0, 4).map((tag) => (
                        <span key={tag} className="build-eco-tag">{tag}</span>
                      ))}
                    </div>
                    <div className="build-eco-cta">
                      <span>Explore {product.name}</span>
                      <span>→</span>
                    </div>
                  </div>
                  <div className="build-eco-right">
                    {product.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.cover_image_url}
                        alt={product.name}
                        className="build-eco-img"
                      />
                    ) : (
                      <NTMark size={80} bodyColor={product.body_color} accentColor="#DB6727" />
                    )}
                  </div>
                </Link>
              ))}
            </div>

            <div className="builds-cta-row">
              <CTABox href="/products" label="View all builds" variant="dark" fullWidth />
            </div>
          </div>
        </section>
      )}

      <section className="services-section" id="services">
        <div className="container">
          <div className="split-header">
            <div>
              <SectionTag label="How we work" />
              <h2 className="section-title-dark">
                We build what<br />others can only<br />
                <em style={{ fontStyle: 'normal', color: 'var(--orange)' }}>describe.</em>
              </h2>
            </div>
            <p className="split-header-desc-dark">
              NexTrium delivers bespoke technology services. No fixed packages. Every engagement starts with a conversation about what you need to build.
            </p>
          </div>
          <div className="services-layout">
            <div>
              {SERVICES.map((service) => (
                <Link key={service.num} href="/services" className="service-item">
                  <span className="service-num">{service.num}</span>
                  <div>
                    <div className="service-name">{service.name}</div>
                    <div className="service-desc">{service.description}</div>
                  </div>
                  <span className="service-arrow">→</span>
                </Link>
              ))}
            </div>
            <div>
              <div className="service-quote-wrap">
                <div className="service-quote-grid" />
                <div className="service-quote-corner-tl" />
                <div className="service-quote-corner-br" />
                <p className="service-quote-text">
                  Every engagement starts with a conversation, not a contract.
                </p>
                <p className="service-quote-sub">
                  We listen first. Then we scope, propose, and build. No retainers unless they make sense. No overhead you did not ask for.
                </p>
              </div>
            </div>
          </div>
          <div className="services-cta">
            <CTABox href="/contact?subject=services" label="Tell us what you're building" variant="light" />
          </div>
        </div>
      </section>

      <section className="hub-section" id="hub">
        <div className="container">
          <div className="split-header">
            <div>
              <SectionTag label="NexTrium Hub" />
              <h2 className="section-title">
                Where builders<br />connect and<br />
                <em style={{ fontStyle: 'normal', color: 'var(--orange)' }}>work gets done.</em>
              </h2>
            </div>
            <p className="split-header-desc">
              The Hub is NexTrium&apos;s community and innovation programme. It has hosted hackathons, workshops, and build sprints that have produced real products from real teams.
            </p>
          </div>
          <div className="hub-layout">
            <div>
              <div className="hub-stats">
                <div className="hub-stat">
                  <div className="hub-stat-num">{eventCount}+</div>
                  <div className="hub-stat-label">Events hosted</div>
                </div>
                <div className="hub-stat">
                  <div className="hub-stat-num">{projectCount}</div>
                  <div className="hub-stat-label">Community projects</div>
                </div>
                <div className="hub-stat">
                  <div className="hub-stat-num">2024</div>
                  <div className="hub-stat-label">Est.</div>
                </div>
              </div>
              <div className="hub-cta">
                <CTABox href="/events" label="See all events" variant="dark" />
              </div>
            </div>
            <div>
              {hubEvent ? (
                <Link href={`/events/${hubEvent.slug}`} style={{ textDecoration: 'none' }}>
                  <div className="event-card">
                    <div className="event-card-corner-tl" />
                    <div className="event-card-corner-br" />
                    <div className="event-type">{hubEvent.event_type}</div>
                    <div className="event-title">{hubEvent.title}</div>
                    <div className="event-meta">
                      {hubEvent.location} · {new Date(hubEvent.start_date).getFullYear()}
                    </div>
                    <div className="event-badge">{hubEvent.status}</div>
                    <p className="event-desc">{hubEvent.description.slice(0, 160)}...</p>
                    <div className="event-footer-row">
                      <span className="event-location">{hubEvent.location}</span>
                      <span style={{ fontSize: '14px', color: 'var(--orange)' }}>↗</span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="event-card">
                  <div className="event-card-corner-tl" />
                  <div className="event-card-corner-br" />
                  <div className="event-type">Hub</div>
                  <div className="event-title">Events coming soon.</div>
                  <p className="event-desc">The Hub is actively planning its next programme. Check back soon.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="blog-section" id="blog">
        <div className="container">
          <div className="split-header">
            <div>
              <SectionTag label="From the blog" />
              <h2 className="section-title">Latest from<br />NexTrium.</h2>
            </div>
            <p className="split-header-desc">
              Product updates, announcements, event recaps, and research notes from the NexTrium team.
            </p>
          </div>
          <div className="blog-list">
            {posts.length === 0 ? (
              <div style={{ padding: '48px 0', color: 'var(--grey-mid)', fontSize: '14px' }}>
                No posts yet. Check back soon.
              </div>
            ) : (
              posts.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="blog-list-item">
                  <span className="blog-date">
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' }).replace('/', '.')
                      : ''}
                  </span>
                  <div>
                    <div className="blog-post-title">{post.title}</div>
                    <div className="blog-post-meta">
                      <span className={`blog-post-type ${POST_TYPE_CLASS[post.post_type] ?? 'type-editorial'}`}>
                        {post.post_type.replace('_', ' ')}
                      </span>
                      {post.author}
                    </div>
                  </div>
                  <span className="blog-arrow">↗</span>
                </Link>
              ))
            )}
          </div>
          <div className="blog-cta">
            <CTABox href="/blog" label="Read more" variant="dark" />
          </div>
        </div>
      </section>

      <section className="company-strip">
        <div className="company-strip-bg" />
        <div className="container">
          <div className="company-strip-inner">
            <div className="company-statement">
              Building from <em>Africa,</em><br />for the world.
            </div>
            <div className="company-details">
              <span className="company-detail-line">NexTrium Global Innovations Ltd</span>
              <span className="company-detail-line">RC: 9506507 · Est. 2026</span>
              <span className="company-detail-line">Lagos, Nigeria</span>
              <span className="company-detail-line">nextrium.org</span>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}