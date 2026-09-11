---
name: estado-actual
description: Dónde quedó el trabajo al cerrar la última ronda — ramas, qué está verificado, qué está en vuelo y qué hay sobre la mesa sin plan.
metadata:
  type: project
---

# Estado al cerrar la ronda del 2026-09-10 (octava del día)

**Verificar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas

```
origin/master   al día hasta f606a2e
master          consolidado, verde y pusheado
```

**No queda ninguna rama local fuera de `master`.** El RFC 024 se consolidó por fast-forward
(`5f8882b..f606a2e`, 13 commits) y la rama `docs/rfc-024-navegacion-por-entidad` se borró.

## Dónde quedó el RFC 024

**Cerrado entero.** Las dos tandas ejecutadas por `obra` y verificadas por `verificador` en corridas
independientes:

*   **Tanda 1** (`6c2c197`, más `51f1a50` y `72d06ff`): 54 archivos, 400 tests, 0 ESLint, 0 TS,
    build OK. Directorio por entidad, familias separadas, `CardVisual`, `deudaDe()`, signo del
    Patrimonio Neto y puerta de atrás de `CreateAccountForm`.
*   **Tanda 2** (`0a2f841`): **56 archivos, 405 tests, 0 errores y 0 warnings ESLint, 0 errores TS,
    build exitoso.** Plan contable mudado a `/settings` como `LedgerAuditPanel` de sólo lectura con
    los cinco tipos y la divisa real, feature nueva `src/features/settings/` con el shell dueño del
    `PageHeader` y las tabs, labels localizadas en los tres diccionarios, §7 del RFC cerrado.

**Consolidado el 2026-09-10** con decisión explícita del usuario: registro congelado en
`docs/registro/2026-09-10-cierre-rfc024.md`, `trabajo-en-vuelo.md` podado, `master` pusheado y rama
borrada. **El merge lo decide el usuario** — ver [[ciclo-de-trabajo]].

## Revisión independiente de la tanda 2 (2026-09-10)

Contrastado archivo por archivo, **sin desvíos respecto del plan**: las cinco clases CSS huérfanas
borradas (el `tabsRow` que sobrevive es de `cards`, otro módulo), las 20 claves de `settingsPage`
alineadas en `es`/`en`/`br`, `dict`/`lang` fuera de `CategoriesSettingsContainer`, y el test del
shell montando `NotificationsProvider` y el diccionario reales, mockeando sólo las server actions.
**Ninguna verificación silenciada.**

## Los hallazgos que trajo `obra` de la tanda 2, ya enrutados

Los tres contrastados contra el repo antes de enrutarlos:

1.  **Textos en español en `CategoriesSettingsContainer`** — es deuda ya abierta, no defecto. Pero el
    texto de `TECHNICAL_DEBT.md` §3 había quedado **mintiendo**: decía que `/settings` «es la única
    ruta que no llama a `getDictionary`», y la tanda 2 hizo que sí lo llame. Reescrito para que la
    deuda apunte al panel (766 líneas), no a la ruta.
2.  **`Tabs` expone `role="tab"`, no botones** → a [[testing-de-componentes-cliente]].
3.  **Un fixture de `Account` exige `cbuCvu` y `alias`** (el tipo es `InferSelectModel`) → idem.

**Lección que confirma la de la ronda anterior:** al cerrar una tanda, buscar en `docs/` y `.agents/`
lo que el trabajo acaba de dejar falso. Van dos rondas seguidas encontrando un doc desactualizado.

## Sobre la mesa, sin plan

*   Las tres propuestas que faltan de la sesión de diseño: reescritura del **RFC 008**, enmienda al
    **RFC 010** y enmienda al **RFC 003**. Las dos primeras referencian al 024, ya cerrado.
*   **La página de estadísticas**: sin RFC y sin nombre de ruta. Recibe el Patrimonio Neto que el 024
    desaloja de `/accounts` —que por decisión del usuario **se queda ahí hasta entonces**— y tiene que
    resolver la convención de signo de `monthly_summaries` (§9 del RFC 024).
*   **Internacionalizar `CategoriesSettingsContainer`**: 766 líneas de español directo en toolbar,
    modales y confirmaciones. Es una tanda propia y ahora es el único resto de i18n de `/settings`.
*   `dict?:` opcional heredado, **5 declaraciones en 4 archivos**: `ContactsTable`,
    `PaymentMethodsPanel`, `ContactFormModal` (×2), `MonthSelector`.
*   Las cuatro rutas del mock sin RFC: `/reportes`, `/patrimonio`, `/configuracion`, `/mejorar-plan`.
*   Deuda preventiva en `TECHNICAL_DEBT.md`: cobertura del mock de `next/cache`, suite real de
    `NotificationsContext`, retroceso de punteros en la migración `0026`, hamburguesa inerte del
    `PageHeader`, y `unarchive` que no deshace la cascada de `archive`.

**Artifact de la hoja de ruta (versión 9, 2026-09-10):** al día — refleja `f606a2e`, 405 tests, la
Fase 2 con 5 de 6 y el RFC 024 como resuelto en el §6. **Trampas al republicar:**
lo que devuelve `action: "read"` viene con el envoltorio `<!doctype><head><body>` que agrega la
publicación, hay que quitarlo (la línea 1 hasta `<body>` y el `</body></html>` final); el `favicon`
(📒) **no** se reenvía en un republish, se hereda; y **el archivo hay que leerlo con la herramienta
`Read`, las 1218 líneas, no con `sed`/`cat`**: si no, la publicación se rechaza con «you hadn't
viewed the live version». Si aun así rechaza por contenido idéntico ya rechazado, hay que volver a
hacer `action: "read"` del artifact y publicar inmediatamente después.
