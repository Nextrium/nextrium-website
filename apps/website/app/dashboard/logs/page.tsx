import Header from '@/components/dashboard/Header'
import LogsClient from './LogsClient'
import { getTeamActivityLogs, getRecentAgentRuns } from './actions'

export const metadata = { title: 'Activity Logs' }
export const dynamic = 'force-dynamic'

export default async function LogsPage() {
  const [{ logs, error }, { runs, error: runsError }] = await Promise.all([
    getTeamActivityLogs({ limit: 50 }),
    getRecentAgentRuns(),
  ])

  return (
    <>
      <Header title="Activity Logs" description="Team actions and AI agent processing history" />
      <div className="dash-content">
        <LogsClient
          initialLogs={logs}
          initialError={error ?? null}
          initialRuns={runs}
          initialRunsError={runsError ?? null}
        />
      </div>
    </>
  )
}
