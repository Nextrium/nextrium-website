import { createServiceClient } from '@nextrium/supabase/server'
import Header from '@/components/dashboard/Header'
import Link from 'next/link'
import PostsListClient from './PostsListClient'
import type { Post } from '@nextrium/supabase/database'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Posts' }

async function getPosts(): Promise<Post[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('posts')
    .select('*')
    .order('updated_at', { ascending: false })
  return data ?? []
}

export default async function PostsPage() {
  const posts = await getPosts()

  return (
    <>
      <style>{`
        .dash-list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .dash-list-count { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); }
        .dash-new-btn { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; padding: 10px 20px; background: var(--orange); color: var(--white); border: none; text-decoration: none; cursor: pointer; transition: background 0.15s ease; display: inline-flex; align-items: center; gap: 8px; }
        .dash-new-btn:hover { background: var(--orange-f); }
        .dash-table { width: 100%; border-collapse: collapse; }
        .dash-table th { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding: 10px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); background: var(--navy); white-space: nowrap; }
        .dash-table td { padding: 14px 16px; font-size: 13px; color: var(--off-white); border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        .dash-table tr:hover td { background: rgba(255,255,255,0.02); }
        .dash-table tr:last-child td { border-bottom: none; }
        .dash-table-wrap { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .post-title-cell { font-weight: 500; color: var(--white); max-width: 320px; }
        .post-title-cell a { text-decoration: none; color: inherit; transition: color 0.15s ease; }
        .post-title-cell a:hover { color: var(--orange); }
        .post-excerpt-cell { color: var(--grey-mid); font-size: 12px; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; display: inline-block; white-space: nowrap; }
        .badge-published { background: color-mix(in srgb, var(--success) 10%, transparent); color: var(--success); border: 1px solid color-mix(in srgb, var(--success) 20%, transparent); }
        .badge-draft     { background: color-mix(in srgb, var(--grey-mid) 10%, transparent); color: var(--grey-mid); border: 1px solid color-mix(in srgb, var(--grey-mid) 20%, transparent); }
        .dash-edit-link { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-mid); text-decoration: none; padding: 5px 10px; border: 1px solid rgba(255,255,255,0.08); transition: all 0.15s ease; display: inline-block; }
        .dash-edit-link:hover { color: var(--white); border-color: rgba(255,255,255,0.2); }
        .dash-empty-state { padding: 64px 32px; text-align: center; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .dash-empty-title { font-family: var(--font-exo2); font-weight: 700; font-size: 20px; color: var(--white); margin-bottom: 8px; }
        .dash-empty-desc { font-size: 14px; color: var(--grey-mid); margin-bottom: 24px; }
      `}</style>

      <Header
        title="Posts"
        description="Manage blog posts, announcements and updates"
        action={
          <Link href="/posts/new" className="dash-new-btn">+ New post</Link>
        }
      />

      <div className="dash-content">
        {posts.length === 0 ? (
          <div className="dash-empty-state">
            <div className="dash-empty-title">No posts yet.</div>
            <div className="dash-empty-desc">Create your first post to get started.</div>
            <Link href="/posts/new" className="dash-new-btn">+ New post</Link>
          </div>
        ) : (
          <PostsListClient posts={posts} />
        )}
      </div>
    </>
  )
}
