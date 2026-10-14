import { createClient } from '@nextrium/supabase/server'
import { notFound, redirect } from 'next/navigation'
import ReportRebuttalClient   from './ReportRebuttalClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ reportId: string }>
}

export default async function RebuttalPage({ params }: Props) {
  const { reportId } = await params
  const supabase     = await createClient()

  const { data: report, error } = await (supabase
    .from('screening_reports') as any)
    .select('id, rebuttal_submitted, rebuttal_locked, dimension_scores')
    .eq('id', reportId.toUpperCase())
    .single()

  if (error || !report) notFound()

  if (report.rebuttal_submitted || report.rebuttal_locked) {
    redirect(`/feedback/${reportId}`)
  }

  const dimensions: string[] = (
    (report.dimension_scores as any)?.dimensionFeedback ?? []
  ).map((d: { dimension: string }) => d.dimension)

  return (
    <ReportRebuttalClient
      reportId={report.id}
      dimensions={dimensions}
    />
  )
}