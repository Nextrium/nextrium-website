// AI Engine-specific instant-navigation skeleton. This page's real content
// is gated on a call to the external, Render-hosted agents-engine service
// which can legitimately take up to ~50s on a cold start (see page.tsx /
// getAgentMetrics) — showing a skeleton immediately, rather than nothing,
// matters most here since the wait can be by far the longest in the app.
export default function AIEngineLoading() {
  return (
    <>
      <style>{`
        @keyframes ai-skel-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        .ai-skel-header { height: 64px; background: var(--navy); border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; padding: 0 32px; }
        .ai-skel-title { width: 140px; height: 18px; background: rgba(255,255,255,0.08); animation: ai-skel-pulse 1.4s ease-in-out infinite; }
        .ai-skel-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .ai-skel-card { height: 84px; background: rgba(255,255,255,0.05); animation: ai-skel-pulse 1.4s ease-in-out infinite; }
        .ai-skel-block { height: 220px; background: rgba(255,255,255,0.04); animation: ai-skel-pulse 1.4s ease-in-out infinite; }
      `}</style>
      <div className="ai-skel-header"><div className="ai-skel-title" /></div>
      <div className="dash-content">
        <div className="ai-skel-cards">
          <div className="ai-skel-card" />
          <div className="ai-skel-card" />
          <div className="ai-skel-card" />
          <div className="ai-skel-card" />
        </div>
        <div className="ai-skel-block" />
      </div>
    </>
  )
}
