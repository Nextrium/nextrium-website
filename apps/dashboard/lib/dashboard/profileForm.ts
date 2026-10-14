import { splitSkills } from '@nextrium/contributions-core/profile'

export interface ContributorValues {
  displayName: string
  categories: string[]
  skillsText: string
  availability: string
  notifyEmail: boolean
}

export interface ProfileValues {
  bio: string
  handles: Record<string, string>
  contributor: ContributorValues | null
}

function normalise(v: ProfileValues) {
  const handles: Record<string, string> = {}
  for (const [k, val] of Object.entries(v.handles)) {
    const t = (val ?? '').trim()
    if (t) handles[k] = t
  }
  const c = v.contributor
  return {
    bio: v.bio.trim(),
    handles: Object.keys(handles).sort().map((k) => `${k}=${handles[k]}`).join('\n'),
    contributor: c ? [
      c.displayName.trim(),
      [...c.categories].sort().join(','),
      splitSkills(c.skillsText).join(','),
      c.availability.trim(),
      String(c.notifyEmail),
    ].join('|') : '',
  }
}

/** True when the form differs from what was last saved, ignoring whitespace and order-only changes. */
export function profileHasChanges(saved: ProfileValues, current: ProfileValues): boolean {
  const a = normalise(saved)
  const b = normalise(current)
  return a.bio !== b.bio || a.handles !== b.handles || a.contributor !== b.contributor
}
