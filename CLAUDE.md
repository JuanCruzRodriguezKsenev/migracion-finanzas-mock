# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Hard restrictions

- **NEVER read, write, list, search, or access the `migracion/` directory or its contents** under any circumstances without explicit written user authorization. This applies to all tools (Glob, Grep, Read, Bash). See `.agents/AGENTS.md` §1.
- **Use `pnpm` only** — `npm` is prohibited for dependencies and scripts.

## Commands

```bash
pnpm dev              # Next.js dev server (localhost:3000)
pnpm build            # production build
pnpm lint             # eslint
pnpm test             # vitest run (single pass)
pnpm exec vitest      # vitest watch mode
pnpm exec vitest run src/features/accounting/services/accountingService.test.ts   # single test file

pnpm db:generate      # drizzle-kit generate (create migration from schema)
pnpm db:migrate       # apply migrations
pnpm db:studio        # drizzle studio
pnpm db:seed          # seed DB (pnpm tsx src/shared/db/seed.ts)
```

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Drizzle ORM + PostgreSQL (postgres-js) · NextAuth v4 · Zod v4 · Recharts · Vitest.

`DATABASE_URL` is read from `.env.local` (falls back to a local dev Postgres URI in `src/shared/db/client.ts`).

## Architecture

**Feature-Driven.** Business logic lives in `src/features/{feature}/`; `src/app/` pages/layouts are thin visual composers only. `src/shared/` holds cross-cutting scaffolding (no business rules). See `ARCHITECTURE.md`.

- `src/features/{feature}/` — self-contained domain modules. Common layout: `components/`, `services/`, `repositories/`, `actions/` (Server Actions), `schemas/` (Zod), `schema.db.ts` (Drizzle tables), `types.ts`, and colocated `*.test.ts`.
- `src/shared/db/` — central Drizzle client (`client.ts`, HMR-safe singleton pool) and `schema.ts`, which re-exports every feature's `schema.db.ts` so Drizzle Kit sees all tables. Register new tables there.
- `src/shared/ui/`, `src/shared/lib/`, `src/shared/services/` — base UI, low-level utilities, cross-domain services.
- `db` from `client.ts` exports type `DBOrTx` — pass it through repositories/services so code works both inside and outside a transaction.
- The core domain is **double-entry accounting**: accounts, a ledger (`ledgerRepository`), monthly summaries, and `accountingService`. Money is handled in cents.

**Routing & i18n.** Routes are under `src/app/[lang]/` with dictionaries in `src/dictionaries/{en,es,br}.json`. Auth routes under `[lang]/auth/`, API routes under `src/app/api/`.

## Testing

Vitest auto-discovers `*.test.ts(x)` under `src/features/**`, `src/shared/lib/**`, `src/shared/services/**`. Colocate tests beside the code they cover. Default environment is `node`; add `// @vitest-environment jsdom` as the first line for tests needing the DOM.

## Code style (enforced — see `.agents/AGENTS.md` §4)

This repo uses an unusual, strict formatting convention. Match surrounding code exactly:

- **Delimiter spacing:** the outermost delimiter *on a physical line* gets inner spaces (`( expr )`, `{ key: val }`, `[ item ]`); nested delimiters on the same line get none (`(inner)`, `{inner}`).
- One space **before every semicolon** (`const a = 1 ;`) and **around commas** (`func( a , b , c )`).
- Control structures: `if( cond ) {`, `for( it ) {` (inner spaces + space before brace).
- Returns wrapped: `return( expr ) ;`.
- Logical expressions: parenthesize only complex comparisons — `return( (user.role === "admin") || (user.role === "owner") ) ;`.
- **Import blocks:** external libs first; local `@/...` grouped by domain with a descriptive comment per block (e.g. `// Feature: Auth`); within a block, order lines longest→shortest; align simple imports by `from`.
- **Visual grid alignment:** vertically align `=`, `:`, `from`, etc. across similar consecutive lines.
- TSDoc on new public functions/types/interfaces.
- **No fixed px** for structural container dimensions — use fluid units (`clamp()`, `vw`, `%`, …).
- **CSS:** no inline `style={{...}}` except genuinely dynamic runtime values (e.g. a fetched brand color); no Tailwind or utility-class frameworks; every style lives in a colocated `*.module.css` and consumes the design tokens in `src/app/globals.css` (`var(--...)`) rather than hardcoded colors/spacing.

## Naming

React components PascalCase; Drizzle schemas use `.db.ts` suffix; utilities/services/tests camelCase or kebab-case; styles as CSS Modules (`*.module.css`).

## Workflow

Significant structural changes follow an RFC process in `docs/proposals/` (states: DRAFT → APPROVED / REJECTED / SUPERSEDED). Code is written only against an APPROVED proposal. `.agents/AGENTS.md` §7 also mandates an investigate → authorize → detailed plan → final approval flow before writing code.
