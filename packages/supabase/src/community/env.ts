// The community project's connection settings. Non-public env vars: they are
// read on the server only and never shipped to the browser.
export function communityEnv(name: 'COMMUNITY_SUPABASE_URL' | 'COMMUNITY_SUPABASE_PUBLISHABLE_KEY' | 'COMMUNITY_SUPABASE_SECRET_KEY'): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}
