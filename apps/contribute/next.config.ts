import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Shared workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: ['@nextrium/supabase', '@nextrium/utils', '@nextrium/brand'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
