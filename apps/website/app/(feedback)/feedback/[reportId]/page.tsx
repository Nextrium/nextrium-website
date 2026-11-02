import { createServiceClient } from '@nextrium/supabase/server'
import { redirect }     from 'next/navigation'
import { getAuthorizedReport } from '@/lib/reportSession'
import ReportClient     from './ReportClient'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function generateMetadata() {
  return {
    title:  'Evaluation Report',
    robots: { index: false, follow: false },
  }
}

interface Props {
  params: Promise<{ reportId: string }>
}

export default async function ReportPage({ params }: Props) {
  const { reportId } = await params

  // No session, an unknown report and someone else's report all take the same
  // exit, so this page doesn't reveal which report IDs exist.
  const reportData = await getAuthorizedReport(reportId) as any
  if (!reportData) redirect(`/feedback/access?report=${encodeURIComponent(reportId)}`)

  // screening_rebuttals is service_role-only (no public RLS policy) -
  // fetch just the status here, server-side, so the "under review" copy
  // can actually reflect what's happened instead of a static message
  // that never changes once a rebuttal is filed.
  let rebuttalStatus: string | null = null
  if (reportData.rebuttal_submitted) {
    const serviceClient = createServiceClient()
    const { data: rebuttal } = await (serviceClient.from('screening_rebuttals') as any)
      .select('status')
      .eq('report_id', reportData.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    rebuttalStatus = rebuttal?.status ?? null
  }

  return <ReportClient report={reportData} rebuttalStatus={rebuttalStatus} />
}