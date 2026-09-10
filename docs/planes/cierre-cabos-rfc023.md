# Plan — Cierre: desbloquear la compuerta y normalizar `revalidatePath`

**Rama:** `fix/cabos-rfc023-y-limpieza-de-tests`, la misma. No se crea rama nueva: esto cierra el
trabajo que ya está ahí, antes de que se consolide.

**Es corto y el Paso 1 es bloqueante:** la rama **no pasa la compuerta de CI** hoy.

---

## Por qué existe este plan

La ronda anterior salió correcta en las cuatro cosas que el plan pedía —guarda bajo bloqueo, backfill,
`limpiarBase()` en las 18 suites, factory y mock—, con 393 tests en verde y el mismo conteo en cuatro
corridas consecutivas con reordenamiento. Lo que falló fue la **verificación**, no la construcción:

*   `package.json` define `"lint": "eslint"`, **sin** `--max-warnings 0`.
*   La compuerta corre `pnpm exec eslint . --max-warnings 0` (`.github/workflows/compuerta.yml:66`).
*   `pnpm lint` sale con **código 0** aunque haya 75 warnings. La compuerta, con los mismos 75, sale
    en **rojo**.

La ficha decía que `pnpm lint` equivalía al comando de la compuerta. **No era cierto, y ya está
corregido** en `AGENTS.md` y `.claude/CLAUDE.md`.

---

## Lo que ya existe y NO hay que construir

**No se rehace nada de la ronda anterior.** Está verificado y correcto:

| Qué | Dónde | Estado |
| :--- | :--- | :--- |
| `limpiarBase()` | `src/shared/db/testCleanup.ts` | Correcto, orden topológico y `categories` en dos pasos. **No tocar** |
| Conversión de las 18 suites | las 18 `*.test.ts` | Completa. Los cinco `db.delete(...).where(...)` dirigidos quedaron intactos, como correspondía |
| `subscriptionRepository.findByIdForUpdate` | `subscriptionRepository.ts:60` | Correcto, copia el molde de `accountRepository` |
| La guarda releída | `resolveSubscriptionAction.ts:137-147` | Correcta, y `freshSub` se usa en **todas** las lecturas posteriores |
| Backfill 0026 | `drizzle/migrations/0026_*.sql` | Contrastado contra `ocurrenciaN`: coincide en las tres frecuencias (7·ic días, 3·ic meses, ic meses) |
| `makeSubscription` | `subscriptions/testing/subscriptionFactory.ts` | Correcto, tres consumidores |

---

## Pasos

### Paso 1 — Los 75 imports huérfanos (bloqueante)

Al reemplazar los bloques de `db.delete( tabla )` por `limpiarBase()`, los `import` de esas tablas
quedaron sin usar. Lo mismo con los helpers que dejaron de usarse al mover el factory. Son **75
símbolos en 18 archivos**, todos `@typescript-eslint/no-unused-vars`, todos en `*.test.ts`.

**El comando que los lista, y el mismo que hay que dejar en verde:**

```bash
pnpm exec eslint . --max-warnings 0
```

Reparto por archivo, para que no falte ninguno:

```
 8  src/features/subscriptions/repositories/subscriptionRepository.test.ts
 7  src/features/contacts/repositories/contactsRepository.test.ts
 6  src/features/accounting/repositories/monthlySummaryRepository.test.ts
 6  src/features/contacts/actions/contactsActions.test.ts
 5  src/features/accounting/services/outboxDispatcher.test.ts
 5  src/features/auth/repositories/userRepository.test.ts
 5  src/features/cards/repositories/cardsRepository.test.ts
 5  src/features/transactions/actions/transactionsActions.test.ts
 5  src/shared/lib/auth.test.ts
 4  src/features/accounting/actions/categoryActions.test.ts
 4  src/features/accounting/repositories/ledgerRepository.test.ts
 4  src/features/subscriptions/actions/resolveSubscriptionAction.test.ts
 3  src/features/cards/actions/cardsActions.test.ts
 3  src/features/cards/services/cardCycleService.test.ts
 2  src/features/accounting/actions/accountingActions.test.ts
 1  src/features/accounting/services/accountingService.test.ts
 1  src/features/subscriptions/services/recurrenceService.test.ts
 1  src/features/subscriptions/utils/calculations.test.ts
```

**`eslint --fix` NO arregla esto** — `no-unused-vars` no es autofixable. Van a mano, uno por uno.

**La trampa:** varios de esos imports **sí se siguen usando** más abajo en el mismo archivo, en un
`db.insert( ... )` que arma el escenario o en un `db.select( ... )` que comprueba el resultado. Borrar
el import entero porque el nombre aparece en la lista rompe el archivo. **Borrá sólo los símbolos que
eslint nombra, y dejá el `import` en pie si le quedan otros.** El typecheck es la red: si borraste de
más, `pnpm exec tsc --noEmit` lo dice.

