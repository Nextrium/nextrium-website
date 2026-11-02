import { redirect } from 'next/navigation'
import { isReportId } from '@/lib/reportAccess'
import AccessClient from './AccessClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Verify your access', robots: { index: false, follow: false } }

interface Props {
  searchParams: Promise<{ report?: string | string[] }>
}

// This page never checks a session, so the report page's redirect here can't loop.
export default async function ReportAccessPage({ searchParams }: Props) {
  const { report } = await searchParams
  if (!isReportId(report)) redirect('/feedback')
  return <AccessClient reportId={report.toUpperCase()} />
}
