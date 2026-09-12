---
name: estado-actual
description: Dónde quedó el trabajo al cerrar la última ronda — ramas, qué está verificado, qué está en vuelo y qué hay sobre la mesa sin plan.
metadata:
  type: project
---

# Estado al cerrar la ronda del 2026-09-12 (RFC 008 consolidado; 010 y 003 reescritos)

**Contrastar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas

```
master                          1dbc993   RFC 008 consolidado. NO PUSHEADO: origin/master sigue en 07aadb3
docs/rfc-010-patrimonio-fisico  5b1d566   rama activa: los dos RFC reescritos
```

**El push sigue pendiente y es del usuario** — van seis commits de ventaja sobre `origin/master`.
`git log --merges` sigue vacío: la historia es estrictamente lineal.

## El RFC 008 quedó cerrado y consolidado

Fast-forward `129a2f9..99deff1`, congelado en `docs/registro/2026-09-11-cierre-rfc008.md`. Las dos
tandas: modelo de préstamos con migración `0028`, y la pantalla `/loans` entera con bandeja de
liquidación, i18n en los tres diccionarios y la familia «Préstamos» de `/accounts`. **485 tests en 68
archivos, 0 ESLint, 0 TS, build verde**, verificado por `verificador`. La rama `feat/rfc-008-loans`
se borró.

**Los tres hallazgos de `obra` de la tanda 2: ninguno era defecto y los tres acertaron también la
referencia** — segunda tanda consecutiva. El único matiz que valía anotar: el cast de frecuencia de
`loanSummaryService.ts:28` **es seguro** porque `LOAN_FREQUENCIES` (`loans.schema.ts:18`) y
`SubscriptionFrequency` (`subscriptions/types.ts:18`) tienen **hoy dominios idénticos**; el riesgo
latente es esa duplicación, no el cast, y no es específico de `loans`.

## La sesión de diseño del 2026-09-09 quedó cerrada del todo

Sus **siete propuestas están escritas**. Las dos últimas —**RFC 010** y **RFC 003**— se reescribieron
el 2026-09-12 y **quedaron en `DRAFT` a propósito**. Ver [[decisiones-rfc010-y-rfc003]] para las cinco
decisiones del usuario y los datos que el contraste dejó verificados.

## Sobre la mesa, sin plan

*   **Aprobar o corregir los RFC 010 y 003.** Es del usuario; ningún agente aprueba un RFC. Hasta que
    alguno pase a `APPROVED` no hay código que escribir contra ellos.
*   **La página de estadísticas**: sin RFC y sin nombre de ruta. Le llegan **tres** encargos, no uno:
    el Patrimonio Neto que el 024 desaloja de `/accounts` —que **se queda ahí hasta entonces**—, la
    convención de signo de `monthly_summaries` (§9 del 024), la brecha del §9 del 008 (un préstamo
    registra el pasivo el día uno y una compra en cuotas no) y ahora el patrimonio físico del 010.
*   **Internacionalizar `CategoriesSettingsContainer`**: 766 líneas, único resto de i18n de
    `/settings`. **Es la única tanda de código lista para plan ahora mismo.**
*   **El neto por contacto en `/contacts`**: hoy no muestra un solo importe, y ahora tiene **dos**
    fuentes que sumar (préstamos y eventos).
*   **Inquilinos, incidencias y cap rate**, escindidos del RFC 010.
*   `dict?:` opcional heredado, **5 declaraciones en 4 archivos**.
*   Las rutas del mock sin RFC: `/reportes`, `/configuracion`, `/mejorar-plan`. **`/patrimonio` ya no
    está en esa lista**: tiene el 010, aunque su ruta en inglés no se eligió todavía.

**Artifact de la hoja de ruta (versión 9, 2026-09-10): sigue atrasado** — refleja `f606a2e` y 405
tests; hoy son `5b1d566` y 485. **Trampas al republicar:** lo que devuelve `action: "read"` viene con
el envoltorio `<!doctype><head><body>` que agrega la publicación y hay que quitarlo (la línea 1 hasta
`<body>` y el `</body></html>` final); el `favicon` (📒) **no** se reenvía en un republish, se
hereda; y **el archivo hay que leerlo con la herramienta `Read`, las 1218 líneas, no con
`sed`/`cat`**: si no, la publicación se rechaza con «you hadn't viewed the live version». Si aun así
rechaza por contenido idéntico ya rechazado, hay que volver a hacer `action: "read"` y publicar
inmediatamente después.
