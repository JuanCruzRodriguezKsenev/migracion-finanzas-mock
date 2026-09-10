---
name: estado-actual
description: Dónde quedó el trabajo de FinanzIA al cerrar la última ronda — qué se consolidó, qué está verificado y qué está en vuelo. Contrastar con git antes de usar.
metadata:
  type: project
---

# Estado al cerrar la ronda del 2026-09-10 (tercera del día)

**Verificar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas

```
origin/master                                 8e086d9   NO pusheado todavía
master                                        ba8b7ca   consolidado, 4 commits por delante de origin
  └─ fix/mocks-de-ui-y-dict-obligatorio       0a8989f   rama activa, plan SIN ejecutar
```

**`fix/page-header-unico-por-pagina` se consolidó** por fast-forward puro (`8e086d9..2fe778b`),
`git log --merges` sigue vacío. **Los dos registros que faltaban ya están escritos:**
`docs/registro/2026-09-10-cierre-rfc023-y-compuerta.md` (`2ae7186..8e086d9`, se había omitido al
consolidar, va marcado como escrito en diferido) y `docs/registro/2026-09-10-cierre-page-header.md`.
`trabajo-en-vuelo.md` quedó podado, sólo con lo vivo.

**Pendiente y consciente:** `master` **no está pusheado** (4 commits por delante de `origin/master`)
y las tres ramas ya contenidas —`feat/bandeja-recurrencias`, `fix/cabos-rfc023-y-limpieza-de-tests`,
`fix/page-header-unico-por-pagina`— **no se borraron**: ninguna de las dos cosas se pidió.

**Artifact de la hoja de ruta al día (versión 8):** refleja `ba8b7ca`, 393 tests, Fase 2 en 4 de 6
y el RFC 023 entregado. **Trampa al republicar:** el archivo que devuelve `action: "read"` viene con
el envoltorio `<!doctype><head><body>` que agrega la publicación — hay que quitarlo antes de
republicar. Y el `favicon` (📒) hay que pasarlo explícito o la publicación se rechaza.

## En cola — un plan escrito, listo para `obra`

**`docs/planes/mocks-de-ui-y-dict-obligatorio.md`**, en la rama `fix/mocks-de-ui-y-dict-obligatorio`
(ya creada, árbol limpio, plan commiteado, rebaseada sobre el `master` consolidado). Cierra los dos hallazgos de la ronda del `PageHeader`:
`dict` obligatorio en `CategoriesSettingsContainer` (hoy opcional con `FALLBACK_DICT` casteado con
`as unknown as`), test montado con `getDictionary( "es" )` real y `<NotificationsProvider>` real, y
setup global de vitest reducido a framework. Deja el patrón §12 en `docs/patterns.md`.

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
