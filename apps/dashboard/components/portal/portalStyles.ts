// Styles shared by the contributor portal pages, in the dashboard's existing
// visual language (navy panels, mono labels, orange actions).
export const PORTAL_CSS = `
  .pt-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
  .pt-tab { font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase; padding: 8px 14px; border: 1px solid rgba(255,255,255,0.1); color: var(--grey-mid); text-decoration: none; }
  .pt-tab[aria-current="page"] { color: var(--orange); border-color: color-mix(in srgb, var(--orange) 45%, transparent); background: color-mix(in srgb, var(--orange) 8%, transparent); }
  .pt-tab .n { color: var(--off-white); margin-left: 6px; }
  .pt-search { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
  .pt-input { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 13px; padding: 9px 12px; outline: none; min-width: 240px; }
  .pt-input:focus { border-color: var(--orange); }
  .pt-textarea { min-height: 90px; resize: vertical; width: 100%; }
  .pt-table-wrap { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); overflow-x: auto; }
  .pt-table { width: 100%; border-collapse: collapse; }
  .pt-table th { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding: 10px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); white-space: nowrap; }
  .pt-table td { padding: 14px 16px; font-size: 13px; color: var(--off-white); border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
  .pt-table tr:last-child td { border-bottom: none; }
  .pt-table a.title { color: var(--white); text-decoration: none; font-weight: 600; }
  .pt-table a.title:hover { color: var(--orange); }
  .pt-muted { color: var(--grey-mid); font-size: 12px; }
  .pt-badge { align-self: flex-start; font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; display: inline-block; white-space: nowrap; border: 1px solid rgba(255,255,255,0.12); color: var(--grey-mid); }
  .pt-badge.warn { color: var(--orange); border-color: color-mix(in srgb, var(--orange) 35%, transparent); }
  .pt-badge.bad { color: var(--error); border-color: color-mix(in srgb, var(--error) 35%, transparent); }
  .pt-badge.good { color: var(--success); border-color: color-mix(in srgb, var(--success) 30%, transparent); }
  .pt-badge.info { color: var(--slate-l); border-color: color-mix(in srgb, var(--slate-l) 35%, transparent); }
  .pt-empty { padding: 56px 32px; text-align: center; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); color: var(--grey-mid); }
  .pt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .pt-stat { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 18px; text-decoration: none; display: flex; flex-direction: column; gap: 6px; }
  .pt-stat:hover { border-color: color-mix(in srgb, var(--orange) 40%, transparent); }
  .pt-stat .v { font-family: var(--font-exo2); font-weight: 700; font-size: 28px; color: var(--white); line-height: 1; font-variant-numeric: tabular-nums; }
  .pt-stat .v.alert { color: var(--orange); }
  .pt-stat .l { font-size: 12px; color: var(--grey-mid); }
  .pt-layout { display: grid; grid-template-columns: 1fr 320px; gap: 24px; align-items: start; }
  .pt-main { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
  .pt-side { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }
  .pt-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  .pt-panel-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .pt-kv { display: grid; grid-template-columns: 150px 1fr; gap: 12px; font-size: 13px; color: var(--off-white); line-height: 1.6; }
  .pt-kv dt { color: var(--grey-mid); }
  .pt-kv dd { overflow-wrap: anywhere; white-space: pre-wrap; }
  .pt-link { color: var(--orange); overflow-wrap: anywhere; }
  .pt-hint { font-size: 12px; color: var(--grey-mid); line-height: 1.5; }
  .pt-btn { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; padding: 9px 18px; background: var(--orange); border: 1px solid var(--orange); color: var(--white); cursor: pointer; text-decoration: none; display: inline-flex; width: fit-content; }
  .pt-btn:disabled { opacity: 0.6; cursor: default; }
  .pt-btn.ghost { background: none; border-color: rgba(255,255,255,0.12); color: var(--grey-mid); }
  .pt-btn.danger { background: none; border-color: color-mix(in srgb, var(--error) 35%, transparent); color: var(--error); }
  .pt-alert { padding: 10px 14px; font-size: 12px; border: 1px solid; line-height: 1.5; }
  .pt-alert.error { background: color-mix(in srgb, var(--error) 8%, transparent); border-color: color-mix(in srgb, var(--error) 30%, transparent); color: var(--error); }
  .pt-alert.success { background: color-mix(in srgb, var(--success) 8%, transparent); border-color: color-mix(in srgb, var(--success) 30%, transparent); color: var(--success); }
  .pt-alert.info { background: color-mix(in srgb, var(--slate-l) 8%, transparent); border-color: color-mix(in srgb, var(--slate-l) 30%, transparent); color: var(--off-white); }
  @media (max-width: 1100px) { .pt-layout { grid-template-columns: 1fr; } .pt-side { position: static; } }
  @media (max-width: 600px) { .pt-kv { grid-template-columns: 1fr; gap: 2px; } .pt-input { min-width: 0; width: 100%; } }
`
