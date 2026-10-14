// Fails when a platform file hard-codes any brand's identity: names, website
// domain, email domain or brand colours. Those must come from @nextrium/brand.
// Run: npm run brand:check
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { BRANDS } from '../packages/brand/src/index'

const root = resolve(import.meta.dirname, '..')
const exempt: string[] = JSON.parse(readFileSync(join(root, 'scripts', 'brand-exempt.json'), 'utf8')).paths

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const words = new Set<string>()
const hexes = new Set<string>()
const rgbs = new Set<string>()
for (const b of Object.values(BRANDS)) {
  for (const w of [b.name, b.styledName, b.legalName, b.styledLegalName, b.urls.websiteDisplay, b.emailDomain]) if (w) words.add(w)
  for (const v of Object.values(b.colors)) {
    if (!/^#[0-9a-f]{6}$/i.test(v) || /^#(ffffff|000000)$/i.test(v)) continue
    hexes.add(v.toLowerCase())
    const n = parseInt(v.slice(1), 16)
    rgbs.add(`${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`)
  }
}
// A brand word, unless it is part of an identifier or package name: @nextrium/x, nextrium-role, NEXTRIUM_KEY.
const wordRe = new RegExp(`(?<![@\\w-])(${[...words].map(escape).join('|')})(?![\\w-]|/[\\w])`, 'i')
const hexRe = new RegExp(`(${[...hexes].map(escape).join('|')})(?![0-9a-f])`, 'i')
// A tint of a brand colour: rgba(219, 103, 39, 0.1) must be color-mix(in srgb, var(--orange) 10%, transparent).
const rgbaRe = new RegExp(`rgba\\(\\s*(${[...rgbs].map((t) => t.split(',').join('\\s*,\\s*')).join('|')})\\s*,`, 'i')

const SCAN = ['apps', 'packages']
const SKIP_DIRS = new Set(['node_modules', '.next', 'public'])
const files: string[] = []
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(name)) walk(p) }
    else if (/\.(ts|tsx|css)$/.test(name) && !name.endsWith('.d.ts')) files.push(p)
  }
}
SCAN.forEach((d) => walk(join(root, d)))

const problems: string[] = []
for (const file of files) {
  const rel = relative(root, file).split('\\').join('/')
  if (exempt.some((e) => rel === e || rel.startsWith(e))) continue
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
    const w = line.match(wordRe)
    const h = line.match(hexRe)
    if (w) problems.push(`${rel}:${i + 1}  brand text "${w[1]}"`)
    if (h) problems.push(`${rel}:${i + 1}  brand colour ${h[1]}`)
    const r = line.match(rgbaRe)
    if (r) problems.push(`${rel}:${i + 1}  brand tint rgba(${r[1]}, …)`)
  })
}

if (problems.length) {
  console.error(`brand:check found ${problems.length} hard-coded brand detail(s). Use @nextrium/brand instead:\n`)
  problems.forEach((p) => console.error('  ' + p))
  process.exit(1)
}
console.log(`brand:check passed — ${files.length} files scanned, ${Object.keys(BRANDS).length} brand(s) known.`)
