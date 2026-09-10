# Plan — Acceso tolerante a Storage y cierre de los mocks de UI

**Rama:** `fix/mocks-de-ui-y-dict-obligatorio`, ya creada. **No cambiar de rama.**

**Origen:** informe de ejecución de `docs/planes/mocks-de-ui-y-dict-obligatorio.md`, que se detuvo a
mitad del Paso 3. Este plan **continúa esa rama**, no la reemplaza: los Pasos 1, 2, 4 y 5 de aquel
plan ya están aplicados y commiteados.

**Punto de partida verificado el 2026-09-10 por `tanda`, sobre el árbol de esta rama:**

```
Test Files  1 failed | 52 passed (53)
     Tests  3 failed | 390 passed (393)
```

Los 3 tests rojos son los de `CategoriesSettingsContainer.test.tsx`, todos por la misma causa.
`eslint`, `tsc --noEmit` y `build` ya estaban en verde y **este plan no debe moverlos**.

---

## Por qué

Montar el `<NotificationsProvider>` real en jsdom estalla con:

```
TypeError: Cannot read properties of undefined (reading 'getItem')
 ❯ getStoredNotifications src/features/notifications/context/NotificationsContext.tsx:61:30
```

**La causa NO es la que dice el informe de ejecución.** Aquel informe afirma que jsdom corre bajo
`about:blank` con origen opaco, y que por eso `window.localStorage` no existe pero el global sí es
distinguible. Sondeado en este entorno, es falso:

```
URL jsdom                     : http://localhost:3000/
typeof window.localStorage    : undefined
typeof globalThis.localStorage: undefined
window === globalThis         : true
descriptor globalThis         : {"get":"function","value":"undefined","configurable":true}
```

El origen no es opaco. Lo que ocurre es que en vitest 4 el `window` de jsdom **es** `globalThis`, y
en ese objeto quedó el accessor nativo de Node 26 que devuelve `undefined` y emite
`ExperimentalWarning: localStorage is not available because --localstorage-file was not provided`.
`window.localStorage` y `localStorage` son exactamente la misma cosa rota. Cualquier plan que se
apoye en la distinción entre ambos falla.

**Decisión del usuario (2026-09-10):** la respuesta a *«el runtime puede no tener Storage»* vive en
el **código de producción**, no en el harness de tests, y se generaliza en un helper compartido.

El motivo es que **el repo ya había tomado esa decisión** una vez:
`AddSubscriptionModal.tsx:119-127,489-494` envuelve sus accesos en `try/catch` con el comentario
*"localStorage bloqueado"*. Poner un polyfill en el harness escribiría en `patterns.md` una regla
(*"en tests siempre hay Storage"*) que contradice código que ya existe, y dejaría vivo un defecto
real de navegador: en Safari y en Firefox con cookies de terceros bloqueadas, **leer la propiedad
`window.localStorage` lanza `SecurityError`** antes de llegar a `getItem`.

---

## Radio de impacto

Cuatro sitios de producción acceden a Storage. El informe de ejecución sólo mapeó el primero.

| Archivo y líneas | Acceso actual | Guardia hoy | Paso |
| :--- | :--- | :--- | :--- |
| `NotificationsContext.tsx:61,111,118` | `localStorage.getItem` / `.setItem` | sólo `typeof window` | 3 |
| `MetricsVisibilityContext.tsx:34,49` | `localStorage.getItem` / `.setItem` | **ninguna** | 4 |
| `ProfileContext.tsx:49` | `localStorage.setItem` | **ninguna** | 5 |
| `AddSubscriptionModal.tsx:120,490` | `localStorage.getItem` / `.setItem` | `try/catch` propio | 6 |

Quién construye o lee cada pieza que este plan toca:

