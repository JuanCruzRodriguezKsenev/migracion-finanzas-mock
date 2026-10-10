# RFC 029: Puertos para servicios externos — hexagonal sólo en el borde

*   **ID de la Propuesta:** 029
*   **Título:** Todo servicio de terceros entra por un puerto con adaptadores; el resto de la arquitectura no cambia
*   **Estado:** `DRAFT` — **no habilita código hasta que el usuario lo apruebe.**
*   **Fecha de Creación:** 2026-10-10
*   **Autor:** `tanda`
*   **Origen:** pregunta del usuario el 2026-10-10 («¿qué tan factible sería migrar a una arquitectura hexagonal?») y la evidencia del plan 41, que sacó Brandfetch del repositorio.

---

## 1. Problema

La arquitectura es feature-driven (`ARCHITECTURE.md` §2): cada feature tiene `actions/`, `services/` y `repositories/`. No hay una frontera explícita entre **la lógica propia** y **los servicios de terceros**: cada componente o servicio que necesitaba un dato externo lo pedía directamente.

El costo quedó medido. Retirar **un** proveedor, Brandfetch, en el plan 41 (commit `c471929`) tocó **23 archivos** (+1279 / −1696). Brandfetch estaba llamado desde dos componentes cliente (`InstitutionLogo.tsx`, `CreateFinancialEntityForm.tsx`), un modal (`AddSubscriptionModal.tsx`), un servicio compartido (`brandSearch.ts`), una ruta (`/api/brand`), `brandService.ts` y dos variables de entorno. Cada uno conocía la URL, el formato de respuesta y el `clientId`.

Con un puerto, el cambio habría sido un adaptador nuevo y una línea de cableado.

---

## 2. Opciones analizadas

| Opción | Qué implica | Veredicto |
| :-- | :-- | :-- |
| **A. Hexagonal completo** | Dominio sin Drizzle; repositorios detrás de interfaces en las 16 features; actions y route handlers como adaptadores de entrada | **Descartada.** Ver §2.1 |
| **B. Puertos sólo para servicios externos** | Cada servicio de terceros detrás de una interfaz propia, con adaptadores por proveedor. Base de datos, motor contable y features intactos | **Recomendada** |
| **C. No hacer nada** | Seguir llamando a terceros desde donde se necesite | Descartada: el plan 41 es el precio, y se repite con cada proveedor |

### 2.1 Por qué no hexagonal completo

*   **La base de datos no es un detalle intercambiable acá: es parte del contrato.** Debe = Haber se valida dentro de la transacción ACID, con bloqueo `FOR UPDATE` (`docs/patterns.md` §1) y montos `bigint`. Esconder Postgres detrás de un puerto genérico debilita esa garantía o la vuelve torpe.
*   **Los tests corren contra Postgres real** (`AGENTS.md:58`: «necesita Postgres vivo»; la limpieza entre tests está en `docs/patterns.md` §11). La ventaja típica del hexágono, testear el dominio sin infraestructura, aquí aporta poco.
*   **No hay un segundo adaptador de base a la vista.** Hexagonal rinde cuando el mismo núcleo se conecta a varias infraestructuras; acá hay una app web sobre una base.
*   **Next.js ya provee los adaptadores de entrada.** Server Actions y Route Handlers cumplen ese rol; envolverlos en otra capa suma archivos sin sumar aislamiento.
*   **Costo sin retorno visible:** hoy 26 archivos de `services/` y 29 de `actions/` importan Drizzle o `@/shared/db` directamente. Reescribirlos no entrega ninguna funcionalidad.

---

## 3. La regla propuesta

1.  **Todo servicio de terceros** (HTTP a un dominio que no es nuestro, SDK de un proveedor, DNS público) se consume **sólo a través de un puerto**: una interfaz TypeScript que habla el idioma del dominio, no el del proveedor.
2.  **El puerto vive junto a su servicio**, en `src/shared/services/<servicio>/` (o `src/features/<f>/services/<servicio>/` si es exclusivo de una feature):
    *   `tipos.ts` — el puerto y los tipos de dominio que devuelve.
    *   `adaptadores/<proveedor>.ts` — un archivo por proveedor; es el **único** lugar que conoce su URL, su formato y sus credenciales.
    *   `<servicio>Service.ts` — elige el adaptador (orden, respaldo, caché) y expone funciones de dominio.
3.  **Fuera de ese directorio nadie importa un adaptador**, ni escribe la URL del proveedor. Componentes, actions y rutas llaman al servicio.
4.  **Los componentes cliente nunca llaman a un tercero.** Van por una ruta o acción propia. (Ya es la regla de hecho desde el plan 41: `brandService.ts` no importa `resolutorIdentidad.ts` por los módulos nativos.)
5.  **Las variables de entorno de un proveedor las lee sólo su adaptador.**
6.  **Los tests del servicio mockean el puerto, no `fetch`.** Los tests del adaptador sí stubbean `fetch` con fixtures reales del proveedor.

**Lo que la regla no toca:** Drizzle, los repositorios, el motor de partida doble, el Outbox, las features. No se crea ninguna capa nueva fuera de los servicios externos.

