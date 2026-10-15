import PublicShell from '@/components/PublicShell'
import PageSkeleton from '@/components/PageSkeleton'

// Public pages: keep the header in place while the next page loads.
export default function Loading() {
  return (
    <PublicShell signedIn={null}>
      <PageSkeleton wide />
    </PublicShell>
  )
}
