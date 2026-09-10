---
name: testing-de-componentes-cliente
description: Cómo se montan los tests de UI en FinanzIA — qué mockea el setup global, qué se usa real, y las trampas de jsdom que ya costaron dos rondas.
metadata:
  type: project
---

# Tests de componentes cliente (jsdom)

**Decisión del usuario, 2026-09-10:** el setup global (`src/shared/lib/vitest.setup.mocks.ts`,
cargado por `vitest.config.ts` en las 53 suites) mockea **sólo dependencias de framework** que jsdom
no provee — `next/cache`, `next/navigation`. **El código propio del proyecto se monta real.**

**Why:** mockear `NotificationsContext` en el setup global anula en silencio la suite propia de esa
feature — y el mock ni siquiera exporta `NotificationsProvider`, así que ese import daría `undefined`
el día que el test placeholder se escriba de verdad.

**How to apply:** queda escrito como patrón §12 de `docs/patterns.md` (ya en el árbol desde
`bfaac23`). La frontera con §11 (limpieza topológica de `finanzas_db_test`) es: §11 gobierna
integración, §12 gobierna UI en jsdom.

## ⚠️ En jsdom NO hay `localStorage` — y la explicación intuitiva es falsa

**Corrige una nota anterior de este mismo archivo que decía que `NotificationsProvider` «funciona
tal cual en jsdom». No era cierto, y esa afirmación descarriló una ejecución completa.**

Sondeado en este repo (vitest 4.1.9, Node 26.7.0):

```
URL jsdom                     : http://localhost:3000/     ← NO es about:blank
typeof window.localStorage    : undefined
typeof globalThis.localStorage: undefined
window === globalThis         : true
descriptor globalThis         : {"get":"function","configurable":true}
```

*   **No es origen opaco.** La URL es `http://localhost:3000/`.
*   **`window.localStorage` y `localStorage` son la misma cosa rota**, porque en vitest 4 el `window`
    de jsdom *es* `globalThis`. Ahí quedó el accessor nativo de Node 26 que devuelve `undefined` y
    emite `ExperimentalWarning: localStorage is not available because --localstorage-file was not
    provided`. **Cualquier plan que distinga entre los dos accesos falla.**
*   El descriptor es `configurable: true`: `vi.stubGlobal( "localStorage" , fake )` **sí** lo
    redefine, y un getter que lanza (simulado con `Object.defineProperty`) **sí** lo atrapa un `try`.
    Ambas cosas están verificadas.
*   **Decisión del usuario (2026-09-10): NO se polyfillea el harness.** La tolerancia vive en
    producción, en `readStorage`/`writeStorage` de `@/shared/lib/safeStorage`. El motivo es que
    `AddSubscriptionModal` ya resolvía esto con `try/catch`, y un polyfill habría escrito una regla
    que contradice código existente. Ver [[patrones-reusables]].

## `vi.hoisted` no se puede exportar en la misma sentencia

`export const x = vi.hoisted( ... )` **no compila**: el transformador de vitest corta con
`SyntaxError: Cannot export hoisted variable`, y **tumba las 53 suites a la vez** con 0 tests
ejecutados (parece catástrofe, es un error de sintaxis). La forma correcta:

```ts
const routerMock = vi.hoisted( () => ( { push: vi.fn() , /* ... */ } ) ) ;

export { routerMock } ;
```

## Lo demás que hay que saber antes de tocar un test de UI

*   **`getDictionary` se puede llamar desde un test.** No tiene `server-only`; es un `import()`
    dinámico de `@/dictionaries/<locale>.json`. `await getDictionary( "es" )` en un `beforeAll` da el
    diccionario real y de paso verifica que las claves existan. Nunca inventar un diccionario de
    respaldo dentro del componente.
*   **`vi.hoisted` es obligatorio para el doble de `next/navigation`.** `vi.mock` se eleva sobre los
    `const` del archivo; sin él la factory lee la variable antes de inicializarla.
*   **`useRouter: () => ( { push: vi.fn() } )` devuelve un objeto nuevo por llamada** y hace
    imposible aseverar `router.refresh()` — justo lo que se cambió en cards en `e280825`. El doble
    tiene que ser un objeto estable y exportado.
*   **`NotificationsDropdown` no contamina las aserciones:** vive dentro de `<Popup>`, y
    `Popup.tsx:115` retorna `null` cerrado. Con storage vacío el store arranca en
    `DEMO_NOTIFICATIONS`, así que `unreadCount > 0` y `PageHeader` pinta el badge.
*   `NotificationsContext.test.tsx` es un **placeholder vacío** (`expect( true ).toBe( true )`), no
    importa nada del módulo. Escribirlo de verdad es deuda abierta.
*   Sólo `CategoriesSettingsContainer` tiene test entre los siete contenedores que montan
    `PageHeader`. Los otros seis lo van a necesitar cuando se testeen.
