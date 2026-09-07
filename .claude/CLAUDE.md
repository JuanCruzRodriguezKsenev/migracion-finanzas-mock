# Ficha de proyecto — FinanzIA

Esto se autocarga en **toda** sesión, incluida una consulta de dos minutos, y es la fuente que leen
los agentes (`tanda`, `verificador`, `forja`) para orientarse sin barrer el repo.

Para el modo de trabajo por rondas: `claude --agent tanda`. Los agentes son genéricos y viven en
`~/.claude/agents/`; lo específico de este proyecto es esta ficha.

## Proyecto

Plataforma SaaS de finanzas personales y comerciales con **motor de partida doble real**: cada hecho
económico respeta Debe = Haber, validado por divisa dentro de la transacción ACID, y todo monto se
guarda en **centavos enteros** (`bigint`), nunca en punto flotante.

Next.js 16 (App Router) · React 19 · TypeScript · Drizzle ORM + PostgreSQL (postgres-js) ·
NextAuth v4 · Zod v4 · Recharts · Vitest. Arquitectura feature-driven bajo `src/features/`.

Es la migración de dos repos previos en `~/Dev/finanzas/`: **FinanzasMock** aporta el catálogo visual
(17 rutas de UI, sin motor contable) y **FinanceApp-WSL** aporta la infraestructura de operación
(QStash, crons, Resend, Redis, export).

## Comandos

```bash
pnpm dev              # next dev — localhost:3000
pnpm build            # next build
pnpm lint             # eslint
pnpm test             # vitest run (una pasada)
pnpm exec vitest      # modo watch

pnpm db:generate      # drizzle-kit generate — crea migración desde el esquema
pnpm db:migrate       # drizzle-kit migrate
pnpm db:studio        # drizzle-kit studio
pnpm db:seed          # siembra la base
pnpm db:outbox        # dispara el ciclo del Transactional Outbox
```

## Verificación

Los cuatro, siempre los cuatro, y el typecheck **como comando propio**:

```bash
pnpm test                  # vitest. Anotar suites y tests exactos
pnpm lint                  # eslint --max-warnings 0
pnpm exec tsc --noEmit     # SEPARADO. Contar con: | grep -c "error TS"
pnpm build                 # produccion
```

> **`pnpm build` no es typecheck.** `next build` sólo tipa los archivos de su grafo, y **los archivos
> de test no entran**; vitest tampoco tipa. Build verde + tests verdes ya convivieron con `tsc
> --noEmit` roto, que es lo que corre la compuerta CI (`.github/workflows/compuerta.yml:62`) y lo que
> la pondría en rojo. Se reportó una vez como "typecheck completo" y no lo era.

**Entorno:** `pnpm test` necesita Postgres vivo — contenedor `postgres-dev` en podman. Sin él la suite
muere en el setup con `ECONNREFUSED`: eso es **entorno caído, no suite roja**.

Para contrastar el esquema contra la base real:

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d <tabla>"
```

Columnas monetarias en `bigint` (centavos). `year`, `month`, `attempts`, `failed_count` e
`interval_count` **no** son dinero y siguen `integer`.

## Mapa de docs

| Archivo | Qué tiene | Cuándo se toca |
| :--- | :--- | :--- |
| `docs/trabajo-en-vuelo.md` | **Único doc de estado**: rama y próximo paso | Se actualiza **en el mismo commit** que avanza el trabajo |
| `docs/TECHNICAL_DEBT.md` | § Resuelto y § Abierto | Al cerrar o abrir deuda |
| `docs/patterns.md` | Patrones vigentes. **Contrastar acá toda decisión nueva** | Al establecer un patrón |
| `docs/proposals/` | 21 RFCs con estado `DRAFT`/`APPROVED` | Código sólo contra `APPROVED` |
| `docs/adr/`, `docs/registro/` | Decisiones arquitectónicas; ramas cerradas | Al cerrar una rama |
| `docs/ROADMAP.md` | **Desactualizado**: cubre 9 de 23 ítems | La hoja de ruta real es el artifact |
| `ARCHITECTURE.md` | Arquitectura feature-driven | Lectura |
| `.agents/AGENTS.md` | §1 restricciones · §4 estilo · §7 flujo · §8 lo que el proyecto cobra caro | Lectura obligatoria |
| `CLAUDE.md` (raíz) | Comandos, stack, estilo de código, convenciones | Lectura |

## Restricciones

*   **`migracion/` está prohibido** leer, escribir, listar o buscar con cualquier herramienta, sin
    autorización escrita explícita del usuario. Ver `.agents/AGENTS.md` §1.
*   **`pnpm` únicamente.** `npm` está prohibido para dependencias y scripts.
*   **Código sólo contra RFC `APPROVED`** (`docs/proposals/`). Las enmiendas quedan en `DRAFT` hasta
    que el usuario las apruebe; no las apruebe el agente.
*   **Estilo estricto** (`.agents/AGENTS.md` §4): espaciado de delimitadores, `return( ... ) ;`,
    alineación por columnas en imports, CSS Modules con tokens, sin px fijos estructurales, y **nada
    de movimiento ni cambio de dimensiones en `:hover`**.

## Referencias

*   **Hoja de ruta (artifact):** `https://claude.ai/code/artifact/822fe915-443b-41e6-966a-6303036c9f82`
    Las 7 fases y los 23 ítems pendientes. Releerlo con `action: "read"` antes de editarlo y
    republicarlo con su `url` cuando cambie el estado de una fase. No crear uno nuevo.
*   **Repos hermanos:** `~/Dev/finanzas/FinanzasMock` (UI) y `~/Dev/finanzas/FinanceApp-WSL` (infra).
