import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Wordmark from '@nextrium/brand/Wordmark'
import { getPortalIdentity } from '@/lib/portal'
import { safeNext } from '@/lib/safeNext'
import SignInCard from './SignInCard'

export const metadata: Metadata = { title: 'Sign in' }

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams
  const next = safeNext(rawNext)
  if (await getPortalIdentity()) redirect(next)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-page-gradient">
      <div className="orb orb-a" aria-hidden="true" />
      <div className="orb orb-b" aria-hidden="true" />

      <Link href="/" className="mb-10 relative" style={{ textDecoration: 'none' }}>
        <Wordmark size="md" />
      </Link>

      <SignInCard next={next} />
    </div>
  )
}
