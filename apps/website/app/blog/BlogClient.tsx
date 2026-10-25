'use client'

import { useState } from 'react'
import Link from 'next/link'
import SectionTag from '@/components/shared/SectionTag'
import type { Post } from '@nextrium/supabase/database'

type FilterType = 'all' | Post['post_type']

const TYPE_FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all',            label: 'All'            },
  { value: 'editorial',      label: 'Editorial'      },
  { value: 'announcement',   label: 'Announcement'   },
  { value: 'product_update', label: 'Product Update' },
  { value: 'event_recap',    label: 'Event Recap'    },
  { value: 'research',       label: 'Research'       },
  { value: 'recruitment',    label: 'Recruitment'    },
]

const TYPE_STYLES: Record<Post['post_type'], { bg: string; color: string }> = {
  editorial:      { bg: 'rgba(138,155,176,0.1)', color: 'var(--grey-mid)' },
  announcement:   { bg: 'rgba(219,103,39,0.1)',  color: 'var(--orange)'   },
  product_update: { bg: 'rgba(10,139,139,0.1)',  color: 'var(--teal)'     },
  event_recap:    { bg: 'rgba(212,168,67,0.1)',  color: 'var(--gold)'     },
  research:       { bg: 'rgba(74,111,165,0.1)',  color: 'var(--slate)'    },
  recruitment:    { bg: 'rgba(34,193,122,0.1)',  color: 'var(--success)'  },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

interface BlogClientProps {
  posts: Post[]
  /** Posts pinned on this site; they already come first in `posts`. */
  pinnedIds?: string[]
}

export default function BlogClient({ posts, pinnedIds = [] }: BlogClientProps) {
  const pinned = new Set(pinnedIds)
  const [active, setActive] = useState<FilterType>('all')

  const filtered = active === 'all'
    ? posts
    : posts.filter((p) => p.post_type === active)

  const featured = filtered[0]
  const rest     = filtered.slice(1)

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }

        .blog-hero { background: var(--navy-deep); padding-top: calc(var(--nav-height) + 80px); padding-bottom: 80px; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .blog-hero-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 55% 50% at 88% 12%, rgba(219,103,39,0.10) 0%, transparent 58%), radial-gradient(ellipse 40% 55% at 6% 88%, rgba(10,139,139,0.06) 0%, transparent 52%); }
        .blog-hero-grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.03; background-image: linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px); background-size: 72px 72px; }
        .blog-hero-inner { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: end; }
        .blog-headline { font-family: var(--font-exo2); font-weight: 900; font-size: clamp(36px, 5vw, 72px); line-height: 1.0; letter-spacing: -2px; color: var(--white); animation: fadeUp 0.7s ease both; animation-delay: 0.1s; }
        .blog-headline em { font-style: normal; color: var(--orange); }
        .blog-hero-desc { font-weight: 300; font-size: clamp(15px, 1.6vw, 18px); color: var(--grey-mid); line-height: 1.75; animation: fadeUp 0.7s ease both; animation-delay: 0.25s; padding-bottom: 8px; }

        .blog-section { background: var(--navy-deep); padding: 80px 0; }
        .filter-bar { display: flex; align-items: center; gap: 2px; margin-bottom: 48px; flex-wrap: wrap; }
        .filter-btn { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; padding: 10px 18px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: var(--grey-mid); cursor: pointer; transition: all var(--transition-base); }
        .filter-btn:hover { color: var(--white); border-color: rgba(255,255,255,0.25); }
        .filter-btn.active { background: var(--orange); color: var(--white); border-color: var(--orange); }

        /* Featured post */
        .blog-pinned { display: inline-block; margin-left: 8px; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange-w); border: 1px solid rgba(219,103,39,0.4); padding: 3px 8px; vertical-align: middle; }
        .blog-featured { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(255,255,255,0.06); margin-bottom: 48px; text-decoration: none; position: relative; align-items: stretch; }
        .blog-featured::before, .blog-featured::after { content: ''; position: absolute; width: 14px; height: 14px; border-color: rgba(219,103,39,0); border-style: solid; transition: border-color var(--transition-slow); z-index: 2; }
        .blog-featured::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .blog-featured::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .blog-featured:hover::before, .blog-featured:hover::after { border-color: var(--orange); }
        .blog-featured-media { background: #071628; overflow: hidden; }
        .blog-featured-media img { width: 100%; height: 100%; object-fit: cover; object-position: left top; display: block; transition: transform var(--transition-slow); }
        .blog-featured:hover .blog-featured-media img { transform: scale(1.04); }
        .blog-featured-media-placeholder { width: 100%; height: 100%; min-height: 320px; display: flex; align-items: center; justify-content: center; background: var(--navy-mid); position: relative; overflow: hidden; }
        .blog-featured-media-placeholder::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(219,103,39,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(219,103,39,0.08) 1px, transparent 1px); background-size: 32px 32px; }
        .blog-featured-body { background: var(--navy); padding: 48px; display: flex; flex-direction: column; gap: 16px; justify-content: center; }
        .blog-type-badge { display: inline-block; font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.15em; text-transform: uppercase; padding: 4px 10px; width: fit-content; }
        .blog-featured-title { font-family: var(--font-exo2); font-weight: 800; font-size: clamp(22px, 3vw, 32px); color: var(--white); letter-spacing: -0.5px; line-height: 1.15; }
        .blog-featured-excerpt { font-size: 14px; color: var(--grey-mid); line-height: 1.75; flex: 1; }
        .blog-featured-meta { display: flex; align-items: center; gap: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); }
        .blog-featured-author { font-size: 12px; color: var(--grey-mid); }
        .blog-featured-date { font-family: var(--font-mono); font-size: 10px; color: var(--grey-dark); letter-spacing: 0.1em; }
        .blog-read-link { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); margin-left: auto; display: flex; align-items: center; gap: 6px; transition: gap var(--transition-base); }
        .blog-featured:hover .blog-read-link { gap: 10px; }

        /* Posts grid */
        .blog-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .blog-card { background: var(--navy); display: flex; flex-direction: column; text-decoration: none; position: relative; transition: background var(--transition-base); overflow: hidden; }
        .blog-card::before, .blog-card::after { content: ''; position: absolute; width: 10px; height: 10px; border-color: rgba(219,103,39,0); border-style: solid; transition: border-color var(--transition-slow); z-index: 2; }
        .blog-card::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .blog-card::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .blog-card:hover { background: var(--navy-mid); }
        .blog-card:hover::before, .blog-card:hover::after { border-color: var(--orange); }
        .blog-card-image { width: 100%; aspect-ratio: 16/9; overflow: hidden; background: var(--navy-mid); flex-shrink: 0; }
        .blog-card-image img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform var(--transition-slow); }
        .blog-card:hover .blog-card-image img { transform: scale(1.04); }
        .blog-card-image-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--navy-mid); position: relative; overflow: hidden; }
        .blog-card-image-placeholder::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(219,103,39,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(219,103,39,0.06) 1px, transparent 1px); background-size: 24px 24px; }
        .blog-card-body { padding: 24px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
        .blog-card-title { font-family: var(--font-exo2); font-weight: 700; font-size: 17px; color: var(--white); letter-spacing: -0.2px; line-height: 1.3; flex: 1; }
        .blog-card-excerpt { font-size: 13px; color: var(--grey-mid); line-height: 1.65; }
        .blog-card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.06); margin-top: auto; }
        .blog-card-meta { font-size: 11px; color: var(--grey-dark); font-family: var(--font-mono); letter-spacing: 0.08em; }
        .blog-card-arrow { font-size: 14px; color: var(--grey-dark); transition: color var(--transition-base), transform var(--transition-base); }
        .blog-card:hover .blog-card-arrow { color: var(--orange); transform: translate(3px, -3px); }

        .blog-empty { padding: 80px 0; text-align: center; }
        .blog-empty-title { font-family: var(--font-exo2); font-weight: 700; font-size: 22px; color: var(--white); margin-bottom: 12px; }
        .blog-empty-sub { font-size: 14px; color: var(--grey-mid); }

        @media (max-width: 900px) { .blog-hero-inner { grid-template-columns: 1fr; gap: 32px; } .blog-featured { grid-template-columns: 1fr; } .blog-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .blog-grid { grid-template-columns: 1fr; } .filter-btn { padding: 8px 12px; font-size: 8px; } .blog-featured-body { padding: 28px; } }
      `}</style>

      <section className="blog-hero">
        <div className="blog-hero-glow" />
        <div className="blog-hero-grid" />
        <div className="container">
          <div className="blog-hero-inner">
            <div>
              <SectionTag label="Blog" />
              <h1 className="blog-headline">
                Ideas worth <em>writing down.</em>
              </h1>
            </div>
            <p className="blog-hero-desc">
              Editorials, announcements, product updates, and research from the NexTrium team. Written when we have something real to say.
            </p>
          </div>
        </div>
      </section>

      <section className="blog-section">
        <div className="container">
          <div className="filter-bar" role="group" aria-label="Filter posts by type">
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '48px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--grey-mid)' }}>
              Looking for in-depth research notes?
            </span>
            <Link href="/research" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 20px', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--white)', fontSize: '13px', fontFamily: 'var(--font-dm)', textDecoration: 'none', transition: 'border-color 0.15s ease, background 0.15s ease', whiteSpace: 'nowrap' }}>
              <span>View research notes</span>
              <span>→</span>
            </Link>
          </div>

          {filtered.length === 0 ? (
            <div className="blog-empty">
              <div className="blog-empty-title">No posts in this category yet.</div>
              <div className="blog-empty-sub">Check back soon.</div>
            </div>
          ) : (
            <>
              {featured && (
                <Link href={`/blog/${featured.slug}`} className="blog-featured">
                  <div className="blog-featured-media">
                    {featured.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={featured.cover_image_url} alt={featured.title} />
                    ) : (
                      <div className="blog-featured-media-placeholder" />
                    )}
                  </div>
                  <div className="blog-featured-body">
                    <span
                      className="blog-type-badge"
                      style={{ background: TYPE_STYLES[featured.post_type].bg, color: TYPE_STYLES[featured.post_type].color, border: `1px solid ${TYPE_STYLES[featured.post_type].color}33` }}
                    >
                      {TYPE_FILTERS.find((f) => f.value === featured.post_type)?.label}
                    </span>
                    {pinned.has(featured.id) && <span className="blog-pinned">Pinned</span>}
                    <div className="blog-featured-title">{featured.title}</div>
                    {featured.excerpt && <div className="blog-featured-excerpt">{featured.excerpt}</div>}
                    <div className="blog-featured-meta">
                      <span className="blog-featured-author">{featured.author}</span>
                      <span className="blog-featured-date">
                        {featured.published_at ? formatDate(featured.published_at) : ''}
                      </span>
                      <span className="blog-read-link">Read <span>→</span></span>
                    </div>
                  </div>
                </Link>
              )}

              {rest.length > 0 && (
                <div className="blog-grid" style={{ marginTop: '40px' }}>
                  {rest.map((post) => {
                    const ts = TYPE_STYLES[post.post_type]
                    return (
                      <Link key={post.slug} href={`/blog/${post.slug}`} className="blog-card">
                        <div className="blog-card-image">
                          {post.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={post.cover_image_url} alt={post.title} />
                          ) : (
                            <div className="blog-card-image-placeholder" />
                          )}
                        </div>
                        <div className="blog-card-body">
                          <span
                            className="blog-type-badge"
                            style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.color}33` }}
                          >
                            {TYPE_FILTERS.find((f) => f.value === post.post_type)?.label}
                          </span>
                          {pinned.has(post.id) && <span className="blog-pinned">Pinned</span>}
                          <div className="blog-card-title">{post.title}</div>
                          {post.excerpt && <div className="blog-card-excerpt">{post.excerpt}</div>}
                          <div className="blog-card-footer">
                            <span className="blog-card-meta">
                              {post.published_at ? formatDate(post.published_at) : ''} · {post.author}
                            </span>
                            <span className="blog-card-arrow">↗</span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  )
}