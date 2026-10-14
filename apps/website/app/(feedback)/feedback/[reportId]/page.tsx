import { createClient, createServiceClient } from '@nextrium/supabase/server'
import { notFound }     from 'next/navigation'
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
  const supabase     = await createClient()

  const { data: report, error } = await supabase
    .from('screening_reports')
    .select('*')
    .eq('id', reportId.toUpperCase())
    .single()

  if (error || !report) notFound()
  const reportData = report as any

  // screening_rebuttals is service_role-only (no public RLS policy), so
  // this candidate-facing page can't read it via the anon client above -
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