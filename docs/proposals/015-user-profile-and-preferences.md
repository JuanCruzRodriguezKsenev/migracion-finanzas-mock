# RFC 015: Perfil del Usuario, Preferencias de Interfaz y Consolidación Monetaria

*   **ID de la Propuesta:** 015
*   **Título:** Módulo de Perfil del Usuario, Preferencias de Formateo y Algoritmo de Patrimonio Neto Consolidado
*   **Estado:** `APPROVED` (2026-09-08, aprobado por el usuario tras la enmienda de contraste)
*   **Fecha de Creación:** 2026-06-22
*   **Fecha de Enmienda:** 2026-09-08
*   **Fecha de Aprobación:** 2026-09-08 — aprobado por el usuario sobre el texto enmendado. El alcance
    aprobado es el de la Sección 1 (*Alcance de la primera ronda*): objetivos 1 y 2 únicamente.
*   **Autor:** Antigravity (AI Coding Assistant)

> [!IMPORTANT]
> **Enmienda de Contraste (2026-09-08).**
> Este RFC se redactó el 2026-06-22, antes de que existieran el core contable, el endurecimiento de
> autenticación y la propia tabla `profiles`. Al contrastarlo contra el esquema real, **tres de sus
> secciones describían un sistema que no es el que existe**. Esta enmienda las corrige y acota el
> alcance. El detalle del contraste está en la Sección 0.

> [!NOTE]
> **Enmienda de Arquitectura (2026-09-07 — Bloque B):**
> Se incorpora la Sección 5 con el registro formal de la decisión arquitectónica sobre **Cotizaciones Históricas y Manejo Multimoneda** (tabla `exchange_rates`, cierres contables persistidos vs. saldos vivos cacheados). Esta decisión queda asentada por escrito para no perder el criterio técnico de diseño, mientras que su implementación de código se reserva para la ronda correspondiente a este RFC.

---

## 0. Contraste contra el esquema real (2026-09-08)

Verificado archivo por archivo y contra la base de desarrollo. Lo que este RFC daba por cierto y no lo es:

| Lo que el RFC asumía | Lo que hay realmente | Consecuencia |
| :--- | :--- | :--- |
| Las preferencias hay que crearlas en `users` | **Ya existen en la tabla `profiles`**, con feature propia en `src/features/profile/` (esquema, repositorio, acciones y contexto) | El trabajo no es crear preferencias, es **normalizarlas**. Ver §2 |
| `users.id` es `text`; hay una columna `password` | `users.id` es `uuid`; la contraseña vive en `password_hash` + `salt` + `hash_params` (commit `0176d86`) | Implementar el esquema propuesto **sería un retroceso de seguridad**. §2 se reescribe |
| Un usuario navega entre workspaces vía `activeOrganizationId` | `users.organization_id` es **`NOT NULL`**: un usuario pertenece a exactamente una organización | Multi-workspace no es una columna, es un cambio de modelo que toca el aislamiento multi-tenant de toda consulta. **Fuera de alcance de este RFC** |
| El patrimonio se consolida sobre `accounts`, `wealthAssets` y `loans` | **`wealth_assets`, `loans`, `liabilities` y `credit_cards` no existen**; son inventario pendiente de portar desde `FinanceApp-WSL` | El algoritmo de §4 no es implementable hoy. Se conserva como diseño de referencia, marcado como no ejecutable |
| Los cierres mensuales fijan y guardan su cotización | `monthly_summaries` **no tiene ninguna columna para almacenarla** | §5.B queda incompleta: falta especificar esa columna. Se señala como pendiente |

Lo que **sí** se sostiene sin cambios: la Sección 3 (aplicación de preferencias en el frontend) y la Sección 5.C (esquema de `exchange_rates`), esta última escrita el 2026-09-07 contra el core actual.

### Estado de las preferencias hoy

`profiles` guarda **etiquetas de interfaz en español**, no códigos canónicos:

| Campo | Valor almacenado hoy | Lo que el código necesita |
| :--- | :--- | :--- |
| `currency` | `'Peso argentino (ARS)'` | `'ARS'` |
| `timezone` | `'(GMT-03:00) Buenos Aires'` | `'America/Argentina/Buenos_Aires'` |
| `number_format` | `'1.234,56'` | `'es-AR'` |
| `weekly_start` | `'Lunes'` | `'monday'` |
| `default_view` | `'Dashboard'` | `'dashboard'` |

Por eso **hoy ninguna preferencia afecta a nada**: el perfil se hidrata en `src/app/[lang]/layout.tsx` y se muestra en `ProfileMenu`, pero `formatCurrency( monto , moneda , locale )` recibe `"es-AR"` escrito en duro en sus ocho invocaciones, porque `'1.234,56'` no es un locale que `Intl` pueda resolver.

