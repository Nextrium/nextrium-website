import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BRANDS, brandCssVariables, color } from './index'

// Tokens every app's CSS relies on; a brand missing one would render unstyled parts.
const REQUIRED_TOKENS = ['--navy-deep', '--navy', '--navy-mid', '--orange', '--orange-w', '--orange-f', '--grey-dark', '--grey-mid', '--grey-light', '--off-white', '--white', '--success', '--warning', '--error']

for (const [slug, b] of Object.entries(BRANDS)) {
  test(`${slug}: identity fields are filled in`, () => {
    assert.equal(b.slug, slug)
    for (const v of [b.name, b.styledName, b.legalName, b.styledLegalName, b.tagline, b.description, b.address.full, b.address.short,
      b.emailDomain, b.teams.talent, b.teams.operations, b.teams.contributors, b.email.defaultSignatureName,
      b.email.defaultSignatureTitle, b.community.discordServer]) {
      assert.ok(typeof v === 'string' && v.trim().length > 0)
    }
    assert.equal(b.wordmark.before + b.wordmark.accent + b.wordmark.after, b.styledName)
  })

  test(`${slug}: urls are https and email addresses use the email domain`, () => {
    for (const u of Object.values(b.urls).filter((u) => u.startsWith('http'))) assert.match(u, /^https:\/\//)
    for (const e of Object.values(b.emails)) assert.ok(e.endsWith(`@${b.emailDomain}`), e)
  })

  test(`${slug}: has every required colour token as a hex value`, () => {
    for (const t of REQUIRED_TOKENS) assert.match(b.colors[t] ?? '', /^#[0-9a-f]{6}$/i, t)
  })
}

test('brandCssVariables writes every token to :root', () => {
  const css = brandCssVariables()
  assert.ok(css.startsWith(':root{'))
  assert.ok(css.includes('--orange:'))
})

test('color() returns a token value and refuses unknown tokens', () => {
  assert.match(color('--orange'), /^#/)
  assert.throws(() => color('--not-a-token'))
})
