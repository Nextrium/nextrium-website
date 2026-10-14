import type { NextRequest } from 'next/server'
import { toDashboard } from '@/lib/dashboardRedirect'

// The dashboard moved to its own domain: /dashboard/x here becomes /x there.
export async function GET(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params
  return toDashboard(request, '/' + path.map(encodeURIComponent).join('/'))
}