| Pieza | Quién más la usa | Qué le pasa |
| :--- | :--- | :--- |
| `src/shared/lib/safeStorage.ts` (**nuevo**) | Nadie hoy. Lo consumen los Pasos 3-6 | Se crea en Paso 1 |
| `NotificationsProvider` | `layout.tsx`, `PageHeader.tsx:52`, `NotificationsDropdown.tsx:25`, `DashboardAlerts.tsx:70`. Tests que lo montan: **sólo** `CategoriesSettingsContainer.test.tsx` | Pasa a verde sin tocar el test |
| `MetricsVisibilityProvider` | `Sparkline.test.tsx` importa **sólo el contexto**, no monta el provider — por eso hoy pasa | Queda apto para montarse en jsdom |
| `ProfileProvider` | Ningún test lo monta hoy | Ídem |
| `docs/patterns.md` §12 | Escrito por la ejecución anterior, ya en el árbol | Se **enmienda**, no se reescribe |

**Verificado antes de escribir este plan:** no existe ningún helper de storage en el repo
(`grep -rln "safeStorage\|storageHelper\|getStorage" src/` no devuelve nada), y `src/shared/lib/`
contiene hoy `auth`, `circuitBreaker`, `currencyFormatter`, `dictionary`, `env`, `logger`, `result`
y los dos setup de vitest.

---

## Reusos: qué hace hoy cada pieza que el plan manda usar

*   **`AddSubscriptionModal.tsx:119-127`** — el precedente que se generaliza. Su `try` envuelve
    **más que el `getItem`**: incluye el `countries.find(...)` y el `return( found )`. Al migrarlo
    (Paso 6) hay que conservar esa lógica fuera del helper, no arrastrarla adentro.
*   **`currencyFormatter.ts:16-35`** — el modelo de helper de `src/shared/lib/`: función exportada
    suelta (no un objeto namespaced), TSDoc con `@param`/`@returns`, y un `try/catch` que cae a un
    valor por defecto documentado en el comentario del `catch`. `safeStorage.ts` se escribe con esa
    misma forma.
*   **`NotificationsContext.tsx:55-58`** — la guardia `if( typeof window === "undefined" ) return(
    EMPTY_NOTIFICATIONS ) ;` **se conserva tal cual**. No es redundante con el helper: distingue
    servidor (donde el arranque correcto es *vacío*) de cliente-sin-storage (donde el arranque
    correcto es `DEMO_NOTIFICATIONS`). Borrarla haría que el servidor renderice las notificaciones
    de demo y rompería la hidratación.
*   **`useSyncExternalStore`** — `getSnapshot` debe devolver un valor **estable** entre llamadas o
    React entra en bucle infinito. `NotificationsContext` ya lo garantiza cacheando en
    `memoryNotifications`; `MetricsVisibilityContext` devuelve un `boolean`, que es primitivo. El
    helper no cambia ninguna de las dos cosas porque devuelve `string | null`.
*   **`vi.stubGlobal`** — **sondeado en este entorno, funciona**: el descriptor de `localStorage` es
    `configurable: true`, así que `vi.stubGlobal( "localStorage" , fake )` lo redefine y queda
    visible tanto como `window.localStorage` como por el global desnudo. Y un getter que lanza
    (simulado con `Object.defineProperty`) **sí** es atrapable por el `try` del helper. Ambas cosas
    se verificaron antes de escribir este plan; el Paso 2 depende de las dos.

---

## Paso 1 — Crear el helper `safeStorage`

**Archivo nuevo:** `src/shared/lib/safeStorage.ts`

```ts
/**
 * @file safeStorage.ts
 * Acceso tolerante a `localStorage`. El Storage no está garantizado en todos los runtimes:
 * en SSR no existe, en Safari y en Firefox con cookies de terceros bloqueadas leer la
 * propiedad `window.localStorage` lanza `SecurityError`, y bajo jsdom + Node el accessor
 * nativo devuelve `undefined`. Toda lectura o escritura de preferencias pasa por acá.
 */

/**
 * Lee una clave del almacenamiento local sin propagar errores del entorno.
 *
 * @param key - Clave a leer.
 * @returns El valor almacenado, o `null` si no existe o el Storage no está disponible.
 */
export function readStorage( key: string ): string | null {
  if( typeof window === "undefined" ) { return( null ) ; }

  try {
    return( window.localStorage?.getItem( key ) ?? null ) ;
  } catch {
    // Storage bloqueado o no disponible — se opera sin preferencia persistida
    return( null ) ;
  }
}

/**
 * Escribe una clave en el almacenamiento local sin propagar errores del entorno.
 *
 * @param key - Clave a escribir.
 * @param value - Valor a persistir.
 * @returns `true` si la escritura se concretó, `false` si el Storage no estaba disponible.
 */
export function writeStorage( key: string , value: string ): boolean {
  if( typeof window === "undefined" ) { return( false ) ; }

  try {
    window.localStorage?.setItem( key , value ) ;
    return( true ) ;
  } catch {
    // Storage bloqueado o cuota excedida — la preferencia no se persiste
    return( false ) ;
  }
}
```

