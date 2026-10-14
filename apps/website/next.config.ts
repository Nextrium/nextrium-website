import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Shared workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: ['@nextrium/supabase', '@nextrium/email', '@nextrium/contributions-core', '@nextrium/utils', '@nextrium/brand'],
}

export default nextConfig
