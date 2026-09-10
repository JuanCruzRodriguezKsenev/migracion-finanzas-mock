# Plan — Diccionario obligatorio y política de mocks para componentes cliente

**Rama:** `fix/mocks-de-ui-y-dict-obligatorio`, ya creada y encadenada sobre
`fix/page-header-unico-por-pagina`. **No cambiar de rama.**

**Origen:** hallazgos del informe de ejecución de `docs/planes/` de la ronda de PageHeader
(rama `fix/page-header-unico-por-pagina`, commit `2fe778b`).

**Punto de partida:** batería en verde verificada de forma independiente el 2026-09-10 —
393/393 tests, 53/53 suites, `eslint . --max-warnings 0` en 0/0, `tsc --noEmit` 0 errores, build ok.
**Este plan no debe cambiar esos números**, salvo que un paso agregue tests (no agrega ninguno).

---

## Por qué

Al montar `PageHeader` dentro de `CategoriesSettingsContainer`, el test existente
(`CategoriesSettingsContainer.test.tsx`) quedó sin `dict` y sin los hooks de `next/navigation` ni el
contexto de notificaciones. Se resolvió **relajando el código de producción** (prop `dict` opcional
con un `FALLBACK_DICT` casteado con `as unknown as`) y **mockeando globalmente código propio**
(`NotificationsContext`). Las dos cosas apagan verificación real:

1. `dict?` opcional significa que una página futura puede olvidarse de pasarlo y la pantalla sale en
   español hardcodeado **sin error de tipos ni de build**. El `as unknown as` además apaga el
   typechecker sobre la forma del diccionario.
2. El mock global de `@/features/notifications/context/NotificationsContext` aplica a las 53 suites.
   Hoy no rompe nada porque `NotificationsContext.test.tsx` es un placeholder vacío; cuando se
   escriba de verdad, el mock lo anula en silencio — y ni siquiera exporta `NotificationsProvider`,
   así que ese import daría `undefined`.
3. `useRouter: () => ( { push: vi.fn() , ... } )` devuelve **un objeto nuevo en cada llamada**:
   ningún test puede aseverar `router.refresh()`, que es justo lo que se cambió en cards la ronda
   anterior (`e280825`).

**Decisión tomada por el usuario (2026-09-10):** el setup global mockea **sólo dependencias de
framework** que en jsdom no existen; el código propio del proyecto se usa real.

---

## Radio de impacto

| Pieza que se toca | Quién la construye o la lee | Qué le pasa |
| :--- | :--- | :--- |
| `CategoriesSettingsContainer` (props `dict`/`lang`) | `src/app/[lang]/(main)/settings/page.tsx:29-35` — **ya pasa `dict` y `lang`** | No cambia. Verificado: es el único consumidor de producción |
| | `CategoriesSettingsContainer.test.tsx` — 3 `render()` en líneas 106, 131, 157 | Paso 2 |
| `src/shared/lib/vitest.setup.mocks.ts` | `vitest.config.ts:22-25` → **las 53 suites** | Pasos 3 |
| mock de `NotificationsContext` que se elimina | Consumidores reales de `useNotifications`: `PageHeader.tsx:52`, `NotificationsDropdown.tsx:25`, `DashboardAlerts.tsx:70`. Tests que lo montan hoy: **sólo** `CategoriesSettingsContainer.test.tsx` (vía `PageHeader`) | Paso 2 le da el provider real |
| `docs/patterns.md` | Sección nueva §12 | Paso 4 |
| `docs/trabajo-en-vuelo.md` | Único doc de estado | Paso 5 |

**Verificado antes de escribir este plan:** ningún `.test.tsx` mockea `next/navigation` localmente,
ninguno asevera sobre `router`/`usePathname`, y de los siete contenedores que montan `PageHeader`
sólo `CategoriesSettingsContainer` tiene test.

---

## Reusos: qué hace hoy cada pieza que el plan manda usar

*   **`getDictionary( locale )`** (`src/shared/lib/dictionary.ts`) — `async`, hace `import()`
    dinámico de `@/dictionaries/<locale>.json` y cae a `en` si el locale no existe. **No tiene
    `server-only`**: se puede llamar desde un test sin ningún adaptador. Su tipo de retorno es la
    unión de los tres JSON, que es exactamente el tipo de la prop `dict`.
*   **`NotificationsProvider`** (`src/features/notifications/context/NotificationsContext.tsx:128`)
    — `useSyncExternalStore` sobre un store en memoria con espejo en `localStorage`. **No hace fetch
    ni toca red ni base**: funciona tal cual en jsdom. Con `localStorage` vacío arranca en
    `DEMO_NOTIFICATIONS`, así que `unreadCount` será > 0 y `PageHeader` pintará el badge numérico.
    Eso **no** interfiere con las aserciones del test: `NotificationsDropdown` vive dentro de
    `<Popup>`, y `Popup.tsx:115` retorna `null` cuando `open` es `false`, que es el estado inicial.
