---
name: estado-actual
description: Dónde quedó el trabajo al cerrar la última ronda — ramas, qué está verificado, qué está en vuelo y qué hay sobre la mesa sin plan.
metadata:
  type: project
---

# Estado al cerrar la ronda del 2026-09-11 (RFC 025 consolidado, tanda 1 del 008 entregada)

**Contrastar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas

```
master               129a2f9   RFC 025 cerrado. NO PUSHEADO: origin/master sigue en 07aadb3
feat/rfc-008-loans   129a2f9   rama activa, árbol limpio, lista para `obra`
```

**El push de `master` quedó pendiente y es del usuario.** Se consolidó por fast-forward
(`07aadb3..129a2f9`, 5 commits) y `git log --merges` sigue vacío. La rama
`docs/rfc-025-cuotas-de-tarjeta` se borró.

## El RFC 025 quedó cerrado entero

Verificación independiente de la tanda 2 (`94c02b4`): **443 tests en 61 archivos, 0 ESLint, 0 TS,
build verde en 13.9s**, con `postgres-dev` vivo. La tanda 1 había dado 429/58: la 2 sumó 3 archivos
(`CardVisual.test.tsx`, `InstallmentPlanFormModal.test.tsx`, `PendingInstallmentsInbox.test.tsx`) y
14 tests. Congelado en `docs/registro/2026-09-11-cierre-rfc025.md`.

**Deuda que el cierre movió:** cerradas la del disponible de tarjetas (§2) y la de i18n de `/cards`
(§3). Sigue abierta y **el 025 no la agravó**: la suma de divisas distintas de `CardVisual` (§9).

## Entregado a `obra`, sin ejecutar

**`docs/planes/008-tanda-1-modelo-de-prestamos.md`** — el backend completo de `/loans`: esquema
literal del §4, migración, `limpiarBase()`, amortización francesa (no existe ninguna en el repo),
cronograma proyectado, repositorio y las dos acciones. **Sin una sola pantalla**: la tanda 2 se
escribe con el informe de la 1 en la mano, como se hizo con el 025.

Las dos decisiones que el RFC delegaba al plan están cerradas en
[[decisiones-rfc008-loans]]: la **categoría de intereses fija por código** (elegida por el usuario
sobre agregar columna o elegir en cada cuota) y **`/loans` en el `Navbar` después de `/cards`**.

## Los tres hallazgos de `obra` de la tanda 2, contrastados y enrutados

**Ninguno era defecto, y ninguno fue a deuda.** Los tres aciertan la conclusión; **uno erra la
referencia**, que es exactamente por qué se contrastan:

1.  Props de los componentes base: `FormInput` usa `helperText`, `FormError` exige `error`, `Button`
    **no** tiene `size`. Verificado en los tres archivos → a [[testing-de-componentes-cliente]].
2.  El informe dijo «`schema.ts:484`» y **ese archivo no existe**: la tabla `cards` vive en
    `src/features/cards/schema.db.ts:25`, el esquema es por feature. La conclusión sí era correcta
    (`entityId`, no `financialEntityId` — ese nombre existe pero en `contacts/schema.db.ts:39`).
3.  La colisión de `accounts_org_code_unique` era **de fixture, no de producción**: el alta real
    deriva el código con `getNextCode()` (`cardsActions.ts:138`).

## Tres documentos corregidos porque el trabajo los dejó falsos

Van **tres rondas seguidas** encontrando docs desactualizados — ver [[ciclo-de-trabajo]]:

1.  **RFC 008, línea de estado autocontradictoria:** decía `APPROVED (habilita código)` y, en la
    misma línea, «No habilita código hasta que el usuario lo apruebe».
2.  **RFC 008 §9** citaba al RFC 025 como `DRAFT`.
3.  **`TECHNICAL_DEBT.md` §2** decía que el disponible de tarjetas no descuenta cuotas, **y
    atribuía el modelo al RFC 008** cuando lo cerró el 025.

## Sobre la mesa, sin plan

*   **Tanda 2 del RFC 008** — la interfaz de `/loans`. Se escribe con el informe de la 1.
*   Las dos propuestas que faltan de la sesión de diseño: **contraste del RFC 010** (patrimonio
    físico, siete columnas monetarias en `integer`) y **enmienda al RFC 003**.
*   **La página de estadísticas**: sin RFC y sin nombre de ruta. Recibe el Patrimonio Neto que el 024
    desaloja de `/accounts` —que **se queda ahí hasta entonces**, por decisión del usuario—, tiene
    que resolver el signo de `monthly_summaries` (§9 del RFC 024) y ahora **también** la brecha que
    el §9 del RFC 008 le encarga: un préstamo registra el pasivo completo el día uno y una compra en
    cuotas no, así que financiar la misma heladera de las dos formas da patrimonios netos distintos.
*   **Internacionalizar `CategoriesSettingsContainer`**: 766 líneas, único resto de i18n de
    `/settings`. Es una tanda propia.
*   `dict?:` opcional heredado, **5 declaraciones en 4 archivos**; y el `<span>Tarjetas</span>` en
    duro del `Navbar` (§8), que **la tanda 2 del 008 puede cerrar de paso**: es una línea en el mismo
    archivo que recibe la entrada de `/loans`.
*   Las cuatro rutas del mock sin RFC: `/reportes`, `/patrimonio`, `/configuracion`, `/mejorar-plan`.

**Artifact de la hoja de ruta (versión 9, 2026-09-10): quedó atrasado** — refleja `f606a2e` y 405
tests; hoy son `129a2f9` y 443, con el RFC 025 cerrado. **Trampas al republicar:** lo que devuelve
`action: "read"` viene con el envoltorio `<!doctype><head><body>` que agrega la publicación y hay que
quitarlo (la línea 1 hasta `<body>` y el `</body></html>` final); el `favicon` (📒) **no** se reenvía
en un republish, se hereda; y **el archivo hay que leerlo con la herramienta `Read`, las 1218 líneas,
no con `sed`/`cat`**: si no, la publicación se rechaza con «you hadn't viewed the live version». Si
aun así rechaza por contenido idéntico ya rechazado, hay que volver a hacer `action: "read"` del
artifact y publicar inmediatamente después.

---

# Contexto de las rondas anteriores del 2026-09-11 (ya congelado en `registro/`)

Se reescribió el **RFC 008** y se escribió el **RFC 025**; el usuario aprobó los dos ese día. Se
aplicó el rename `/debts` → `/loans` (RFC 024 líneas 62/79/85/291/297, `ARCHITECTURE.md:81`,
inventario del doc de estado) y la nota de corrección al **RFC 007** §8B, cuya fórmula del disponible
restaba una tabla que no existía. **No se tocaron** `docs/registro/`, `docs/diseno/` ni los planes ya
ejecutados: son actas.

Las dos decisiones de UI del 025 las cerró el usuario con `AskUserQuestion` y mockups ASCII, una
pregunta por vez, eligiendo la recomendada en las dos: **bandeja global** de cuotas pendientes arriba
de la grilla, y **alta de plan dentro del modal de detalle** por tarjeta, sin selector de tarjeta en
ningún formulario.
