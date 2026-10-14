import { isValidUrl, normalizeUrl } from '@nextrium/utils/normalizeUrl'

// The contributor application: what the form offers and how a submission is
// checked on the server. The database enforces the same category list and
// limits (valid_categories, check_name_length, check_bio_length).

export const CATEGORIES = [
  { id: 'technical', label: 'Technical', desc: 'Code, infrastructure, SDKs, documentation' },
  { id: 'design', label: 'Design', desc: 'Brand, UI/UX, illustrations, motion' },
  { id: 'community', label: 'Community', desc: 'Outreach, events, coordination' },
  { id: 'research', label: 'Research', desc: 'Product research, analysis, academic work' },
  { id: 'operations', label: 'Operations', desc: 'Legal, finance, project management' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export const MAX_CATEGORIES = 2

export const TIMEZONES = [
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Accra',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Singapore',
] as const

export const AVAILABILITY = [
  { value: 2, label: '1-2 hours per week' },
  { value: 5, label: '3-5 hours per week' },
  { value: 10, label: '6-10 hours per week' },
  { value: 20, label: '10-20 hours per week' },
  { value: 40, label: 'Full time (20+ hours)' },
] as const

export const LIMITS = {
  name: 100,
  teamName: 100,
  location: 100,
  bio: 2000,
  skill: 40,
  skills: 20,
  url: 300,
  wallet: 120,
} as const

/** The fields a contributor controls. Status, points and claim limits are never taken from the form. */
export interface Application {
  name: string
  contributor_type: 'individual' | 'team'
  team_name: string | null
  location: string
  timezone: string
  categories: CategoryId[]
  skills: string[] | null
  availability_hours_per_week: number
  bio: string
  github_handle: string | null
  twitter_handle: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  wallet_address: string | null
  notification_email: boolean
}

export type ParseResult = { ok: true; value: Application } | { ok: false; error: string }

interface FormLike {
  get(name: string): FormDataEntryValue | null
  getAll(name: string): FormDataEntryValue[]
}

const text = (form: FormLike, name: string) => {
  const v = form.get(name)
  return typeof v === 'string' ? v.trim() : ''
}

// Handles: accept "name", "@name" or a profile URL, keep just the name.
function handle(raw: string, hosts: string[], pattern: RegExp): string | null | false {
  if (!raw) return null
  let v = raw.replace(/^@/, '')
  const url = v.match(/^(?:https?:\/\/)?(?:www\.)?([^/]+)\/([^/?#]+)\/?(?:[?#].*)?$/i)
  if (url) {
    if (!hosts.includes(url[1].toLowerCase())) return false
    v = url[2].replace(/^@/, '')
  }
  return pattern.test(v) ? v : false
}

function link(raw: string): string | null | false {
  if (!raw) return null
  if (raw.length > LIMITS.url || !isValidUrl(raw)) return false
  const url = new URL(normalizeUrl(raw))
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  if (url.username || url.password) return false
  url.protocol = 'https:'
  return url.toString()
}

export function parseApplication(form: FormLike): ParseResult {
  const name = text(form, 'name')
  if (name.length < 2) return { ok: false, error: 'Enter your name.' }
  if (name.length > LIMITS.name) return { ok: false, error: `Your name can be at most ${LIMITS.name} characters.` }

  const typeRaw = text(form, 'contributor_type')
  if (typeRaw !== 'individual' && typeRaw !== 'team') return { ok: false, error: 'Choose individual or team.' }
  const contributor_type = typeRaw

  let team_name: string | null = null
  if (contributor_type === 'team') {
    team_name = text(form, 'team_name')
    if (!team_name) return { ok: false, error: 'Enter your team name.' }
    if (team_name.length > LIMITS.teamName) return { ok: false, error: `The team name can be at most ${LIMITS.teamName} characters.` }
  }

  const known = CATEGORIES.map((c) => c.id) as string[]
  const picked = [...new Set(form.getAll('categories').filter((v): v is string => typeof v === 'string'))]
  if (picked.length === 0) return { ok: false, error: 'Choose at least one category.' }
  if (picked.length > MAX_CATEGORIES) return { ok: false, error: `Choose at most ${MAX_CATEGORIES} categories.` }
  if (picked.some((c) => !known.includes(c))) return { ok: false, error: 'Choose categories from the list.' }
  const categories = picked as CategoryId[]

  const profile = parseProfileFields(form)
  if (!profile.ok) return profile

  return { ok: true, value: { name, contributor_type, team_name, categories, ...profile.value } }
}

/** The fields a contributor may change later from their profile. Name, type, team and categories are fixed after approval. */
export type ProfileFields = Omit<Application, 'name' | 'contributor_type' | 'team_name' | 'categories'>

export function parseProfileFields(form: FormLike): { ok: true; value: ProfileFields } | { ok: false; error: string } {
  const location = text(form, 'location')
  if (location.length < 2) return { ok: false, error: 'Enter your location.' }
  if (location.length > LIMITS.location) return { ok: false, error: `Your location can be at most ${LIMITS.location} characters.` }

  const timezone = text(form, 'timezone')
  if (!(TIMEZONES as readonly string[]).includes(timezone)) return { ok: false, error: 'Choose a timezone from the list.' }

  const skillList = text(form, 'skills').split(',').map((s) => s.trim()).filter(Boolean)
  if (skillList.length > LIMITS.skills) return { ok: false, error: `List at most ${LIMITS.skills} skills.` }
  if (skillList.some((s) => s.length > LIMITS.skill)) return { ok: false, error: `Each skill can be at most ${LIMITS.skill} characters.` }
  const skills = skillList.length > 0 ? [...new Set(skillList)] : null

  const hours = Number(text(form, 'availability_hours_per_week'))
  if (!AVAILABILITY.some((a) => a.value === hours)) return { ok: false, error: 'Choose your availability from the list.' }

  const bio = text(form, 'bio')
  if (!bio) return { ok: false, error: 'Tell us about yourself in the bio.' }
  if (bio.length > LIMITS.bio) return { ok: false, error: `The bio can be at most ${LIMITS.bio} characters.` }

  const github_handle = handle(text(form, 'github_handle'), ['github.com'], /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/)
  if (github_handle === false) return { ok: false, error: 'Enter a valid GitHub handle.' }
  const twitter_handle = handle(text(form, 'twitter_handle'), ['twitter.com', 'x.com'], /^[A-Za-z0-9_]{1,15}$/)
  if (twitter_handle === false) return { ok: false, error: 'Enter a valid Twitter / X handle.' }

  const linkedin_url = link(text(form, 'linkedin_url'))
  if (linkedin_url === false) return { ok: false, error: 'Enter a valid LinkedIn URL.' }
  const portfolio_url = link(text(form, 'portfolio_url'))
  if (portfolio_url === false) return { ok: false, error: 'Enter a valid portfolio URL.' }

  const walletRaw = text(form, 'wallet_address')
  if (walletRaw && (walletRaw.length > LIMITS.wallet || !/^[A-Za-z0-9_]+$/.test(walletRaw))) {
    return { ok: false, error: 'Enter a valid wallet address (letters and numbers only).' }
  }

  return {
    ok: true,
    value: {
      location,
      timezone,
      skills,
      availability_hours_per_week: hours,
      bio,
      github_handle,
      twitter_handle,
      linkedin_url,
      portfolio_url,
      wallet_address: walletRaw || null,
      notification_email: form.get('notification_email') === 'on',
    },
  }
}
