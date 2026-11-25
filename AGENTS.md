# Nextrium Website Platform — Engineering & Assistant Rules

This repository is a **public** npm-workspaces monorepo hosting three Next.js apps (`apps/website`, `apps/dashboard`, `apps/contribute`) and six shared packages (`packages/*`).

Private operational notes, plans, and phase security reviews live in the private organization docs repository (`../internal-docs/projects/nextrium-website/README.md` and `../internal-docs/engineering/operational-protocol.md`). Never copy internal docs, private plans, security reviews, or secrets into this public repository.

## 1. Branch & Git Workflow
- **Work only on `develop`.** Never commit directly to `main`.
- **Merging `develop` into `main`:** Use a PR with **Create a merge commit** (never squash or rebase-merge).
- **Commits & PRs:** Keep commit messages and PR descriptions short, clear, human-readable, and non-technical. Never include AI or `Co-Authored-By` lines.
- **No silent regressions:** Never weaken tests or security controls, and never remove or alter existing intended behavior without explicit owner approval.

## 2. Architecture & Stack Boundaries
- **Existing stack:** npm workspaces, Next.js 16 / React 19, TypeScript, Vercel, two separate Supabase projects, and Render services.
- **Two separate Supabase databases:**
  - Main project (`@nextrium/supabase/server`): backs `apps/website` and `apps/dashboard` (internal staff, content, applications, internal tasks). One row per person in `dashboard_users` (role + `is_team_member` flag); all active dashboard roles can contribute with contributor tables linked to `auth.users(id)`.
  - Community project (`@nextrium/supabase/community/server`): backs `apps/contribute` and `/portal/*` admin pages inside `apps/dashboard`.
- **Database rules:** Never commit SQL schema or migration files to Git (`supabase/schema.sql` is gitignored). Changes must be additive-only by default; any genuinely unavoidable `DROP` in any environment requires explicit owner approval first.
- **Multi-brand isolation:** Never hard-code brand names, domains, email domains, or brand colors outside marketing copy or approved data-key exemptions (`scripts/brand-exempt.json`). Read brand tokens from `@nextrium/brand` and keep `npm run brand:check` passing.
- **Dashboard UI contrast:** Never use `var(--grey-dark)` for dashboard text (unreadable on navy backgrounds).
- **CI workflows:** Keep `.github/workflows/aegis.yml` and `.github/dependabot.yml` intact; pin all GitHub Actions and reusable workflows to full 40-character commit SHAs.

## 3. Mandatory Security & Full Verification Gate
Security is a hard requirement on every feature and change—never an afterthought. Before marking any task complete:
1. **Security & edge-case review (defensive and offensive):** Verify all server actions and API routes check identity and specific roles fresh on the server (`getVerifiedIdentity()` / `getVerifiedDashboardRole()` / `roleDenial()`), fail closed, prevent redirect loops, sanitize HTML/links, validate inputs at every boundary, and guard against injection, XSS, SSRF, and unauthorized access.
2. **Automated tests:** Add and pass unit, regression, edge-case, and negative/unauthorized tests (`npm test`).
3. **End-to-end & browser checks:** Run E2E checks and test UI changes in a real browser. Report honestly if any check could not be run and why.
4. **Typecheck, production build & brand check:** Confirm `npm run type-check`, `npm run brand:check`, and affected `npm run build:*` commands all pass.
