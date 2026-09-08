# Trabajo en vuelo

**Qué hay a medias, en qué rama, y cuál es el próximo paso.** Este es el único doc con estado de trabajo; `AGENTS.md` sólo apunta acá para no llevarlo adentro.

Si venís de otra sesión y no tenés contexto: **leé esto primero, después [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md) §Abierto.**

**Se actualiza en el mismo commit que avanza el trabajo.** Un doc de estado que se actualiza después es un doc de estado que miente.

**Lo cerrado no se queda acá: se congela.** Cuando una rama se mergea, su sección se va a [`registro/`](registro/) con su fecha.

---

## Rama y próximo paso

**Rama activa:** `feat/preferencias-canonicas` (sale de `master`). Plan escrito y listo para ejecutar: [`planes/normalizar-preferencias-perfil.md`](planes/normalizar-preferencias-perfil.md).

**Estado:** 🟡 **Planificado, bloqueado por aprobación.** El RFC 015 fue contrastado archivo por archivo contra el esquema real y **enmendado el 2026-09-08**: describía preferencias a crear en `users` que ya existen en `profiles`, proponía una columna `password` que el endurecimiento de autenticación (`0176d86`) reemplazó por `password_hash`+`salt`+`hash_params`, y su algoritmo de consolidación consulta `wealthAssets` y `loans`, dos tablas que no existen. **El RFC sigue en `DRAFT`: no se escribe una línea de código hasta que pase a `APPROVED`.**

La primera ronda cubre sólo los objetivos 1 y 2 del RFC: normalizar las preferencias de `profiles` de etiquetas de interfaz (`'Peso argentino (ARS)'`, `'1.234,56'`, `'Lunes'`) a códigos canónicos (`'ARS'`, `'es-AR'`, `'monday'`), y cablearlas al formateo — hoy las ocho llamadas a `formatCurrency` pasan `"es-AR"` escrito en duro, de modo que **ninguna preferencia del usuario afecta a nada**. Incluye cerrar la validación ausente de `updateProfileAction`, que hoy permite que un cliente se cambie el plan comercial.

**Fuera de alcance, y nombrado para que no se filtre:** `exchange_rates` y la consolidación de patrimonio (dependen de tablas inexistentes), multi-workspace (`users.organization_id` es `NOT NULL`; es cambio de modelo, RFC propio) y la ruta `/perfil`.

**Próximo paso de desarrollo:**
1.  **Aprobar el RFC 015** (`docs/proposals/015-user-profile-and-preferences.md`) pasándolo de `DRAFT` a `APPROVED`. Es decisión del usuario; ningún agente lo aprueba por su cuenta.
2.  Ejecutar el plan con `obra`.
3.  Al cerrar, retomar la consolidación multimoneda cuando existan las tablas de riqueza y deudas.

> **Corrección de rumbo (2026-09-07):** este documento venía proponiendo Tarjetas o Metas como próximo
> módulo, en contra del artifact. **Tarjetas (RFC 007) es Fase 2 y Metas (RFC 011) es Fase 3.** Metas
> en la primera fase es justamente el error que el artifact documenta del `ROADMAP.md` viejo.

**Pendiente de la gobernanza:** revisar la duplicación entre `ARCHITECTURE.md` y `.agents/AGENTS.md` §2–§5.

---

### Inventario de migración de módulos (Fuentes de referencia)

#### 1. Módulos pendientes de portar desde `FinanzasMock` (Catálogo UI de 17 dominios)
* **Tarjetas (`/tarjetas`)** — RFC 007 (`007-cards-management.md`): componente visual de tarjeta física (chip, emisor, número enmascarado), vinculado a cuentas de pasivo.
* **Metas de ahorro (`/metas`)** — RFC 011 (`011-goals-and-reserves.md`): barras de progreso, cálculo de fecha objetivo y asignación de fondos.
* **Presupuestos (`/presupuestos`):** Donut ring, barras de progreso y límites de gasto asociados al árbol de `categories`.
* **Inversiones (`/inversiones`)** — RFC 014 (`014-investments-management.md`): portafolio, cotizaciones y gráficos con Recharts.
* **Deudas y préstamos (`/deudas`)** — RFC 008 (`008-loans-and-installments.md`): cronograma de amortización y cuotas.
* **Facturación (`/facturacion`)** — RFC 013 (`013-billing-and-invoicing.md`): emisión y preview de comprobantes.
* **Integraciones y API Keys (`/integraciones`)** — RFC 012 (`012-integrations-and-api-keys.md`).

#### 2. Servicios de infraestructura pendientes de portar desde `FinanceApp-WSL`
* **Crons y Workers de Background:** Upstash QStash (`/api/cron/net-worth`, `/api/cron/statements`, `/api/webhooks/qstash`) para el cálculo automatizado de fin de mes.
* **Email Transaccional:** Resend + plantillas de `@react-email/components` para resúmenes mensuales y alertas.
* **Esquemas de Riqueza (Wealth):** Tablas `assets`, `liabilities`, `credit_cards` adaptadas para incluir `organization_id`.