Todavía no existe una ruta de edición de perfil (`/perfil` no está construida), así que **no hay UI que migrar**: los únicos productores del dato son el `default` del esquema, `seed.ts` y la constante `DEFAULT_PROFILE` del layout.

---

## 1. Contexto y Objetivos

Para ofrecer una experiencia de usuario altamente personalizada, el sistema debe adaptarse a las preferencias de formato de cada persona (idioma, formato de fecha, formato de miles, zona horaria y moneda base).

Además, dado que el usuario posee activos en diferentes monedas (ej: cuentas bancarias en pesos, inmuebles e inversiones bursátiles en dólares), necesitamos una métrica unificada de "Patrimonio Neto Total" expresada en la moneda preferida del perfil del usuario.

### Objetivos

1.  **Preferencias canónicas:** que `profiles` almacene **códigos**, no etiquetas de presentación, y que la etiqueta en español se derive del código en el borde de la interfaz.
2.  **Preferencias con efecto real:** que el formateo de montos y fechas consuma el perfil en lugar de constantes escritas en duro.
3.  **Algoritmo de Consolidación Monetaria:** convertir activos y pasivos a la moneda base del usuario para reportes unificados. *(Diseño de referencia; no implementable hasta que existan las tablas de riqueza y deudas.)*

### Alcance de la primera ronda

Sólo los objetivos **1 y 2**. Quedan explícitamente fuera:

*   **Multi-workspace (`activeOrganizationId`).** Cambio de modelo, RFC propio.
*   **`exchange_rates` y consolidación de patrimonio.** Su diseño queda asentado en §5, pero no hay nada que consolidar mientras todas las cuentas estén en una sola divisa y falten las tablas de riqueza.
*   **La ruta `/perfil`.** La UI de edición es un módulo aparte del catálogo pendiente.

    > **Enmienda del 2026-09-09, decidida por el usuario: no hay ruta `/profile`.** El perfil pasa a
    > ser **una pestaña dentro de `/settings`**, junto con preferencias, categorías y seguridad.
    > *Motivo:* la referencia del mock **duplica** — `/perfil` (363 líneas) muestra *Información
    > personal* y *Preferencias de la aplicación*, y `/configuracion` (491 líneas) repite las dos
    > como sus pestañas `Perfil` y `Preferencias`, todas decorativas (`activeTab` no condiciona
    > ningún render). Se unifica en una sola página con pestañas en vez de portar la duplicación.
    > **Lo demás de este RFC no cambia:** el esquema, los códigos canónicos y el cableado del
    > formateo se sostienen tal como fueron aprobados.

### Decisión: la moneda base es del usuario

La moneda de consolidación sale de `profiles.currency`, no de la organización. Es una **preferencia de visualización**: dos miembros de la misma organización pueden ver el mismo patrimonio expresado en monedas distintas. Los importes contables y los cierres persistidos no cambian de divisa por esto — lo que cambia es cómo se presentan.

---

## 2. Esquema de Base de Datos (Drizzle ORM)

> **Reescrito en la enmienda del 2026-09-08.** La versión anterior proponía crear estos campos en
> `users`. La tabla `profiles` ya los tiene; lo que sigue es la normalización de sus valores, no un
> alta de columnas.

La tabla vive en `src/features/profile/schema.db.ts` y cuelga de `users.id` con `onDelete: "cascade"`. **No lleva `organizationId`**: el aislamiento multi-tenant es transitivo a través del usuario, igual que en `contact_payment_methods`.

Los cambios son de **valor por defecto y de contenido**, no de estructura:

| Columna | `default` actual | `default` canónico | Dominio de valores |
| :--- | :--- | :--- | :--- |
| `currency` | `'Peso argentino (ARS)'` | `'ARS'` | Código ISO 4217 |
| `timezone` | `'(GMT-03:00) Buenos Aires'` | `'America/Argentina/Buenos_Aires'` | Identificador IANA |
| `number_format` | `'1.234,56'` | `'es-AR'` | Etiqueta de locale BCP 47 |
| `weekly_start` | `'Lunes'` | `'monday'` | `'monday' \| 'sunday'` |
| `default_view` | `'Dashboard'` | `'dashboard'` | Slug de ruta |
| `date_format` | `'DD/MM/YYYY'` | `'DD/MM/YYYY'` | Sin cambio: ya es un patrón, no una etiqueta |

Las columnas `theme`, `fast_login`, `round_amounts`, `include_transfers`, `phone`, `bio` y `default_account` ya son canónicas o libres, y no se tocan.

