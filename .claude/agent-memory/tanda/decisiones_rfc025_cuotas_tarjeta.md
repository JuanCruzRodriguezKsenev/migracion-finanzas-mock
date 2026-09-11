---
name: decisiones-rfc025-cuotas-tarjeta
description: RFC 025 (2026-09-11) — compras en cuotas con tarjeta: por qué una cuota por mes y no el total al comprar, y la asimetría declarada con el RFC 008.
metadata:
  type: project
---

# RFC 025 — compras en cuotas con tarjeta

Escrito el **2026-09-11**, en **`DRAFT`**: `docs/proposals/025-card-installment-plans.md`.
Hermano del [[decisiones-rfc008-loans]]; los dos se leen juntos.

## Por qué se adelantó al RFC 010

**El RFC 007 está `APPROVED` y depende de una tabla que nunca se modeló.** Su §8B
(`007-cards-management.md:319`) calcula el disponible restando `installmentPlans`, que no existe en
el esquema ni en ningún otro RFC. Es la trampa de los RFC viejos al revés: no autoriza un modelo
equivocado, **promete una tabla fantasma**. El 010 es patrimonio físico y no bloquea nada.

## La decisión del usuario (2026-09-11)

**Una heladera de $120.000 en 12 cuotas es un gasto de $10.000 por mes, no de $120.000 en septiembre.**
La compra **no emite ningún asiento**; cada cuota se imputa al resumen cuando entra.

*   Se gana que **el saldo de la tarjeta sea el resumen**, y que `cardCycleService.ts` siga correcto sin tocarse.
*   **El costo está declarado en el §2 del RFC, no escondido:** el patrimonio neto ignora las cuotas futuras, y eso es **asimétrico con el RFC 008**, donde un préstamo sí registra el pasivo completo el día uno. Financiar lo mismo de las dos formas da patrimonios netos distintos.
*   **Quién cierra la brecha:** la propuesta de estadísticas, que ya tenía pendiente la convención de signo de `monthly_summaries`. Es requisito, no sugerencia.

## Decisiones de modelado y su porqué

*   **`card_installment_plans` NO tiene tabla puente al libro.** Es la excepción explicada al RFC 024 §4: un plan no tiene saldo propio, sus asientos acreditan la cuenta de la tarjeta que `card_accounts` ya puentea.
*   **Se guarda `installmentAmount` (lo que factura cada mes), no el total de la compra.** El redondeo lo decide el banco; guardar los dos da dos verdades que se contradicen.
*   **Sin `frequency` ni `intervalCount`**: las cuotas de tarjeta son mensuales por definición. Se le pasan `"monthly"` y `1` literales a `ocurrenciaN()`.
*   **Imputar una cuota NO mueve plata.** Es la diferencia con `resolveSubscriptionAction.ts`, que es el molde a copiar: la acción de cuotas **no recibe `accountId` de pago**. El pago del resumen es otro hecho, ya existente.
*   **La bandeja de cuotas vive en `/cards`**, no en la de recurrencias de `/subscriptions`.

## Fechas separadas, en los dos RFC

Pedido del usuario el 2026-09-11: **la fecha del hecho y el ancla del cronograma son dos columnas.**
Se aplicó a los dos documentos.

*   `loans`: `startDate` (desembolso) + `firstInstallmentDate` (`date` civil).
*   `card_installment_plans`: `purchasedAt` (informativa, no emite asiento) + `firstInstallmentDate`.

**Verificado en el motor, no supuesto:** `extraerComponentesCiviles()` (`recurrenceService.ts:38`)
lee un `YYYY-MM-DD` con regex sin construir ningún `Date`, así que una columna `date` no se corre por
zona horaria; y `calcularPunteroInicial()` (`:206`), cuando ninguna ventana abrió todavía, deja el
puntero un intervalo **antes** del inicio, de modo que una primera cuota futura queda pendiente sin
inventar ocurrencias anteriores. **Los dos se reusan tal cual.**
