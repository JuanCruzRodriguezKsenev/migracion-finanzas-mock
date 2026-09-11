# Estado al cerrar la ronda del 2026-09-10 (quinta del día)

**Verificar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas

```
origin/master   al día
master          consolidado, verde, árbol limpio, SIN rama activa encima
```

**`master` se pusheó a `origin` el 2026-09-10** (era el primer push del repo desde `8e086d9`; venía
16 commits atrasado) **y las cuatro ramas ya contenidas se borraron.** No queda ninguna rama local
fuera de `master`, así que la próxima ronda **crea la suya** antes de traspasarle nada a `obra`.

## Qué se consolidó

`fix/mocks-de-ui-y-dict-obligatorio` entró por **fast-forward puro** (`git log --merges` sigue en 0).
Registro congelado en `docs/registro/2026-09-10-cierre-mocks-ui-y-storage.md`: `dict` obligatorio,
la política «se mockea el framework, no el proyecto» en el setup de vitest, y
`@/shared/lib/safeStorage` adoptado en los cuatro sitios de producción que tocaban Storage.

**Verificado de forma independiente** con `verificador` sobre `e5f1e4f`, los cuatro en verde:
**54 archivos de test / 399 tests**, eslint 0/0, `tsc --noEmit` 0 errores, build exitoso.

**Ojo con el conteo:** el plan predijo «53 suites / 399 tests» y `obra` repitió ese número en vez de
la salida real. Eran 54: el plan sumó los 6 tests de `safeStorage.test.ts` pero no contó el archivo
nuevo que los trae. No fue defecto de ejecución, fue aritmética del plan.

**Artifact de la hoja de ruta (versión 8):** refleja `ba8b7ca`, 393 tests, Fase 2 en 4 de 6.
**Desactualizado**: no incluye esta consolidación. **Trampa al republicar:** lo que devuelve
`action: "read"` viene con el envoltorio `<!doctype><head><body>` que agrega la publicación — hay que
quitarlo antes de republicar. Y el `favicon` (📒) hay que pasarlo explícito o la publicación se rechaza.

## Los dos hallazgos de la ronda, ya enrutados

1.  **`NotificationsContext.test.tsx` es un placeholder** → bajado a `TECHNICAL_DEBT.md` §7, con la
    trampa del estado mutable de módulo anotada. Prioridad baja: sirve datos de demo hardcodeados.
2.  **El script anti-flash del `<head>` lee `localStorage` directo** (`src/app/[lang]/layout.tsx:92`)
    → **no es deuda, el código está bien**: ya tiene su `try/catch` y la clave coincide con la que
    escribe `ProfileContext.tsx:50`. Lo que sí estaba mal era la Regla 5 recién escrita, que decía
    «nunca directo» sin nombrar esta excepción permanente. Corregido en `ece10ba`.

## En cola — ningún plan escrito sin ejecutar

## Sobre la mesa, sin plan

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
