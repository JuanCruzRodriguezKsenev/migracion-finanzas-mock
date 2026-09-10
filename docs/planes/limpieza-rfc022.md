# Plan — Limpieza de cabos sueltos del RFC 022, antes de consolidar

*   **RFC:** [`../proposals/022-unified-classification.md`](../proposals/022-unified-classification.md) — `APPROVED`.
*   **Rama:** `feat/gestion-categorias`. **No se crea rama nueva:** esto corrige la misma tajada que
    todavía no se consolidó, y la historia del repo es lineal.
*   **Origen:** los cuatro hallazgos de la verificación independiente de la segunda tajada
    (2026-09-10). Ninguno rompe nada hoy; los cuatro son cosas que el plan anterior no nombró.
*   **Línea base verificada** (subagente `verificador`, 2026-09-10, sobre `a71d439`):
    **51 archivos de test, 375 tests, lint 0 errores / 0 warnings, `tsc --noEmit` 0 errores, build
    verde**, con el esquema real contrastado contra `finanzas_db`. Si algo sale en rojo antes de
    tocar nada, es entorno: ver la nota de Verificación al final.

Es una tanda chica y deliberadamente cerrada: **tres correcciones de import/borrado y un test**.
Nada más entra acá. Lo que se decidió **no** arreglar en esta tanda está al final, en *Lo que NO
entra*, y ya quedó anotado en `TECHNICAL_DEBT.md` §4.

---

## Paso 1 — Borrar el tipo muerto `SubscriptionCategory`

`src/features/subscriptions/types.ts:23` define y exporta:

```ts
export type SubscriptionCategory = ...
```

Es el enum de los siete valores viejos (`entertainment`, `productivity`, …) que la migración `0024`
eliminó de la base. **Contraste hecho:** `grep -rn "SubscriptionCategory" src` devuelve **una sola
línea, la propia definición**. No tiene un consumidor. El lint no lo marca porque está exportado.

*   Borrar el tipo.
*   **Verificar antes de borrar** que ningún `index.ts` de la feature lo reexporte
    (`grep -rn "SubscriptionCategory" src`). Si aparece un reexport, borrarlo también.
*   No tocar nada más de `types.ts`: `SubscriptionFormData` y `SubscriptionFrequency` siguen vivos.

## Paso 2 — Que los componentes cliente no importen del repositorio

Dos componentes de cliente traen el tipo `CategoryTreeNode` desde el módulo del repositorio, que
importa `db` y drizzle:

| Archivo | Línea | Import de hoy |
| :--- | :--- | :--- |
| `src/features/transactions/components/TransactionsContainer.tsx` | 17 | `from "@/features/accounting/repositories/categoryRepository"` |
| `src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.tsx` | 23 | `from "../../repositories/categoryRepository"` |

**La tanda anterior ya resolvió esto y quedó a medias:** movió `CategoryTreeNode` a
`src/features/accounting/types.ts` justamente para que los componentes no tuvieran que tocar el
repositorio, y dejó en `categoryRepository.ts` un `export type { CategoryTreeNode }` de
compatibilidad. `TransactionFormModal.tsx:19` **ya lo importa bien**, desde
`@/features/accounting/types` — ése es el patrón a copiar en los otros dos.

*   Reapuntar los dos imports a `@/features/accounting/types` (ruta absoluta, como
    `TransactionFormModal`, aunque el segundo archivo hoy use ruta relativa).
*   Respetar la alineación por columnas del bloque de imports de cada archivo
    (`.agents/AGENTS.md` §4): cambiar la ruta cambia el largo de la línea.
*   **No borrar** el `export type { CategoryTreeNode }` de `categoryRepository.ts`: el repositorio
    usa el tipo en sus propias firmas y el reexport es API legítima del módulo. Que quede sin
    consumidores no es motivo para sacarlo en esta tanda.

## Paso 3 — Sacar la prop `lang`, que nadie usa

`CategoriesSettingsContainer` declara `lang?: string` en su interfaz de props (línea 32) y **no la
usa en ninguna parte del componente**; `settings/page.tsx` se la pasa.

*   Sacar `lang` de la interfaz de props del container y de la desestructuración, si estuviera.
*   Sacar `lang={lang}` de `src/app/[lang]/(main)/settings/page.tsx`.
*   **Cuidado — el efecto en cadena:** al sacarlo, `const { lang } = await params ;` queda sin uso y
    **el lint se pone en rojo**. Sacar también esa línea y la interfaz `SettingsPageProps`, y dejar
    la firma como `export default async function SettingsPage()`. Un Server Component puede no
    declarar `params`; el segmento `[lang]` de la ruta sigue funcionando igual.
