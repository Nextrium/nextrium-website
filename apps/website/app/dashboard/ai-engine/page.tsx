import Header from '@/components/dashboard/Header'
import AIEngineClient from './AIEngineClient'

export const metadata = { title: 'AI Engine' }
export const dynamic = 'force-dynamic'

// Previously awaited getAgentMetrics() here, which calls out to the
// Render-hosted agents-engine and can take up to ~50s on a cold start —
// that blocked this page's entire first paint on a call with no visible
// feedback in the meantime. The page now renders immediately with no
// metrics; AIEngineClient fetches them client-side right after mount and
// shows its own loading state while that's in flight (see its useEffect).
export default function AIEnginePage() {
  return (
    <>
      <Header title="AI Engine" description="Monitor and manage Nextrium's AI agents" />
      <div className="dash-content">
        <AIEngineClient initialMetrics={null} initialError={null} />
      </div>
    </>
  )
}
