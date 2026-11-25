# Nextrium Website Platform — Guidance for Assistants

Read and follow [`AGENTS.md`](AGENTS.md) in this repository alongside the private company-wide protocol in `../internal-docs/engineering/operational-protocol.md` and `../internal-docs/projects/nextrium-website/README.md`.

Key reminders:
- Work on `develop` only (never `main`); use **Create a merge commit** for `develop` into `main`.
- Keep commit and PR descriptions short, plain-language, and free of AI or `Co-Authored-By` lines.
- Never commit secrets, internal docs, or SQL schema files (`supabase/schema.sql`).
- Database changes are additive-only by default; report and get explicit owner approval before any unavoidable `DROP` in any environment.
- Before reporting any task done, verify: security review (defensive & offensive + the seven access checks), unit/regression/edge/negative tests, E2E + desktop & mobile responsiveness checks in a real browser for UI changes, `npm run type-check`, `npm run brand:check`, and production build.