**Regla que queda establecida:** la base guarda el código; la etiqueta en español se deriva en el borde de la interfaz mediante un catálogo explícito. Una columna que guarda `'Peso argentino (ARS)'` obliga a cada consumidor a parsear la etiqueta para recuperar el código, y ese parseo es el que hoy impide usar `Intl`.

### Nota sobre los campos de plan

`plan_name`, `plan_billing` y `plan_next_charge` describen la **suscripción comercial del usuario al SaaS**, no una preferencia de interfaz, y conviven en esta tabla con los campos de formateo. Mientras `updateProfileAction` acepte un `Partial<ProfileData>` sin validar, esa convivencia es explotable: un cliente puede enviar `{ planName: "Premium" }` y modificar su propio plan. La validación se corrige en la ronda de esta enmienda; **la separación de estos campos a su propia tabla queda anotada como deuda.**

---

## 3. Lógica de Aplicación de Preferencias en el Frontend (UX)

El cliente de Next.js lee el perfil del usuario autenticado para adaptar toda la visualización del sistema dinámicamente:

### A. Formateo de Moneda
Usando el `numberFormat` del perfil —ya normalizado a un locale BCP 47— y la moneda de la cuenta (`currency`). **`formatCurrency` en `src/shared/lib/currencyFormatter.ts` ya implementa exactamente esta firma y resuelve los decimales de cada divisa en runtime vía `Intl`: se reusa, no se reescribe.**
```typescript
export function renderMoney(amountInCents: number, currency: string, profile: ProfileData) {
  const value = amountInCents / 100;
  const formatted = new Intl.NumberFormat(profile.numberFormat, {
    style: "currency",
    currency: currency,
    maximumFractionDigits: profile.roundAmounts ? 0 : 2,
  }).format(value);
  return formatted;
}
// Ejemplo para profile.numberFormat = 'es-AR', currency = 'USD', amount = 150075 ($1500.75):
// Retorna: "US$ 1.500,75" (o "$1.501" si roundAmounts = true)
```

### B. Formateo de Fecha y Zona Horaria
Todas las marcas de tiempo de la base de datos se almacenan en UTC. Al renderizarlas, se traducen a la zona horaria del usuario (`profiles.timezone`, normalizado a identificador IANA) usando bibliotecas como `dayjs` o `date-fns-tz` y se muestran con el formato `dateFormat` (ej: `23/06/2026`).

---

## 4. Algoritmo de Consolidación del Patrimonio Neto (Net Worth)

> [!WARNING]
> **Diseño de referencia, no ejecutable hoy (enmienda 2026-09-08).** El `Promise.all` de más abajo
> consulta `wealthAssets` y `loans`: **ninguna de las dos tablas existe**, son inventario pendiente de
> portar desde `FinanceApp-WSL`. Tampoco existe `exchange_rates`. Esta sección se conserva porque el
> criterio de rendimiento sigue siendo el correcto —resolver el conjunto único de divisas de una sola
> vez en lugar de consultar la tasa dentro de un bucle—, pero **no debe implementarse hasta que las
> tablas de riqueza y deudas existan**. Escribir código contra ella hoy no compilaría.

Para calcular la métrica unificada de patrimonio neto que se muestra en el Dashboard principal:

$$\text{Patrimonio Neto Total} = \sum(\text{Activos Convertidos}) - \sum(\text{Pasivos Convertidos})$$

### Algoritmo Optimizado (Criterios de Rendimiento de Vercel):
1.  **Deduplicación de Configuración (`server-cache-react`):** Envolver el fetching de preferencias del usuario y la organización activa mediante `React.cache()` en la capa de servicios para que sea compartido por todos los componentes del árbol sin llamadas redundantes a la base de datos.
2.  **Obtener Todos los Saldos en Paralelo (`async-parallel`):**
    Consultar los saldos de cuentas, tarjetas, activos y deudas en paralelo utilizando `Promise.all` para evitar cascadas asíncronas en el servidor:
    ```typescript
    const [ctaSaldos, assetSaldos, loanSaldos] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.organizationId, orgId)),
      db.select().from(wealthAssets).where(eq(wealthAssets.organizationId, orgId)),
      db.select().from(loans).where(eq(loans.organizationId, orgId))
    ]);
    ```
3.  **Evitar Consultas en Bucle de Tasas de Cambio (`async-parallel-fetching`):**
    *   **Incorrecto:** Llamar a `await ExchangeRateService.getRate(Mo, Md)` de forma secuencial dentro de un bucle `map` para cada cuenta.
    *   **Correcto:** Identificar el conjunto único de divisas de origen involucradas en los saldos (`Mo_unicas`) y consultar todos sus tipos de cambio hacia la moneda destino ($M_d$) en una única consulta de base de datos o en paralelo mediante `Promise.all`.
