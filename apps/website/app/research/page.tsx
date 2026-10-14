import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import SectionTag from '@/components/shared/SectionTag'
import CTABox from '@/components/ui/CTABox'
import Link from 'next/link'
import { createClient } from '@nextrium/supabase/server'
import type { Post } from '@nextrium/supabase/database'

export const metadata = {
  title: 'Research',
  description: 'Research notes, papers, and findings from NexTrium. Grounded in real problems, written for practitioners.',
}

async function getResearchPosts(): Promise<Post[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('is_published', true)
    .eq('post_type', 'research')
    .order('published_at', { ascending: false })
  if (error || !data) return []
  return data
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

export default async function ResearchPage() {
  const posts     = await getResearchPosts()
  const hasPosts  = posts.length > 0
  const featured  = posts[0]
  const rest      = posts.slice(1)

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }

        .research-hero { background: var(--navy-deep); padding-top: calc(var(--nav-height) + 80px); padding-bottom: 80px; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .research-hero-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 55% 50% at 88% 12%, rgba(74,111,165,0.12) 0%, transparent 58%), radial-gradient(ellipse 40% 55% at 6% 88%, rgba(219,103,39,0.07) 0%, transparent 52%); }
        .research-hero-grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.03; background-image: linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px); background-size: 72px 72px; }
        .research-hero-inner { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: end; }
        .research-headline { font-family: var(--font-exo2); font-weight: 900; font-size: clamp(36px, 5vw, 72px); line-height: 1.0; letter-spacing: -2px; color: var(--white); animation: fadeUp 0.7s ease both; animation-delay: 0.1s; }
        .research-headline em { font-style: normal; color: var(--orange); }
        .research-hero-desc { font-weight: 300; font-size: clamp(15px, 1.6vw, 18px); color: var(--grey-mid); line-height: 1.75; animation: fadeUp 0.7s ease both; animation-delay: 0.25s; padding-bottom: 8px; }

        .research-section { background: var(--navy-deep); padding: 80px 0; }

        /* Featured post */
        .research-featured { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(255,255,255,0.06); margin-bottom: 48px; text-decoration: none; position: relative; }
        .research-featured::before, .research-featured::after { content: ''; position: absolute; width: 14px; height: 14px; border-color: rgba(219,103,39,0); border-style: solid; transition: border-color var(--transition-slow); z-index: 2; }
        .research-featured::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .research-featured::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .research-featured:hover::before, .research-featured:hover::after { border-color: var(--orange); }
        .research-featured-media { background: var(--navy-mid); position: relative; min-height: 320px; overflow: hidden; }
        .research-featured-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform var(--transition-slow); }
        .research-featured:hover .research-featured-media img { transform: scale(1.04); }
        .research-featured-placeholder { width: 100%; height: 100%; min-height: 320px; display: flex; align-items: center; justify-content: center; background: var(--navy-mid); position: relative; overflow: hidden; }
        .research-featured-placeholder::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(74,111,165,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(74,111,165,0.1) 1px, transparent 1px); background-size: 32px 32px; }
        .research-featured-placeholder-text { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(74,111,165,0.5); position: relative; z-index: 1; }
        .research-featured-body { background: var(--navy); padding: 48px; display: flex; flex-direction: column; gap: 16px; justify-content: center; }
        .research-badge { display: inline-block; font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.15em; text-transform: uppercase; padding: 4px 10px; background: rgba(74,111,165,0.1); color: var(--slate); border: 1px solid rgba(74,111,165,0.2); width: fit-content; }
        .research-featured-title { font-family: var(--font-exo2); font-weight: 800; font-size: clamp(20px, 2.5vw, 28px); color: var(--white); letter-spacing: -0.3px; line-height: 1.2; }
        .research-featured-excerpt { font-size: 14px; color: var(--grey-mid); line-height: 1.75; flex: 1; }
        .research-featured-meta { display: flex; align-items: center; gap: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap; }
        .research-featured-author { font-size: 12px; color: var(--grey-mid); }
        .research-featured-date { font-family: var(--font-mono); font-size: 10px; color: var(--grey-dark); letter-spacing: 0.1em; }
        .research-read-link { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--slate); margin-left: auto; display: flex; align-items: center; gap: 6px; transition: gap var(--transition-base); }
        .research-featured:hover .research-read-link { gap: 10px; }

        /* Grid */
        .research-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 40px; }
        .research-card { background: var(--navy); display: flex; flex-direction: column; text-decoration: none; position: relative; transition: background var(--transition-base); overflow: hidden; }
        .research-card::before, .research-card::after { content: ''; position: absolute; width: 10px; height: 10px; border-color: rgba(219,103,39,0); border-style: solid; transition: border-color var(--transition-slow); z-index: 2; }
        .research-card::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .research-card::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .research-card:hover { background: var(--navy-mid); }
        .research-card:hover::before, .research-card:hover::after { border-color: var(--orange); }
        .research-card-image { width: 100%; aspect-ratio: 16/9; overflow: hidden; background: var(--navy-mid); flex-shrink: 0; position: relative; }
        .research-card-image img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform var(--transition-slow); }
        .research-card:hover .research-card-image img { transform: scale(1.04); }
        .research-card-image-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--navy-mid); position: relative; overflow: hidden; }
        .research-card-image-placeholder::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(74,111,165,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(74,111,165,0.08) 1px, transparent 1px); background-size: 24px 24px; }
        .research-card-body { padding: 24px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
        .research-card-title { font-family: var(--font-exo2); font-weight: 700; font-size: 17px; color: var(--white); letter-spacing: -0.2px; line-height: 1.3; flex: 1; }
        .research-card-excerpt { font-size: 13px; color: var(--grey-mid); line-height: 1.65; }
        .research-card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.06); margin-top: auto; }
        .research-card-meta { font-size: 11px; color: var(--grey-dark); font-family: var(--font-mono); letter-spacing: 0.08em; }
        .research-card-arrow { font-size: 14px; color: var(--grey-dark); transition: color var(--transition-base), transform var(--transition-base); }
        .research-card:hover .research-card-arrow { color: var(--orange); transform: translate(3px, -3px); }

        /* Empty */
        .research-empty { padding: 80px 40px; text-align: center; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); position: relative; overflow: hidden; }
        .research-empty::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(74,111,165,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(74,111,165,0.06) 1px, transparent 1px); background-size: 40px 40px; }
        .research-empty-title { font-family: var(--font-exo2); font-weight: 700; font-size: 22px; color: var(--white); margin-bottom: 12px; position: relative; z-index: 1; }
        .research-empty-sub { font-size: 14px; color: var(--grey-mid); position: relative; z-index: 1; max-width: 400px; margin: 0 auto 32px; line-height: 1.7; }

        .research-cta { margin-top: 40px; }
        .research-cta a { max-width: 100% !important; width: 100% !important; }

        @media (max-width: 900px) { .research-hero-inner { grid-template-columns: 1fr; gap: 32px; } .research-featured { grid-template-columns: 1fr; } .research-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .research-grid { grid-template-columns: 1fr; } }
      `}</style>

      <Navbar />

      <section className="research-hero">
        <div className="research-hero-glow" />
        <div className="research-hero-grid" />
        <div className="container">
          <div className="research-hero-inner">
            <div>
              <SectionTag label="Research" />
              <h1 className="research-headline">
                Grounded in<br /><em>real problems.</em>
              </h1>
            </div>
            <p className="research-hero-desc">
              Research notes, papers, and findings from NexTrium. Written for practitioners, not journals. Everything here connects to something we are building or have built.
            </p>
          </div>
        </div>
      </section>

      <section className="research-section">
        <div className="container">
          {!hasPosts ? (
            <div className="research-empty">
              <div className="research-empty-title">Research coming soon.</div>
              <div className="research-empty-sub">
                We publish research when we have something real to say. Check back or subscribe to the blog for updates.
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <CTABox href="/blog" label="Read the blog instead" variant="dark" />
              </div>
            </div>
          ) : (
            <>
              {featured && (
                <Link href={`/blog/${featured.slug}`} className="research-featured">
                  <div className="research-featured-media">
                    {featured.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={featured.cover_image_url} alt={featured.title} />
                    ) : (
                      <div className="research-featured-placeholder">
                        <span className="research-featured-placeholder-text">NexTrium Research</span>
                      </div>
                    )}
                  </div>
                  <div className="research-featured-body">
                    <span className="research-badge">Research</span>
                    <div className="research-featured-title">{featured.title}</div>
                    {featured.excerpt && (
                      <div className="research-featured-excerpt">{featured.excerpt}</div>
                    )}
                    <div className="research-featured-meta">
                      <span className="research-featured-author">{featured.author}</span>
                      {featured.published_at && (
                        <span className="research-featured-date">{formatDate(featured.published_at)}</span>
                      )}
                      <span className="research-read-link">Read <span>→</span></span>
                    </div>
                  </div>
                </Link>
              )}

              {rest.length > 0 && (
                <div className="research-grid">
                  {rest.map((post) => (
                    <Link key={post.slug} href={`/blog/${post.slug}`} className="research-card">
                      <div className="research-card-image">
                        {post.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.cover_image_url} alt={post.title} />
                        ) : (
                          <div className="research-card-image-placeholder" />
                        )}
                      </div>
                      <div className="research-card-body">
                        <span className="research-badge">Research</span>
                        <div className="research-card-title">{post.title}</div>
                        {post.excerpt && (
                          <div className="research-card-excerpt">{post.excerpt}</div>
                        )}
                        <div className="research-card-footer">
                          <span className="research-card-meta">
                            {post.published_at ? formatDate(post.published_at) : ''} · {post.author}
                          </span>
                          <span className="research-card-arrow">↗</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              <div className="research-cta">
                <CTABox href="/blog" label="View all posts" variant="dark" fullWidth />
              </div>
            </>
          )}
        </div>
      </section>

      <Footer />
    </>
  )
}