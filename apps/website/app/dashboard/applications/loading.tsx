// Applications-specific instant-navigation skeleton. The real page blocks
// on several Supabase queries before it can render anything (see
// page.tsx) — this shows immediately on click so the wait reads as
// "loading the list" rather than "did my click even register."
export default function ApplicationsLoading() {
  return (
    <>
      <style>{`
        @keyframes apps-skel-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        .apps-skel-header { height: 64px; background: var(--navy); border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; padding: 0 32px; }
        .apps-skel-title { width: 140px; height: 18px; background: rgba(255,255,255,0.08); animation: apps-skel-pulse 1.4s ease-in-out infinite; }
        .apps-skel-toolbar { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .apps-skel-bar { height: 34px; background: rgba(255,255,255,0.05); animation: apps-skel-pulse 1.4s ease-in-out infinite; }
        .apps-skel-row { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .apps-skel-name { width: 45%; height: 14px; background: rgba(255,255,255,0.06); animation: apps-skel-pulse 1.4s ease-in-out infinite; }
        .apps-skel-pill { width: 72px; height: 22px; background: rgba(255,255,255,0.06); animation: apps-skel-pulse 1.4s ease-in-out infinite; }
      `}</style>
      <div className="apps-skel-header"><div className="apps-skel-title" /></div>
      <div className="dash-content">
        <div className="apps-skel-toolbar"><div className="apps-skel-bar" /></div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="apps-skel-row">
            <div className="apps-skel-name" />
            <div className="apps-skel-pill" />
          </div>
        ))}
      </div>
    </>
  )
}
