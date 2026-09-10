# Registro de Cierre — Política de mocks de UI, `dict` obligatorio y acceso tolerante a Storage

* **Fecha de consolidación:** 2026-09-10
* **Rama base:** `master`
* **Rango consolidado:** desde `ba8b7ca` hasta el `master` resultante — **11 commits**, de los cuales `90bee72` es el último de trabajo y el que cierra es este mismo registro.
* **Rama fusionada:** `fix/mocks-de-ui-y-dict-obligatorio`, encadenada sobre `master` ya consolidado.
* **Método:** fast-forward puro (`--ff-only`), sin conflictos. `git log --merges` sigue vacío.
* **Resultado global:** **399 tests en 54 archivos de prueba**, 0 fallos; `eslint . --max-warnings 0` con 0 errores y 0 warnings; `pnpm exec tsc --noEmit` en 0 errores corrido como comando propio; build de producción exitoso (generación estática 4/4). **Verificado de forma independiente** por el subagente `verificador` sobre el commit `e5f1e4f` con el árbol limpio y `postgres-dev` vivo, después de que `obra` reportara la ejecución terminada.

La ronda **agregó 6 tests y 1 archivo** respecto de `ba8b7ca` (393 tests en 53 archivos): los seis casos de `safeStorage.test.ts`.

---

## Detalle de lo consolidado

Fueron **dos tandas de ejecución**, porque la primera destapó un defecto de producción que la segunda tuvo que arreglar antes de poder cerrar la suite.

### Tanda 1 — `dict` vuelve a ser obligatorio y el setup deja de mockear código propio
* **Commit del plan:** `fe5e55f`; **ejecución:** `bfaac23`
* Revierte el código relajado que había dejado el hueco del plan del `PageHeader`: `dict` y `lang` vuelven a ser **props obligatorias** de `CategoriesSettingsContainer` (`CategoriesSettingsContainer.tsx:33`), y desaparecen tanto el `FALLBACK_DICT` embebido como su casteo `as unknown as`, que apagaba el typechecker sobre la forma del diccionario.
* El test carga el **diccionario real** con `getDictionary( "es" )` en `beforeAll` y envuelve el render con el **`<NotificationsProvider>` real**, en lugar de mockear el contexto.
* `vitest.setup.mocks.ts` queda reducido a su política declarada: **se mockea el framework, no el proyecto.** Sólo `next/cache` y `next/navigation`; el mock de `NotificationsContext` —código propio— se eliminó del setup global, donde anulaba en silencio la suite de esa feature en los 53 archivos.
* El `routerMock` pasa a ser **estable y aseverable** (`vi.hoisted`), de modo que un test puede espiar `routerMock.refresh()` en vez de recibir un objeto nuevo por invocación.
* **Restricción sintáctica encontrada y documentada:** `export const x = vi.hoisted( ... )` **no compila** — el transformador de vitest corta con `SyntaxError: Cannot export hoisted variable`. Hay que declarar y exportar por separado.
* `patterns.md` estrena el **§12**, montaje de tests de componentes cliente.

**Esta tanda cerró a propósito con 3 tests en rojo** (52/53 suites, 390/393 tests). Montar el provider real destapó que `NotificationsContext` accedía a `localStorage` sin tolerar su ausencia, y bajo jsdom + Node 26 ese global es un accessor que devuelve `undefined`. **El defecto era de producción, no del test**: la decisión fue arreglar el componente, no polyfillear el harness.

### Tanda 2 — `safeStorage` y el cierre de la suite
* **Commit del plan:** `01a8467`; **ejecución:** `e5f1e4f`
* Nace [`src/shared/lib/safeStorage.ts`](../../src/shared/lib/safeStorage.ts) con `readStorage` / `writeStorage`, que toleran los **tres** entornos donde el Storage no está garantizado: SSR (no existe), navegador con Storage bloqueado (**leer la propiedad** lanza `SecurityError`, así que `typeof window !== "undefined"` no alcanza) y jsdom bajo Node (el accessor devuelve `undefined`).
* **Adoptado en los cuatro sitios de producción** que tocaban Storage, que era el radio de impacto completo que el plan había enumerado: `NotificationsContext.tsx`, `MetricsVisibilityContext.tsx`, `ProfileContext.tsx` y `AddSubscriptionModal.tsx`. En los dos últimos reemplazó `try/catch` repetidos y en el primero, guardias `typeof window` que no cubrían el caso real.
* `safeStorage.test.ts` agrega **6 casos**, incluidos los dos que importan: getter que lanza y `localStorage` en `undefined`.
* `patterns.md` §12 suma la **Regla 5 — el Storage no está garantizado**, con su corolario explícito: **el harness de tests no debe polyfillear `localStorage`**; si un componente no monta en jsdom por Storage, el defecto está en el componente.

### Cierre de hallazgos y verificación
* **Commit:** `ece10ba`
* La Regla 5 se había escrito como prohibición absoluta —«nunca `localStorage.getItem` directo»— sin nombrar la **única excepción del repo, que es permanente**: el script anti-flash del `<head>` en [`src/app/[lang]/layout.tsx`](../../src/app/[lang]/layout.tsx), una cadena de JS crudo inyectada por `dangerouslySetInnerHTML`. Está fuera del grafo de módulos, no puede importar el helper, y debe correr **antes** de que hidrate React o el tema parpadea. Cumple la regla por otra vía: su propio `try/catch`. Escrita sin la excepción, la regla era una invitación a que la próxima ronda la «arreglara» al revés y rompiera el anti-flash.

---

## Lo que la ronda dejó abierto, y por qué

* **`NotificationsContext.test.tsx` sigue siendo un marcador de posición** (`expect( true ).toBe( true )`). Anotado en [`TECHNICAL_DEBT.md`](../TECHNICAL_DEBT.md) §7 y **no** resuelto acá: estaba fuera del alcance declarado del plan. Atenuante real: desde esta ronda el contexto **sí** tiene cobertura indirecta de montaje, porque `CategoriesSettingsContainer.test.tsx` lo monta real. Lo que falta es la lógica del store. La trampa para quien escriba esa suite quedó anotada con el ítem: el store vive en **estado mutable de módulo** (`memoryNotifications` y `listeners`), que persiste entre tests del mismo archivo.
* **Las 5 declaraciones de `dict?:` opcional heredadas** en `ContactsTable.tsx:26`, `PaymentMethodsPanel.tsx:45`, `ContactFormModal.tsx:26` y `:43`, y `MonthSelector.tsx:39`. Son menos graves que el caso cerrado acá —shape acotado y sin cast— y quedaron fuera de alcance explícito. Es la continuación natural de esta rama.

### El cabo de proceso
El plan de la tanda 2 predijo **«53 suites / 399 tests»** y `obra` repitió ese número en su informe en vez de la salida real. La corrida dio **54 archivos**: el plan sumó los 6 tests que creaba `safeStorage.test.ts` pero no contó el archivo nuevo que los trae. **No fue defecto de ejecución, fue aritmética del plan** — pero convirtió una corrida sana en una discrepancia que hubo que investigar, y la destapó `verificador`, no el informe.

---

## Estado de las ramas

`fix/mocks-de-ui-y-dict-obligatorio` queda contenida en `master` y **no recibe más trabajo: se puede
borrar**, igual que `feat/bandeja-recurrencias`, `fix/cabos-rfc023-y-limpieza-de-tests` y
`fix/page-header-unico-por-pagina`, las tres ya contenidas desde antes.

**`master` no está pusheado a `origin`.** Con este cierre queda **15 commits por delante de
`origin/master`** (`8e086d9`).
