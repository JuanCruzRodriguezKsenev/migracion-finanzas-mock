---
name: testing-de-componentes-cliente
description: Cómo se montan los tests de UI en FinanzIA — qué mockea el setup global, qué se usa real, y las trampas de jsdom que ya costaron una ronda.
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

**How to apply:** queda escrito como patrón §12 de `docs/patterns.md` al ejecutarse
`docs/planes/mocks-de-ui-y-dict-obligatorio.md`. La frontera con §11 (limpieza topológica de
`finanzas_db_test`) es: §11 gobierna integración, §12 gobierna UI en jsdom.

## Lo que hay que saber antes de tocar un test de UI

*   **`getDictionary` se puede llamar desde un test.** No tiene `server-only`; es un `import()`
    dinámico de `@/dictionaries/<locale>.json`. `await getDictionary( "es" )` en un `beforeAll` da el
    diccionario real y de paso verifica que las claves existan. Nunca inventar un diccionario de
    respaldo dentro del componente.
*   **`NotificationsProvider` funciona tal cual en jsdom:** `useSyncExternalStore` sobre memoria +
    `localStorage`, sin red ni base. Con `localStorage` vacío arranca en `DEMO_NOTIFICATIONS`, así
    que `unreadCount > 0` y `PageHeader` pinta el badge. **No contamina las aserciones**:
    `NotificationsDropdown` vive dentro de `<Popup>`, y `Popup.tsx:115` retorna `null` cerrado.
*   **Un doble de `next/navigation` necesita `vi.hoisted`.** `vi.mock` se eleva sobre los `const`
    del archivo; sin `vi.hoisted` la factory lee la variable antes de inicializarla y vitest corta
    con *"Cannot access 'x' before initialization"*.
*   **`useRouter: () => ( { push: vi.fn() } )` devuelve un objeto nuevo por llamada** y hace
    imposible aseverar `router.refresh()` — justo lo que se cambió en cards en `e280825`. El doble
    tiene que ser un objeto estable y exportado.
*   Sólo `CategoriesSettingsContainer` tiene test entre los siete contenedores que montan
    `PageHeader`. Los otros seis lo van a necesitar cuando se testeen.