Tres cosas que **no** hay que cambiar de esa forma:

*   **El acceso a `window.localStorage` va dentro del `try`.** Es la lectura de la propiedad la que
    lanza en Safari, no el `getItem`. Sacarla del `try` deja el bug vivo.
*   **El `?.` y el `try` conviven a propósito.** El `?.` cubre el caso jsdom/Node (getter que
    devuelve `undefined`); el `try` cubre el caso navegador (getter que lanza). Cada uno atrapa un
    caso que el otro no.
*   **No agregar `removeStorage`.** Ningún sitio del repo llama a `removeItem`.

---

## Paso 2 — Test del helper

**Archivo nuevo:** `src/shared/lib/safeStorage.test.ts`, con `// @vitest-environment jsdom` en la
primera línea (el default de `vitest.config.ts` es `node`, donde `typeof window === "undefined"` y
sólo se podría probar un camino).

El doble se instala con `vi.stubGlobal( "localStorage" , ... )` y se retira con
`vi.unstubAllGlobals()` en un `afterEach`. **Esto no viola la Regla 3 del §12**: `localStorage` es
un global del entorno, no código propio del proyecto.

Escribir exactamente estos **seis** casos:

1.  `readStorage` devuelve el valor guardado cuando el Storage funciona.
2.  `readStorage` devuelve `null` para una clave ausente.
3.  `readStorage` devuelve `null` cuando el getter de `localStorage` **lanza** — simular con
    `Object.defineProperty( globalThis , "localStorage" , { configurable: true , get() { throw new Error( "SecurityError" ) ; } } )`.
4.  `readStorage` devuelve `null` cuando `localStorage` es `undefined` — `vi.stubGlobal( "localStorage" , undefined )`, que es el caso real de este entorno.
5.  `writeStorage` persiste y devuelve `true` con Storage disponible.
6.  `writeStorage` devuelve `false` sin lanzar cuando el `setItem` lanza (cuota excedida).

El doble de Storage se arma con un `Map` en memoria, como en la sonda:
`{ getItem: ( k ) => ( m.has( k ) ? m.get( k )! : null ) , setItem: ( k , v ) => { m.set( k , v ) ; } }`.

**Estos seis casos suben el total de 393 a 399.** Es el único cambio de conteo que este plan
autoriza.

---

## Paso 3 — `NotificationsContext` adopta el helper

**Archivo:** `src/features/notifications/context/NotificationsContext.tsx`

1.  Agregar al bloque de imports `// Shared` (respetando la pirámide invertida del §4):
    `import { readStorage , writeStorage } from "@/shared/lib/safeStorage" ;`
2.  Línea 61: `const saved = localStorage.getItem( STORAGE_KEY ) ;`
    → `const saved = readStorage( STORAGE_KEY ) ;`
3.  Líneas 110-112 — el `if( typeof window !== "undefined" ) { localStorage.setItem( ... ) }` se
    reemplaza por la llamada sola, porque el helper ya trae la guardia:
    `writeStorage( STORAGE_KEY , JSON.stringify( next ) ) ;`
4.  Líneas 116-119 — igual en `resetDemo()`:
    `writeStorage( STORAGE_KEY , JSON.stringify( DEMO_NOTIFICATIONS ) ) ;`

