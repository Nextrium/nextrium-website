import { NextResponse, type NextRequest } from 'next/server'
import { updateCommunitySession } from '@nextrium/supabase/community/proxy'

// Keeps the community session fresh on every page and turns away visitors who
// are not signed in from the pages that need an account. Whether a signed-in
// person is approved is decided on the server by each page and action.
const SIGNED_IN_PATHS = ['/dashboard', '/register']

export async function proxy(request: NextRequest) {
  const { response, user } = await updateCommunitySession(request)
  const path = request.nextUrl.pathname

  if (!user && SIGNED_IN_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    const to = request.nextUrl.clone()
    to.pathname = '/signin'
    to.search = ''
    to.searchParams.set('next', path + request.nextUrl.search)
    const redirect = NextResponse.redirect(to)
    // Carry any cookie changes (e.g. a cleared expired session) onto the redirect.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
