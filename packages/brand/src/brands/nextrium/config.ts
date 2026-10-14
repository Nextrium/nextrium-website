import type { BrandConfig } from '../../types'
import Mark from './Mark'

const domain = 'nextrium.org'

export const nextrium: BrandConfig = {
  slug: 'nextrium',
  name: 'Nextrium',
  styledName: 'NexTrium',
  wordmark: { before: 'Nex', accent: 'T', after: 'rium' },
  legalName: 'Nextrium Global Innovations Ltd',
  styledLegalName: 'NexTrium Global Innovations Ltd',
  tagline: 'Innovation. Incubation. Impact.',
  description: 'An innovation company designing products, infrastructure, and ventures for emerging markets and beyond.',
  address: {
    full: '69 Abeokuta Street, Ilaje Bariga, Lagos 100223, Nigeria',
    short: 'Lagos, Nigeria',
  },
  urls: {
    website: 'https://www.nextrium.org',
    websiteDisplay: 'nextrium.org',
    dashboard: 'https://dashboard.nextrium.org',
    contribute: 'https://contribute.nextrium.org',
  },
  emailDomain: domain,
  emails: {
    hello: `hello@${domain}`,
    careers: `careers@${domain}`,
    operations: `operations@${domain}`,
    contributors: `contributors@${domain}`,
  },
  teams: {
    talent: 'Nextrium Talent Team',
    operations: 'Nextrium Operations',
    contributors: 'Nextrium Contributor Program',
  },
  email: {
    defaultSignatureName: 'The Nextrium Team',
    defaultSignatureTitle: 'Nextrium Global Innovations Ltd',
  },
  community: { discordServer: 'Nextrium Discord server' },
  colors: {
    '--navy-deep': '#071628',
    '--navy': '#0D233D',
    '--navy-mid': '#163352',
    '--orange': '#DB6727',
    '--orange-w': '#E8843A',
    '--orange-f': '#C4521A',
    '--teal': '#0A8B8B',
    '--teal-l': '#12B3B3',
    '--gold': '#D4A843',
    '--gold-l': '#E8C06A',
    '--slate': '#4A6FA5',
    '--slate-l': '#6B8FC4',
    '--black': '#060E18',
    '--grey-dark': '#2E3F54',
    '--grey-mid': '#8A9BB0',
    '--grey-light': '#E2E6ED',
    '--off-white': '#F5F6F8',
    '--white': '#FFFFFF',
    '--success': '#22C17A',
    '--warning': '#D4A843',
    '--error': '#E84545',
  },
  Mark,
}
