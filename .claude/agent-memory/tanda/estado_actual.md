---
name: estado-actual
description: Dónde quedó el trabajo al cerrar la última ronda — ramas, qué está verificado, qué está en vuelo y qué hay sobre la mesa sin plan.
metadata:
  type: project
---

# Estado al cerrar la ronda del 2026-09-21 (los `Result` del panel, ejecutados y verificados)

**Contrastar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas

```
master                          1dbc993   RFC 008 consolidado. NO PUSHEADO: origin/master sigue en 07aadb3
docs/rfc-010-patrimonio-fisico  c15bfd0   los dos RFC reescritos. SIN CONSOLIDAR a master
feat/i18n-categorias            d5985a6   i18n de categorías, ejecutada y verificada
fix/result-panel-categorias     26e0937   rama activa: los Result del panel, EJECUTADA Y VERIFICADA
```

**El push sigue pendiente y es del usuario** — la punta de `fix/result-panel-categorias` va **22 commits**
adelante de `origin/master` (07aadb3), y `master` local va 10. Contarlo con `git rev-list --count
origin/master..HEAD`, no de memoria: ya estuvo mal anotado dos veces.
`git log --merges` sigue vacío: la historia es estrictamente lineal.

**Las ramas se encadenan, no salen todas de `master`.** `feat/i18n-categorias` se creó sobre
`docs/rfc-010-patrimonio-fisico` sin mergear nada: el merge lo decide el usuario, y los RFC 010 y 003
siguen esperando su firma. **Ninguna de las tres ramas está consolidada**, y la de i18n ya está verde y
lista para que el usuario decida el fast-forward.

## La tanda de los `Result` del panel quedó cerrada y verificada de forma independiente

`0039f9d` ejecutó `docs/planes/fix-result-panel-categorias.md` al pie: los cinco sitios de
`CategoriesSettingsContainer.tsx` miran el `Result` —tres escrituras y dos lecturas—, con **dos
canales de error separados** (`actionError` pinta el banner del panel, `formError` pinta dentro del
modal), la casilla «Ver archivadas» revierte cuando la lectura falla, y lo tipeado en ícono/color
sobrevive a un guardado rechazado. Cinco tests nuevos, los tres viejos intactos.

`verificador` (2026-09-21): **490 tests en 68 archivos, 0 ESLint, 0 errores TS, build verde.** Son
los 485 anteriores más los cinco casos nuevos, sin archivos nuevos: el número predicho y el real
coincidieron. `obra` cerró **sin hallazgos** — cuarta ronda seguida sin desvíos.

**Los dos únicos defectos fueron del plan, no de la ejecución**, y los dos son salidas de `grep`
predichas sin correrlas; la lección está en [[ciclo-de-trabajo]]. Lo que quedó verificado a mano y
**no hay que volver a investigar**: los dos `await …Action(` de `installmentPlansActions.test.ts:429,492`
son siembra de test y está bien que descarten el `Result`, y el `style={{…}}` de
`CategoriesSettingsContainer.tsx:451` es `backgroundColor` calculado de `activeParent.color`, o sea
dinámico y dentro de la excepción del §4.

**El único cabo que dejó, y es cosmético:** `handleCreateParent`, `handleCreateChild` y
`handleUpdateCategory` no limpian `actionError` al arrancar (el plan les prohibió tocarlos, con
razón), así que un banner del panel puede sobrevivir a un alta exitosa hecha después. Una línea por
handler si alguna vez molesta; no vale una ronda.

## La tanda de i18n quedó cerrada y verificada de forma independiente

`d9b40ea` internacionalizó `CategoriesSettingsContainer` al pie del plan
`docs/planes/feat-i18n-categorias.md`: ocho archivos —los seis del radio de impacto más los dos docs—,
58 claves en `settingsPage.categories` de los tres diccionarios, con paridad exacta comprobada. Con
esto **`/settings` queda íntegramente internacionalizado** y la tercera viñeta del §3 de
`TECHNICAL_DEBT.md` quedó cerrada; en su lugar se abrió la deuda de los `Result.error`.

`verificador` (2026-09-21): **485 tests en 68 archivos, 0 ESLint, 0 errores TS, build verde.** Son
los mismos 485 del cierre del RFC 008 y está bien: la tanda no agregó tests, reescribió aserciones.

**El único cabo lo dejó el plan, no la ejecución**, y se corrigió en esta ronda con una línea: la
aserción `getByRole( "button" , { name: /Confirmar archivado/i } )` del test seguía con el literal
español porque mi tabla enumeró cinco aserciones y son seis. Ver [[ciclo-de-trabajo]], que ya lleva la
lección. `obra` cerró **sin hallazgos fuera de plan** — tercera ronda seguida sin desvíos.

## El RFC 008 quedó cerrado y consolidado

