import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getDashboardRole, type DashboardRole } from '@/lib/dashboard/getRole'
import Header from '@/components/dashboard/Header'
import Link from 'next/link'
import type { Post, Application } from '@/lib/types/database'

async function getStats(role: DashboardRole) {
  const supabase = createServiceClient()

  const canSeeProducts     = role === 'admin' || role === 'content' || role === 'moderator'
  const canSeePosts        = role === 'admin' || role === 'content' || role === 'moderator'
  const canSeeEvents       = true
  const canSeeApplications = role === 'admin' || role === 'moderator'
  const canSeeContacts     = role === 'admin' || role === 'moderator'

  const [products, posts, events, applications, contacts] = await Promise.all([
    canSeeProducts     ? supabase.from('products').select('id', { count: 'exact', head: true }) : null,
    canSeePosts        ? supabase.from('posts').select('id', { count: 'exact', head: true }).eq('is_published', true) : null,
    canSeeEvents       ? supabase.from('events').select('id', { count: 'exact', head: true }) : null,
    canSeeApplications ? supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'pending') : null,
    canSeeContacts     ? supabase.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new') : null,
  ])
  return {
    products:     products?.count     ?? 0,
    posts:        posts?.count        ?? 0,
    events:       events?.count       ?? 0,
    applications: applications?.count ?? 0,
    contacts:     contacts?.count     ?? 0,
  }
}

async function getRecentPosts(role: DashboardRole): Promise<Pick<Post, 'slug' | 'title' | 'post_type' | 'published_at' | 'is_published'>[]> {
  if (role !== 'admin' && role !== 'content' && role !== 'moderator') return []

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('posts')
    .select('slug, title, post_type, published_at, is_published')
    .order('updated_at', { ascending: false })
    .limit(5)
  return data ?? []
}

