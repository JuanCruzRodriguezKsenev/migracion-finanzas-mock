# Estado al cerrar la ronda del 2026-09-10 (séptima del día)

**Verificar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas

```
origin/master                            al día
master                                   consolidado y verde
  └─ docs/rfc-024-navegacion-por-entidad rama activa, árbol limpio, HEAD en 15dc15e
```

No queda ninguna otra rama local.

## Dónde quedó el RFC 024

**`APPROVED`** (`docs/proposals/024-instruments-and-entity-navigation.md`). Se parte en dos tandas y
**con la tanda 2 queda cerrado entero**.

*   **Tanda 1 — ejecutada y verificada en verde** (54 archivos, 400 tests, 0 ESLint, 0 TS, build OK).
    Directorio por entidad, familias separadas en el modal, `CardVisual`, `deudaDe()`, signo del
    Patrimonio Neto corregido (`51f1a50`) y puerta de atrás de `CreateAccountForm` cerrada (`72d06ff`).
*   **Tanda 2 — plan escrito, en cola para `obra`**, sin ejecutar:
    `docs/planes/024-tanda-2-plan-contable-en-settings.md`.

## Las cuatro decisiones que tomó el usuario para la tanda 2

1.  **La pestaña de auditoría muestra el plan de cuentas COMPLETO** (los cinco tipos, 71 filas en la
    base local), **no** sólo las nominales que estaban en `/accounts`. Motivo: auditar un saldo de
    banco o tarjeta exige ver `asset` y `liability`.
2.  **Se presenta como tabla** (`DataTable`, que ya existe y usan `ContactsTable` y
    `TransactionsTable`), con buscador (`SearchInput`), no como grilla de `Card`.
3.  **Feature nueva `src/features/settings/`** con el shell `SettingsContainer`, dueño del
    `PageHeader` y de las tabs. Motivo: Perfil, Preferencias y Seguridad no son contabilidad. Los
    paneles siguen en `accounting`.
4.  **Tab activa por `useState`**, no por query param: no hay ni un `searchParams` para tabs en el
    repo y no se inventa el patrón en esta tanda.

Decididas por mí e informadas: las labels de las tabs de `/settings` se localizan (hoy están
hardcodeadas en español), y el panel de auditoría **no** consulta `useMetricsVisibility()` porque el
interruptor que lo revierte vive en `MetricsSection`, que está en `/accounts` y no en `/settings`.

## Lo que destapó el contraste de esta ronda

*   **`AccountsContainer` hardcodea `<span>ARS</span>`** en el listado del plan contable, con
    `accounts.currency` existiendo desde siempre y el RFC 022 creando **una cuenta por divisa**.
    Mudarlo tal cual habría convertido la pantalla de auditoría en una que miente.
*   **`dict` y `lang` entran a `CategoriesSettingsContainer` SÓLO para el `PageHeader`.** Al mudarlo
    al shell quedan muertas: hay que sacarlas de la interfaz, del destructuring y del `render()` del
    test, o `eslint --max-warnings 0` corta.
*   **Tres docs declaraban vivo el defecto del Patrimonio Neto que la tanda 1 ya corrigió**
    (`TECHNICAL_DEBT.md` §6, `patterns.md` §8, `.agents/AGENTS.md` §8.6). **Corregidos en `15dc15e`.**
    Lección: al cerrar una tanda que arregla un defecto documentado, buscar el defecto por nombre de
    archivo en `docs/` y en `.agents/`.
*   **El §7 del RFC seguía sin ejecutar** (`cardsActions.ts` emite `Apertura deuda inicial ${label}`).
    Entró en la tanda 2 como paso 7, con assert nuevo dentro de un `it` existente.
*   **Cinco clases de CSS quedan huérfanas** al borrar la tab de `/accounts` (`.tabsRow`,
    `.entitySection`, `.entityTitle`, `.cardsGridPlan`, `.accountBalanceMuted`) y **cinco no**, porque
    las usa el modal de entidad. Contadas con `grep`, escritas en el plan.

## Los hallazgos que trajo `obra` de la tanda 1, ya enrutados

Los cuatro eran correcciones de rutas que el plan había escrito mal, ninguno es deuda:
diccionarios en `src/dictionaries/` (no `src/messages/`), los componentes de cuentas viven en
`features/accounting/components/` (no existe `features/accounts/`), y el test de esquema está en
`schemas/accounting.schema.test.ts` sin subcarpeta `__tests__`. **Anotado en
[[patrones-reusables]]**: verificar la ruta física con `find`/`grep -rln` antes de ponerla en un plan.

## Sobre la mesa, sin plan

*   Las tres propuestas que faltan de la sesión de diseño: reescritura del **RFC 008**, enmienda al
    **RFC 010** y enmienda al **RFC 003**. Las dos primeras referencian al 024 ya aprobado.
*   **La página de estadísticas**: sin RFC y sin nombre de ruta. Recibe el Patrimonio Neto que el 024
    desaloja de `/accounts` —que por decisión del usuario **se queda ahí hasta entonces**— y tiene que
    resolver la convención de signo de `monthly_summaries` (§9 del RFC 024).
*   `dict?:` opcional heredado, **5 declaraciones en 4 archivos**: `ContactsTable`,
    `PaymentMethodsPanel`, `ContactFormModal` (×2), `MonthSelector`.
*   **`/settings` no está internacionalizada** (`TECHNICAL_DEBT.md` §3): las ~790 líneas de
    `CategoriesSettingsContainer` llevan el texto en español directo. La tanda 2 localiza **sólo** las
    labels de las tabs; el resto sigue siendo deuda.
*   Las cuatro rutas del mock sin RFC: `/reportes`, `/patrimonio`, `/configuracion`, `/mejorar-plan`.
*   Deuda preventiva en `TECHNICAL_DEBT.md`: cobertura del mock de `next/cache`, retroceso de
    punteros en la migración `0026`, hamburguesa inerte del `PageHeader`, y `unarchive` que no
    deshace la cascada de `archive` (§4).

**Artifact de la hoja de ruta (versión 8):** refleja `ba8b7ca` y 393 tests. **Desactualizado**: no
incluye la consolidación de mocks/storage ni el RFC 024. **Trampas al republicar:** lo que devuelve
`action: "read"` viene con el envoltorio `<!doctype><head><body>` que agrega la publicación, hay que
quitarlo; el `favicon` (📒) va explícito o se rechaza; y el archivo es de ~1218 líneas, así que hay
que leerlo entero antes de republicar.
