---
name: feature-profile
description: Estado real de la feature `profile` de FinanzIA — códigos canónicos ya migrados, qué quedó abierto y por qué las preferencias todavía no afectan a nada.
metadata:
  type: project
---

# Preferencias de usuario (feature `profile`)

*   **`profiles` es una tabla aparte de `users`**, con todas las preferencias (`currency`, `timezone`,
    `theme`, `numberFormat`, `weeklyStart`, `dateFormat`, `roundAmounts`, …). Cuelga de `users.id`
    **sin `organizationId`**: aislamiento transitivo, igual que `contact_payment_methods`.
*   **Corregido el 2026-09-10 — ya guarda códigos canónicos, no etiquetas de UI.** `numberFormat` es
    BCP 47 (`"es-AR"`), validado con `z.enum( NUMBER_FORMAT_CODES )`. El catálogo código→etiqueta vive
    en `features/profile/preferences.ts`, con `LABEL_TO_CODE_MAP` para las filas heredadas que migró
    la `0021`. Cinco componentes ya leen `profile.numberFormat` como locale.
    **Why:** la memoria anterior decía que guardaba `'1.234,56'` y `'Peso argentino (ARS)'`; eso ya no
    es cierto y llevaba a planificar una migración que ya estaba hecha.
*   **Corregido — `updateProfileAction` ya valida con Zod estricto.** El agujero por el que un cliente
    se cambiaba `planName` está cerrado. Lo que sigue abierto es que los campos comerciales
    (`planName`, `planBilling`, `planNextCharge`) vivan en la tabla de preferencias (deuda §2).
*   **`formatCurrency( amount , currencyCode , locale )`** (`shared/lib/currencyFormatter.ts`): firma
    correcta y cachea decimales por divisa, **pero no valida el locale** antes de pasarlo a `Intl`
    (deuda §3) — una fila fuera del backfill haría lanzar en render. Convive con `formatCents`
    (`accounting/utils/dashboardMetrics.ts`), más viejo y sin divisa ni locale, que
    `.agents/AGENTS.md` §8.2 **todavía nombra como el canónico**.
*   **No existe la ruta de edición del perfil**, así que `preferences.ts` no tiene consumidor de
    producción y `roundAmounts` se persiste sin que nadie lo lea. **Enmienda al RFC 015 (2026-09-09):
    no hay ruta `/profile`** — el perfil es otra pestaña de `/settings`.
*   `SummaryBar.tsx` **no lleva `"use client"`**: es cliente por transitividad, porque lo importa
    `SubscriptionDashboard`. Recibe todo por props y debe seguir así.
