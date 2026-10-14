import { notFound } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import NTMark from '@nextrium/brand/NTMark'
import SectionTag from '@/components/shared/SectionTag'
import CTABox from '@/components/ui/CTABox'
import { createClient } from '@nextrium/supabase/server'
import { normalizeUrl } from '@nextrium/utils/normalizeUrl'
import type { Product } from '@nextrium/supabase/database'

interface Props {
  params: Promise<{ slug: string }>
}

async function getProduct(slug: string): Promise<Product | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error || !data) return null
  return data
}

async function getRelatedProducts(slug: string): Promise<Product[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .neq('slug', slug)
    .limit(2)
  if (error || !data) return []
  return data
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) return { title: 'Product not found' }
  return { title: product.name, description: product.tagline }
}

const STATUS_LABELS: Record<Product['status'], string> = {
  in_development: 'In Development',
  beta:           'Beta',
  live:           'Live',
  sunset:         'Sunset',
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const [product, related] = await Promise.all([
    getProduct(slug),
    getRelatedProducts(slug),
  ])
  if (!product) notFound()

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .product-hero { background: var(--navy-deep); padding-top: calc(var(--nav-height) + 80px); padding-bottom: 80px; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .product-hero-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 50% 60% at 90% 10%, rgba(219,103,39,0.09) 0%, transparent 55%), radial-gradient(ellipse 40% 50% at 5% 90%, rgba(10,139,139,0.06) 0%, transparent 50%); }
        .product-hero-grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.03; background-image: linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px); background-size: 72px 72px; }
        .product-hero-inner { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: end; }
        .product-mark-wrap { width: 72px; height: 72px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; margin-bottom: 24px; animation: fadeUp 0.6s ease both; }
        .product-status-badge { display: inline-block; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; padding: 4px 10px; margin-bottom: 20px; }
        .status-in_development { background: rgba(212,168,67,0.1); color: var(--gold); border: 1px solid rgba(212,168,67,0.2); }
        .status-live { background: rgba(34,193,122,0.1); color: var(--success); border: 1px solid rgba(34,193,122,0.2); }
        .status-beta { background: rgba(10,139,139,0.1); color: var(--teal); border: 1px solid rgba(10,139,139,0.2); }
        .status-sunset { background: rgba(232,69,69,0.1); color: var(--error); border: 1px solid rgba(232,69,69,0.2); }
        .product-title { font-family: var(--font-exo2); font-weight: 900; font-size: clamp(40px, 7vw, 80px); line-height: 0.97; letter-spacing: -2px; color: var(--white); animation: fadeUp 0.7s ease both; animation-delay: 0.1s; }
        .product-hero-right { animation: fadeUp 0.7s ease both; animation-delay: 0.25s; padding-bottom: 8px; }
        .product-tagline { font-size: clamp(16px, 1.8vw, 20px); font-weight: 300; color: var(--grey-mid); line-height: 1.7; margin-bottom: 32px; }
        .product-links { display: flex; flex-direction: column; gap: 8px; }
        .product-link-btn { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px; border: 1px solid rgba(255,255,255,0.15); color: var(--white); font-size: 13px; font-family: var(--font-dm); text-decoration: none; transition: border-color var(--transition-base), background var(--transition-base); }
        .product-link-btn:hover { border-color: var(--orange); background: rgba(219,103,39,0.06); }
        .product-body-section { background: var(--off-white); padding: var(--section-py) 0; }
        .product-body-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
        .product-desc-title { font-family: var(--font-exo2); font-weight: 800; font-size: clamp(24px, 3vw, 36px); color: var(--navy-deep); letter-spacing: -0.5px; line-height: 1.15; margin-bottom: 24px; }
        .product-desc { font-size: 16px; color: var(--grey-dark); line-height: 1.85; }
        .product-meta-block { display: flex; flex-direction: column; gap: 0; }
        .product-meta-row { display: grid; grid-template-columns: 140px 1fr; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--grey-light); }
        .product-meta-row:first-child { border-top: 1px solid var(--grey-light); }
        .product-meta-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); padding-top: 2px; }
        .product-meta-value { font-size: 14px; color: var(--grey-dark); line-height: 1.5; }
        .product-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .product-tag { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 10px; border: 1px solid var(--grey-light); color: var(--grey-dark); }
        .related-section { background: var(--navy-deep); padding: var(--section-py) 0; }
        .related-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(255,255,255,0.06); }
        .related-card { background: var(--navy); padding: 32px; display: flex; flex-direction: column; gap: 14px; text-decoration: none; transition: background var(--transition-base); position: relative; }
        .related-card::before, .related-card::after { content: ''; position: absolute; width: 10px; height: 10px; border-color: rgba(219,103,39,0); border-style: solid; transition: border-color var(--transition-slow); }
        .related-card::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .related-card::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .related-card:hover { background: var(--navy-mid); }
        .related-card:hover::before, .related-card:hover::after { border-color: var(--orange); }
        .related-name { font-family: var(--font-exo2); font-weight: 700; font-size: 20px; color: var(--white); letter-spacing: -0.3px; flex: 1; }
        .related-tagline { font-size: 13px; color: var(--grey-mid); line-height: 1.65; }
        .related-arrow { font-size: 16px; color: var(--grey-dark); align-self: flex-end; transition: color var(--transition-base), transform var(--transition-base); }
        .related-card:hover .related-arrow { color: var(--orange); transform: translate(3px, -3px); }
        .back-link { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); text-decoration: none; transition: color var(--transition-base); margin-bottom: 40px; }
        .back-link:hover { color: var(--orange); }
        .related-cta-row { border-top: 1px solid rgba(255,255,255,0.06); }
        .related-cta-row a { max-width: 100% !important; width: 100% !important; }
        @media (max-width: 900px) { .product-hero-inner { grid-template-columns: 1fr; gap: 40px; } .product-body-grid { grid-template-columns: 1fr; gap: 40px; } .related-grid { grid-template-columns: 1fr; } }
        @media (max-width: 600px) { .product-meta-row { grid-template-columns: 1fr; gap: 4px; } }
      `}</style>

      <Navbar />

      <section className="product-hero">
        <div className="product-hero-glow" />
        <div className="product-hero-grid" />
        <div className="container">
          <Link href="/products" className="back-link">← Back to builds</Link>
          <div className="product-hero-inner">
            <div>
              <div className="product-mark-wrap">
                <NTMark size={40} bodyColor={product.body_color} accentColor="#DB6727" />
              </div>
              <div className={`product-status-badge status-${product.status}`}>
                {STATUS_LABELS[product.status]}
              </div>
              <h1 className="product-title">{product.name}</h1>
            </div>
            <div className="product-hero-right">
              <p className="product-tagline">{product.tagline}</p>
              <div className="product-links">
                {product.website_url && (
                  <a href={normalizeUrl(product.website_url)} className="product-link-btn" target="_blank" rel="noopener noreferrer">
                    <span>Visit website</span><span>↗</span>
                  </a>
                )}
                {product.github_url && (
                  <a href={normalizeUrl(product.github_url)} className="product-link-btn" target="_blank" rel="noopener noreferrer">
                    <span>View on GitHub</span><span>↗</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="product-body-section">
        <div className="container">
          <div className="product-body-grid">
            <div>
              <SectionTag label="About this product" />
              <div className="product-desc-title">What it is<br />and why it matters.</div>
              <p className="product-desc">{product.description ?? product.tagline}</p>
            </div>
            <div>
              <div className="product-meta-block">
                <div className="product-meta-row">
                  <span className="product-meta-label">Status</span>
                  <span className="product-meta-value">{STATUS_LABELS[product.status]}</span>
                </div>
                {product.tech_stack.length > 0 && (
                  <div className="product-meta-row">
                    <span className="product-meta-label">Tech stack</span>
                    <div className="product-tags">
                      {product.tech_stack.map((t) => <span key={t} className="product-tag">{t}</span>)}
                    </div>
                  </div>
                )}
                {product.category.length > 0 && (
                  <div className="product-meta-row">
                    <span className="product-meta-label">Category</span>
                    <div className="product-tags">
                      {product.category.map((c) => <span key={c} className="product-tag">{c}</span>)}
                    </div>
                  </div>
                )}
                {product.website_url && (
                  <div className="product-meta-row">
                    <span className="product-meta-label">Website</span>
                    <a href={normalizeUrl(product.website_url)} className="product-meta-value" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)' }}>
                      {product.website_url.replace('https://', '')}
                    </a>
                  </div>
                )}
                {product.github_url && (
                  <div className="product-meta-row">
                    <span className="product-meta-label">GitHub</span>
                    <a href={normalizeUrl(product.github_url)} className="product-meta-value" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)' }}>
                      {product.github_url.replace('https://github.com/', '')}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="related-section">
          <div className="container">
            <div style={{ marginBottom: '40px' }}>
              <SectionTag label="Other builds" />
              <h2 className="section-title">More from NexTrium.</h2>
            </div>
            <div className="related-grid">
              {related.map((p) => (
                <Link key={p.slug} href={`/products/${p.slug}`} className="related-card">
                  <div className={`product-status-badge status-${p.status}`} style={{ display: 'inline-block', fontSize: '7.5px', fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '3px 8px' }}>
                    {STATUS_LABELS[p.status]}
                  </div>
                  <div className="related-name">{p.name}</div>
                  <div className="related-tagline">{p.tagline}</div>
                  <span className="related-arrow">↗</span>
                </Link>
              ))}
            </div>
            <div className="related-cta-row">
              <CTABox href="/products" label="View all builds" variant="dark" fullWidth />
            </div>
          </div>
        </section>
      )}

      <Footer />
    </>
  )
}