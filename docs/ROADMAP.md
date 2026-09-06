# Hoja de Ruta de Producto — FinanzIA (Roadmap)

Este documento detalla las nuevas características y módulos funcionales pendientes de portar e implementar en FinanzIA, ordenados por fases de entrega y referenciados a sus Propuestas de Cambio (RFCs) aprobadas en `docs/proposals/`.

---

## Fase 1 — Gestión de Riqueza y Pasivos (Prioridad Inmediata)

### 1. Tarjetas de Crédito y Débito (`/tarjetas`)
*   **RFC de referencia:** [RFC 007 — `007-cards-management.md`](proposals/007-cards-management.md).
*   **Alcance funcional:**
    *   Componente visual interactivo de tarjeta física (chip EMV, emisor Visa/Mastercard/Amex, número enmascarado, fecha de expiración).
    *   Vinculación contable con cuentas de tipo `liability` en el Libro Mayor.
    *   Control de fecha de cierre y fecha de vencimiento con recordatorios.

### 2. Deudas y Préstamos Amortizables (`/deudas`)
*   **RFC de referencia:** [RFC 008 — `008-loans-and-installments.md`](proposals/008-loans-and-installments.md).
*   **Alcance funcional:**
    *   Seguimiento de préstamos personales y comerciales con cálculo de interés francés o alemán.
    *   Cronograma de cuotas con desglose de capital e intereses.
    *   Asiento contable automático de cada cuota cancelada.

### 3. Metas de Ahorro y Fondos de Reserva (`/metas`)
*   **RFC de referencia:** [RFC 011 — `011-goals-and-reserves.md`](proposals/011-goals-and-reserves.md).
*   **Alcance funcional:**
    *   Barras de progreso visual hacia objetivos monetarios.
    *   Cálculo de aportes periódicos recomendados para alcanzar la fecha meta.
    *   Reserva contable virtual sin necesidad de mover fondos entre cuentas bancarias reales.

---

## Fase 2 — Análisis Financiero e Inversiones

### 4. Presupuestos por Categoría (`/presupuestos`)
*   **Alcance funcional:**
    *   Gráfico Donut ring y barras de ejecución presupuestaria.
    *   Límites de gasto mensuales asociados a la jerarquía de `categories`.
    *   Alertas tempranas al alcanzar el 80% y 100% del límite fijado.

### 5. Portafolio de Inversiones (`/inversiones`)
*   **RFC de referencia:** [RFC 014 — `014-investments-management.md`](proposals/014-investments-management.md).
*   **Alcance funcional:**
    *   Seguimiento de CEDEARs, acciones, bonos y fondos comunes de inversión.
    *   Visualización de rendimientos históricos y cotizaciones mediante Recharts.
    *   Ajuste por valuación a mercado (Mark-to-Market) con asientos contables de resultado por tenencia.

---

## Fase 3 — Operaciones Comerciales e Integraciones

### 6. Facturación y Comprobantes (`/facturacion`)
*   **RFC de referencia:** [RFC 013 — `013-billing-and-invoicing.md`](proposals/013-billing-and-invoicing.md).
*   **Alcance funcional:**
    *   Emisión de comprobantes y vista previa en PDF/impresión.
    *   Impacto automático en cuentas de ingresos (`revenue`) y cuentas a cobrar (`accounts_receivable`).

### 7. Integraciones y Claves de API (`/integraciones`)
*   **RFC de referencia:** [RFC 012 — `012-integrations-and-api-keys.md`](proposals/012-integrations-and-api-keys.md).
*   **Alcance funcional:**
    *   Gestión de tokens Bearer para acceso programático externo.
    *   Sincronización mediante webhooks alimentados por el despachador Outbox.

---

## Fase 4 — Automatizaciones e Infraestructura de Fondo

### 8. Workers de Tareas en Background (Upstash QStash)
*   **Alcance:**
    *   Crons automatizados para el cierre mensual y cálculo de balances históricos (`/api/cron/net-worth`, `/api/cron/statements`).
    *   Procesamiento del Transactional Outbox para reintento de eventos fallidos.

### 9. Mensajería Transaccional (Resend + React Email)
*   **Alcance:**
    *   Plantillas tipadas con `@react-email/components`.
    *   Envío de resúmenes de fin de mes y avisos de vencimiento de tarjetas.
