---
name: estado-actual
description: Dónde quedó el trabajo de FinanzIA al cerrar la última ronda — qué se consolidó, qué está verificado y qué está en vuelo. Contrastar con git antes de usar.
metadata:
  type: project
---

# Estado al cerrar la ronda del 2026-09-10 (segunda del día)

**Verificar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas

```
origin/master = master        8e086d9   consolidado y pusheado
  └─ fix/page-header-unico-por-pagina   5baa78f   rama activa, plan SIN ejecutar
```

**La cadena encadenada se consolidó.** `master` avanzó por fast-forward de `2ae7186` a `8e086d9`
(15 commits, sin merge commit) y está pusheado. Entraron `feat/bandeja-recurrencias` (RFC 023) y
`fix/cabos-rfc023-y-limpieza-de-tests`; **las dos ramas viejas ya no reciben trabajo y se pueden
borrar.**

*   **`8e086d9` verificado en verde** por batería independiente: **393 tests / 53 suites**,
    `eslint . --max-warnings 0` sin warnings, `tsc --noEmit` 0 errores, build exitoso.
*   Del RFC 023 **no hay que rehacer nada**: `limpiarBase()`, la guarda releída bajo bloqueo, el
    backfill `0026` y el factory `makeSubscription` están correctos y verificados.

**Queda pendiente de `docs/registro/`:** la consolidación se hizo pero **no** se escribió el
`docs/registro/2026-09-10-<nombre>.md` que la convención pide, ni se podó de `trabajo-en-vuelo.md`
el bloque «Estado de la ronda anterior». Ver [[ciclo-de-trabajo]] § Cómo se cierra una rama.

## En cola — un plan escrito, listo para `obra`

**`docs/planes/page-header-unico-por-pagina.md`**, en la rama `fix/page-header-unico-por-pagina`
(ya creada, árbol limpio). Un `PageHeader` compartido con `title` obligatoria que cada página
compone, para matar el sniffeo de `pathname` de `Header.tsx:50-53` y las dos listas de rutas
hardcodeadas (título y selector de mes). Afecta **cuatro de ocho rutas**; `/cards` y `/settings`
además **no tienen `*Page.title` en el diccionario** y hay que agregarlo.

**Primer intento fallido, sin daño:** se invocó a `obra` antes de crear la rama y rebotó con un
informe de factibilidad. Confirmó que el plan coincide con el repo — validación gratis. La lección
quedó en [[ciclo-de-trabajo]].

## Sobre la mesa, sin plan

*   Las cuatro rutas del mock que el inventario no listaba: `/reportes`, `/patrimonio`,
    `/configuracion`, `/mejorar-plan`. **Ninguna tiene RFC.**
*   Las propuestas que faltan de la sesión de diseño de clasificación — ver
    [[decisiones-modelo-clasificacion]].
*   Dos ítems de deuda preventiva abiertos en `TECHNICAL_DEBT.md`: cobertura de métodos en el mock de
    `next/cache`, y retroceso potencial de punteros en la migración `0026`.