4.  **Cálculo en Memoria:** Una vez que el mapa de tasas de cambio y los saldos están cargados en memoria del servidor, realizar la multiplicación y agregación de forma puramente síncrona:
    $$\text{Saldo Convertido} = S \times \text{Tasa de Cambio en Memoria}$$

---

---

## 5. Registro de Decisión Arquitectónica: Cotizaciones Históricas y Manejo Multimoneda

*Nota: Esta sección documenta la decisión formal de diseño para el almacenamiento de cotizaciones y conversión cambiaria. Su construcción queda fuera del alcance del Bloque B y se ejecutará cuando se aborde integralmente el RFC 015.*

### A. Problemática
El cálculo del patrimonio neto consolidado y la visualización de balances o transacciones en monedas extranjeras (USD, EUR, etc.) requiere un criterio explícito para evitar distorsiones o inconsistencias causadas por la volatilidad cambiaria histórica.

### B. Criterio de Doble Estrategia

| Dimensión | Enfoque Técnico | Criterio de Negocio |
| :--- | :--- | :--- |
| **Cierres mensuales** | **Persistidos en Base de Datos** | Todo balance cerrado (`monthly_summaries`) fija la cotización vigente al cierre y la guarda. **Pendiente de especificar (enmienda 2026-09-08): `monthly_summaries` no tiene hoy ninguna columna donde almacenarla.** Definir su nombre, tipo y escala es requisito previo a implementar esta fila. Es el único caso donde hay que almacenarla: un cierre es un total en moneda base sin dos importes de los que deducir el cociente. No se recalcula retrospectivamente. |
| **Transacciones de cambio** | **Deducida, nunca almacenada** | Una transacción de cambio ya lleva los dos importes en sus asientos, así que su cotización efectiva es el cociente entre ambos. Guardarla aparte crearía un dato que puede contradecir a los asientos. Esta regla ya está implementada y documentada en `patterns.md` §Cambio de divisas; esta sección no la altera. |
| **Saldos Vivos del Dashboard** | **Caché del Día (In-Memory / TTL)** | La conversión en tiempo real de saldos vigentes hacia la divisa preferida del usuario utiliza la cotización oficial/de referencia del día. Se cachea a nivel servidor con TTL (ej. 24 horas o intradía) para evitar llamadas concurrentes a APIs externas o consultas recurrentes a la base de datos. |

### C. Esquema Relacional de Referencia (`exchange_rates`)
Para la persistencia histórica de tasas de cambio diarias/oficiales:

```typescript
import { pgTable , uuid , varchar , bigint , date , timestamp , uniqueIndex , index } from "drizzle-orm/pg-core" ;

export const exchangeRates = pgTable( "exchange_rates" , {
  id:             uuid( "id" ).primaryKey().defaultRandom() ,
  // Sin `organization_id`: las cotizaciones son dato de referencia del sistema, iguales para todos
  // los inquilinos. Una columna de tenant anulable obligaría a todas las consultas a hacer
  // `or( eq(orgId) , isNull(orgId) )`, que es exactamente el patrón que filtra datos cuando alguien
  // olvida la mitad. Una cotización propia por organización necesita su propia decisión.
  baseCurrency:   varchar( "base_currency"   , {length: 10} ).notNull() , // Ej: 'USD'
  targetCurrency: varchar( "target_currency" , {length: 10} ).notNull() , // Ej: 'ARS'
  // Tasa entera con factor fijo RATE_SCALE = 1_000_000 (seis decimales). 1 USD = 1487,50 ARS se
  // guarda como 1_487_500_000. El factor es único y no negociable: una escala ambigua se lee mal
  // tarde o temprano. Seis decimales cubren también los pares invertidos (1 ARS = 0,000672 USD).
  rate:           bigint( "rate" , {mode: "number"} ).notNull() ,
  // `date` y no `timestamp`: la cotización es de un día. Con marca de tiempo, dos capturas del mismo
  // día a distinta hora pasarían el índice único y habría dos cotizaciones para la misma fecha.
  rateDate:       date( "rate_date" ).notNull() ,
  source:         varchar( "source" , {length: 50} ).default( "official" ).notNull() , // 'official' | 'blue' | 'mep' | 'ccl'
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  uniqueRateEntry: uniqueIndex( "exchange_rates_currency_date_source_unique" ).on(
    table.baseCurrency ,
    table.targetCurrency ,
    table.rateDate ,
    table.source
  ) ,
  lookupIdx: index( "exchange_rates_lookup_idx" ).on(
    table.targetCurrency ,
    table.baseCurrency ,
    table.rateDate
  ) ,
} ) ; } ) ;
```

