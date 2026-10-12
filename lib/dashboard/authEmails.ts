// Email addresses for a set of auth users. listUsers() returns one page (50
// by default), so reading only the first page left everyone after it as
// "Unknown"; one getUserById per person avoids that but makes a request per
// row and hits the auth API's rate limit as the team grows. This pages
// through listUsers 1,000 at a time and stops once every id is found.

const PER_PAGE = 1000
const MAX_PAGES = 50

interface AuthAdmin {
  auth: {
    admin: {
      listUsers(params: { page: number; perPage: number }): PromiseLike<{
        data: { users: { id: string; email?: string | null }[] } | null
        error: unknown
      }>
    }
  }
}

export async function getAuthEmails(supabase: AuthAdmin, ids: string[]): Promise<Map<string, string>> {
  const wanted = new Set(ids)
  const emails = new Map<string, string>()
  for (let page = 1; page <= MAX_PAGES && emails.size < wanted.size; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error || !data) break
    for (const u of data.users) if (wanted.has(u.id)) emails.set(u.id, u.email ?? '')
    if (data.users.length < PER_PAGE) break
  }
  return emails
}
