# Estado al cerrar la ronda del 2026-09-10 (sexta del día)

**Verificar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas

```
origin/master                          al día (se pusheó el 2026-09-10, era el primer push)
master                                 consolidado y verde
  └─ docs/rfc-024-navegacion-por-entidad   rama activa, árbol limpio, sólo docs
```

Las cuatro ramas viejas ya contenidas se borraron. **No quedaba ninguna rama local fuera de
`master`**, así que esta ronda creó la suya.

## Dónde quedó esta ronda

**Escrito el RFC 024** —`docs/proposals/024-instruments-and-entity-navigation.md`, en `DRAFT`—, que
cubre el §4 de la sesión de diseño: `/accounts` como directorio por entidad, el instrumento
presentado como instrumento, el plan de cuentas mudado a `/settings` en sólo lectura, y el Patrimonio
Neto desalojado de `/accounts`.

**Dos decisiones que tomó el usuario en esta ronda:**

1.  **Propuesta nueva (024), no enmienda al RFC 007.** De las cinco decisiones del §4 sólo una es
    sobre tarjetas, y el 008 y el 010 van a tener que referenciarla.
2.  **El plan de cuentas se muda a `/settings` como pestaña de sólo lectura**, y `CreateAccountForm`
    pierde los tres tipos nominales.

**Lo que el contraste destapó, y es lo más valioso de la ronda:**

*   **No lleva migración.** `financial_entities` ya existe con `logo`/`brandDomain`/`color`, y
    `accounts`, `cards` y `contact_payment_methods` ya tienen su columna de entidad.
*   **Dos defectos activos**, ahora requisitos del RFC: el Patrimonio Neto de `AccountsContainer.tsx:87-89`
    **resta** los pasivos que ya vienen negados, así que infla el patrimonio; y `CreateAccountForm`
    + `createAccountAction` crean cuentas de gasto **huérfanas del árbol de categorías**, que es la
    puerta de atrás que el RFC 022 no cerró.
*   **Tres afirmaciones de la sesión de diseño resultaron falsas** — ver
    [[decisiones-modelo-clasificacion]], que ahora las lista.

**El usuario aprobó el 024** y `obra` ejecutó la **Tanda 1**:
Plan ejecutado: `docs/planes/024-tanda-1-directorio-por-entidad.md`.
Verificación delegada a `verificador`: **54 archivos, 400 tests pasados, 0 errores ESLint, 0 errores TS, build exitoso**.

**Qué cubrió la Tanda 1:**
*   Signo del Patrimonio Neto corregido en `AccountsContainer.tsx` (ahora suma los pasivos negativos según `patterns.md` §8).
*   Puerta de atrás de `CreateAccountForm` cerrada: `createAccountSchema` restringido a `asset` y `liability`, formulario simplificado (removida lógica muerta y `prevType`), y test unitario de rechazo de tipos nominales en `accounting.schema.test.ts`.
*   Directorio por entidad en `AccountsContainer.tsx`: carga concurrente de tarjetas con `getCardsAction()` en `accounts/page.tsx`, separación de familias (Tarjetas y Cuentas) en el modal de detalle con `CardVisual`, exclusión de cuentas que son reflejo de tarjetas para evitar contar deuda duplicada, y deuda de pasivos expresada en positivo mediante `deudaDe()`.
*   Textos localizados en los tres diccionarios (`es.json`, `en.json`, `br.json`).

**Próximo paso:** Escribir el plan de la **Tanda 2** (mudar el plan de cuentas a `/settings` en sólo lectura y activar navegación de tabs).

**Radio de impacto ya verificado para la tanda 1** (sirve igual si hay que rehacer el plan):
`createAccountSchema` tiene **un solo** consumidor (`createAccountAction`) y éste **un solo** llamador
(`CreateAccountForm`). El alta de categorías del RFC 022 crea sus cuentas con `insert( accounts )`
directo en `categoryRepository.ts`, **sin pasar por ninguno de los dos**: restringir el enum no la
toca.

**Artifact de la hoja de ruta (versión 8):** refleja `ba8b7ca` y 393 tests. **Desactualizado**: no
incluye la consolidación de mocks/storage ni este RFC. **Trampas al republicar:** lo que devuelve
`action: "read"` viene con el envoltorio `<!doctype><head><body>` que agrega la publicación, hay que
quitarlo; el `favicon` (📒) va explícito o se rechaza; y el archivo es de ~1218 líneas, así que hay
que leerlo entero antes de republicar.

## Los dos hallazgos de la ronda anterior, ya enrutados

1.  **`NotificationsContext.test.tsx` es un placeholder** → bajado a `TECHNICAL_DEBT.md` §7, con la
    trampa del estado mutable de módulo anotada. Prioridad baja: sirve datos de demo hardcodeados.
2.  **El script anti-flash del `<head>` lee `localStorage` directo** (`src/app/[lang]/layout.tsx:92`)
    → **no es deuda, el código está bien**: ya tiene su `try/catch` y la clave coincide con la que
    escribe `ProfileContext.tsx:50`. Lo que sí estaba mal era la Regla 5 recién escrita, que decía
    «nunca directo» sin nombrar esta excepción permanente. Corregido en `ece10ba`.

## Sobre la mesa, sin plan

*   `dict?:` opcional heredado, **5 declaraciones en 4 archivos**: `ContactsTable.tsx:26`,
    `PaymentMethodsPanel.tsx:45`, `ContactFormModal.tsx:26` y `:43`, `MonthSelector.tsx:39`. Shape
    acotado y sin cast, así que es menos grave que el caso ya cerrado; es la continuación natural.
*   Las cuatro rutas del mock que el inventario no listaba: `/reportes`, `/patrimonio`,
    `/configuracion`, `/mejorar-plan`. **Ninguna tiene RFC.**
*   Las tres propuestas que **siguen** faltando de la sesión de diseño: reescritura del RFC 008,
    enmienda al RFC 010 y enmienda al RFC 003. Las dos primeras referencian al 024, así que van
    después de que se apruebe. Ver [[decisiones-modelo-clasificacion]].
*   **La página de estadísticas**: sin RFC y sin nombre de ruta elegido. Es la que recibe el
    Patrimonio Neto que el 024 desaloja, y la que lee la dimensión de categoría del RFC 022.
*   Deuda preventiva abierta en `TECHNICAL_DEBT.md`: cobertura de métodos en el mock de `next/cache`,
    retroceso potencial de punteros en la migración `0026`, y el botón hamburguesa inerte del
    `PageHeader` (§8).
