---
name: estado-actual
description: Dónde quedó la última ronda — ramas, qué está verificado, qué hay en cola y qué está sobre la mesa sin plan.
metadata:
  type: project
---

# Estado al cerrar la ronda del 2026-09-10 (quinta del día)

**Verificar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas

```
origin/master                                 8e086d9   NO pusheado todavía
master                                        ba8b7ca   consolidado, 4 commits por delante de origin
  └─ fix/mocks-de-ui-y-dict-obligatorio       ece10ba   rama activa, árbol limpio, TERMINADA Y VERDE
```

## Dónde quedó la rama activa

**Terminada.** `e5f1e4f` ejecutó el plan `docs/planes/storage-tolerante-y-cierre-de-mocks-ui.md`
completo: `@/shared/lib/safeStorage` (`readStorage`/`writeStorage`) creado y adoptado en los cuatro
sitios (`NotificationsContext`, `MetricsVisibilityContext`, `ProfileContext`, `AddSubscriptionModal`),
`dict` obligatorio en `CategoriesSettingsContainer`, y la Regla 5 del §12 de `patterns.md`.

**Verificado de forma independiente** con `verificador` sobre `e5f1e4f`, los cuatro en verde:
**54 archivos de test / 399 tests**, eslint 0/0, `tsc --noEmit` 0 errores, build exitoso.

**Ojo con el conteo:** el plan predijo «53 suites / 399 tests» y `obra` repitió ese número en vez de
la salida real. Eran 54: el plan sumó los 6 tests de `safeStorage.test.ts` pero no contó el archivo
nuevo que los trae. No fue defecto de ejecución, fue aritmética del plan. **Al predecir totales en un
plan que crea un archivo de test, sumar el archivo además de los tests.**

`ece10ba` cierra los dos hallazgos de `obra` (ver abajo) y asienta la verificación.

**Pendiente y consciente:** `master` **no está pusheado** (4 commits por delante de `origin/master`)
y las tres ramas ya contenidas —`feat/bandeja-recurrencias`, `fix/cabos-rfc023-y-limpieza-de-tests`,
`fix/page-header-unico-por-pagina`— **no se borraron**: ninguna de las dos cosas se pidió.

**Artifact de la hoja de ruta (versión 8):** refleja `ba8b7ca`, 393 tests, Fase 2 en 4 de 6.
**Desactualizado**: no incluye esta rama. **Trampa al republicar:** lo que devuelve `action: "read"`
viene con el envoltorio `<!doctype><head><body>` que agrega la publicación — hay que quitarlo antes
de republicar. Y el `favicon` (📒) hay que pasarlo explícito o la publicación se rechaza.

## Los dos hallazgos de la ronda, ya enrutados

1.  **`NotificationsContext.test.tsx` es un placeholder** → bajado a `TECHNICAL_DEBT.md` §7, con la
    trampa del estado mutable de módulo anotada. Prioridad baja: sirve datos de demo hardcodeados.
2.  **El script anti-flash del `<head>` lee `localStorage` directo** (`src/app/[lang]/layout.tsx:92`)
    → **no es deuda, el código está bien**: ya tiene su `try/catch` y la clave coincide con la que
    escribe `ProfileContext.tsx:50`. Lo que sí estaba mal era la Regla 5 recién escrita, que decía
    «nunca directo» sin nombrar esta excepción permanente. Corregido en `ece10ba`.

## En cola — ningún plan escrito sin ejecutar

## Sobre la mesa, sin plan

*   **Consolidar `fix/mocks-de-ui-y-dict-obligatorio` sobre `master`** — está verde y lista; el merge
    lo decide el usuario.
*   `dict?:` opcional heredado, **5 declaraciones en 4 archivos**: `ContactsTable.tsx:26`,
    `PaymentMethodsPanel.tsx:45`, `ContactFormModal.tsx:26` y `:43`, `MonthSelector.tsx:39`. Shape
    acotado y sin cast, así que es menos grave que el caso ya cerrado; es la continuación natural.
*   Las cuatro rutas del mock que el inventario no listaba: `/reportes`, `/patrimonio`,
    `/configuracion`, `/mejorar-plan`. **Ninguna tiene RFC.**
*   Las propuestas que faltan de la sesión de diseño de clasificación — ver
    [[decisiones-modelo-clasificacion]].
*   Deuda preventiva abierta en `TECHNICAL_DEBT.md`: cobertura de métodos en el mock de `next/cache`,
    retroceso potencial de punteros en la migración `0026`, y el botón hamburguesa inerte del
    `PageHeader` (§8).
