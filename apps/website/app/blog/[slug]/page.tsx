import { notFound } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import SectionTag from '@/components/shared/SectionTag'
import { createClient } from '@nextrium/supabase/server'
import type { Post } from '@nextrium/supabase/database'

interface Props {
  params: Promise<{ slug: string }>
}

async function getPost(slug: string): Promise<Post | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()
  if (error || !data) return null
  return data
}

async function getRelatedPosts(slug: string, postType: Post['post_type']): Promise<Post[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('is_published', true)
    .eq('post_type', postType)
    .neq('slug', slug)
    .limit(3)
  if (error || !data) return []
  return data
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'Post not found' }
  return { title: post.title, description: post.excerpt ?? '' }
}

const TYPE_LABELS: Record<Post['post_type'], string> = {
  editorial:      'Editorial',
  announcement:   'Announcement',
  product_update: 'Product Update',
  event_recap:    'Event Recap',
  research:       'Research',
  recruitment:    'Recruitment',
}

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

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const related = await getRelatedPosts(slug, post.post_type)
  const ts = TYPE_STYLES[post.post_type]

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .post-hero { background: var(--navy-deep); padding-top: calc(var(--nav-height) + 80px); padding-bottom: 80px; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .post-hero-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 50% 60% at 90% 10%, rgba(219,103,39,0.09) 0%, transparent 55%); }
        .post-hero-grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.03; background-image: linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px); background-size: 72px 72px; }
        .post-hero-inner { position: relative; z-index: 1; max-width: 860px; }
        .post-type-badge { display: inline-block; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; padding: 4px 10px; margin-bottom: 20px; animation: fadeUp 0.6s ease both; }
        .post-title { font-family: var(--font-exo2); font-weight: 900; font-size: clamp(36px, 6vw, 72px); line-height: 1.0; letter-spacing: -2px; color: var(--white); margin-bottom: 24px; animation: fadeUp 0.7s ease both; animation-delay: 0.1s; }
        .post-excerpt { font-size: clamp(16px, 1.8vw, 20px); font-weight: 300; color: var(--grey-mid); line-height: 1.7; margin-bottom: 32px; max-width: 680px; animation: fadeUp 0.7s ease both; animation-delay: 0.2s; }
        .post-meta { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; animation: fadeUp 0.7s ease both; animation-delay: 0.3s; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.08); }
        .post-meta-author { font-size: 14px; color: var(--white); font-weight: 500; }
        .post-meta-date { font-family: var(--font-mono); font-size: 10px; color: var(--grey-mid); letter-spacing: 0.1em; }
        .post-meta-tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .post-meta-tag { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; border: 1px solid rgba(255,255,255,0.1); color: var(--grey-mid); }

        .post-cover-wrap { width: 100%; margin-bottom: 48px; background: #071628; overflow: hidden; }
        .post-cover { width: 100%; height: auto; display: block; }

        .post-body-section { background: var(--off-white); padding: var(--section-py) 0; }
        .post-body-inner { display: grid; grid-template-columns: 1fr 220px; gap: 24px; align-items: start; min-width: 0; }
        .post-content { font-size: 17px; color: var(--grey-dark); line-height: 1.9; width: 100%; min-width: 0; overflow: hidden; }
        .post-content h1, .post-content h2, .post-content h3 { font-family: var(--font-exo2); font-weight: 700; color: var(--navy-deep); line-height: 1.2; margin-top: 2em; margin-bottom: 0.75em; }
        .post-content h1 { font-size: 32px; }
        .post-content h2 { font-size: 26px; }
        .post-content h3 { font-size: 20px; }
        .post-content p { margin-bottom: 1.5em; }
        .post-content a { color: var(--orange); text-decoration: underline; }
        .post-content ul, .post-content ol { padding-left: 24px; margin-bottom: 1.5em; }
        .post-content li { margin-bottom: 0.5em; }
        .post-content blockquote { border-left: 3px solid var(--orange); padding-left: 20px; color: var(--grey-mid); font-style: italic; margin: 2em 0; }
        .post-content pre { background: var(--navy-deep); color: var(--off-white); padding: 24px; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 1.5em; font-family: var(--font-mono); font-size: 13px; line-height: 1.7; white-space: pre; word-break: normal; }
        .post-content code { font-family: var(--font-mono); font-size: 13px; background: rgba(7,22,40,0.08); padding: 2px 6px; border-radius: 2px; overflow-wrap: anywhere; }
        /* Inside a code block the inline-code look must not apply: its padding pushed the
           first line right and broke column alignment. */
        .post-content pre code { display: block; padding: 0; background: none; border-radius: 0; font-size: inherit; line-height: inherit; color: inherit; white-space: inherit; word-break: normal; overflow-wrap: normal; }
        .post-content td pre, .post-content th pre { display: inline-block; max-width: 100%; margin: 0; padding: 4px 10px; font-size: 12px; line-height: 1.5; vertical-align: middle; }
        .post-content img { max-width: 100%; display: block; margin: 2em 0; }
        .post-content hr { border: none; border-top: 1px solid var(--grey-light); margin: 3em 0; }
        .post-content .table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 2em 0; }
        .post-content table { border-collapse: collapse; width: 100%; table-layout: auto; margin: 0; }
        .post-content th { background: var(--navy-deep); color: var(--white); font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; padding: 10px 14px; text-align: left; border: 1px solid rgba(255,255,255,0.1); word-wrap: break-word; white-space: nowrap; }
        .post-content td { padding: 10px 14px; font-size: 14px; color: var(--grey-dark); border: 1px solid var(--grey-light); vertical-align: top; word-wrap: break-word; }
        .post-content tr:nth-child(even) td { background: rgba(7,22,40,0.03); }

        .post-sidebar { position: sticky; top: calc(var(--nav-height) + 32px); display: flex; flex-direction: column; gap: 16px; }
        .post-sidebar-panel { background: var(--white); border: 1px solid var(--grey-light); padding: 24px; }
        .post-sidebar-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--grey-light); }
        .post-sidebar-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
        .post-sidebar-label { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); }
        .post-sidebar-value { font-size: 13px; color: var(--grey-dark); }

        .related-section { background: var(--navy-deep); padding: var(--section-py) 0; }
        .related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: rgba(255,255,255,0.06); }
        .related-card { background: var(--navy); padding: 28px; display: flex; flex-direction: column; gap: 12px; text-decoration: none; position: relative; transition: background var(--transition-base); }
        .related-card::before, .related-card::after { content: ''; position: absolute; width: 10px; height: 10px; border-color: rgba(219,103,39,0); border-style: solid; transition: border-color var(--transition-slow); }
        .related-card::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .related-card::after  { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .related-card:hover { background: var(--navy-mid); }
        .related-card:hover::before, .related-card:hover::after { border-color: var(--orange); }
        .related-card-title { font-family: var(--font-exo2); font-weight: 700; font-size: 17px; color: var(--white); letter-spacing: -0.2px; line-height: 1.3; flex: 1; }
        .related-card-meta { font-size: 11px; color: var(--grey-dark); font-family: var(--font-mono); }
        .related-card-arrow { font-size: 14px; color: var(--grey-dark); align-self: flex-end; transition: color var(--transition-base), transform var(--transition-base); }
        .related-card:hover .related-card-arrow { color: var(--orange); transform: translate(3px, -3px); }

        .back-link { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); text-decoration: none; transition: color var(--transition-base); margin-bottom: 40px; }
        .back-link:hover { color: var(--orange); }

        @media (max-width: 900px) {
          .post-body-inner { grid-template-columns: 1fr; gap: 40px; min-width: 0; }
          .post-sidebar { position: static; }
          .related-grid { grid-template-columns: 1fr; }
          .post-content { min-width: 0; overflow: hidden; }
          /* Code blocks keep their columns on phones too; they scroll sideways. */
          .post-content code { word-break: break-word; overflow-wrap: anywhere; }
        }
      `}</style>

      <Navbar />

      <section className="post-hero">
        <div className="post-hero-glow" />
        <div className="post-hero-grid" />
        <div className="container">
          <Link href="/blog" className="back-link">← Back to blog</Link>
          <div className="post-hero-inner">
            <span
              className="post-type-badge"
              style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.color}33` }}
            >
              {TYPE_LABELS[post.post_type]}
            </span>
            <h1 className="post-title">{post.title}</h1>
            {post.excerpt && <p className="post-excerpt">{post.excerpt}</p>}
            <div className="post-meta">
              <span className="post-meta-author">{post.author}</span>
              {post.published_at && (
                <span className="post-meta-date">{formatDate(post.published_at)}</span>
              )}
              {post.tags && post.tags.length > 0 && (
                <div className="post-meta-tags">
                  {post.tags.map((tag) => (
                    <span key={tag} className="post-meta-tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="post-body-section">
        <div className="container">
          {post.cover_image_url && (
            <div className="post-cover-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.cover_image_url} alt={post.title} className="post-cover" />
            </div>
          )}
          <div className="post-body-inner">
            <div
              className="post-content"
              dangerouslySetInnerHTML={{
                __html: post.content.replace(
                  /<table/g,
                  '<div class="table-wrap"><table'
                ).replace(
                  /<\/table>/g,
                  '</table></div>'
                )
              }}
            />
            <div className="post-sidebar">
              <div className="post-sidebar-panel">
                <div className="post-sidebar-title">About this post</div>
                <div className="post-sidebar-row">
                  <span className="post-sidebar-label">Author</span>
                  <span className="post-sidebar-value">{post.author}</span>
                </div>
                {post.published_at && (
                  <div className="post-sidebar-row">
                    <span className="post-sidebar-label">Published</span>
                    <span className="post-sidebar-value">{formatDate(post.published_at)}</span>
                  </div>
                )}
                <div className="post-sidebar-row">
                  <span className="post-sidebar-label">Type</span>
                  <span className="post-sidebar-value">{TYPE_LABELS[post.post_type]}</span>
                </div>
                {post.tags && post.tags.length > 0 && (
                  <div className="post-sidebar-row">
                    <span className="post-sidebar-label">Tags</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {post.tags.map((tag) => (
                        <span key={tag} className="post-meta-tag" style={{ border: '1px solid var(--grey-light)', color: 'var(--grey-dark)' }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Link href="/blog" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'var(--navy-deep)', color: 'var(--white)', textDecoration: 'none', fontSize: '13px', fontFamily: 'var(--font-dm)', transition: 'background var(--transition-base)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span>← All posts</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="related-section">
          <div className="container">
            <div style={{ marginBottom: '40px' }}>
              <SectionTag label="More posts" />
              <h2 className="section-title">Keep reading.</h2>
            </div>
            <div className="related-grid">
              {related.map((p) => {
                const rts = TYPE_STYLES[p.post_type]
                return (
                  <Link key={p.slug} href={`/blog/${p.slug}`} className="related-card">
                    <span className="blog-type-badge" style={{ display: 'inline-block', width: 'fit-content', background: rts.bg, color: rts.color, border: `1px solid ${rts.color}33`, fontFamily: 'var(--font-mono)', fontSize: '7.5px', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '3px 8px' }}>
                      {TYPE_LABELS[p.post_type]}
                    </span>
                    <div className="related-card-title">{p.title}</div>
                    <div className="related-card-meta">
                      {p.published_at ? formatDate(p.published_at) : ''} · {p.author}
                    </div>
                    <span className="related-card-arrow">↗</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </>
  )
}