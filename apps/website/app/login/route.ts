import type { NextRequest } from 'next/server'
import { toDashboard } from '@/lib/dashboardRedirect'

// Moved to the dashboard's domain; the query string (e.g. an invite token) is kept.
export async function GET(request: NextRequest) {
  return toDashboard(request, '/login')
}
