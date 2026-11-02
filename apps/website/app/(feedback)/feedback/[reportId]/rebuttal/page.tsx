import { redirect } from 'next/navigation'
import { getAuthorizedReport } from '@/lib/reportSession'
import ReportRebuttalClient   from './ReportRebuttalClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ reportId: string }>
}

export default async function RebuttalPage({ params }: Props) {
  const { reportId } = await params

  const report = await getAuthorizedReport(reportId)
  if (!report) redirect(`/feedback/access?report=${encodeURIComponent(reportId)}`)

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