Fast-forward `129a2f9..99deff1`, congelado en `docs/registro/2026-09-11-cierre-rfc008.md`. Las dos
tandas: modelo de préstamos con migración `0028`, y la pantalla `/loans` entera con bandeja de
liquidación, i18n en los tres diccionarios y la familia «Préstamos» de `/accounts`. La rama
`feat/rfc-008-loans` se borró.

El único matiz que valía anotar: el cast de frecuencia de `loanSummaryService.ts:28` **es seguro**
porque `LOAN_FREQUENCIES` (`loans.schema.ts:18`) y `SubscriptionFrequency`
(`subscriptions/types.ts:18`) tienen **hoy dominios idénticos**; el riesgo latente es esa duplicación,
no el cast, y no es específico de `loans`.

## La sesión de diseño del 2026-09-09 quedó cerrada del todo

Sus **siete propuestas están escritas**. Las dos últimas —**RFC 010** y **RFC 003**— se reescribieron
el 2026-09-12 y **quedaron en `DRAFT` a propósito**. Ver [[decisiones-rfc010-y-rfc003]] para las cinco
decisiones del usuario y los datos que el contraste dejó verificados.

## Sobre la mesa, sin plan

*   **Aprobar o corregir los RFC 010 y 003.** Es del usuario; ningún agente aprueba un RFC. Hasta que
    alguno pase a `APPROVED` no hay código que escribir contra ellos. Es lo que `trabajo-en-vuelo.md`
    declara hoy como próximo paso.
*   ~~**Los `Result` descartados de `CategoriesSettingsContainer`**~~ — **resuelto y verificado el
    2026-09-21**, commit `0039f9d`. Lo que sigue valiendo del barrido: **el resto del repo maneja bien
    el `Result`**, comprobado con cuatro barridos distintos —los `.then()` de `useSubscriptions`, los
    `Promise.all` de las ocho `page.tsx` y las 28 llamadas a acciones chequean todas—, así que no hace
    falta volver a barrerlo.
*   **La página de estadísticas**: sin RFC y sin nombre de ruta. Le llegan **tres** encargos, no uno:
    el Patrimonio Neto que el 024 desaloja de `/accounts` —que **se queda ahí hasta entonces**—, la
    convención de signo de `monthly_summaries` (§9 del 024), la brecha del §9 del 008 (un préstamo
    registra el pasivo el día uno y una compra en cuotas no) y ahora el patrimonio físico del 010.
*   **El neto por contacto en `/contacts`**: hoy no muestra un solo importe, y ahora tiene **dos**
    fuentes que sumar (préstamos y eventos).
*   **Inquilinos, incidencias y cap rate**, escindidos del RFC 010.
*   **La deuda nueva de los `Result.error`:** 201 `fail()` en 13 archivos devuelven prosa española que
    la UI pinta cruda. **Exige RFC propio** que fije el contrato (código + parámetros) y su mapeo en
    los tres diccionarios. Anotada en `TECHNICAL_DEBT.md` §3 el 2026-09-20. Ver
    [[i18n-panel-de-categorias]].
*   **CSS inline estático contra el §4**, destapado por el barrido del 2026-09-21: verificados a mano
    `PendingInstallmentsInbox.tsx:156,221,237`, `CardFormModal.tsx:198`, `InstallmentPlansModal.tsx:112`
    y `CardVisual.tsx:79`. Una heurística marca ~22 en 13 archivos **con falsos positivos**
    (`style={cardStyle}` es dinámico). **Ya está anotada** en `TECHNICAL_DEBT.md` §1 (2026-09-21);
    el conteo exacto es parte de cerrarla.
*   `dict?:` opcional heredado, **5 declaraciones en 4 archivos**.
*   Las rutas del mock sin RFC: `/reportes`, `/configuracion`, `/mejorar-plan`. **`/patrimonio` ya no
    está en esa lista**: tiene el 010, aunque su ruta en inglés no se eligió todavía.

**Artifact de la hoja de ruta (versión 9, 2026-09-10): sigue atrasado** — refleja `f606a2e` y 405
tests; hoy son 485 y la punta de `feat/i18n-categorias`. **Trampas al republicar:** lo que devuelve
`action: "read"` viene con el envoltorio `<!doctype><head><body>` que agrega la publicación y hay que
quitarlo (la línea 1 hasta `<body>` y el `</body></html>` final); el `favicon` (📒) **no** se reenvía
en un republish, se hereda; y **el archivo hay que leerlo con la herramienta `Read`, las 1218 líneas,
no con `sed`/`cat`**: si no, la publicación se rechaza con «you hadn't viewed the live version». Si
aun así rechaza por contenido idéntico ya rechazado, hay que volver a hacer `action: "read"` y
publicar inmediatamente después.
