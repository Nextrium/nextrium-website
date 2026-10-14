'use client'

/**
 * Generic right-side slide-over. Generalized from the mobile Sidebar's
 * fixed-overlay + translateX mechanic (see Sidebar.tsx) — that was the only
 * drawer/modal pattern anywhere in the dashboard before this, so new
 * overlay UI (starting with the Co-Pilot chat) reuses this instead of each
 * feature inventing its own fixed-position/z-index scheme.
 */
export default function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <>
      <style>{`
        .drawer-overlay { display: none; position: fixed; inset: 0; z-index: 59; background: rgba(7,22,40,0.7); backdrop-filter: blur(2px); }
        .drawer-overlay.open { display: block; }
        .drawer-panel {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: 420px; max-width: 100vw; height: 100dvh;
          background: var(--navy); border-left: 1px solid rgba(255,255,255,0.08);
          display: flex; flex-direction: column;
          z-index: 60; transform: translateX(100%);
          transition: transform 0.25s ease;
          box-shadow: -4px 0 32px rgba(0,0,0,0.4);
        }
        .drawer-panel.open { transform: translateX(0); }
        .drawer-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
        }
        .drawer-title {
          font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.12em;
          text-transform: uppercase; color: var(--white);
        }
        .drawer-close {
          background: none; border: none; color: var(--grey-mid); cursor: pointer;
          font-size: 18px; line-height: 1; padding: 4px; transition: color 0.15s ease;
        }
        .drawer-close:hover { color: var(--white); }
        .drawer-body { flex: 1; overflow-y: auto; padding: 20px; }
      `}</style>
      <div className={`drawer-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`drawer-panel ${open ? 'open' : ''}`} role="dialog" aria-hidden={!open}>
        <div className="drawer-header">
          <span className="drawer-title">{title}</span>
          <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  )
}
