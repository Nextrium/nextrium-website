// Portal palette and type, by role. Every value is a brand token, so the
// portal takes on whichever brand the deployment runs as.

export const C = {
  /** Page background. */
  void: 'var(--navy-deep)',
  /** Cards and panels. */
  depth: 'var(--navy)',
  /** Borders and dividers. */
  border: 'var(--navy-mid)',
  /** Primary accent: buttons, active states, focus. */
  core: 'var(--orange)',
  /** Accent text and icons. */
  accent: 'var(--orange-w)',
  /** Headings and primary text. */
  light: 'var(--off-white)',
  /** Body copy on dark grounds. */
  mist: 'var(--grey-light)',
  /** Secondary text and labels. */
  mute: 'var(--grey-mid)',
  /** Tertiary text: hints and footnotes. */
  dim: 'var(--slate-l)',
  teal: 'var(--teal-l)',
  gold: 'var(--gold-l)',
  info: 'var(--slate-l)',
  danger: 'var(--error)',
  success: 'var(--success)',
} as const

/** A see-through tint of a brand token, e.g. tint('--orange', 12). */
export function tint(token: string, percent: number): string {
  return `color-mix(in srgb, var(${token}) ${percent}%, transparent)`
}

export const F = {
  display: "var(--font-exo2), 'Exo 2', sans-serif",
  body: "var(--font-dm), 'DM Sans', sans-serif",
  mono: "var(--font-mono), 'Space Mono', monospace",
} as const

export const GRADIENT = 'linear-gradient(135deg, var(--orange-w), var(--orange), var(--orange-f))'
