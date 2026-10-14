import Link from 'next/link'
import { createServiceClient } from '@nextrium/supabase/server'

const COMPANY_LINKS = [
  { label: 'About',   href: '/about'   },
  { label: 'Team',    href: '/team'    },
  { label: 'The Hub', href: '/hub'     },
  { label: 'Contact', href: '/contact' },
]

const RESOURCE_LINKS = [
  { label: 'Services',  href: '/services'  },
  { label: 'Events',    href: '/events'    },
  { label: 'Blog',      href: '/blog'      },
  { label: 'Research',  href: '/research'  },
  { label: 'Careers',   href: '/careers'   },
]

async function getFooterProducts(): Promise<{ slug: string; name: string }[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('products')
    .select('slug, name')
    .order('sort_order', { ascending: true })
    .limit(5)
  return (data ?? []) as { slug: string; name: string }[]
}

export default async function Footer() {
  const products = await getFooterProducts()
  const year = new Date().getFullYear()

  return (
    <>
      <style>{`
        .footer {
          background: var(--navy);
          padding: 72px 0 36px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 48px;
          margin-bottom: 56px;
        }
        .footer-col-title {
          font-family: var(--font-mono);
          font-size: 9px; font-weight: 700;
          color: var(--grey-mid);
          letter-spacing: 0.2em; text-transform: uppercase;
          margin-bottom: 20px;
        }
        .footer-links { display: flex; flex-direction: column; gap: 12px; }
        .footer-links a {
          font-family: var(--font-dm);
          font-size: 15px;
          color: var(--off-white);
          text-decoration: none;
          transition: color var(--transition-base);
          line-height: 1.4;
        }
        .footer-links a:hover { color: var(--orange); }
        .footer-tagline {
          font-family: var(--font-mono);
          font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--grey-mid); margin-top: 14px; margin-bottom: 20px;
        }
        .footer-rc {
          font-family: var(--font-mono);
          font-size: 10px; letter-spacing: 0.06em;
          color: var(--grey-mid); line-height: 2;
        }
        .footer-bottom {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 32px;
          border-top: 1px solid rgba(255,255,255,0.08);
          flex-wrap: wrap; gap: 16px;
        }
        .footer-copy {
          font-family: var(--font-mono);
          font-size: 10px; letter-spacing: 0.08em; color: var(--grey-mid);
        }
        .footer-social { display: flex; gap: 24px; }
        .footer-social a {
          font-family: var(--font-mono);
          font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--grey-mid); text-decoration: none;
          transition: color var(--transition-base);
        }
        .footer-social a:hover { color: var(--orange); }
        @media (max-width: 900px) {
          .footer-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 600px) {
          .footer-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <footer className="footer" role="contentinfo">
        <div className="container">
          <div className="footer-grid">
            <div>
              <Link href="/" aria-label="NexTrium home" style={{ textDecoration: 'none' }}>
                <span style={{
                  fontFamily: 'var(--font-exo2)',
                  fontWeight: 900,
                  fontSize: '18px',
                  letterSpacing: '-0.3px',
                  color: 'var(--off-white)',
                }}>
                  Nex<span style={{ color: 'var(--orange)' }}>T</span>rium
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: 'var(--grey-mid)',
                  display: 'block',
                  marginTop: '4px',
                }}>
                  Innovation. Incubation. Impact.
                </span>
              </Link>
              <address className="footer-rc" style={{ fontStyle: 'normal' }}>
                NexTrium Global Innovations Ltd<br />
                RC: 9506507<br />
                69 Abeokuta Street, Ilaje Bariga<br />
                Lagos, Nigeria — 100223
              </address>
            </div>
            <div>
              <div className="footer-col-title">Company</div>
              <ul className="footer-links">
                {COMPANY_LINKS.map((link) => (
                  <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Products</div>
              <ul className="footer-links">
                <li><Link href="/products">All builds</Link></li>
                {products.map((p) => (
                  <li key={p.slug}><Link href={`/products/${p.slug}`}>{p.name}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Resources</div>
              <ul className="footer-links">
                {RESOURCE_LINKS.map((link) => (
                  <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span className="footer-copy">
              © {year} NexTrium Global Innovations Ltd. All rights reserved.
            </span>
            <div className="footer-social">
              <a href="#" rel="noopener noreferrer">Twitter</a>
              <a href="#" rel="noopener noreferrer">LinkedIn</a>
              <a href="https://github.com/Next-Trend-Lab" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}