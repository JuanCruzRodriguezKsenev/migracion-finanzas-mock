---
name: trampas-del-seed
description: seed.ts miente en tres dimensiones — su limpieza queda atrás de cada feature nueva, nunca escribió occurredAt, y su "historial" de doce meses no existe.
metadata:
  type: project
---

# `src/shared/db/seed.ts` — tres trampas, verificadas el 2026-09-21

Se descubrieron las tres de una, cuando `obra` frenó en el paso del seed del plan de los resúmenes
mensuales. Ver [[trampas-del-repo]] y [[estado-actual]].

## 1. La limpieza queda atrás de cada feature nueva, y nadie lo nota

`pnpm db:seed` **estaba roto** y nadie lo sabía: fallaba con
`23503 … still referenced from table "loan_accounts"`. La lista de `db.delete()` de `:43-53` no se
actualizó cuando entraron préstamos, contactos y planes de cuotas.

**Why:** el seed es lo único que no corre en CI ni en la batería, así que una feature nueva con FK
contra `accounts`, `categories`, `cards` o `financial_entities` lo rompe en silencio hasta que
alguien lo ejecuta a mano.

**How to apply:** **cada plan que agrega una tabla con FK tiene que nombrar dos listas, no una**:
`testCleanup.ts` (`limpiarBase()`) **y** la limpieza de `seed.ts`. Y el orden se saca de la base, no
de la cabeza:

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -t -c "
SELECT tc.table_name || ' -> ' || ccu.table_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' ORDER BY 1 ;"
```

`outbox_events` **nunca estuvo** en esa lista: acumula una fila por transacción desde siempre.

## 2. El seed nunca escribió `occurredAt` — y todo el repo lee ese campo

`createLedgerTransaction` **acepta `occurredAt`** desde siempre (`accountingService.ts:34,55`;
`types.ts:51`). El helper `registrarTransaccion` no se lo pasaba: retocaba `createdAt` con dos
`UPDATE` posteriores. Y `ledgerTransactions.createdAt` **no lo lee nadie** — el único consumidor es
el *fallback* `tx.occurredAt || tx.createdAt` de `dashboardMetrics.ts:60,82`.

Todo lo demás filtra, ordena y pagina por `occurredAt`: `ledgerRepository.ts:240,250,306,320,384`.

**Consecuencia que conviene recordar:** hasta el arreglo, `/transactions` mostró **todo** el historial
sembrado con la fecha del día en que se corrió el seed. Cualquier captura, recuerdo o bug anterior al
2026-09-21 que hable de fechas del listado hay que releerlo con eso en la mano.

## 3. Los «doce meses de historia» no existían

El bucle diario de `:479` cubre **sólo el mes en curso**. La historia previa eran once filas de
`monthly_summaries` inventadas con `Math.random()`, más una transacción de «ajuste de saldos» cuyo
monto era la **suma de esos `Math.random()`** — un contrapeso para que `accounts.balance` cuadrara con
la ficción.

**How to apply:** antes de escribir «el seed ya siembra X», abrí el bucle y mirá su rango. Este plan
se entregó con la premisa «derivar después de sembrar las transacciones históricas» y no había
ninguna. **Decisión del usuario (2026-09-21):** el seed pasa a generar doce meses reales envolviendo
el generador diario en un bucle de meses (~580 transacciones, 15-30 s). Se descartó dejar el pasado
plano porque reproduce el síntoma que abrió la ronda.

## Y una consecuencia operativa

**Un seed que falla a mitad deja la base a medio limpiar.** El 2026-09-21 quedó con 73 `accounts` y
67 `categories` vivas y `ledger_transactions`, `ledger_entries`, `monthly_summaries`, `cards` y
`subscriptions` en cero. No rompe la suite —los tests usan `limpiarBase()`— pero deja el dashboard
vacío hasta que el seed vuelva a correr entero.
