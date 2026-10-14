import type { BrandConfig } from './types'
import { nextrium } from './brands/nextrium/config'

export type { BrandConfig, MarkProps } from './types'

// Every brand this platform can be deployed as. `npm run brand:new <slug>` adds one.
export const BRANDS: Record<string, BrandConfig> = {
  nextrium,
}

/**
 * The brand this deployment runs as, chosen at build time by NEXT_PUBLIC_BRAND
 * (default: nextrium). An unknown value stops the build rather than silently
 * shipping the wrong identity.
 */
function selectBrand(): BrandConfig {
  const slug = process.env.NEXT_PUBLIC_BRAND || 'nextrium'
  const selected = BRANDS[slug]
  if (!selected) throw new Error(`Unknown brand "${slug}". Known brands: ${Object.keys(BRANDS).join(', ')}`)
  return selected
}

export const brand: BrandConfig = selectBrand()

/** `:root { --token: value; ... }` for the selected brand, for each app's root layout. */
export function brandCssVariables(b: BrandConfig = brand): string {
  return `:root{${Object.entries(b.colors).map(([k, v]) => `${k}:${v}`).join(';')}}`
}

/** A colour value by token name, for places CSS variables can't reach (e.g. email HTML). */
export function color(token: string, b: BrandConfig = brand): string {
  const value = b.colors[token]
  if (!value) throw new Error(`Brand "${b.slug}" has no colour token ${token}`)
  return value
}
