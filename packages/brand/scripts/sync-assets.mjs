// Copies the selected brand's public assets (favicons, app icons) into an app's
// public/ folder. Runs inside each app's dev and build scripts, so the deployed
// app always carries the right brand's icons. Brand = NEXT_PUBLIC_BRAND (default nextrium).
// Usage: node ../../packages/brand/scripts/sync-assets.mjs <app-dir>
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const brandSlug = process.env.NEXT_PUBLIC_BRAND || 'nextrium'
const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, '..', 'src', 'brands', brandSlug, 'public')
const appDir = resolve(process.argv[2] || '.')
const target = join(appDir, 'public')

if (!existsSync(source)) {
  console.error(`[brand] No assets for brand "${brandSlug}" at ${source}`)
  process.exit(1)
}
mkdirSync(target, { recursive: true })
const files = readdirSync(source)
for (const f of files) cpSync(join(source, f), join(target, f))
console.log(`[brand] ${brandSlug}: copied ${files.length} asset(s) into ${target}`)
