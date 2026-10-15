import Link from 'next/link'
import PublicShell from '@/components/PublicShell'
import { C, F } from '@/lib/theme'

export default function NotFound() {
  return (
    <PublicShell>
      <div className="bg-void pt-36 pb-28 flex flex-col items-center justify-center px-8 text-center">
        <p className="section-label mb-4">404</p>
        <h1 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 28, color: C.light, marginBottom: 12 }}>Page not found</h1>
        <p style={{ fontFamily: F.body, fontSize: 14, color: C.mute, marginBottom: 28 }}>The page you are looking for does not exist or has moved.</p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/tasks" className="btn-primary" style={{ fontSize: 13 }}>Browse open tasks</Link>
          <Link href="/" className="btn-outline" style={{ fontSize: 13 }}>Back to contribute</Link>
        </div>
      </div>
    </PublicShell>
  )
}
