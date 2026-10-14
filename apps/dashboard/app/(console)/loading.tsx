// Generic instant-navigation fallback for every /dashboard/* route that
// doesn't define its own loading.tsx. Without a loading.tsx anywhere in
// this tree, Next.js has no Suspense boundary to show on navigation — the
// browser just sits frozen on the previous page until the entire next page
// (including all its data fetching) finishes, then snaps in all at once.
// This (and the more tailored loading.tsx files on individual routes)
// gives an instant visual response the moment a nav link is clicked.
export default function DashboardLoading() {
  return (
    <div className="dash-content">
      <style>{`
        @keyframes dash-skel-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        .dash-skel { background: rgba(255,255,255,0.05); animation: dash-skel-pulse 1.4s ease-in-out infinite; }
        .dash-skel-title { height: 20px; width: 160px; margin-bottom: 24px; }
        .dash-skel-row { height: 64px; margin-bottom: 8px; }
      `}</style>
      <div className="dash-skel dash-skel-title" />
      <div className="dash-skel dash-skel-row" />
      <div className="dash-skel dash-skel-row" />
      <div className="dash-skel dash-skel-row" />
      <div className="dash-skel dash-skel-row" />
    </div>
  )
}
