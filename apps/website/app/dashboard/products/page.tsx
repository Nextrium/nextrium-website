import { createServiceClient } from '@nextrium/supabase/server'
import Header from '@/components/dashboard/Header'
import Link from 'next/link'
import type { Product } from '@nextrium/supabase/database'
import { brand } from '@nextrium/brand'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Products' }

const STATUS_LABELS: Record<Product['status'], string> = {
  in_development: 'In Development',
  beta:           'Beta',
  live:           'Live',
  sunset:         'Sunset',
}

const STATUS_STYLES: Record<Product['status'], { bg: string; color: string }> = {
  in_development: { bg: 'color-mix(in srgb, var(--gold) 10%, transparent)',  color: 'var(--gold)'    },
  beta:           { bg: 'color-mix(in srgb, var(--teal) 10%, transparent)',  color: 'var(--teal)'    },
  live:           { bg: 'color-mix(in srgb, var(--success) 10%, transparent)',  color: 'var(--success)' },
  sunset:         { bg: 'color-mix(in srgb, var(--error) 10%, transparent)',   color: 'var(--error)'   },
}

async function getProducts(): Promise<Product[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })
  return data ?? []
}

export default async function ProductsPage() {
  const products = await getProducts()

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
        .dash-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; display: inline-block; white-space: nowrap; }
        .badge-featured { background: color-mix(in srgb, var(--orange) 10%, transparent); color: var(--orange); border: 1px solid color-mix(in srgb, var(--orange) 20%, transparent); }
        .dash-edit-link { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-mid); text-decoration: none; padding: 5px 10px; border: 1px solid rgba(255,255,255,0.08); transition: all 0.15s ease; display: inline-block; }
        .dash-edit-link:hover { color: var(--white); border-color: rgba(255,255,255,0.2); }
        .product-color-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; border: 1px solid rgba(255,255,255,0.1); }
        .dash-empty-state { padding: 64px 32px; text-align: center; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); }
        .dash-empty-title { font-family: var(--font-exo2); font-weight: 700; font-size: 20px; color: var(--white); margin-bottom: 8px; }
        .dash-empty-desc { font-size: 14px; color: var(--grey-mid); margin-bottom: 24px; }
      `}</style>

      <Header
        title="Products"
        description={`Manage ${brand.styledName} products and builds`}
        action={<Link href="/dashboard/products/new" className="dash-new-btn">+ New product</Link>}
      />

      <div className="dash-content">
        {products.length === 0 ? (
          <div className="dash-empty-state">
            <div className="dash-empty-title">No products yet.</div>
            <div className="dash-empty-desc">Add your first product to get started.</div>
            <Link href="/dashboard/products/new" className="dash-new-btn">+ New product</Link>
          </div>
        ) : (
          <>
            <div className="dash-list-header">
              <span className="dash-list-count">{products.length} product{products.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Category</th>
                    <th>Color</th>
                    <th>Featured</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const ss = STATUS_STYLES[product.status]
                    return (
                      <tr key={product.slug}>
                        <td style={{ color: 'var(--grey-dark)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{product.sort_order}</td>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--white)', marginBottom: '2px' }}>{product.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--grey-mid)' }}>{product.tagline}</div>
                        </td>
                        <td>
                          <span className="dash-badge" style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}33` }}>
                            {STATUS_LABELS[product.status]}
                          </span>
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--grey-mid)' }}>{product.category.join(', ')}</td>
                        <td>
                          <span className="product-color-dot" style={{ background: product.body_color }} title={product.body_color} />
                        </td>
                        <td>
                          {product.is_featured && <span className="dash-badge badge-featured">Featured</span>}
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--grey-mid)', whiteSpace: 'nowrap' }}>
                          {new Date(product.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td>
                          <Link href={`/dashboard/products/${product.slug}`} className="dash-edit-link">Edit →</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