**Conservar intacta la guardia de las líneas 55-57** (`if( typeof window === "undefined" ) return(
EMPTY_NOTIFICATIONS ) ;`) por el motivo explicado en «Reusos». **No tocar `subscribe()`**: sus
guardias son sobre `window.addEventListener`, no sobre Storage.

---

## Paso 4 — `MetricsVisibilityContext` adopta el helper

**Archivo:** `src/shared/ui/layout/MetricsSection/MetricsVisibilityContext.tsx`

1.  Agregar el import de `@/shared/lib/safeStorage` en un bloque `// Shared`.
2.  Línea 34: `const stored = localStorage.getItem( STORAGE_KEY ) ;`
    → `const stored = readStorage( STORAGE_KEY ) ;`
3.  Línea 49: `localStorage.setItem( STORAGE_KEY , String( !isContentVisible ) ) ;`
    → `writeStorage( STORAGE_KEY , String( !isContentVisible ) ) ;`

**No tocar la línea `return( stored === null ? true : (stored === "true") ) ;`.** `readStorage`
devuelve `null` exactamente en los mismos casos en que `getItem` devolvía `null`, más los casos que
antes lanzaban: el default de `true` (métricas visibles) se preserva y ahora también cubre el
Storage bloqueado. **No tocar `subscribe()`** ni `window.dispatchEvent`.

---

## Paso 5 — `ProfileContext` adopta el helper

**Archivo:** `src/features/profile/context/ProfileContext.tsx`

Línea 49: `localStorage.setItem( "theme" , theme ) ;` → `writeStorage( "theme" , theme ) ;`,
agregando el import al bloque `// Shared` existente (donde ya está `Result , ok , fail`), ordenado
por longitud de línea.

**No tocar `document.documentElement.setAttribute( "data-theme" , activeTheme )`** de la línea
anterior: el tema se aplica igual aunque la preferencia no se persista, y ése es justamente el
comportamiento correcto cuando el Storage está bloqueado.

---

## Paso 6 — `AddSubscriptionModal` migra su `try/catch` al helper

**Archivo:** `src/features/subscriptions/components/AddSubscriptionModal.tsx`

1.  Líneas 119-127 — el `try` envuelve el `getItem` **y** el `find` **y** el `return`. Queda:

    ```ts
    const savedCode = readStorage( COUNTRY_STORAGE_KEY ) ;
    if( savedCode ){
      const found = countries.find( ( c ) => c.code === savedCode ) ;
      if( found ){ return( found ) ; }
    }
    ```

    Es decir: se elimina el `try`/`catch` y su comentario, y **se conserva la lógica que estaba
    adentro**, ahora fuera. El `try` siguiente (el de `Intl.DateTimeFormat`) **no se toca**.

2.  Líneas 489-494 — el `try`/`catch` alrededor del `setItem` se reemplaza por
    `writeStorage( COUNTRY_STORAGE_KEY , found.code ) ;` a secas.

Este paso no cambia comportamiento observable: sustituye dos `try/catch` manuales por el helper que
hace lo mismo. Está en el plan para que quede **un** modo de acceder a Storage en el repo y el
patrón nuevo no nazca ya contradicho.

---

## Paso 7 — Enmendar `docs/patterns.md` §12

El §12 ya está escrito en el árbol por la ejecución anterior. **Enmendarlo, no reescribirlo.**

1.  **Agregar una Regla 5 — El Storage no está garantizado.** Todo acceso a `localStorage` desde
    código propio pasa por `readStorage`/`writeStorage` de `@/shared/lib/safeStorage`. Nunca
    `localStorage.getItem` directo, ni siquiera detrás de `typeof window !== "undefined"`: esa
    guardia cubre SSR pero no cubre ni al navegador con Storage bloqueado (donde **leer la
    propiedad** lanza `SecurityError`) ni a jsdom bajo Node, donde el accessor nativo devuelve
    `undefined`. Corolario explícito: **el harness de tests no debe polyfillear `localStorage`** —
    si un componente no monta en jsdom por Storage, el defecto está en el componente.

