# Registro de Cierre — Transacciones, Contactos, Gobernanza y Entidades Financieras

* **Fecha de consolidación:** 2026-09-08
* **Rama base:** `master`
* **Rango consolidado:** `b28eb08..ef21cf9` — 23 commits
* **Ramas fusionadas, en orden:** `feat/contacts-management` → `chore/gobernanza-reglas-neutrales` → `fix/entidades-financieras`
* **Método:** fast-forward puro (`--ff-only`), sin conflictos. `master` no había divergido y las tres ramas estaban encadenadas.
* **Resultado global:** 305 tests pasando en 39 archivos de prueba; 0 errores y 0 warnings de ESLint; `pnpm exec tsc --noEmit` en 0 errores corrido como comando propio; compilación de producción exitosa. Verificado sobre `master` en `ef21cf9`.

---

## Detalle de lo consolidado

### Tanda I — Módulo de Transacciones (`feat/transactions-management`)
* **Commits:** `12a9efa`, `a1c5d82`
* Módulo contable completo en `/transactions`: alta y detalle en modal, reversión ACID, búsqueda y filtros.
* `occurred_at` con backfill (migración `0014_real_komodo.sql`) y paginación por cursor `(occurred_at, id)`.
* Primitivas compartidas nuevas: `DataTable` y `SearchInput`. Selector de columnas visibles y badges de marcas.

### Tanda J — Multimoneda y Reversión Irrepetible (`feat/transactions-management`)
* **Commit:** `a3c8f95`
* **Validación de Debe = Haber por divisa**, no por suma total: sumar todos los asientos sin mirar la moneda daba por balanceada una transacción que no lo estaba.
* Cambio de divisas con 4 asientos en 2 libros contra `3.3.01-<MONEDA>`.
* Reversión irrepetible con bloqueo `SELECT FOR UPDATE`; columnas `reversed_at` y `reverses_transaction_id` (migración `0015_icy_blizzard.sql`).

### Tanda K — Despachador Outbox, RFC 020 (`feat/transactions-management`)
* **Commit:** `43f5773`
* Consumo desacoplado en 3 pasos con `SKIP LOCKED`, recuperación de `PROCESSING` huérfanos y purga histórica.
* Script CLI `pnpm db:outbox` e índice `outbox_status_created_idx` (migración `0016_eminent_roxanne_simpson.sql`).

### Fase 0 — Endurecimiento del Core (`feat/transactions-management`)
* **A1 (`dd3eff8`):** incremento de intentos y transición a `FAILED` en huérfanos del dispatcher; protección de asentamiento tardío.
* **A2 (`7dac3b6`):** índice único `monthly_summaries_org_year_month_unique` (migración `0017_free_iron_monger.sql`).
* **A3 (`ed91817`):** RFC 018 regularizado a `APPROVED` con el estado real del core contable (migraciones 0012–0016).
* **A4 (`b736953`):** RFC 019 y migración de 9 columnas monetarias a `bigint` en modo number (migración `0018_slimy_wiccan.sql`).

### Seguridad de Autenticación
* **Commit:** `0176d86`
* Endurecimiento de sesiones, hashing y freno de fuerza bruta.
* **Nota:** este trabajo no figuraba en la tabla de tandas de `trabajo-en-vuelo.md`. Se detectó al delimitar el rango para este registro; queda asentado acá para que no se pierda.

### Bloque B — Agenda de Contactos (`feat/contacts-management`)
* **Commits:** `27e42ee`, `50444dd`, `ca9b900`, `5684e41`
* Contactos y métodos de cobro en `/contacts` (RFC 006 enmendado, migración `0019_tidy_piledriver.sql`).
* Validadores de CBU, alias y CUIT. **DAL con aislamiento multi-tenant transitivo:** `contact_payment_methods` cuelga de `contact_id`, así que la capa de datos joinea contra `contacts` para filtrar por organización.
* 42 tests nuevos de contactos. En `27e42ee` quedó además registrada la decisión de cotizaciones que alimenta el RFC 015.
* `5684e41` completa fixtures de `Account` con `cbu_cvu` y `alias`: agregar columnas a `accounts` rompió fixtures de features ajenas.

### Gobernanza y Flota de Agentes (`chore/gobernanza-reglas-neutrales`)
* **Commits:** `d9a8a30`, `677a337`, `da7fa34`, `56af414`, `f7e91f0`, `f2bc4a3`
* `AGENTS.md` en la raíz como **router neutral** para cualquier cliente de IA, con las reglas duras y las rutas al resto; `CLAUDE.md` reducido a puntero.
* Agentes generalizados a nivel usuario (`~/.claude/agents/`), con lo específico del repo en la ficha `.claude/CLAUDE.md`. Ciclo `tanda` → `obra` → `verificador`.
* Primera ronda real del ciclo: `obra` frenó ante el árbol sucio y devolvió un informe de factibilidad en vez de improvisar.

### Fix Entidades Financieras (`fix/entidades-financieras`)
* **Commits:** `2ebc37e`, `0fdde0c`, `b0ceb72`, `ef21cf9`
* **`createFinancialEntityAction` pasó a ser alta pura** a nivel organización. Antes creaba la entidad *y* una cuenta de activo propia, de modo que dar de alta una entidad para el método de cobro de un contacto abría una cuenta del usuario en un banco donde no opera.
* Nueva `createAccountForEntityAction`: crea la cuenta y, ante saldo inicial mayor a cero, **emite el asiento de apertura contra Patrimonio Neto (`3.1.01.01`)**, verificando que esa cuenta exista antes de crear nada. El alta anterior insertaba el saldo sin asiento, lo que violaba Debe = Haber.
* Columna `brand_domain` (`varchar(100)`, migración `0020_soft_fixer.sql`) con backfill: `financial_entities.logo` guardaba indistintamente un dominio de marca o un nombre de ícono y se desambiguaba olfateando strings.
* Prop `withOwnAccount` en `CreateFinancialEntityForm` (en `false` desde `PaymentMethodsPanel`) y guard del selector de íconos para que no pise el dominio.
* `0fdde0c` cierra el radio de impacto: de los cuatro consumidores de `InstitutionLogo`, `TransactionsTable` era el único que no recibía `brandDomain`.

---

## Saneamiento de datos

Se eliminó de la base de desarrollo la entidad de diagnóstico `kk` y su `Cuenta Principal kk` (`1.1.01.03`), que arrastraba 3 centavos de saldo con 0 asientos respaldatorios —es decir, un descuadre de Debe = Haber originado por el alta vieja—. El borrado exigió sacar primero la cuenta, por el `onDelete: "restrict"` de `accounts.entity_id`. Tras la limpieza no queda ninguna cuenta con saldo sin asiento que lo respalde.

## Lo que queda abierto

* **RFC 015 — perfil, preferencias y consolidación multimoneda:** único RFC en `DRAFT` de los 21 y único bloqueo formal para dar la Fase 1 por cerrada. No hay una sola línea de consolidación multimoneda en `src/`.
* **`createAccountForEntityAction` fija `currency: "ARS"` en duro**, en un motor que ya valida Debe = Haber por divisa. Anotado en `TECHNICAL_DEBT.md` § Abierto.
* Revisar la duplicación entre `ARCHITECTURE.md` y `.agents/AGENTS.md` §2–§5.