**Nada de silenciar con `eslint-disable`, ni de renombrar a `_tabla`.** Los imports sobran de verdad;
se van.

### Paso 2 — Las tres llamadas de `cardsActions.ts`

`revalidatePath( "/cards" )` en las líneas **100, 178 y 253** no revalida nada: es un **no-op
silencioso**.

**La razón, que es lo contrario de lo que dice hoy la deuda §7:** la documentación de Next 16 es
explícita en que `revalidatePath` *"operates on the route file structure, not the URL visible to
users"*, y da el ejemplo `revalidatePath('/(main)/blog/[slug]', 'page')` — **con el grupo de rutas
adentro**. Además, si el path lleva un segmento dinámico, el segundo parámetro es **obligatorio**.

O sea que las once llamadas del resto del repo, `revalidatePath( "/[lang]/(main)/<ruta>" , "page" )`,
**están bien**: reflejan `src/app/[lang]/(main)/<ruta>/page.tsx`, que es el archivo real. La que está
mal es `/cards`, que no corresponde a ningún archivo de ruta.

**Qué hacer:** las tres pasan a `revalidatePath( "/[lang]/(main)/cards" , "page" )`. Verificá que el
archivo sea `src/app/[lang]/(main)/cards/page.tsx` antes de escribir la ruta; si la carpeta real
difiere, mandá el path que refleje la carpeta, no el que dice este plan.

**No inventar el locale.** No hay que resolver `/es/cards` ni pasar el idioma por parámetro: el
patrón literal con `[lang]` es lo correcto, y `type: "page"` hace que cubra todos los idiomas.

`cardsActions.test.ts` ya tiene el mock global de `next/cache`; si algún caso afirma sobre el
argumento de `revalidatePath`, actualizá el esperado.

### Paso 3 — Documentación, en el mismo commit

*   **`TECHNICAL_DEBT.md` §7:** reescribir el ítem. El texto actual dice que las demás acciones usan
    *"la convención localizada"* y que `cardsActions` **debe normalizarse**; con el Paso 2 el ítem
    queda **resuelto**, y el motivo que hay que dejar escrito es el de la doc de Next (estructura de
    archivos, no URL), no el del locale. Pasalo a § Resuelto con esa explicación.
*   **`TECHNICAL_DEBT.md` § Abierto**, dos ítems nuevos que salieron de la revisión y **no** se
    arreglan en esta ronda:
    *   **El mock de `next/cache` sólo expone `revalidatePath`** (`vitest.setup.mocks.ts`). El día que
        alguien use `revalidateTag` o `updateTag` va a recibir `undefined` y un error confuso.
    *   **La migración 0026 no filtra por `resolved_through`**: pisa lo que dejó la 0025 en todas las
        filas de esas frecuencias. Inocuo acá porque no hay producción y la 0025 se aplicó el mismo
        día, pero sobre una base en uso **retrocedería punteros que el usuario ya avanzó** desde la
        bandeja, y las ocurrencias confirmadas reaparecerían.
*   **`trabajo-en-vuelo.md`:** rama, estado y próximo paso, en este mismo commit.

---

## Verificación

**El comando de lint cambia: es el de la compuerta, no el script.**

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit | grep -c "error TS"
pnpm build
```

Y la quinta, que sigue valiendo mientras se toquen archivos de test:

```bash
pnpm test && pnpm test
```

El punto de partida es **53 archivos / 393 tests**, idéntico en cuatro corridas consecutivas. Este
plan **no agrega tests**: si el número se mueve, algo se rompió en el Paso 1 y hay que mirarlo.

`pnpm exec eslint . --max-warnings 0` tiene que salir con **código 0 y sin la línea "ESLint found too
many warnings"**. El reporte **pega la salida**, no la describe.

---

## Lo que NO entra

*   **Tocar `limpiarBase()`, la guarda releída, el backfill o el factory.** Están verificados.
*   **Agregar `--max-warnings 0` al script `lint` de `package.json`.** Alinearlo con la compuerta es
    razonable, pero cambia el comando que corre todo el mundo y merece su propia decisión.
*   **Los 75 warnings que puedan existir fuera de `src/`.** El reparto de arriba es el total: 18
    archivos, todos de test. Si aparece uno en otro lado, es que algo más cambió — reportalo, no lo
    arregles de callado.
*   **El resto de la deuda abierta:** `getNextCode`, desarchivado en cascada, signo de los pasivos,
    `formatCents`.