2.  **Corregir la Regla 4**, que hoy dice que los dobles «se declaran mediante `vi.hoisted` y se
    exportan» sin decir cómo. Agregar la restricción sintáctica que costó la ejecución anterior:
    `export const x = vi.hoisted( ... )` **no compila** — el transformador de vitest corta con
    `SyntaxError: Cannot export hoisted variable`. La forma que funciona es declarar y exportar por
    separado:

    ```ts
    const routerMock = vi.hoisted( () => ( { push: vi.fn() , /* ... */ } ) ) ;

    export { routerMock } ;
    ```

3.  **Corregir el texto del §12 o de cualquier doc de esta rama que afirme que
    `NotificationsProvider` «funciona tal cual en jsdom».** Con el Paso 3 aplicado pasa a ser cierto;
    antes no lo era, y la afirmación sin matizar es la que hizo descarrilar la ejecución anterior.

---

## Paso 8 — Doc de estado

Actualizar `docs/trabajo-en-vuelo.md` **en el mismo commit** que los Pasos 1-7: dejar asentado que la
rama cierra `dict` obligatorio, la política de mocks de UI y el acceso tolerante a Storage, con el
total de tests en 399, y el próximo paso en revisión y consolidación sobre `master`.

---

## Lo que NO hay que construir

| No hacer | Por qué |
| :--- | :--- |
| Polyfillear `localStorage` en `vitest.setup.dom.ts` | Es la opción que el usuario descartó. Ocultaría el defecto de producción en vez de arreglarlo |
| Mockear `useNotifications` local en `CategoriesSettingsContainer.test.tsx` | Rompe el objetivo de la ronda anterior. El provider real tiene que montar |
| Tocar `CategoriesSettingsContainer.test.tsx` o `.tsx` | Ya están correctos. Pasan a verde solos cuando el Paso 3 se aplica. **Si hay que tocarlos, algo del Paso 3 salió mal** |
| Tocar `vitest.setup.mocks.ts` | Ya quedó bien: `next/cache`, `next/navigation` hoisted y exportado, y nada de código propio |
| Completar `NotificationsContext.test.tsx` (hoy es `expect( true ).toBe( true )`) | Ronda aparte. Queda anotado como deuda |
| Agregar guardias `typeof window` a los `addEventListener` / `dispatchEvent` | Fuera de alcance: `subscribe` de `useSyncExternalStore` no corre en servidor |
| Tocar el script inline de tema en `layout.tsx:92` | Corre como string en el navegador real, fuera del grafo de módulos. No puede importar el helper |
| Convertir `safeStorage` en un objeto namespaced o en una clase | `src/shared/lib/` usa funciones sueltas exportadas. Ver `currencyFormatter.ts` |
| Agregar `clearMocks` a `vitest.config.ts` | Cambia las 53 suites sin necesidad |

---

## Verificación

Los cuatro, en este orden, y **pegar la salida cruda en el informe — no describirla**:

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit | grep -c "error TS"
pnpm build
```

**Números esperados:**

*   `pnpm test` → **53 suites en verde, 399 tests en verde.** Son los 393 actuales (con los 3 de
    `CategoriesSettingsContainer` pasando de rojo a verde) más los 6 casos nuevos del Paso 2.
*   `eslint` → 0 errores, 0 warnings.
*   `grep -c "error TS"` → `0`.
*   `build` → exitoso.

**Entorno:** `pnpm test` necesita el contenedor `postgres-dev` arriba. Si la suite muere en el setup
con `ECONNREFUSED` o `AggregateError`, es entorno caído, no suite rota: levantar el contenedor y
repetir.

**Señal de que el Paso 3 quedó a medias:** si `CategoriesSettingsContainer.test.tsx` sigue rojo con
`Cannot read properties of undefined (reading 'getItem')`, quedó un acceso directo a `localStorage`
sin migrar. Buscarlo con:

```bash
grep -rn "localStorage\." src/ --include="*.ts" --include="*.tsx" | grep -v "safeStorage"
```

Tras este plan ese `grep` debe devolver **una sola línea**: el script inline de `layout.tsx:92`.
