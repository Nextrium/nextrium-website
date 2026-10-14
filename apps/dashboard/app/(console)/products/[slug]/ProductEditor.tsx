'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@nextrium/supabase/client'
import { normalizeUrl } from '@nextrium/utils/normalizeUrl'
import Header from '@/components/dashboard/Header'
import CoverImageUpload from '@/components/dashboard/CoverImageUpload'
import type { Product } from '@nextrium/supabase/database'
import { logActivityAction } from '@/app/actions/activityLog'
import { brand, color } from '@nextrium/brand'

interface ProductEditorProps {
  product: Product | null
}

const STATUS_OPTIONS: { value: Product['status']; label: string }[] = [
  { value: 'in_development', label: 'In Development' },
  { value: 'beta',           label: 'Beta'           },
  { value: 'live',           label: 'Live'           },
  { value: 'sunset',         label: 'Sunset'         },
]

function slugify(str: string): string {
  return str.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)
}

export default function ProductEditor({ product }: ProductEditorProps) {
  const router = useRouter()
  const isNew  = !product

  const [name,        setName]        = useState(product?.name             ?? '')
  const [slug,        setSlug]        = useState(product?.slug             ?? '')
  const [tagline,     setTagline]     = useState(product?.tagline          ?? '')
  const [description, setDescription] = useState(product?.description      ?? '')
  const [status,      setStatus]      = useState<Product['status']>(product?.status ?? 'in_development')
  const [category,    setCategory]    = useState((product?.category        ?? []).join(', '))
  const [techStack,   setTechStack]   = useState((product?.tech_stack      ?? []).join(', '))
  const [bodyColor,   setBodyColor]   = useState(product?.body_color       ?? color('--navy'))
  const [websiteUrl,  setWebsiteUrl]  = useState(product?.website_url      ?? '')
  const [githubUrl,   setGithubUrl]   = useState(product?.github_url       ?? '')
  const [coverImage,  setCoverImage]  = useState(product?.cover_image_url  ?? '')
  const [isFeatured,  setIsFeatured]  = useState(product?.is_featured      ?? false)
  const [sortOrder,   setSortOrder]   = useState(product?.sort_order       ?? 0)

  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  async function handleSave() {
    setError(null); setSuccess(null)
    if (!name.trim())    { setError('Name is required.');    return }
    if (!slug.trim())    { setError('Slug is required.');    return }
    if (!tagline.trim()) { setError('Tagline is required.'); return }

    setSaving(true)
    const supabase = createClient()
    const now      = new Date().toISOString()

    const payload = {
      name:            name.trim(),
      slug:            slug.trim(),
      tagline:         tagline.trim(),
      description:     description.trim() || null,
      status,
      category:        category.split(',').map((s) => s.trim()).filter(Boolean),
      tech_stack:      techStack.split(',').map((s) => s.trim()).filter(Boolean),
      body_color:      bodyColor,
      website_url:     normalizeUrl(websiteUrl)  || null,
      github_url:      normalizeUrl(githubUrl)   || null,
      cover_image_url: normalizeUrl(coverImage)  || null,
      is_featured:     isFeatured,
      sort_order:      Number(sortOrder),
      updated_at:      now,
    }

    try {
      if (isNew) {
        const { error: err } = await (supabase.from('products') as any).insert({ ...payload, created_at: now })
        if (err) throw err
        setSuccess('Product created.')
        logActivityAction({
          action: 'product_created',
          targetType: 'product',
          targetId: payload.slug,
          details: { name: payload.name },
        }).catch(() => {})
        router.push(`/products/${payload.slug}`)
        router.refresh()
      } else {
        const { error: err } = await (supabase.from('products') as any).update(payload).eq('slug', product!.slug)
        if (err) throw err
        setSuccess('Product saved.')
        logActivityAction({
          action: 'product_updated',
          targetType: 'product',
          targetId: payload.slug,
          details: { name: payload.name },
        }).catch(() => {})
        router.refresh()
        if (slug !== product!.slug) router.push(`/products/${payload.slug}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!product) return
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    setDeleting(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('products').delete().eq('slug', product.slug)
    if (err) { setError(err.message); setDeleting(false); return }
    logActivityAction({
      action: 'product_deleted',
      targetType: 'product',
      targetId: product.slug,
      details: { name: product.name },
    }).catch(() => {})
    router.push('/products')
    router.refresh()
  }

  const ActionButtons = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {!isNew && (
        <button
          type="button" onClick={handleDelete} disabled={deleting}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 14px', background: 'none', border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)', color: 'var(--error)', cursor: 'pointer' }}
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      )}
      <button
        type="button" onClick={handleSave} disabled={saving}
        style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 20px', background: 'var(--orange)', border: '1px solid var(--orange)', color: 'var(--white)', cursor: 'pointer' }}
      >
        {saving ? 'Saving...' : isNew ? 'Create product' : 'Save changes'}
      </button>
    </div>
  )

  return (
    <>
      <style>{`
        .prod-editor-layout { display: grid; grid-template-columns: 1fr 280px; gap: 24px; align-items: start; }
        .prod-editor-main { display: flex; flex-direction: column; gap: 20px; }
        .prod-editor-sidebar { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }
        .editor-field { display: flex; flex-direction: column; gap: 8px; }
        .editor-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); }
        .editor-input { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; transition: border-color 0.15s ease; }
        .editor-input:focus { border-color: var(--orange); }
        .editor-input::placeholder { color: var(--grey-dark); }
        .editor-textarea { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: var(--off-white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; resize: vertical; min-height: 120px; line-height: 1.6; transition: border-color 0.15s ease; }
        .editor-textarea:focus { border-color: var(--orange); }
        .editor-textarea::placeholder { color: var(--grey-dark); }
        .editor-select { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; cursor: pointer; transition: border-color 0.15s ease; }
        .editor-select:focus { border-color: var(--orange); }
        .editor-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .editor-panel-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .editor-toggle { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; }
        .editor-toggle-label { font-size: 13px; color: var(--off-white); }
        .editor-toggle-switch { position: relative; width: 40px; height: 22px; }
        .editor-toggle-switch input { opacity: 0; width: 0; height: 0; }
        .editor-toggle-track { position: absolute; cursor: pointer; inset: 0; background: rgba(255,255,255,0.1); transition: 0.15s ease; border-radius: 11px; }
        .editor-toggle-track::before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: var(--grey-mid); transition: 0.15s ease; border-radius: 50%; }
        input:checked + .editor-toggle-track { background: var(--orange); }
        input:checked + .editor-toggle-track::before { transform: translateX(18px); background: var(--white); }
        .color-field { display: flex; align-items: center; gap: 12px; }
        .color-preview { width: 40px; height: 40px; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; }
        .editor-alert { padding: 10px 14px; font-size: 12px; border: 1px solid; margin-bottom: 8px; }
        .editor-alert-error { background: color-mix(in srgb, var(--error) 8%, transparent); border-color: color-mix(in srgb, var(--error) 30%, transparent); color: var(--error); }
        .editor-alert-success { background: color-mix(in srgb, var(--success) 8%, transparent); border-color: color-mix(in srgb, var(--success) 30%, transparent); color: var(--success); }
        @media (max-width: 1100px) { .prod-editor-layout { grid-template-columns: 1fr; } .prod-editor-sidebar { position: static; } }
      `}</style>

      <Header
        title={isNew ? 'New product' : 'Edit product'}
        description={isNew ? `Add a new ${brand.styledName} product` : product?.slug}
        action={ActionButtons}
      />

      <div className="dash-content">
        {error   && <div className="editor-alert editor-alert-error">{error}</div>}
        {success && <div className="editor-alert editor-alert-success">{success}</div>}

        <div className="prod-editor-layout">
          <div className="prod-editor-main">
            <div className="editor-field">
              <label className="editor-label" htmlFor="name">Product name</label>
              <input
                className="editor-input" id="name" type="text"
                placeholder="e.g. Zivana Protocol"
                value={name}
                onChange={(e) => { setName(e.target.value); if (isNew) setSlug(slugify(e.target.value)) }}
                style={{ fontSize: '20px', fontFamily: 'var(--font-exo2)', fontWeight: 700 }}
              />
            </div>

            <div className="editor-field">
              <label className="editor-label" htmlFor="tagline">Tagline</label>
              <input
                className="editor-input" id="tagline" type="text"
                placeholder="One-line description shown in listings"
                value={tagline} onChange={(e) => setTagline(e.target.value)}
              />
            </div>

            <div className="editor-field">
              <label className="editor-label" htmlFor="description">Description</label>
              <textarea
                className="editor-textarea" id="description"
                placeholder="Full product description shown on the product detail page"
                value={description} onChange={(e) => setDescription(e.target.value)} rows={6}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="editor-field">
                <label className="editor-label" htmlFor="category">Categories</label>
                <input
                  className="editor-input" id="category" type="text"
                  placeholder="Web3, DeFi, Africa"
                  value={category} onChange={(e) => setCategory(e.target.value)}
                />
                <span style={{ fontSize: '11px', color: 'var(--grey-dark)' }}>Comma separated</span>
              </div>
              <div className="editor-field">
                <label className="editor-label" htmlFor="tech_stack">Tech stack</label>
                <input
                  className="editor-input" id="tech_stack" type="text"
                  placeholder="Next.js, Supabase, Cardano"
                  value={techStack} onChange={(e) => setTechStack(e.target.value)}
                />
                <span style={{ fontSize: '11px', color: 'var(--grey-dark)' }}>Comma separated</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="editor-field">
                <label className="editor-label" htmlFor="website_url">Website URL</label>
                <input
                  className="editor-input" id="website_url" type="url"
                  placeholder="https://"
                  value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </div>
              <div className="editor-field">
                <label className="editor-label" htmlFor="github_url">GitHub URL</label>
                <input
                  className="editor-input" id="github_url" type="url"
                  placeholder="https://github.com/..."
                  value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="editor-field">
              <label className="editor-label">Cover image</label>
              <CoverImageUpload
                value={coverImage}
                onChange={setCoverImage}
                folder="products"
              />
            </div>
          </div>

          <div className="prod-editor-sidebar">
            <div className="editor-panel">
              <div className="editor-panel-title">Settings</div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="slug">Slug</label>
                <input
                  className="editor-input" id="slug" type="text" placeholder="product-slug"
                  value={slug} onChange={(e) => setSlug(slugify(e.target.value))}
                />
              </div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="status">Status</label>
                <select
                  className="editor-select" id="status" value={status}
                  onChange={(e) => setStatus(e.target.value as Product['status'])}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="editor-field">
                <label className="editor-label" htmlFor="sort_order">Sort order</label>
                <input
                  className="editor-input" id="sort_order" type="number" min="0"
                  value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))}
                />
              </div>

              <div className="editor-toggle">
                <span className="editor-toggle-label">Featured</span>
                <label className="editor-toggle-switch">
                  <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
                  <span className="editor-toggle-track" />
                </label>
              </div>
            </div>

            <div className="editor-panel">
              <div className="editor-panel-title">Brand color</div>
              <div className="editor-field">
                <label className="editor-label" htmlFor="body_color">Card body color</label>
                <div className="color-field">
                  <div className="color-preview" style={{ background: bodyColor }} />
                  <input
                    className="editor-input" id="body_color" type="text"
                    placeholder={color('--navy')}
                    value={bodyColor} onChange={(e) => setBodyColor(e.target.value)}
                  />
                </div>
                <input
                  type="color" value={bodyColor}
                  onChange={(e) => setBodyColor(e.target.value)}
                  style={{ width: '100%', height: '36px', border: 'none', cursor: 'pointer', background: 'none' }}
                />
              </div>
            </div>

            {!isNew && (
              <div className="editor-panel">
                <div className="editor-panel-title">Info</div>
                <div style={{ fontSize: '12px', color: 'var(--grey-mid)', lineHeight: 1.8 }}>
                  <div>Created: {new Date(product!.created_at).toLocaleDateString('en-GB')}</div>
                  <div>Updated: {new Date(product!.updated_at).toLocaleDateString('en-GB')}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