**Por qué no `src/shared/ports/`:** un directorio global de puertos separa la interfaz de su único consumidor y de sus adaptadores. Coubicarlos sigue la estructura feature-driven que ya existe, y es la forma que el plan 35 ya eligió por su cuenta (§5).

---

## 4. Inventario: dónde aplica hoy

Contrastado contra el código el 2026-10-10 (`grep` de URLs `https://` y de SDKs en `package.json`).

| Servicio | Dónde está hoy | Estado frente a la regla |
| :-- | :-- | :-- |
| **Identidad de marca** (ícono y color) | `src/shared/services/brand/resolutorIdentidad.ts` con `fetchSeguro.ts` | Casi conforme: un solo punto de entrada (`resolverIdentidad`), detrás de `/api/brand/identidad`. Falta separar las fuentes (`sitio`, `google-s2`) en adaptadores |
| **Búsqueda de dominios de marca** | `src/shared/services/brand/verificados.ts`, detrás de `/api/brand?q=` | Conforme en lo esencial (DNS y HTML vía `fetchSeguro`). Sin proveedor externo de pago |
| **Favicon de Google S2 armado a mano** | `brandService.ts:65` (`getBrandLogoUrl`) y `src/app/api/brand/route.ts` (campo `icon`) | **No conforme:** la URL del proveedor está escrita en dos lugares fuera de un adaptador |
| **Clearbit** | `AddSubscriptionModal.tsx` y `src/shared/db/seed.ts` (`logo.clearbit.com`) | **No conforme:** un componente cliente arma la URL de un tercero. Además, hay que comprobar si el servicio sigue respondiendo |
| **Cotizaciones** (plan 35, sin ejecutar) | Diseñado en `src/shared/services/exchangeRate/` con `adaptadores.ts` y `proveedores.ts` | **Ya sigue la forma** (§5). Primer caso nuevo que nace conforme |
| **Laboratorio de marcas** | `src/features/sandbox/services/marcas/` | **Exento:** su función es comparar proveedores crudos. No es código de producción |
| **Resend, QStash, Redis** | No están en el repo (`package.json` no los trae; son infraestructura de FinanceApp-WSL sin migrar) | Entran ya conformes cuando se migren |

**`circuitBreaker.ts` no lo usa nadie:** `src/shared/lib/circuitBreaker.ts` sólo lo importa su test, y `docs/patterns.md` §4 todavía lo presenta como protección de Brandfetch, que ya no existe. Si un adaptador necesita disyuntor, ese es el lugar donde se compone; si no, queda para retirar (decisión aparte, no de este RFC).

---

## 5. Contraste con lo que ya existe

*   **`docs/patterns.md` §4 y §5** describen Brandfetch como fuente vigente (§4: «como la Brandfetch API»; §5: `brand_domain` «para Brandfetch», «la CDN de Brandfetch»). Quedaron viejos con el plan 41. Si este RFC se aprueba, se reescriben §5 para remitir acá y §4 según lo que se decida del disyuntor.
*   **RFC 026 (integraciones salientes, `DRAFT`)** trata **qué** datos se traen (Open Banking, cotizaciones, mercados) y **cómo se guardan las credenciales** (su bloqueante, §3). Este RFC trata **por dónde entra el código** de cualquier tercero. No se pisan: cuando el 026 se apruebe, cada proveedor que defina se implementa como adaptador según el §3 de acá.
*   **Plan 35 (cotizaciones)** ya define `src/shared/services/exchangeRate/types.ts` (el puerto: `origen: "dolarapi" | "awesomeapi" | "memoria"`), `adaptadores.ts`, `proveedores.ts` y `exchangeRateService.ts` con caché y respaldo, consumido sólo por `cotizacionesActions.ts`. Es exactamente la regla del §3, salvo que los adaptadores están en un solo archivo. **No hace falta tocar el plan 35**; dividir `adaptadores.ts` por proveedor es opcional y se decide al ejecutarlo.
*   **`ARCHITECTURE.md` §2** no cambia de modelo; se le agrega una línea que remita a este RFC al describir `services/`.

---

## 6. Adopción

**Sin migración masiva.** La regla se aplica:

1.  **A todo servicio externo nuevo** desde la aprobación (cotizaciones es el primero).
2.  **A los existentes, cuando se toquen.** No se abre un plan sólo para mover los no conformes del §4.
3.  **Una excepción recomendada, chica:** concentrar la URL de Google S2 en un solo lugar (hoy está en `brandService.ts` y en `/api/brand`), porque son dos líneas y es el próximo proveedor que podría cambiar.

**Lo que queda fuera y se decide aparte:**

*   Extraer el cálculo puro del motor contable (validar Debe = Haber, armar las líneas de un asiento) a funciones sin base. Mejora tests y lectura, pero no es un puerto ni un servicio externo.
*   El destino de `circuitBreaker.ts`.
*   Reemplazar Clearbit.

---

## 7. Criterio de verificación

Cuando la regla esté aplicada a un servicio, esto da vacío fuera de su directorio de adaptadores (ejemplo para Google S2):

```bash
grep -rn "google.com/s2" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | grep -v 'adaptadores/'
```

---

## 8. Aprobación

*   **Estado:** `DRAFT`. Pendiente de revisión del usuario.
