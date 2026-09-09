# Registro de Cierre — Tarjetas como Cuentas de Pasivo (RFC 007, primera tajada)

* **Fecha de consolidación:** 2026-09-08
* **Rama base:** `master`
* **Rango consolidado:** `e4d8cb3..0578bb2` — 4 commits
* **Rama fusionada:** `feat/tarjetas`
* **Método:** fast-forward puro (`--ff-only`), sin conflictos. `master` no había divergido. `git log --merges` sigue vacío.
* **Resultado global:** 348 tests pasando en 46 archivos de prueba; 0 errores y 0 warnings de ESLint; `pnpm exec tsc --noEmit` en 0 errores corrido como comando propio; compilación de producción exitosa en 17,3 s. **Verificado de forma independiente por el subagente `verificador`** sobre el árbol de trabajo antes del merge, con `postgres-dev` vivo y la suite levantando `finanzas_db_test` con sus migraciones.

---

## Detalle de lo consolidado

### Enmienda y aprobación del RFC 007
* **Commits:** `3bc4251`, `9456889`
* El RFC venía de junio, antes del core contable, y se lo contrastó **archivo por archivo contra `src/features/*/schema.db.ts` real** antes de aprobarlo. Es el mismo procedimiento que salvó al RFC 015 la ronda anterior, y por la misma razón: un RFC viejo da por ciertas cosas que dejaron de serlo.
* Sobre el texto enmendado pasó a `APPROVED`. El plan de ejecución quedó cerrado en [`planes/tarjetas-como-cuentas-de-pasivo.md`](../planes/tarjetas-como-cuentas-de-pasivo.md).

### Implementación del modelo de dos tablas
* **Commit:** `3520f60`
* **El problema de fondo:** una tarjeta no es una cuenta contable. Es un plástico que puede tener saldo en varias divisas, sobre un motor donde cada cuenta tiene una única divisa y valida Debe = Haber por divisa dentro de la transacción ACID.
* La solución quedó en dos tablas, con la migración `0022_familiar_richard_fisk.sql`: `cards` guarda sólo los metadatos del plástico (red, últimos 4 dígitos, expiración, días de cierre y pago, límites) y **no guarda dinero**; `card_accounts` vincula el plástico a una cuenta de pasivo por divisa.
* La deuda de la tarjeta es el saldo contable **negado**: un pasivo aumenta con el crédito, los consumos acreditan, y por eso el balance en base es negativo. La conversión se centralizó en `deudaDe( cuenta )` para que ningún componente la repita con el signo al revés.
* Validación PCI-DSS estricta en `cards.schema.ts`: no se persiste el número completo.
* Agregación nueva en `ledgerRepository.sumEntriesByAccountInRange`, cálculo puro de ciclos en `ciclo.ts` con soporte de identificadores IANA, UI completa en `/cards`, siembra idempotente en `seed.ts`.
* Patrón asentado en [`patterns.md` §7](../patterns.md) y corrección de `.agents/AGENTS.md` §8.1.

### Cableado del ciclo a la vista — hallazgo de la verificación independiente
* **Commit:** `0578bb2`
* **La batería reproducía en verde y aun así faltaba lo principal.** `calcularPeriodos` y `sumEntriesByAccountInRange` estaban construidos y probados, pero **no tenían un solo consumidor de producción**: la maquinaria del ciclo existía y la tarjeta seguía mostrando únicamente deuda total. La partición entre saldo facturado y saldo en curso es el §4 del RFC y la justificación de la ronda entera.
* Es el defecto que ninguna de las cuatro comprobaciones puede ver: tests, lint, typecheck y build pasan perfecto sobre código correcto que nadie llama. Sólo aparece preguntando *quién consume esto en producción*.
* Se cableó con [`cardCycleService.ts`](../../src/features/cards/services/cardCycleService.ts), que resuelve el ciclo **en el servidor** porque la partición sale de una agregación del libro mayor, y con la **zona horaria del perfil**: de ella depende a qué día del mes pertenece un consumo, y con un cierre el 25 eso decide en qué período cae.
* `CicloTarjeta` viaja con fechas en ISO 8601 y no como `Date`: cruza del Server Component al cliente, y un `Date` no sobrevive esa frontera.
* Se corrigió además el mensaje de error del alta, que se tragaba el estado a medias de cuatro escrituras encadenadas sin transacción común (tarjeta, cuenta de pasivo, vínculo y asiento) — mismo precedente que `createAccountForEntityAction`. Una tarjeta sin cuenta contable no muestra saldo, y desde la interfaz eso parecía un error de lectura y no de alta.

---

## Deuda abierta en esta ronda

Anotada en [`TECHNICAL_DEBT.md`](../TECHNICAL_DEBT.md) § Abierto, ninguna bloqueante:

* Los intereses y comisiones de tarjeta (`interestRateFinancing`, `monthlyMaintenanceFee`, `annualRenewalFee`) están modelados pero **ningún proceso los devenga** en la fecha de cierre. Depende de los crons de la Fase 3.
* El disponible para compras (`Límite − Deuda total`) **no descuenta cuotas futuras pendientes**, porque el modelo relacional de cuotas nace con el RFC 008.

---

## Decisiones de gobernanza tomadas al cerrar

* **Los segmentos de ruta van en inglés.** Quedó escrito en [`ARCHITECTURE.md` §4](../../ARCHITECTURE.md). La convención existía de hecho —las cinco rutas en pie nacieron en inglés— pero no estaba en ningún lado, y la hoja de ruta seguía prometiendo los nombres en español del catálogo de FinanzasMock (`/tarjetas`). El módulo se entregó en **`/cards`**.
* Los tres pendientes menores heredados de la ronda de preferencias canónicas bajaron a `TECHNICAL_DEBT.md` § Abierto, sección 3, en vez de seguir viviendo en el doc de estado.
