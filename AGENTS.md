# AGENTS.md — FinanzIA

Router de reglas para cualquier agente de IA que trabaje en este repo, sin importar la herramienta.
**Las reglas duras están acá completas; el detalle vive en las rutas que este archivo indica.**

Plataforma SaaS de finanzas con motor de partida doble real. Next.js 16 (App Router) · React 19 ·
TypeScript · Drizzle ORM + PostgreSQL · NextAuth v4 · Zod v4 · Vitest. Arquitectura feature-driven
bajo `src/features/`.

El dominio central es la **contabilidad por partida doble**: cuentas, un libro mayor
(`ledgerRepository`), resúmenes mensuales y `accountingService`, que es el único punto por donde
puede pasar un asiento.

## Reglas duras — rigen aunque no leas nada más

1.  **`migracion/` está prohibido.** No leer, no escribir, no listar, no buscar, con ninguna
    herramienta, sin autorización escrita explícita del usuario.
2.  **`pnpm` únicamente.** `npm` está vedado para dependencias y scripts.
3.  **Código sólo contra propuestas `APPROVED`** en `docs/proposals/`. Las enmiendas quedan en `DRAFT`
    hasta que las apruebe el usuario; no las apruebe el agente.
4.  **El dinero va en centavos enteros** (`bigint`), nunca en punto flotante.
5.  **Toda consulta a la base filtra por `organizationId`.** Omitirlo filtra datos entre
    organizaciones sin producir ningún error visible.
6.  **Debe = Haber.** Ningún asiento se inserta esquivando el servicio contable.
7.  **No se improvisa.** Investigar → autorizar → plan detallado → aprobación final, antes de escribir.
    Detalle en [`.agents/AGENTS.md`](.agents/AGENTS.md) §7.

## Antes de escribir código

Este repo tiene una convención de formato **estricta y poco habitual**: espaciado de delimitadores,
espacio antes de cada `;`, `return( ... ) ;`, imports agrupados y alineados, CSS Modules con tokens,
sin px fijos estructurales y sin movimiento en `:hover`.

**Abrí [`.agents/AGENTS.md`](.agents/AGENTS.md) §4 antes del primer archivo**, y §8 —lo que este
proyecto cobra caro— como chequeo mientras escribís. No alcanza con este resumen: §4 tiene las
reglas completas y §8 los cuatro incidentes que ya costaron bugs.

La forma barata de acertar es mirar el archivo vecino y copiar su disposición.

## Puntos de contacto que no se deducen leyendo el código

*   **Tablas nuevas:** además del `schema.db.ts` de la feature, hay que registrarlas en
    `src/shared/db/schema.ts`, que re-exporta todos los esquemas para que Drizzle Kit los vea. Si no,
    la migración sale vacía sin avisar.
*   **Transacciones:** `db` (`src/shared/db/client.ts`) exporta el tipo `DBOrTx`. Pasalo por
    repositorios y servicios para que el mismo código sirva dentro y fuera de una transacción.
*   **`DATABASE_URL`** se lee de `.env.local`, con fallback a un Postgres local en `client.ts`.
*   **Rutas e i18n:** todo cuelga de `src/app/[lang]/`, con los diccionarios en
    `src/dictionaries/{en,es,br}.json`. Toda cadena visible pasa por ahí, en los tres idiomas.

## Verificación

Los cuatro, siempre los cuatro, y el typecheck **como comando propio**:

```bash
pnpm test                  # vitest — necesita Postgres vivo
pnpm lint                  # eslint --max-warnings 0
pnpm exec tsc --noEmit     # SEPARADO: pnpm build NO tipa los archivos de test
pnpm build                 # producción
```

## Dónde está el resto

| Ruta | Qué tiene |
| :--- | :--- |
| [`.agents/AGENTS.md`](.agents/AGENTS.md) | **Reglas completas.** §1 restricciones · §4 estilo · §7 flujo · §8 lo que el proyecto cobra caro |
| [`docs/trabajo-en-vuelo.md`](docs/trabajo-en-vuelo.md) | Único doc de estado: rama y próximo paso |
| [`docs/patterns.md`](docs/patterns.md) | Patrones vigentes. Contrastar acá toda decisión nueva |
| [`docs/proposals/`](docs/proposals/) | RFCs. Código sólo contra `APPROVED` |
| [`docs/planes/`](docs/planes/) | Planes aprobados listos para ejecutar |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Arquitectura feature-driven |
