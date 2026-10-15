import { C, tint } from '@/lib/theme'

// Instant placeholder shown the moment a link is clicked, while the next page
// loads on the server. Without it the browser sits on the old page until the
// new one is ready, which feels frozen.
export default function PageSkeleton({ rows = 4, wide = false }: { rows?: number; wide?: boolean }) {
  return (
    <div
      className={wide ? 'max-w-6xl mx-auto px-6 lg:px-10 py-16' : 'max-w-6xl mx-auto px-6 sm:px-8 lg:px-14 py-12 lg:py-16'}
      role="status"
      aria-label="Loading"
    >
      <style>{`
        @keyframes portal-skel-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
        .portal-skel { background: ${tint('--off-white', 5)}; border-radius: 12px; animation: portal-skel-pulse 1.4s ease-in-out infinite; }
      `}</style>
      <div className="portal-skel" style={{ height: 40, width: 'min(320px, 70%)', marginBottom: 14 }} />
      <div className="portal-skel" style={{ height: 14, width: 'min(480px, 90%)', marginBottom: 40 }} />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="portal-skel" style={{ height: 76, border: `1px solid ${C.border}` }} />
        ))}
      </div>
    </div>
  )
}
