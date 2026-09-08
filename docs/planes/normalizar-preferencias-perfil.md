# Plan — Normalizar las preferencias de perfil y cablearlas al formateo

> **Ronda:** RFC 015, primera parte (objetivos 1 y 2).
> **Precondición innegociable:** el RFC 015 debe estar en **`APPROVED`**. Hoy está en `DRAFT` con la
> enmienda del 2026-09-08. Si al empezar sigue en `DRAFT`, **no se escribe código**: se informa y se
> frena.
> **Este plan no lleva progreso adentro.** El estado vive en `docs/trabajo-en-vuelo.md`.

---

## Qué se corrige y por qué

`profiles` guarda **etiquetas de interfaz en español** donde debería guardar códigos: `'Peso argentino (ARS)'` en vez de `'ARS'`, `'1.234,56'` en vez de `'es-AR'`, `'(GMT-03:00) Buenos Aires'` en vez de `'America/Argentina/Buenos_Aires'`, `'Lunes'` en vez de `'monday'`.

La consecuencia es que **ninguna preferencia del usuario afecta a nada**. El perfil se hidrata en el layout y se muestra en el `ProfileMenu`, pero las ocho llamadas a `formatCurrency` pasan `"es-AR"` escrito en duro, porque `'1.234,56'` no es un locale que `Intl` pueda resolver.

No hay UI de edición de perfil (`/perfil` no existe todavía), así que **no hay selectores que migrar**. Esto es lo que hace barata la ronda: los únicos productores del dato son el `default` del esquema, `seed.ts` y `DEFAULT_PROFILE` en el layout.

## Radio de impacto

Todo lo que construye, escribe o lee estas columnas. **Si un paso toca una fila de esta tabla, hay que revisar las demás.**

| Archivo | Qué hace con el dato |
| :--- | :--- |
| `src/features/profile/schema.db.ts` | Define las columnas y sus `default` — es la fuente de las etiquetas |
| `src/shared/db/seed.ts` (~línea 107 y ~127) | **Dos** bloques que siembran perfiles con etiquetas |
| `src/app/[lang]/layout.tsx` (~línea 50-67) | `DEFAULT_PROFILE`: el perfil que se usa cuando no hay sesión o no hay fila |
| `src/features/profile/actions/profileActions.ts` | `updateProfileAction` — hoy escribe sin validar |
| `src/features/profile/repositories/profileRepository.ts` | `findByUserId` y `update` |
| `src/features/profile/context/ProfileContext.tsx` | `ProfileProvider` / `useProfileContext` — reparte el perfil al árbol cliente |
| `src/shared/ui/feedback/ProfileMenu/ProfileMenu.tsx` | Lee **sólo** `planName`. No consume las columnas de formateo, así que la normalización no lo rompe |
| `src/shared/lib/currencyFormatter.ts` | `formatCurrency` — el consumidor final |
| 4 componentes (abajo, Paso 5) | Las 8 llamadas con `"es-AR"` en duro |

**No hay tests en `src/features/profile/`**: la feature está sin cobertura. El Paso 6 la abre.

## Reusos: qué hacen hoy las piezas que este plan toca

*   **`formatCurrency( amount , currencyCode , locale )`** (`src/shared/lib/currencyFormatter.ts`) **ya tiene exactamente la firma que hace falta y no hay que tocarla.** Resuelve los decimales de cada divisa en runtime con `Intl.NumberFormat(...).resolvedOptions()`, los cachea en `decimalPlacesCache`, y cae a 2 decimales si la divisa es inválida. El trabajo del Paso 5 es **pasarle el locale del perfil en vez de la constante**, nada más.
*   **`formatCents`** (`src/features/accounting/utils/dashboardMetrics.ts`) es un formateador **distinto y más viejo**, sin parámetro de divisa ni de locale. `.agents/AGENTS.md` §8.2 lo nombra como la conversión canónica a formato visible, pero `formatCurrency` lo superó. **Este plan no unifica los dos** — se anota como deuda en el Paso 7.
*   **`useProfileContext()`** (`src/features/profile/context/ProfileContext.tsx`) lanza si se usa fuera del `ProfileProvider`. El provider se monta en el layout raíz, así que cualquier componente cliente del árbol lo tiene disponible.

---

## Pasos

### Paso 1 — Catálogo de preferencias

Crear `src/features/profile/preferences.ts`: la pieza que permite **guardar el código y mostrar la etiqueta**.