*   **`vitest.setup.mocks.ts`** — hoy tiene tres bloques: `next/cache` (de la ronda del RFC 023,
    se conserva), `next/navigation` (se reescribe) y `NotificationsContext` (se elimina).

---

## Paso 1 — `dict` y `lang` obligatorios en `CategoriesSettingsContainer`

**Archivo:** `src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.tsx`

1.  En `CategoriesSettingsContainerProps`, quitar los `?` de `dict` y `lang`:

    ```ts
    export interface CategoriesSettingsContainerProps {
      initialTree: CategoryTreeNode[] ;
      dict:        Awaited< ReturnType< typeof getDictionary > > ;
      lang:        string ;
    }
    ```

2.  **Eliminar el bloque `const FALLBACK_DICT = { ... } as unknown as ... ;` completo.** Conservar el
    `import type { getDictionary } from "@/shared/lib/dictionary" ;`, que sigue usándose en la interfaz.

3.  En la desestructuración de la función, quitar los valores por defecto: queda
    `{ initialTree , dict , lang }`.

4.  En el `return`, reemplazar el doble respaldo por el acceso directo:

    ```tsx
    <PageHeader
      title={dict.settingsPage.title}
      subtitle={dict.settingsPage.subtitle}
      showMonthSelector={false}
      dict={dict}
      lang={lang}
    />
    ```

    **Verificado:** `settingsPage.title` y `settingsPage.subtitle` existen con la misma forma en
    `es.json`, `en.json` y `br.json`, así que el acceso tipa sin `?.` contra el tipo unión.

**No tocar `settings/page.tsx`:** ya pasa ambas props.

---

## Paso 2 — El test monta con diccionario real y provider real

**Archivo:** `src/features/accounting/components/CategoriesSettings/CategoriesSettingsContainer.test.tsx`
(conserva su `// @vitest-environment jsdom` de la línea 1).

1.  Agregar a los imports (respetando el orden por bloques y la alineación por columnas del §4):

    ```tsx
    // Librerías externas
    import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;

    // Shared
    import { getDictionary } from "@/shared/lib/dictionary" ;

    // Feature: Notifications
    import { NotificationsProvider } from "@/features/notifications/context/NotificationsContext" ;
    ```

2.  Dentro del `describe`, junto a `sampleTree`, agregar el diccionario real y un helper de montaje:

    ```tsx
    let dict: Awaited< ReturnType< typeof getDictionary > > ;

    beforeAll( async () => {
      dict = await getDictionary( "es" ) ;
    } ) ;

    const renderContainer = ( tree: CategoryTreeNode[] ) => (
      render(
        <NotificationsProvider>
          <CategoriesSettingsContainer initialTree={tree} dict={dict} lang="es" />
        </NotificationsProvider>
      )
    ) ;
    ```

3.  Reemplazar los **tres** `render( <CategoriesSettingsContainer initialTree={sampleTree} /> ) ;`
    (líneas 106, 131 y 157) por `renderContainer( sampleTree ) ;`.

**No cambiar ninguna aserción ni ningún `vi.mocked( ... )` del archivo.** El mock local de
`../../actions/categoryActions` se conserva tal cual: son server actions, no código de UI.

---

## Paso 3 — El setup global mockea framework, no código propio

**Archivo:** `src/shared/lib/vitest.setup.mocks.ts`

1.  **Eliminar por completo** el bloque `vi.mock( "@/features/notifications/context/NotificationsContext" , ... )`.

2.  Reescribir el bloque de `next/navigation` con un objeto estable y exportado:

    ```ts
    export const routerMock = vi.hoisted( () => ( {
      push:    vi.fn() ,
      replace: vi.fn() ,
      refresh: vi.fn() ,
      back:    vi.fn() ,
      forward: vi.fn() ,
    } ) ) ;

    vi.mock( "next/navigation" , () => ( {
      useRouter:       () => routerMock ,
      usePathname:     () => "/" ,
      useSearchParams: () => new URLSearchParams() ,
    } ) ) ;
    ```

    **`vi.hoisted` no es opcional.** `vi.mock` se eleva por encima de las declaraciones del archivo;
    si `routerMock` fuera un `const` común, la factory lo leería antes de su inicialización y
    vitest cortaría con *"Cannot access 'routerMock' before initialization"*.

