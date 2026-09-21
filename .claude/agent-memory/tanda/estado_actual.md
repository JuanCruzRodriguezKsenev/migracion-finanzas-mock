---
name: estado-actual
description: Dónde quedó el trabajo al cerrar la última ronda — ramas, qué está verificado, qué está en vuelo y qué hay sobre la mesa sin plan.
metadata:
  type: project
---

# Estado al cerrar la ronda del 2026-09-21 (consolidación de las tres ramas)

**Contrastar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas: no hay ninguna. Todo está en `master`

```
master  ee3949d  las tres ramas encadenadas, consolidadas por fast-forward el 2026-09-21
```

`docs/rfc-010-patrimonio-fisico`, `feat/i18n-categorias` y `fix/result-panel-categorias` se
fusionaron con `--ff-only` y **se borraron**. `git log --merges` sigue vacío: la historia es
estrictamente lineal, y la convención es que cada rama sale de la punta anterior, no de `master`.

**El push sigue pendiente y es del usuario:** `master` va **24 commits** adelante de `origin/master`
(`07aadb3`). Contarlo con `git rev-list --count origin/master..HEAD`, no de memoria — ya estuvo mal
anotado tres veces, la última en el propio doc de estado de esta consolidación: **al contar, sumar el
commit del registro de cierre, que todavía no existe cuando se escribe el número**.

## Lo cerrado, congelado

`docs/registro/2026-09-21-cierre-categorias-y-rfc-010-003.md` (`1dbc993..0428b22`) guarda las tres
tandas: la reescritura de los RFC 010 y 003, la i18n del panel de categorías y el manejo del `Result`
en ese mismo panel. **No repetir acá lo que el registro ya tiene**; lo que sigue es sólo lo que hace
falta para arrancar la próxima ronda.

*   **Verificado por `verificador` el 2026-09-21:** 490 tests en 68 archivos, 0 ESLint, 0 errores TS,
    build verde. `obra` cerró las tres tandas **sin hallazgos** — cuatro rondas seguidas sin desvíos.
*   **Los únicos defectos fueron de planificación, y del mismo tipo las dos veces:** enumeraciones y
    salidas de `grep` escritas sin correr el comando. La lección está en [[ciclo-de-trabajo]].
*   **Cabo cosmético que quedó y no vale una ronda:** `handleCreateParent`, `handleCreateChild` y
    `handleUpdateCategory` de `CategoriesSettingsContainer` no limpian `actionError` al arrancar, así
    que un banner del panel puede sobrevivir a un alta exitosa posterior. El plan les prohibió
    tocarlos, con razón.

## El próximo paso es del usuario: firmar o corregir los RFC 010 y 003

Los dos están **en `master` y en `DRAFT` al mismo tiempo**, y es deliberado: entraron con la
consolidación porque la cadena es lineal, **no porque estén aprobados**. No habilitan una línea de
código. Ver [[decisiones-rfc010-y-rfc003]] para las cinco decisiones y el apartamiento del RFC 024 §4.

**Ningún agente aprueba un RFC.** Hasta que alguno pase a `APPROVED` no hay código que escribir
contra ellos, y la secuencia de `trabajo-en-vuelo.md` los pone primeros por eso.

## Sobre la mesa, sin plan

*   **La página de estadísticas**: sin RFC y sin nombre de ruta. Le llegan **cuatro** encargos: el
    Patrimonio Neto que el 024 desaloja de `/accounts` —que **se queda ahí hasta entonces**—, la
    convención de signo de `monthly_summaries` (§9 del 024), la brecha del §9 del 008 (un préstamo
    registra el pasivo el día uno y una compra en cuotas no) y el patrimonio físico del 010.
*   **El neto por contacto en `/contacts`**: hoy no muestra un solo importe, y tiene **dos** fuentes
    que sumar (préstamos y eventos).
*   **Inquilinos, incidencias y cap rate**, escindidos del RFC 010.
*   **Los `Result.error` como códigos y no como prosa española:** 201 `fail()` en 13 archivos. **Exige
    RFC propio** que fije el contrato (código + parámetros) y su mapeo en los tres diccionarios.
    `TECHNICAL_DEBT.md` §3. Ver [[i18n-panel-de-categorias]].
*   **CSS inline estático contra el §4:** verificados a mano `PendingInstallmentsInbox.tsx:156,221,237`,
    `CardFormModal.tsx:198`, `InstallmentPlansModal.tsx:112` y `CardVisual.tsx:79`. Una heurística
    marca ~22 en 13 archivos **con falsos positivos** (`style={cardStyle}` es dinámico). Anotada en
    `TECHNICAL_DEBT.md` §1 el 2026-09-21; el conteo exacto es parte de cerrarla.
*   `dict?:` opcional heredado, **5 declaraciones en 4 archivos**.
*   Las rutas del mock sin RFC: `/reportes`, `/configuracion`, `/mejorar-plan`. **`/patrimonio` ya no
    está en esa lista**: tiene el 010, aunque su ruta en inglés no se eligió todavía.

## Lo que ya está barrido y no hay que volver a investigar

*   **El resto del repo maneja bien el `Result`** — cuatro barridos distintos, incluidas las 28
    llamadas a acciones, los `.then()` de `useSubscriptions` y los `Promise.all` de las ocho
    `page.tsx`. El panel de categorías era la única excepción y ya está corregido.
*   **Dos residuos que parecen defectos y no lo son:** `installmentPlansActions.test.ts:429,492`
    descarta el `Result` a propósito (siembra de test), y el `style={{…}}` de
    `CategoriesSettingsContainer.tsx:451` es `backgroundColor` calculado de `activeParent.color`, o
    sea dinámico y dentro de la excepción del §4.

**Artifact de la hoja de ruta (versión 9, 2026-09-10): sigue atrasado** — refleja `f606a2e` y 405
tests; hoy son 490 sobre `master` consolidado. **Trampas al republicar:** lo que devuelve
`action: "read"` viene con el envoltorio `<!doctype><head><body>` que agrega la publicación y hay que
quitarlo (la línea 1 hasta `<body>` y el `</body></html>` final); el `favicon` (📒) **no** se reenvía
en un republish, se hereda; y **el archivo hay que leerlo con la herramienta `Read`, las 1218 líneas,
no con `sed`/`cat`**: si no, la publicación se rechaza con «you hadn't viewed the live version». Si
aun así rechaza por contenido idéntico ya rechazado, hay que volver a hacer `action: "read"` y
publicar inmediatamente después.
