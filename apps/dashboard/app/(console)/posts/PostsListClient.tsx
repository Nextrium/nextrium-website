'use client'

import Link from 'next/link'
import type { Post } from '@nextrium/supabase/database'
import { useDashboardSearch } from '@/lib/dashboard/useDashboardSearch'
import DashboardSearchBox from '@/components/dashboard/DashboardSearchBox'

const TYPE_LABELS: Record<Post['post_type'], string> = {
  editorial:      'Editorial',
  announcement:   'Announcement',
  product_update: 'Product Update',
  event_recap:    'Event Recap',
  research:       'Research',
  recruitment:    'Recruitment',
}

const TYPE_STYLES: Record<Post['post_type'], { bg: string; color: string }> = {
  editorial:      { bg: 'color-mix(in srgb, var(--grey-mid) 10%, transparent)', color: 'var(--grey-mid)' },
  announcement:   { bg: 'color-mix(in srgb, var(--orange) 10%, transparent)',  color: 'var(--orange)'   },
  product_update: { bg: 'color-mix(in srgb, var(--teal) 10%, transparent)',  color: 'var(--teal)'     },
  event_recap:    { bg: 'color-mix(in srgb, var(--gold) 10%, transparent)',  color: 'var(--gold)'     },
  research:       { bg: 'color-mix(in srgb, var(--slate) 10%, transparent)',  color: 'var(--slate)'    },
  recruitment:    { bg: 'color-mix(in srgb, var(--success) 10%, transparent)',  color: 'var(--success)'  },
}

export default function PostsListClient({ posts }: { posts: Post[] }) {
  const { query, setQuery, results } = useDashboardSearch(
    posts,
    (post) => [post.title, post.excerpt, post.author, TYPE_LABELS[post.post_type]]
  )

  return (
    <>
      <div className="dash-list-header">
        <span className="dash-list-count">{posts.length} post{posts.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <DashboardSearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search posts by title, author, or type..."
          resultCount={results.length}
        />
      </div>

      {results.length === 0 ? (
        <div className="dash-empty-state">
          <div className="dash-empty-title">No posts match your search.</div>
        </div>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Author</th>
                <th>Status</th>
                <th>Published</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.map((post) => {
                const ts = TYPE_STYLES[post.post_type]
                return (
                  <tr key={post.slug}>
                    <td className="post-title-cell">
                      <Link href={`/posts/${post.slug}`}>{post.title}</Link>
                      <div className="post-excerpt-cell">{post.excerpt}</div>
                    </td>
                    <td>
                      <span
                        className="dash-badge"
                        style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.color}33` }}
                      >
                        {TYPE_LABELS[post.post_type]}
                      </span>
                    </td>
                    <td style={{ color: 'var(--grey-mid)', fontSize: '12px' }}>{post.author}</td>
                    <td>
                      <span className={`dash-badge ${post.is_published ? 'badge-published' : 'badge-draft'}`}>
                        {post.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      <div style={{ color: 'var(--grey-mid)' }}>
                        {post.published_at
                          ? new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </div>
                      <div style={{ color: 'var(--grey-mid)', fontSize: '11px', marginTop: '2px' }}>
                        Updated {new Date(post.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </td>
                    <td>
                      <Link href={`/posts/${post.slug}`} className="dash-edit-link">Edit →</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
