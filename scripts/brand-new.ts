// Creates a new brand from the Nextrium template and registers it.
// Run: npm run brand:new -- <slug>      (lowercase letters, numbers, dashes)
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const slug = process.argv[2]
if (!slug || !/^[a-z][a-z0-9-]{1,30}$/.test(slug)) {
  console.error('Usage: npm run brand:new -- <slug>   (lowercase letters, numbers, dashes; starts with a letter)')
  process.exit(1)
}
const root = resolve(import.meta.dirname, '..')
const brandsDir = join(root, 'packages', 'brand', 'src', 'brands')
const target = join(brandsDir, slug)
if (existsSync(target)) { console.error(`Brand "${slug}" already exists.`); process.exit(1) }

const ident = slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
cpSync(join(brandsDir, 'nextrium'), target, { recursive: true })

const cfgPath = join(target, 'config.ts')
const cfg = readFileSync(cfgPath, 'utf8')
  .replace('export const nextrium: BrandConfig', `export const ${ident}: BrandConfig`)
  .replace("slug: 'nextrium'", `slug: '${slug}'`)
writeFileSync(cfgPath, `// TODO(${slug}): replace every Nextrium value below with ${slug}'s own.\n` + cfg)

const indexPath = join(root, 'packages', 'brand', 'src', 'index.ts')
const index = readFileSync(indexPath, 'utf8')
  .replace("import { nextrium } from './brands/nextrium/config'", `import { nextrium } from './brands/nextrium/config'\nimport { ${ident} } from './brands/${slug}/config'`)
  .replace('  nextrium,\n}', `  nextrium,\n  '${slug}': ${ident},\n}`)
writeFileSync(indexPath, index)

console.log(`Created brand "${slug}". Next:
  1. Edit packages/brand/src/brands/${slug}/config.ts — names, legal name, tagline, address, urls,
     email domain and addresses, team names, signature, Discord name, colours.
  2. Replace packages/brand/src/brands/${slug}/Mark.tsx with the brand's logo mark.
  3. Replace the icons in packages/brand/src/brands/${slug}/public/ (same file names).
  4. Fonts: if different, change the three next/font calls in each app's app/layout.tsx.
  5. Write the brand's own website pages (marketing copy is brand content).
  6. Deploy any app with NEXT_PUBLIC_BRAND=${slug}, against the brand's own Supabase project.
  7. Run: npm test && npm run brand:check`)
