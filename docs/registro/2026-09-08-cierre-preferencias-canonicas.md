# Registro de Cierre — Preferencias Canónicas de Perfil (RFC 015, primera tajada)

* **Fecha de consolidación:** 2026-09-08
* **Rama base:** `master`
* **Rango consolidado:** `492b8cf..1ba3d37` — 6 commits
* **Rama fusionada:** `feat/preferencias-canonicas`
* **Método:** fast-forward puro (`--ff-only`), sin conflictos. `master` no había divergido.
* **Resultado global:** 321 tests pasando en 41 archivos de prueba; 0 errores y 0 warnings de ESLint; `pnpm exec tsc --noEmit` en 0 errores corrido como comando propio; compilación de producción exitosa. Verificado sobre `master` en `1ba3d37`.

---

## Detalle de lo consolidado

### Aprobación del RFC 015
* **Commits:** `17f963e`, `1604146`, `e422a34`, `ca7417f`
* El RFC venía de junio con un esquema anterior al core contable. Se lo enmendó **contra `src/features/profile/schema.db.ts` real** antes de aprobarlo, y recién sobre el texto enmendado pasó a `APPROVED`. Es el último de los 21 RFCs que quedaba en `DRAFT`.
* La enmienda dejó nombrado, dentro del propio RFC, lo que **no** es ejecutable hoy: el algoritmo de consolidación de §4 consulta `wealthAssets` y `loans`, y ninguna de las dos tablas existe.
* El plan de ejecución quedó cerrado en [`planes/normalizar-preferencias-perfil.md`](../planes/normalizar-preferencias-perfil.md).

### Normalización de preferencias a códigos canónicos
* **Commit:** `002e7c7`
* **El problema:** `profiles` guardaba cadenas de presentación de la interfaz. Una fila decía `currency = 'Peso argentino (ARS)'`, `timezone = '(GMT-03:00) Buenos Aires'` y `number_format = '1.234,56'`. Ninguna de las tres sirve para alimentar `Intl`, así que la preferencia de formato del usuario era decorativa: las 8 llamadas a `formatCurrency` tenían `"es-AR"` en duro.
* Catálogo nuevo en [`src/features/profile/preferences.ts`](../../src/features/profile/preferences.ts): opciones `{ code , label }` por grupo, la función pura `etiquetaDe( grupo , code )` con el propio código como respaldo, y el mapa inverso etiqueta → código que documenta qué valor viejo corresponde a cuál nuevo.
* Defaults del esquema Drizzle a ISO 4217 / IANA / BCP 47 / `monday` / `dashboard`. `date_format` **no se tocó**: `'DD/MM/YYYY'` ya es un patrón, no una etiqueta.
* Migración `0021_thick_corsair.sql` **con `UPDATE` de backfill escrito a mano**, siguiendo el precedente de `brand_domain` en `0020_soft_fixer.sql`. Los defaults nuevos no reescriben filas ya guardadas: sin ese `UPDATE`, la base quedaba con perfiles viejos en etiquetas y nuevos en códigos, que es peor que el estado de partida. El `CASE ... ELSE columna` lo deja idempotente.
* Sincronizados los tres productores del dato que si no revivían el bug: `DEFAULT_PROFILE` en `src/app/[lang]/layout.tsx` (el perfil que ve un usuario sin fila en `profiles`) y **los dos bloques** de `seed.ts` (`values` y el `set` de `onConflictDoUpdate`).
* Las 8 llamadas a `formatCurrency` pasan a leer el locale del perfil, resuelto una sola vez por componente con respaldo a `"es-AR"`. `SummaryBar` lo recibe **por prop** desde `SubscriptionDashboard`: es cliente sólo por transitividad y recibe todo lo demás por props. `formatCurrency` no se tocó.

### Cierre del agujero de escalamiento de plan
* **Commits:** `002e7c7`, `1ba3d37`
* `updateProfileAction` recibía `Partial< ProfileData >` y lo pasaba **entero y sin validar** al repositorio. Como `profiles` incluye `planName`, `planBilling` y `planNextCharge`, un cliente podía enviar `{ planName: "Premium" }` y cambiarse el plan.
* [`profile.schema.ts`](../../src/features/profile/schemas/profile.schema.ts) valida con Zod en modo `.strict()`: sólo columnas de contacto y preferencia, los campos con dominio cerrado por `z.enum` sobre los códigos del catálogo. El `.strict()` es lo que hace fallar el envío en vez de descartar la clave en silencio.
* `1ba3d37` cierra el borde del lado del cliente: `ProfileContext.updateProfile` tipaba `Partial< ProfileData >`, que incluye `planName`, `userId` y `createdAt` — claves que el `.strict()` ahora rechaza **en runtime y sin aviso del compilador**. Pasa a `UpdateProfileInput`, con el porqué anotado en el archivo para que no vuelva al `Partial`.

### Tests y documentación
* La feature `profile/` no tenía ninguno: se agregaron **16 tests** en `preferences.test.ts` y `profile.schema.test.ts` (305 → 321).
* El test del mapa inverso cubre todos los valores que migra el backfill: si el catálogo pierde uno, falla el test antes que la migración.
* `patterns.md` §6 — **Preferencias canónicas**: la base guarda el código, la etiqueta se deriva en el borde de la interfaz.

---

## Verificación

Batería completa sobre `master` en `1ba3d37`, con el typecheck como comando propio:

```
pnpm test                  41 archivos · 321 tests · exit 0
pnpm lint                  exit 0
pnpm exec tsc --noEmit     0 errores
pnpm build                 verde
```

Datos en la base real tras la migración:

```
 currency | timezone                       | number_format | weekly_start | default_view
 ARS      | America/Argentina/Buenos_Aires | es-AR         | monday       | dashboard
```

Los cinco `column_default` de `information_schema` quedaron también en códigos canónicos.

## Lo que queda abierto

* **El catálogo de `preferences.ts` todavía no tiene consumidor de producción** — `etiquetaDe`, `PREFERENCE_CATALOG` y `LABEL_TO_CODE_MAP` sólo los usan los tests. Es consecuencia directa de dejar la ruta `/perfil` fuera de alcance: `patterns.md` §6 documenta una derivación en el borde que todavía no tiene borde. Se cierra cuando se construya la UI de edición.
* **`formatCurrency` no protege el locale.** El respaldo `profile.numberFormat || "es-AR"` cubre vacío y `undefined`, pero no un valor heredado no-BCP-47 que el `ELSE` del backfill haya preservado: `new Intl.NumberFormat` lanzaría `RangeError` y voltearía la tabla de transacciones del lado del cliente. No es bug activo con los datos de hoy.
* **`roundAmounts` se guarda pero nadie lo lee.** `formatCurrency` no admite el flag; queda pendiente para cuando se unifique con `formatCents`.
* **Convivencia de `formatCents` y `formatCurrency`**, y `.agents/AGENTS.md` §8.2 nombrando al primero como canónico cuando el segundo lo superó. Anotado en `TECHNICAL_DEBT.md` § Abierto.
* **`planName`, `planBilling` y `planNextCharge` siguen dentro de `profiles`.** La acción quedó asegurada, pero son datos de suscripción comercial y merecen tabla propia. Anotado en `TECHNICAL_DEBT.md` § Abierto.
* **Fuera de alcance por diseño, y sin cambios:** `exchange_rates` y la consolidación de patrimonio (dependen de tablas inexistentes), multi-workspace (`users.organization_id` es `NOT NULL`; es cambio de modelo y RFC propio), la ruta `/perfil` y la columna de cotización en `monthly_summaries`.
