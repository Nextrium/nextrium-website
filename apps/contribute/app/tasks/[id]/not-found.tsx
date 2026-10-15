import Link from 'next/link'
import PublicShell from '@/components/PublicShell'
import { C, F } from '@/lib/theme'

export default function TaskNotFound() {
  return (
    <PublicShell>
      <div className="bg-void pt-36 pb-28 flex flex-col items-center justify-center px-8 text-center">
        <h1 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 24, color: C.light, marginBottom: 12 }}>Task not available</h1>
        <p style={{ fontFamily: F.body, fontSize: 14, color: C.mute, marginBottom: 28 }}>This task may have already been claimed or does not exist.</p>
        <Link href="/tasks" className="btn-primary" style={{ fontSize: 13 }}>Browse open tasks</Link>
      </div>
    </PublicShell>
  )
}