async function getRecentApplications(role: DashboardRole): Promise<Pick<Application, 'id' | 'name' | 'email' | 'role_title' | 'status' | 'created_at'>[]> {
  if (role !== 'admin' && role !== 'moderator') return []

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('applications')
    .select('id, name, email, role_title, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)
  return data ?? []
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = await getDashboardRole()

  const [stats, recentPosts, recentApplications] = await Promise.all([
    getStats(role),
    getRecentPosts(role),
    getRecentApplications(role),
  ])

  const canSeeProducts     = role === 'admin' || role === 'content' || role === 'moderator'
  const canSeePosts        = role === 'admin' || role === 'content' || role === 'moderator'
  const canSeeApplications = role === 'admin' || role === 'moderator'
  const canSeeContacts     = role === 'admin' || role === 'moderator'
  const canSeeRoles        = role === 'admin' || role === 'moderator'

  const STAT_CARDS = [
    canSeeProducts     && { label: 'Products',        value: stats.products,     href: '/dashboard/products',     accent: '#0A8B8B' },
    canSeePosts        && { label: 'Published posts', value: stats.posts,        href: '/dashboard/posts',        accent: '#4A6FA5' },
    { label: 'Events', value: stats.events, href: '/dashboard/events', accent: '#D4A843' },
    canSeeApplications && { label: 'Pending apps',    value: stats.applications, href: '/dashboard/applications', accent: stats.applications > 0 ? '#DB6727' : '#2E3F54' },
    canSeeContacts     && { label: 'New messages',    value: stats.contacts,     href: '/dashboard/contact',      accent: stats.contacts > 0 ? '#DB6727' : '#2E3F54' },
  ].filter(Boolean) as { label: string; value: number; href: string; accent: string }[]

  const QUICK_ACTIONS = [
    canSeePosts    && { label: 'New post',    href: '/dashboard/posts/new'    },
    canSeeProducts && { label: 'New product', href: '/dashboard/products/new' },
    { label: 'New event', href: '/dashboard/events/new' },
    canSeeRoles    && { label: 'New role',    href: '/dashboard/roles/new'    },
  ].filter(Boolean) as { label: string; href: string }[]

  return (
    <>
      <style>{`
        .dash-stat-grid {
          display: grid; grid-template-columns: repeat(5, 1fr);
          gap: 1px; background: rgba(255,255,255,0.06); margin-bottom: 32px;
        }
        .dash-stat-card {
          background: var(--navy); padding: 24px;
          text-decoration: none; display: flex; flex-direction: column; gap: 12px;
          transition: background 0.15s ease; position: relative; overflow: hidden;
        }
        .dash-stat-card::after {
          content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
          background: var(--accent-color);
        }
        .dash-stat-card:hover { background: var(--navy-mid); }
        .dash-stat-label {
          font-family: var(--font-mono); font-size: 8.5px;
          letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid);
        }
        .dash-stat-value {
          font-family: var(--font-exo2); font-weight: 900;
          font-size: 40px; letter-spacing: -2px; line-height: 1; color: var(--white);
        }
        .dash-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .dash-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .dash-panel-header {
          padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: space-between;
        }
        .dash-panel-title {
          font-family: var(--font-exo2); font-weight: 700;
          font-size: 14px; color: var(--white); letter-spacing: -0.2px;
        }
        .dash-panel-link {
          font-family: var(--font-mono); font-size: 8px;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--orange); text-decoration: none;
        }
        .dash-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 14px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          text-decoration: none; transition: background 0.15s ease;
          overflow: hidden;
        }
        .dash-row:last-child { border-bottom: none; }
        .dash-row:hover { background: rgba(255,255,255,0.03); }
        .dash-row-title {
          font-size: 13px; color: var(--white); line-height: 1.3; font-weight: 500;
          flex: 1; min-width: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .dash-row-meta {
          font-size: 11px; color: var(--grey-mid); flex-shrink: 0;
          max-width: 40%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .dash-badge {
          font-family: var(--font-mono); font-size: 7.5px;
          letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 7px; flex-shrink: 0;
        }
        .badge-published   { background: rgba(34,193,122,0.1);  color: var(--success); border: 1px solid rgba(34,193,122,0.2); }
        .badge-draft       { background: rgba(138,155,176,0.1); color: var(--grey-mid); border: 1px solid rgba(138,155,176,0.2); }
        .badge-pending     { background: rgba(219,103,39,0.1);  color: var(--orange); border: 1px solid rgba(219,103,39,0.2); }
        .badge-reviewed    { background: rgba(74,111,165,0.1);  color: var(--slate); border: 1px solid rgba(74,111,165,0.2); }
        .badge-shortlisted { background: rgba(212,168,67,0.1);  color: var(--gold); border: 1px solid rgba(212,168,67,0.2); }
        .badge-rejected    { background: rgba(232,69,69,0.1);   color: var(--error); border: 1px solid rgba(232,69,69,0.2); }
        .badge-accepted    { background: rgba(34,193,122,0.1);  color: var(--success); border: 1px solid rgba(34,193,122,0.2); }
        .dash-empty { padding: 32px 24px; text-align: center; font-size: 13px; color: var(--grey-dark); }
        .dash-quick-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 32px; }
        .dash-quick-btn {
          font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.15em; text-transform: uppercase;
          padding: 10px 16px; border: 1px solid rgba(255,255,255,0.1);
          color: var(--grey-mid); text-decoration: none;
          transition: all 0.15s ease; display: flex; align-items: center; gap: 8px;
        }
        .dash-quick-btn:hover { color: var(--white); border-color: var(--orange); background: rgba(219,103,39,0.06); }
        @media (max-width: 1200px) { .dash-stat-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 900px)  { .dash-two-col { grid-template-columns: 1fr; } }
      `}</style>

      <Header title="Dashboard" description="NexTrium Global Innovations Ltd" />

      <div className="dash-content">
        <div className="dash-quick-actions">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} className="dash-quick-btn">+ {a.label}</Link>
          ))}
        </div>

        <div className="dash-stat-grid">
          {STAT_CARDS.map((card) => (
            <Link
              key={card.href} href={card.href} className="dash-stat-card"
              style={{ '--accent-color': card.accent } as React.CSSProperties}
            >
              <div className="dash-stat-label">{card.label}</div>
              <div className="dash-stat-value">{card.value}</div>
            </Link>
          ))}
        </div>

        <div className="dash-two-col">
          {canSeePosts && (
          <div className="dash-panel">
            <div className="dash-panel-header">
              <span className="dash-panel-title">Recent posts</span>
              <Link href="/dashboard/posts" className="dash-panel-link">View all →</Link>
            </div>
            <div>
              {recentPosts.length === 0 ? (
                <div className="dash-empty">No posts yet.</div>
              ) : (
                recentPosts.map((post) => (
                  <Link key={post.slug} href={`/dashboard/posts/${post.slug}`} className="dash-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="dash-row-title">{post.title}</div>
                      <div className="dash-row-meta">
                        {post.published_at
                          ? new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Draft'}
                      </div>
                    </div>
                    <span className={`dash-badge ${post.is_published ? 'badge-published' : 'badge-draft'}`}>
                      {post.is_published ? 'Published' : 'Draft'}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
          )}

          {canSeeApplications && (
          <div className="dash-panel">
            <div className="dash-panel-header">
              <span className="dash-panel-title">Recent applications</span>
              <Link href="/dashboard/applications" className="dash-panel-link">View all →</Link>
            </div>
            <div>
              {recentApplications.length === 0 ? (
                <div className="dash-empty">No applications yet.</div>
              ) : (
                recentApplications.map((app) => (
                  <div key={app.id} className="dash-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="dash-row-title">{app.name}</div>
                      <div className="dash-row-meta">
                        {app.role_title ?? 'Open application'} · {new Date(app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <span className={`dash-badge badge-${app.status}`}>{app.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </>
  )
}
