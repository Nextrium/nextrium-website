'use client'

import { useState } from 'react'
import Link from 'next/link'
import NTMark from '@nextrium/brand/Mark'
import SectionTag from '@/components/shared/SectionTag'
import { normalizeUrl } from '@nextrium/utils/normalizeUrl'
import type { Product } from '@nextrium/supabase/database'

type FilterStatus = 'all' | Product['status']

const FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'all',            label: 'All'            },
  { value: 'in_development', label: 'In Development' },
  { value: 'beta',           label: 'Beta'           },
  { value: 'live',           label: 'Live'           },
  { value: 'sunset',         label: 'Sunset'         },
]

const STATUS_LABELS: Record<Product['status'], string> = {
  in_development: 'In Development',
  beta:           'Beta',
  live:           'Live',
  sunset:         'Sunset',
}

interface ProductsClientProps {
  products: Product[]
}

export default function ProductsClient({ products }: ProductsClientProps) {
  const [active, setActive] = useState<FilterStatus>('all')

  const filtered = active === 'all'
    ? products
    : products.filter((p) => p.status === active)

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .products-hero { background: var(--navy-deep); padding-top: calc(var(--nav-height) + 80px); padding-bottom: 80px; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .products-hero-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 50% 60% at 90% 10%, rgba(219,103,39,0.09) 0%, transparent 55%), radial-gradient(ellipse 40% 50% at 5% 90%, rgba(10,139,139,0.06) 0%, transparent 50%); }
        .products-hero-grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.03; background-image: linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px); background-size: 72px 72px; }
        .products-hero-content { position: relative; z-index: 1; }
        .products-headline { font-family: var(--font-exo2); font-weight: 900; font-size: clamp(48px, 8vw, 88px); line-height: 0.95; letter-spacing: -2.5px; color: var(--white); margin-bottom: 24px; animation: fadeUp 0.7s ease both; animation-delay: 0.1s; }
        .products-headline em { font-style: normal; color: var(--orange); }
        .products-sub { font-weight: 300; font-size: clamp(15px, 1.6vw, 18px); color: var(--grey-mid); line-height: 1.7; max-width: 520px; animation: fadeUp 0.7s ease both; animation-delay: 0.2s; }
        .products-section { background: var(--navy-deep); padding: 80px 0; }
        .filter-bar { display: flex; align-items: center; gap: 2px; margin-bottom: 48px; flex-wrap: wrap; }
        .filter-btn { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; padding: 10px 18px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: var(--grey-mid); cursor: pointer; transition: all var(--transition-base); }
        .filter-btn:hover { color: var(--white); border-color: rgba(255,255,255,0.25); }
        .filter-btn.active { background: var(--orange); color: var(--white); border-color: var(--orange); }
        .products-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: rgba(255,255,255,0.06); }
        .product-card { background: var(--navy); padding: 40px 32px 32px; display: flex; flex-direction: column; gap: 20px; text-decoration: none; transition: background var(--transition-base); position: relative; }
        .product-card::before, .product-card::after { content: ''; position: absolute; width: 12px; height: 12px; border-color: rgba(219,103,39,0); border-style: solid; transition: border-color var(--transition-slow); }
        .product-card::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .product-card::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .product-card:hover { background: var(--navy-mid); }
        .product-card:hover::before, .product-card:hover::after { border-color: var(--orange); }
        .product-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .product-mark-wrap { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; flex-shrink: 0; }
        .product-status { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.15em; text-transform: uppercase; padding: 4px 8px; }
        .status-in_development { background: rgba(212,168,67,0.1); color: var(--gold); border: 1px solid rgba(212,168,67,0.2); }
        .status-live { background: rgba(34,193,122,0.1); color: var(--success); border: 1px solid rgba(34,193,122,0.2); }
        .status-beta { background: rgba(10,139,139,0.1); color: var(--teal); border: 1px solid rgba(10,139,139,0.2); }
        .status-sunset { background: rgba(232,69,69,0.1); color: var(--error); border: 1px solid rgba(232,69,69,0.2); }
        .product-name { font-family: var(--font-exo2); font-weight: 700; font-size: 22px; color: var(--white); letter-spacing: -0.3px; line-height: 1.2; }
        .product-tagline { font-size: 13px; color: var(--grey-mid); line-height: 1.65; flex: 1; }
        .product-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .product-tag { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; border: 1px solid rgba(255,255,255,0.08); color: var(--grey-mid); }
        .product-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); }
        .product-links { display: flex; gap: 12px; }
        .product-link { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-mid); text-decoration: none; transition: color var(--transition-base); }
        .product-link:hover { color: var(--orange); }
        .product-arrow { font-size: 16px; color: var(--grey-dark); transition: color var(--transition-base), transform var(--transition-base); }
        .product-card:hover .product-arrow { color: var(--orange); transform: translate(3px, -3px); }
        .product-card-image-wrap { width: 100%; aspect-ratio: 16/9; overflow: hidden; background: var(--navy-mid); display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
        .product-card-image { width: 100%; height: 100%; object-fit: contain; object-position: center; padding: 24px; display: block; transition: transform var(--transition-slow); }
        .product-card:hover .product-card-image { transform: scale(1.04); }
        .products-empty { grid-column: 1 / -1; padding: 80px 40px; text-align: center; background: var(--navy); }
        .products-empty-title { font-family: var(--font-exo2); font-weight: 700; font-size: 22px; color: var(--white); margin-bottom: 12px; }
        .products-empty-sub { font-size: 14px; color: var(--grey-mid); }
        .products-note { border-top: 1px solid rgba(255,255,255,0.06); padding: 40px 0; }
        .products-note-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        .products-note-text { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-dark); }
        .products-note-cta { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--orange); text-decoration: none; transition: color var(--transition-base); }
        .products-note-cta:hover { color: var(--orange-w); }
        @media (max-width: 900px) { .products-grid { grid-template-columns: 1fr; } }
        @media (max-width: 600px) { .filter-btn { padding: 8px 14px; font-size: 8px; } }
      `}</style>

      <section className="products-hero">
        <div className="products-hero-glow" />
        <div className="products-hero-grid" />
        <div className="container products-hero-content">
          <SectionTag label="Our builds" />
          <h1 className="products-headline">Everything<br />we <em>build.</em></h1>
          <p className="products-sub">
            Products designed by NexTrium. Each one addresses a real gap in an underserved market. The list grows as we ship.
          </p>
        </div>
      </section>

      <section className="products-section">
        <div className="container">
          <div className="filter-bar" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
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

          <div className="products-grid">
            {filtered.length === 0 ? (
              <div className="products-empty">
                <div className="products-empty-title">No builds in this category yet.</div>
                <div className="products-empty-sub">Check back soon or view all builds.</div>
              </div>
            ) : (
              filtered.map((product) => (
                <div key={product.slug} className="product-card" onClick={() => window.location.href = `/products/${product.slug}`} style={{ cursor: 'pointer' }}>
                  {product.cover_image_url && (
                    <div className="product-card-image-wrap">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.cover_image_url}
                        alt={product.name}
                        className="product-card-image"
                      />
                    </div>
                  )}
                  <div className="product-card-top">
                    {!product.cover_image_url && (
                      <div className="product-mark-wrap">
                        <NTMark size={32} bodyColor={product.body_color} accentColor="#DB6727" />
                      </div>
                    )}
                    <span className={`product-status status-${product.status}`}>
                      {STATUS_LABELS[product.status]}
                    </span>
                  </div>
                  <div className="product-name">{product.name}</div>
                  <div className="product-tagline">{product.tagline}</div>
                  <div className="product-tags">
                    {product.category.map((tag) => (
                      <span key={tag} className="product-tag">{tag}</span>
                    ))}
                  </div>
                  <div className="product-footer">
                    <div className="product-links">
                      {product.website_url && (
                        <a href={normalizeUrl(product.website_url)} className="product-link" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Website ↗</a>
                      )}
                      {product.github_url && (
                        <a href={normalizeUrl(product.github_url)} className="product-link" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>GitHub ↗</a>
                      )}
                    </div>
                    <span className="product-arrow">↗</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="products-note">
            <div className="products-note-inner">
              <span className="products-note-text">More builds coming. This list grows as NexTrium ships.</span>
              <Link href="/contact?subject=partnership" className="products-note-cta">Partner with us →</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}