*   Por cada preferencia normalizable (`currency`, `timezone`, `numberFormat`, `weeklyStart`, `defaultView`), exportar el arreglo de opciones válidas como `{ code , label }`, y una función `etiquetaDe( grupo , code )` que devuelva la etiqueta en español, con el propio código como respaldo si no está en el catálogo.
*   Exportar además el mapa inverso **etiqueta → código**, que el Paso 2 necesita para migrar las filas existentes y que documenta qué valor viejo se corresponde con cuál nuevo.
*   Como mínimo, cubrir los valores que hoy existen en la base: `'Peso argentino (ARS)'`→`'ARS'`, `'(GMT-03:00) Buenos Aires'`→`'America/Argentina/Buenos_Aires'`, `'1.234,56'`→`'es-AR'`, `'1,234.56'`→`'en-US'`, `'Lunes'`→`'monday'`, `'Domingo'`→`'sunday'`, `'Dashboard'`→`'dashboard'`.
*   TSDoc en cada export. Sin dependencias nuevas.

### Paso 2 — Esquema y migración de datos

1.  En `src/features/profile/schema.db.ts`, cambiar los `default` de `currency`, `timezone`, `numberFormat`, `weeklyStart` y `defaultView` a los códigos canónicos de la tabla del RFC §2. **`dateFormat` no se toca**: `'DD/MM/YYYY'` ya es un patrón, no una etiqueta.
2.  Reducir los `length` sobredimensionados sólo si no obliga a truncar ningún valor del catálogo; ante la duda, dejarlos como están. **Un `length` no es el problema que esta ronda resuelve.**
3.  `pnpm db:generate` para el ALTER de los defaults.
4.  **Editar a mano el `.sql` generado** y agregarle el `UPDATE` que migra las filas existentes, mapeando etiqueta → código. Los defaults nuevos no reescriben las filas ya guardadas: sin este `UPDATE`, la base queda con perfiles viejos en etiquetas y nuevos en códigos, que es peor que el estado actual. **Precedente idéntico: el backfill de `brand_domain` en `0020_soft_fixer.sql`.**
5.  `pnpm db:migrate` y comprobar con:
    ```bash
    podman exec postgres-dev psql -U postgres -d finanzas_db -c "SELECT currency , timezone , number_format , weekly_start , default_view FROM profiles ;"
    ```
    Ninguna fila debe quedar con paréntesis, espacios ni acentos en esas cinco columnas.

### Paso 3 — Productores del dato

*   `src/app/[lang]/layout.tsx`: `DEFAULT_PROFILE` pasa a códigos canónicos. Es el perfil que ve un usuario sin fila en `profiles`, así que si queda con etiquetas el bug sobrevive a la migración.
*   `src/shared/db/seed.ts`: **son dos bloques distintos** (~107 y ~127). Corregir los dos; corregir uno solo deja la base sembrada a medias.

### Paso 4 — Validar `updateProfileAction`

Hoy la acción recibe `Partial< ProfileData >` y lo pasa **entero y sin validar** a `profileRepository.update`. Como `profiles` incluye `planName`, `planBilling` y `planNextCharge`, un cliente puede enviar `{ planName: "Premium" }` y cambiarse el plan.

*   Crear `src/features/profile/schemas/profile.schema.ts` con un esquema Zod que acepte **sólo** las columnas de preferencia y contacto: `phone`, `bio`, `currency`, `timezone`, `theme`, `defaultView`, `fastLogin`, `weeklyStart`, `dateFormat`, `numberFormat`, `roundAmounts`, `includeTransfers`, `defaultAccount`. Todas opcionales.
*   Los tres campos de plan **quedan fuera del esquema**: no son editables por el usuario desde esta acción.
*   Los campos con dominio cerrado se validan contra el catálogo del Paso 1 (`z.enum` sobre los códigos), no como texto libre. Es lo que impide que vuelva a entrar una etiqueta.
*   `updateProfileAction` corre `safeParse` y devuelve `fail( ... )` con el primer mensaje de error, siguiendo el patrón de `createFinancialEntityAction` en `accountingActions.ts`.
*   **Contrato del `Result`:** el éxito es `{ success: true , value: T }` — el campo es `value`, no `data`.

### Paso 5 — Cablear el formateo

Las 8 llamadas con `"es-AR"` en duro, en 4 archivos:

