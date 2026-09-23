import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getVerifiedDashboardRole } from '@/lib/dashboard/getRole'
import { STAFF_ROLES } from '@/lib/dashboard/requireRole'

export async function GET(request: NextRequest) {
  // Applicant CVs are personal data. Only staff who can open the
  // Applications page may download them, with a verified session (this route
  // is not covered by proxy.ts).
  const role = await getVerifiedDashboardRole()
  if (!STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')

  if (!path) {
    return NextResponse.json({ error: 'No path provided' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Extract file path from full Supabase storage URL
  // Input: https://...supabase.co/storage/v1/object/public/documents/applications/file.pdf
  // Output: applications/file.pdf
  let filePath = path

  if (path.includes('/storage/v1/object/')) {
    const parts = path.split('/storage/v1/object/')
    if (parts[1]) {
      // Remove "public/documents/" or "sign/documents/" prefix
      const withoutVisibility = parts[1].replace(/^(public|sign)\//, '')
      // Remove bucket name "documents/"
      filePath = withoutVisibility.replace(/^documents\//, '')
    }
  }

  // Only files the application form itself stores; no traversal.
  if (!filePath.startsWith('applications/') || filePath.includes('..') || filePath.includes('\\')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const { data, error } = await supabase
    .storage
    .from('documents')
    .createSignedUrl(filePath, 120) // 2 minutes expiry

  if (error || !data?.signedUrl) {
    console.error('Signed URL error:', error)
    return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
