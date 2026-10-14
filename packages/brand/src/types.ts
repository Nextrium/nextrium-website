import type { ComponentType } from 'react'

export interface MarkProps {
  size?: number
  bodyColor?: string
  accentColor?: string
  className?: string
}

/**
 * Everything user-facing that identifies a brand. Apps and packages read
 * these instead of hard-coding names, addresses, domains or colours, so a
 * deployment can assume another brand by setting NEXT_PUBLIC_BRAND.
 */
export interface BrandConfig {
  slug: string
  /** Plain name used in sentences: "Join the Nextrium Discord server". */
  name: string
  /** Name as it appears in logos and headers. */
  styledName: string
  /** Wordmark split: the letters drawn in the accent colour. */
  wordmark: { before: string; accent: string; after: string }
  /** Formal company name, used in sender names, signatures and reports. */
  legalName: string
  /** Company name as styled in page titles, share cards, headers and email footers. */
  styledLegalName: string
  tagline: string
  description: string
  address: { full: string; short: string }
  urls: {
    website: string
    websiteDisplay: string
    dashboard: string
    contribute: string
  }
  /** Domain used to build addresses like hello@<domain>. */
  emailDomain: string
  emails: {
    hello: string
    careers: string
    operations: string
    contributors: string
  }
  teams: {
    talent: string
    operations: string
    contributors: string
  }
  email: {
    defaultSignatureName: string
    defaultSignatureTitle: string
  }
  community: { discordServer: string }
  /** CSS custom properties written to :root by each app (token names are platform-wide). */
  colors: Record<string, string>
  Mark: ComponentType<MarkProps>
}
