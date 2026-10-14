'use client'

export default function DashboardSearchBox({
  value,
  onChange,
  placeholder = 'Search...',
  resultCount,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  resultCount?: number
}) {
  return (
    <>
      <style>{`
        .dash-search-box { display: flex; align-items: center; gap: 8px; background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.1); padding: 8px 12px; transition: border-color 0.15s ease; }
        .dash-search-box:focus-within { border-color: var(--orange); }
        .dash-search-icon { font-size: 12px; color: var(--grey-mid); flex-shrink: 0; }
        .dash-search-input { flex: 1; background: none; border: none; outline: none; color: var(--white); font-family: var(--font-dm); font-size: 13px; min-width: 0; }
        .dash-search-input::placeholder { color: var(--grey-mid); }
        .dash-search-clear { background: none; border: none; color: var(--grey-mid); cursor: pointer; font-size: 13px; padding: 0 2px; flex-shrink: 0; }
        .dash-search-clear:hover { color: var(--white); }
        .dash-search-count { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.08em; color: var(--grey-mid); flex-shrink: 0; white-space: nowrap; }
      `}</style>
      <div className="dash-search-box">
        <span className="dash-search-icon">🔍</span>
        <input
          type="text"
          className="dash-search-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button type="button" className="dash-search-clear" onClick={() => onChange('')} aria-label="Clear search">
            ✕
          </button>
        )}
        {typeof resultCount === 'number' && value && (
          <span className="dash-search-count">{resultCount} match{resultCount === 1 ? '' : 'es'}</span>
        )}
      </div>
    </>
  )
}