3.  Dejar `next/cache` intacto y actualizar el comentario de cabecera del archivo para que declare la
    política: **sólo dependencias de framework que jsdom no provee; el código propio del proyecto se
    monta real.**

**No agregar limpieza global de mocks** (`clearMocks`, ni un `beforeEach` con `vi.clearAllMocks()`):
cambiaría el comportamiento de las 53 suites sin necesidad. El test que un día asevere sobre
`routerMock` limpia lo suyo en su propio `beforeEach`; queda escrito en el patrón del Paso 4.

---

## Paso 4 — Asentar el patrón §12 en `docs/patterns.md`

**Contraste obligatorio antes de escribir una sola línea:** leer `docs/patterns.md` §11 ("Limpieza
Unificada de Base de Datos en Orden Topológico", líneas 292-336). §11 gobierna las suites de
**integración** contra `finanzas_db_test`; §12 gobierna las de **componentes cliente** en jsdom.
Nombrar esa frontera de forma explícita en el texto nuevo para que no se lean como reglas rivales.

Agregar al final del archivo `## 12. Montaje de Tests de Componentes Cliente (Client Component Test Harness)` con:

*   **Regla 1 — El diccionario nunca es opcional.** Un componente que renderiza texto traducible
    recibe `dict` como prop **obligatoria**. Prohibido un diccionario de respaldo embebido en el
    componente, y prohibido el cast `as unknown as` sobre la forma del diccionario: apaga la única
    verificación de que la clave existe en los tres JSON.
*   **Regla 2 — El test usa el diccionario real.** `await getDictionary( "es" )` en un `beforeAll`.
    Así el test también cubre que las claves existan, en vez de inventarlas.
*   **Regla 3 — Se mockea el framework, no el proyecto.** `vitest.setup.mocks.ts` sólo puede mockear
    módulos que jsdom no provee (`next/cache`, `next/navigation`). Un contexto o hook propio se monta
    con su provider real; si eso no fuera posible, el mock va **local al archivo de test**, nunca al
    setup global, para que no anule en silencio la suite propia de esa feature.
*   **Regla 4 — Los dobles del framework son estables y aseverables.** Declarados con `vi.hoisted` y
    exportados, para que un test pueda aseverar `routerMock.refresh` y limpiarlo en su `beforeEach`.

Referenciar el ejemplo vivo: `CategoriesSettingsContainer.test.tsx`.

---

## Paso 5 — Doc de estado

Actualizar `docs/trabajo-en-vuelo.md` **en el mismo commit** que los pasos 1-4: reemplazar la
mención a *"mocks de `next/navigation` y `NotificationsContext` incorporados a `vitest.setup.mocks.ts`
y fallback defensivo en `CategoriesSettingsContainer`"* por el resultado de este plan, y dejar el
próximo paso en revisión y consolidación sobre `master`.

---

## Lo que NO hay que construir

| No hacer | Por qué |
| :--- | :--- |
| Tocar los `dict?:` de `ContactsTable`, `PaymentMethodsPanel`, `ContactFormModal` y `MonthSelector` | Son de rondas anteriores, con shape acotado y sin cast. Fuera de alcance |
| Escribir tests nuevos para los otros seis contenedores con `PageHeader` | Ronda aparte. Este plan no debe mover el total de 393 tests |
| Completar `NotificationsContext.test.tsx` (hoy placeholder) | Ronda aparte; este plan sólo le saca el mock global de encima |
| Agregar `clearMocks: true` a `vitest.config.ts` | Cambia las 53 suites sin necesidad. Ver Paso 3 |
| Tocar el mock de `next/cache` | Es del RFC 023 y funciona |
| Cambiar `PageHeader` | Su `dict` ya es obligatorio: está bien como está |

---

## Verificación

Los cuatro, en este orden, y pegar la salida cruda en el informe — no describirla:

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit | grep -c "error TS"
pnpm build
```

**Números esperados, idénticos al punto de partida:** 393 tests / 53 suites en verde, 0 errores y
0 warnings de eslint, `0` como salida del `grep -c`, build exitoso.

**Entorno:** `pnpm test` necesita el contenedor `postgres-dev` arriba. Si la suite muere en el setup
con `ECONNREFUSED` o `AggregateError`, es entorno caído, no suite rota: levantar el contenedor y
repetir.

**Comprobación adicional del Paso 3**, porque es la que este plan puede romper a distancia: si alguna
suite que hoy pasa empieza a fallar con *"useNotifications debe usarse dentro de un
NotificationsProvider"*, es un componente que monta `PageHeader` sin el provider. La corrección es
envolverlo en `<NotificationsProvider>` en ese test, **nunca** devolver el mock al setup global.