*   **No agregar `getDictionary` acá.** Es lo que hace `accounts/page.tsx`, pero las 789 líneas del
    container están escritas en español directo e internacionalizarlas es otra tanda. Queda anotado
    como deuda, no se abre en ésta.

## Paso 4 — El test de cascada que faltaba

El plan anterior lo pedía (paso 9.5) y no se escribió. La cascada **existe y funciona**:
`categoryRepository.archive` (`categoryRepository.ts:344`) archiva la fila y después corre un
segundo `UPDATE` sobre las hijas por `parentId`.

Va en `src/features/accounting/actions/categoryActions.test.ts`, dentro del `describe` que ya
existe: **`"R4 — No se borra: se archiva (inmutabilidad del libro)"`** (línea 163). Ahí ya está
montado el andamiaje de organización y sesión que necesita.

El test:

1.  Crear un padre y dos subcategorías reales bajo él.
2.  `archiveCategoryAction( { id: padre.id } )` → `success`.
3.  Releer las dos hijas: **ambas con `archivedAt` no nulo**.
4.  `getCategoryTreeAction()` **sin** `includeArchived` no devuelve ese padre;
    con `{ includeArchived: true }` sí.

> **Lo que el test NO debe afirmar:** que desarchivar el padre devuelve las hijas. **No lo hace** —
> `unarchive` sólo toca la fila del padre, y eso es el defecto anotado en `TECHNICAL_DEBT.md` §4,
> que **esta tanda no arregla**. Si el test se escribe esperando la simetría, sale rojo y no es un
> bug de la tanda: es la deuda. Escribir el test contra el comportamiento real.

## Paso 5 — Documentación, en el mismo commit

*   **`docs/trabajo-en-vuelo.md`** — en el mismo commit que el código, como siempre.
*   **`docs/TECHNICAL_DEBT.md`** — los dos items que dejó esta verificación **ya están escritos** en
    §4 (desarchivado asimétrico, y resolución padre→hoja duplicada). **No volver a agregarlos.**
    Agregar sólo uno nuevo, en §3 o donde corresponda: *`/settings` no carga diccionario ni
    internacionaliza sus textos, a diferencia de las seis páginas que sí llaman a `getDictionary`*.
*   **`docs/patterns.md`** — no se toca: esta tanda no establece ningún patrón nuevo.

---

## Radio de impacto

Chico y acotado, pero conviene tenerlo escrito:

*   **Paso 1** — cero consumidores, verificado por grep. Riesgo nulo.
*   **Paso 2** — sólo cambia la procedencia de un tipo; no cambia el tipo. Si `tsc` se queja, es que
    `accounting/types.ts` no exporta lo mismo: contrastar contra el import de
    `TransactionFormModal.tsx:19`, que es el que ya funciona.
*   **Paso 3** — **es el único con efecto en cadena**, y cae sobre el lint, no sobre los tests.
*   **Paso 4** — agrega tests, no toca código de producción. Si sale rojo, leer el aviso del propio
    paso antes de "arreglar" nada.

## Verificación

Los cuatro, y el typecheck **como comando propio**:

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit | grep -c "error TS"
pnpm build
```

**El reporte pega la salida, no la describe.** Números exactos: archivos de test, tests, errores TS.
La línea base a superar es **51 archivos / 375 tests**; con el Paso 4 el conteo de tests sube y el
de archivos no.

> **`pnpm build` no es typecheck:** `next build` no tipa los archivos de test. El `tsc` va aparte y
> es lo que corre la compuerta CI.

> **Entorno:** `pnpm test` necesita `postgres-dev` vivo en podman. `ECONNREFUSED` o `AggregateError`
> en el setup es **entorno caído, no suite roja**: `podman ps` antes de diagnosticar.

## Lo que NO entra

Los dos hallazgos que quedaron en `TECHNICAL_DEBT.md` §4 por decisión explícita del usuario
(2026-09-10) — son cambios de comportamiento y necesitan su propia ronda:

*   **Hacer simétrico el desarchivado** (que desarchivar un padre devuelva sus hojas) y meter los
    dos `UPDATE` de `archive` en una transacción.
*   **Extraer la resolución padre → hoja** de `transactionsActions.ts` al repositorio.

Tampoco entra internacionalizar `/settings`, ni tocar la migración `0024`, que ya está aplicada
sobre la base real.
