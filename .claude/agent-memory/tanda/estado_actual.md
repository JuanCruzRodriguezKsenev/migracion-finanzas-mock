---
name: estado-actual
description: Dónde quedó el trabajo al cerrar la última ronda — ramas, qué está verificado, qué está en vuelo y qué hay sobre la mesa sin plan.
metadata:
  type: project
---

# Estado al cerrar la ronda del 2026-09-11 (tanda 1 del 008 ejecutada, tanda 2 entregada)

**Contrastar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas

```
master               129a2f9   RFC 025 cerrado. NO PUSHEADO: origin/master sigue en 07aadb3
feat/rfc-008-loans   58ce3c0   rama activa: tanda 1 del 008 ejecutada y verificada
```

**El push de `master` sigue pendiente y es del usuario.** La rama `docs/rfc-025-cuotas-de-tarjeta`
se borró. `git log --merges` sigue vacío: la historia es estrictamente lineal.

## La tanda 1 del RFC 008 está ejecutada y verificada

`58ce3c0` — backend completo de `src/features/loans/`: esquema con migración `0028`, amortización
francesa, cronograma proyectado, DAL, esquemas Zod y las dos server actions con bloqueo pesimista.
**467 tests en 65 archivos, 0 ESLint, 0 TS, build verde**, verificado por `verificador`.

## Entregado a `obra`, sin ejecutar

**`docs/planes/008-tanda-2-interfaz-de-loans.md`** — la pantalla `/loans` entera, su navegación, su
i18n en los tres diccionarios (`es`, `en`, **`br`** — no hay `pt`), las tres piezas de backend que la
tanda 1 no dejó (`findAllWithRelations`, `loanSummaryService`, `getLoansAction` +
`archiveLoanAction`) y la familia «Préstamos» del detalle de entidad de `/accounts`.

**Las tres decisiones del usuario, con `AskUserQuestion` y mockups ASCII, una pregunta por vez** (el
formato que ya funcionó en el 025; eligió la recomendada en las tres):

1.  **Tabla con tabs por dirección** (Todos/Pedidos/Dados) con `MetricsSection` arriba. No grilla de
    tarjetas: un préstamo tiene seis columnas numéricas que en una tarjeta no entran.
2.  **Bandeja global de liquidación** arriba de la tabla, con modal de selección de cuenta. **Una
    sola fila por préstamo —su cuota más antigua—** porque `payLoanInstallmentAction` rechaza
    cualquier otra dentro de la transacción. La fila de la tabla no lleva botón de pago.
3.  **La familia «Préstamos» de `/accounts` entra en la misma tanda**, con el filtro que saca las
    cuentas espejo de la lista de cuentas de la entidad.

De paso cierra la deuda §8 del `<span>Tarjetas</span>` en duro, agregando `sidebar.cards` a los tres
diccionarios — clave que **no existía** y que `BottomNav.tsx:77` ya leía con respaldo.

## Los tres hallazgos de `obra` de la tanda 1, contrastados

**Ninguno era defecto y ninguno fue a deuda; los tres aciertan, y esta vez también la referencia** —
mejora respecto de la tanda anterior del 025, donde uno erraba el archivo.

1.  **`CreateLoanInput` es `z.input`, no `z.infer`**, y por eso los campos con `.default()` son
    opcionales para quien llama. Verificado en `loans.schema.ts:52`. Ver [[patrones-reusables]].
2.  **`financial_entities` no tiene `code` ni `type`** (`accounting/schema.db.ts:36`): id,
    organizationId, name, logo, brandDomain, color, createdAt. Dato de fixture, sin acción.
3.  **La categoría de intereses se resuelve filtrando `categoryRepository.findAll()` por
    `accountCode`**, sin métodos nuevos en el repositorio — **y conservando el respaldo
    `findOrCreateTypeGeneralLeaf` que el plan exigía** (`loansActions.ts:300-325`). El hallazgo
    describe bien lo que hizo.

## Sobre la mesa, sin plan

*   Las dos propuestas que faltan de la sesión de diseño: **contraste del RFC 010** (patrimonio
    físico, siete columnas monetarias en `integer`) y **enmienda al RFC 003**.
*   **La página de estadísticas**: sin RFC y sin nombre de ruta. Recibe el Patrimonio Neto que el 024
    desaloja de `/accounts` —que **se queda ahí hasta entonces**, por decisión del usuario—, tiene
    que resolver el signo de `monthly_summaries` (§9 del RFC 024) y la brecha que el §9 del RFC 008
    le encarga: un préstamo registra el pasivo completo el día uno y una compra en cuotas no.
*   **Internacionalizar `CategoriesSettingsContainer`**: 766 líneas, único resto de i18n de
    `/settings`. Es una tanda propia.
*   **El neto por contacto en `/contacts`** — el §9 del RFC 008 lo deja abierto y depende de él.
    Hoy `/contacts` no muestra un solo importe.
*   `dict?:` opcional heredado, **5 declaraciones en 4 archivos**.
*   Las cuatro rutas del mock sin RFC: `/reportes`, `/patrimonio`, `/configuracion`, `/mejorar-plan`.

**Artifact de la hoja de ruta (versión 9, 2026-09-10): sigue atrasado** — refleja `f606a2e` y 405
tests; hoy son `58ce3c0` y 467. **Trampas al republicar:** lo que devuelve `action: "read"` viene con
el envoltorio `<!doctype><head><body>` que agrega la publicación y hay que quitarlo (la línea 1 hasta
`<body>` y el `</body></html>` final); el `favicon` (📒) **no** se reenvía en un republish, se
hereda; y **el archivo hay que leerlo con la herramienta `Read`, las 1218 líneas, no con
`sed`/`cat`**: si no, la publicación se rechaza con «you hadn't viewed the live version». Si aun así
rechaza por contenido idéntico ya rechazado, hay que volver a hacer `action: "read"` y publicar
inmediatamente después.
