# Estado al cerrar la ronda del 2026-09-10 (cuarta del día)

**Verificar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas

```
origin/master                                 8e086d9   NO pusheado todavía
master                                        ba8b7ca   consolidado, 4 commits por delante de origin
  └─ fix/mocks-de-ui-y-dict-obligatorio       01a8467   rama activa, árbol limpio
```

## Dónde quedó la rama activa

`bfaac23` trae la **ejecución parcial** del plan de mocks (dict obligatorio, setup de vitest sin
código propio, patrón §12). **La suite quedó en 3 tests rojos a propósito**: 52/53 suites,
390/393 tests. Montar el `<NotificationsProvider>` real destapó que en jsdom + Node 26 no hay
`localStorage` — ver [[testing-de-componentes-cliente]], que corrige una nota mía que era falsa.

`01a8467` trae el plan que lo cierra: **`docs/planes/storage-tolerante-y-cierre-de-mocks-ui.md`**,
listo para `obra` y sin ejecutar. Crea `@/shared/lib/safeStorage` y lo adopta en los **cuatro**
sitios que tocan Storage (`NotificationsContext`, `MetricsVisibilityContext`, `ProfileContext`,
`AddSubscriptionModal`). Total esperado al terminar: **399 tests, 53 suites**.

**Pendiente y consciente:** `master` **no está pusheado** (4 commits por delante de `origin/master`)
y las tres ramas ya contenidas —`feat/bandeja-recurrencias`, `fix/cabos-rfc023-y-limpieza-de-tests`,
`fix/page-header-unico-por-pagina`— **no se borraron**: ninguna de las dos cosas se pidió.

**Artifact de la hoja de ruta (versión 8):** refleja `ba8b7ca`, 393 tests, Fase 2 en 4 de 6 y el
RFC 023 entregado. **Quedó desactualizado**: no incluye esta rama. **Trampa al republicar:** el
archivo que devuelve `action: "read"` viene con el envoltorio `<!doctype><head><body>` que agrega la
publicación — hay que quitarlo antes de republicar. Y el `favicon` (📒) hay que pasarlo explícito o
la publicación se rechaza.

## En cola — un plan escrito, listo para `obra`

**`docs/planes/storage-tolerante-y-cierre-de-mocks-ui.md`** (detalle arriba).

## Sobre la mesa, sin plan

*   Las cuatro rutas del mock que el inventario no listaba: `/reportes`, `/patrimonio`,
    `/configuracion`, `/mejorar-plan`. **Ninguna tiene RFC.**
*   Las propuestas que faltan de la sesión de diseño de clasificación — ver
    [[decisiones-modelo-clasificacion]].
*   Dos ítems de deuda preventiva abiertos en `TECHNICAL_DEBT.md`: cobertura de métodos en el mock de
    `next/cache`, y retroceso potencial de punteros en la migración `0026`.
*   `dict?:` opcional heredado en `ContactsTable`, `PaymentMethodsPanel`, `ContactFormModal` y
    `MonthSelector`. Shape acotado y sin cast, así que es menos grave; quedó fuera de alcance
    explícito del plan de mocks.
