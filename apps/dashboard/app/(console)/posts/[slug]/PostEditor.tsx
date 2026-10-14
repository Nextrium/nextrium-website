'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@nextrium/supabase/client'
import Header from '@/components/dashboard/Header'
import CoverImageUpload from '@/components/dashboard/CoverImageUpload'
import { normalizeUrl } from '@nextrium/utils/normalizeUrl'
import RichTextEditor from '@/components/editor/RichTextEditor'
import type { Post } from '@nextrium/supabase/database'
import { logActivityAction } from '@/app/actions/activityLog'

interface PostEditorProps {
  post: Post | null
}

const POST_TYPES: { value: Post['post_type']; label: string }[] = [
  { value: 'editorial',      label: 'Editorial'      },
  { value: 'announcement',   label: 'Announcement'   },
  { value: 'product_update', label: 'Product Update' },
  { value: 'event_recap',    label: 'Event Recap'    },
  { value: 'research',       label: 'Research'       },
  { value: 'recruitment',    label: 'Recruitment'    },
]

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export default function PostEditor({ post }: PostEditorProps) {
  const router = useRouter()
  const isNew  = !post

  const [title,       setTitle]       = useState(post?.title           ?? '')
  const [slug,        setSlug]        = useState(post?.slug            ?? '')
  const [excerpt,     setExcerpt]     = useState(post?.excerpt         ?? '')
  const [content,     setContent]     = useState(post?.content         ?? '')
  const [postType,    setPostType]    = useState<Post['post_type']>(post?.post_type ?? 'editorial')
  const [author,      setAuthor]      = useState(post?.author          ?? 'Abdulbasit Abdulrahman')
  const [tags,        setTags]        = useState((post?.tags ?? []).join(', '))
  const [isPublished, setIsPublished] = useState(post?.is_published    ?? false)
  const [coverImage,  setCoverImage]  = useState(post?.cover_image_url ?? '')
  const [brand,        setBrand]      = useState<'nextrium' | 'zivana'>(post?.brand ?? 'nextrium')

  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  const handleTitleChange = useCallback((val: string) => {
    setTitle(val)
    if (isNew) setSlug(slugify(val))
  }, [isNew])

  async function handleSave(publish: boolean) {
    setError(null); setSuccess(null)
    if (!title.trim())   { setError('Title is required.');   return }
    if (!slug.trim())    { setError('Slug is required.');    return }
    if (!excerpt.trim()) { setError('Excerpt is required.'); return }
    if (!content.trim() || content === '<p></p>') { setError('Content is required.'); return }
    if (!author.trim())  { setError('Author is required.');  return }

    setSaving(true)
    const supabase  = createClient()
    const tagsArray = tags.split(',').map((t) => t.trim()).filter(Boolean)
    const now       = new Date().toISOString()

    const payload = {
      title:           title.trim(),
      slug:            slug.trim(),
      excerpt:         excerpt.trim(),
      content:         content.trim(),
      post_type:       postType,
      author:          author.trim(),
      tags:            tagsArray,
      is_published:    publish,
      published_at:    publish ? (post?.published_at ?? now) : null,
      cover_image_url: normalizeUrl(coverImage) || null,
      brand:           brand,
      updated_at:      now,
    }

    try {
      if (isNew) {
        const { error: err } = await (supabase.from('posts') as any).insert({ ...payload, created_at: now })
        if (err) throw err
        setSuccess('Post created.')
        logActivityAction({
          action: publish ? 'post_published' : 'post_created',
          targetType: 'post',
          targetId: payload.slug,
          details: { title: payload.title },
        }).catch(() => {})
        router.push(`/posts/${payload.slug}`)
        router.refresh()
      } else {
        const { error: err } = await (supabase.from('posts') as any).update(payload).eq('slug', post!.slug)
        if (err) throw err
        setSuccess(publish ? 'Post published.' : 'Draft saved.')
        logActivityAction({
          action: publish && !post!.is_published ? 'post_published' : 'post_updated',
          targetType: 'post',
          targetId: payload.slug,
          details: { title: payload.title },
        }).catch(() => {})
        router.refresh()
        if (slug !== post!.slug) router.push(`/posts/${payload.slug}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!post) return
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return
    setDeleting(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('posts').delete().eq('slug', post.slug)
    if (err) { setError(err.message); setDeleting(false); return }
    logActivityAction({
      action: 'post_deleted',
      targetType: 'post',
      targetId: post.slug,
      details: { title: post.title },
    }).catch(() => {})
    router.refresh()
    router.push('/posts')
  }

  const ActionButtons = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {!isNew && (
        <button type="button" onClick={handleDelete} disabled={deleting}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 14px', background: 'none', border: '1px solid rgba(232,69,69,0.3)', color: 'var(--error)', cursor: 'pointer' }}>
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      )}
      <button type="button" onClick={() => handleSave(false)} disabled={saving}
        style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 14px', background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--grey-mid)', cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Save draft'}
      </button>
      <button type="button" onClick={() => handleSave(true)} disabled={saving}
        style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 16px', background: 'var(--orange)', border: '1px solid var(--orange)', color: 'var(--white)', cursor: 'pointer' }}>
        {saving ? 'Publishing...' : isPublished ? 'Update' : 'Publish'}
      </button>
    </div>
  )

  return (
    <>
      <style>{`
        .post-editor-layout { display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: start; }
        .post-editor-main { display: flex; flex-direction: column; gap: 20px; }
        .post-editor-sidebar { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }
        .editor-field { display: flex; flex-direction: column; gap: 8px; }
        .editor-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); }
        .editor-input { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; transition: border-color 0.15s ease; }
        .editor-input:focus { border-color: var(--orange); }
        .editor-input::placeholder { color: var(--grey-dark); }
        .editor-textarea { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: var(--off-white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; resize: vertical; min-height: 80px; line-height: 1.6; transition: border-color 0.15s ease; }
        .editor-textarea:focus { border-color: var(--orange); }
        .editor-textarea::placeholder { color: var(--grey-dark); }
        .editor-select { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; cursor: pointer; transition: border-color 0.15s ease; }
        .editor-select:focus { border-color: var(--orange); }
        .editor-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .editor-panel-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .editor-toggle { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; }
        .editor-toggle-label { font-size: 13px; color: var(--off-white); }
        .editor-toggle-switch { position: relative; width: 40px; height: 22px; }
        .editor-toggle-switch input { opacity: 0; width: 0; height: 0; }
        .editor-toggle-track { position: absolute; cursor: pointer; inset: 0; background: rgba(255,255,255,0.1); transition: 0.15s ease; border-radius: 11px; }
        .editor-toggle-track::before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: var(--grey-mid); transition: 0.15s ease; border-radius: 50%; }
        input:checked + .editor-toggle-track { background: var(--orange); }
        input:checked + .editor-toggle-track::before { transform: translateX(18px); background: var(--white); }
        .editor-cover-preview { width: 100%; aspect-ratio: 16/9; object-fit: cover; border: 1px solid rgba(255,255,255,0.08); display: block; }
        .editor-alert { padding: 10px 14px; font-size: 12px; border: 1px solid; margin-bottom: 8px; }
        .editor-alert-error { background: rgba(232,69,69,0.08); border-color: rgba(232,69,69,0.3); color: var(--error); }
        .editor-alert-success { background: rgba(34,193,122,0.08); border-color: rgba(34,193,122,0.3); color: var(--success); }
        @media (max-width: 1100px) { .post-editor-layout { grid-template-columns: 1fr; } .post-editor-sidebar { position: static; } }
      `}</style>

      <Header
        title={isNew ? 'New post' : 'Edit post'}
        description={isNew ? 'Create a new post' : post?.slug}
        action={ActionButtons}
      />

      <div className="dash-content">
        {error   && <div className="editor-alert editor-alert-error">{error}</div>}
        {success && <div className="editor-alert editor-alert-success">{success}</div>}

        <div className="post-editor-layout">
          <div className="post-editor-main">
            <div className="editor-field">
              <label className="editor-label" htmlFor="title">Title</label>
              <input className="editor-input" id="title" type="text" placeholder="Post title"
                value={title} onChange={(e) => handleTitleChange(e.target.value)}
                style={{ fontSize: '20px', fontFamily: 'var(--font-exo2)', fontWeight: 700 }}
              />
            </div>

            <div className="editor-field">
              <label className="editor-label" htmlFor="excerpt">Excerpt</label>
              <textarea className="editor-textarea" id="excerpt"
                placeholder="A short summary shown in listings and previews"
                value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} />
            </div>

            <div className="editor-field">
              <label className="editor-label">Content</label>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Write your post content here..."
              />
            </div>
          </div>

          <div className="post-editor-sidebar">
            <div className="editor-panel">
              <div className="editor-panel-title">Settings</div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="slug">Slug</label>
                <input className="editor-input" id="slug" type="text" placeholder="post-url-slug"
                  value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
              </div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="post_type">Type</label>
                <select className="editor-select" id="post_type" value={postType}
                  onChange={(e) => setPostType(e.target.value as Post['post_type'])}>
                  {POST_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="brand">Brand</label>
                <select className="editor-select" id="brand" value={brand}
                  onChange={(e) => setBrand(e.target.value as 'nextrium' | 'zivana')}>
                  <option value="nextrium">NexTrium</option>
                  <option value="zivana">Zivana Protocol</option>
                </select>
              </div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="author">Author</label>
                <input className="editor-input" id="author" type="text" placeholder="Author name"
                  value={author} onChange={(e) => setAuthor(e.target.value)} />
              </div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="tags">Tags</label>
                <input className="editor-input" id="tags" type="text"
                  placeholder="Comma separated: Web3, Nigeria"
                  value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>

              <div className="editor-toggle">
                <span className="editor-toggle-label">Published</span>
                <label className="editor-toggle-switch">
                  <input type="checkbox" checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)} />
                  <span className="editor-toggle-track" />
                </label>
              </div>
            </div>

            <div className="editor-panel">
              <div className="editor-panel-title">Cover image</div>
              <CoverImageUpload
                value={coverImage}
                onChange={setCoverImage}
                folder="posts"
              />
            </div>

            {!isNew && (
              <div className="editor-panel">
                <div className="editor-panel-title">Info</div>
                <div style={{ fontSize: '12px', color: 'var(--grey-mid)', lineHeight: 1.8 }}>
                  <div>Created: {new Date(post!.created_at).toLocaleDateString('en-GB')}</div>
                  <div>Updated: {new Date(post!.updated_at).toLocaleDateString('en-GB')}</div>
                  {post!.published_at && (
                    <div>Published: {new Date(post!.published_at).toLocaleDateString('en-GB')}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}