| Archivo | Llamadas | Cómo recibe el locale |
| :--- | :---: | :--- |
| `src/features/transactions/components/TransactionsTable.tsx` | 2 | `useProfileContext()` — es client component |
| `src/features/transactions/components/TransactionDetailModal.tsx` | 2 | `useProfileContext()` — es client component |
| `src/features/subscriptions/components/SubscriptionCard.tsx` | 2 | `useProfileContext()` — es client component |
| `src/features/subscriptions/components/SummaryBar.tsx` | 2 | **Prop nueva desde `SubscriptionDashboard.tsx:201`** |

`SummaryBar` **no lleva la directiva `"use client"`**: es cliente sólo por transitividad, porque lo importa `SubscriptionDashboard`, que sí la tiene. Técnicamente podría usar el hook, pero recibe todo lo demás por props y debe seguir haciéndolo. **Pasarle el locale por prop desde el padre, no meterle un hook.**

En los tres restantes: leer `profile.numberFormat` del contexto y pasarlo como tercer argumento. **No cambiar la firma de `formatCurrency` ni tocar `currencyFormatter.ts`.**

Si `profile.numberFormat` llegara vacío o desconocido, `Intl` lanza. Resolver el locale una sola vez por componente con respaldo a `"es-AR"`, en lugar de repetir el respaldo en cada llamada.

### Paso 6 — Tests

La feature no tiene ninguno. Crear `src/features/profile/preferences.test.ts` y `src/features/profile/schemas/profile.schema.test.ts`:

*   `etiquetaDe` devuelve la etiqueta correcta para cada código del catálogo, y devuelve el código sin romper cuando el valor no está.
*   El mapa inverso cubre **todos** los valores de etiqueta que el Paso 2 migra: si el catálogo pierde uno, el test falla antes que la migración.
*   El esquema Zod **rechaza `planName`, `planBilling` y `planNextCharge`** — este es el test que documenta el agujero cerrado.
*   El esquema rechaza una etiqueta en español donde espera un código (`'Peso argentino (ARS)'` debe fallar; `'ARS'` debe pasar).

Entorno `node` por defecto; si algún test necesita DOM, `// @vitest-environment jsdom` en la primera línea, nunca tocando la config global.

### Paso 7 — Documentación, en el mismo commit

*   **`docs/patterns.md`** — sección nueva: **Preferencias canónicas**. La base guarda el código; la etiqueta se deriva en el borde de la interfaz. Contrastado antes de escribirlo: `patterns.md` **no tiene hoy ninguna sección de formateo, locale ni i18n**, así que esto no contradice ni duplica nada existente.
*   **`docs/TECHNICAL_DEBT.md` § Abierto** — dos ítems: (a) `formatCents` y `formatCurrency` son dos formateadores que conviven, y `.agents/AGENTS.md` §8.2 todavía nombra a `formatCents` como el canónico; (b) `planName`, `planBilling` y `planNextCharge` son datos de suscripción comercial mezclados en la tabla de preferencias y deberían tener tabla propia.
*   **`docs/trabajo-en-vuelo.md`** — rama, estado y próximo paso, actualizado **en este mismo commit**.

---

## Verificación

Los cuatro, siempre los cuatro, y el typecheck **como comando propio**. Pegar la salida, no describirla:

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit 2>&1 | grep -c "error TS"
pnpm build
```

Referencia al abrir la ronda: **39 archivos, 305 tests, lint 0, `tsc` 0 errores, build verde.** Los tests nuevos del Paso 6 deben subir el total; ninguno de los 305 existentes debe romperse.

`pnpm test` necesita el contenedor `postgres-dev` vivo. Si muere con `ECONNREFUSED` en el setup, es **entorno caído, no suite roja**.

Además, la comprobación de datos del Paso 2:

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "SELECT currency , timezone , number_format , weekly_start , default_view FROM profiles ;"
```

---

## Lo que NO entra en esta ronda

Nombrado para que no se filtre por los bordes:

*   **`exchange_rates` y la consolidación de patrimonio neto.** El algoritmo del RFC §4 consulta `wealthAssets` y `loans`: **ninguna de las dos tablas existe.** Está marcado en el RFC como no ejecutable.
*   **Multi-workspace (`activeOrganizationId`).** `users.organization_id` es `NOT NULL`; cambiarlo toca el aislamiento multi-tenant de toda consulta del sistema. RFC propio.
*   **La ruta `/perfil`.** No se construye UI de edición en esta ronda.
*   **La columna de cotización en `monthly_summaries`.** Señalada como pendiente en el RFC §5.B; se especifica cuando se aborde la consolidación.
*   **Unificar `formatCents` con `formatCurrency`.** Se anota como deuda, no se ejecuta.
