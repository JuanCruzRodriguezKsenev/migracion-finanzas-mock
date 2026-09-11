# RFC 025: Compras en cuotas con tarjeta

*   **ID de la Propuesta:** 025
*   **Título:** Planes de cuotas de tarjeta de crédito, imputación al resumen y disponible real
*   **Estado:** `APPROVED` (2026-09-11 — aprobado por el usuario. Habilita código contra este texto)
*   **Fecha de Creación:** 2026-09-11
*   **Autor:** `tanda`
*   **Depende de:** RFC 007 (tarjetas, `APPROVED`), RFC 022 (clasificación, `APPROVED`), RFC 023 (transacciones propuestas, `APPROVED`)
*   **Hermano de:** RFC 008 (préstamos), del que se escindió por decisión del usuario

> [!IMPORTANT]
> Este RFC existe porque el **RFC 007 está `APPROVED` y depende de una tabla que nunca se modeló.**
> Su §8B calcula el disponible restando `installmentPlans`, y esa tabla no existe en el esquema, ni
> en ningún otro RFC, ni la nombra ningún otro documento. Mientras siga así, la fórmula aprobada del
> disponible **no se puede implementar como está escrita**.

---

## 0. Contraste contra el código real (2026-09-11)

Verificado archivo por archivo antes de escribir una línea de esquema.

| Lo que se suponía | Lo que hay realmente | Consecuencia |
| :--- | :--- | :--- |
| Hay que construir la partición facturado / en curso | **Ya está construida y testeada**: [`cardCycleService.ts`](../../src/features/cards/services/cardCycleService.ts) suma asientos por rango de fecha contra cada `card_accounts`, y [`ciclo.ts`](../../src/features/cards/utils/ciclo.ts) resuelve el ciclo con zonas IANA y años bisiestos | Este RFC **no toca nada de eso**. Sólo agrega un término |
| Hay que construir el disponible | **Ya existe**, en [`CardVisual.tsx:40`](../../src/features/cards/components/CardVisual.tsx): `Math.max( 0 , limite - deudaTotal )` | Sólo falta restarle las cuotas futuras |
| La fórmula del RFC 007 §321 es la que hay que implementar | La implementación **ya se apartó de ella, y para mejor**: el RFC resta `facturado + enCurso`, que son sólo los asientos del ciclo en curso; el código resta `deudaDe()` de **todo** el saldo, que además incluye deuda vieja impaga | **La fórmula del §321 subestima la deuda.** Este RFC la corrige en el documento viejo, no al revés |
| `ledger_transactions` puede apuntar a la compra que la originó | Tiene **`categoryId` y `reversesTransactionId`, nada más** — verificado | Qué cuotas ya se imputaron se sabe **sólo** por el puntero `resolved_through` |
| El motor de recurrencias sirve tal cual | `ocurrenciaN()` y `calcularPunteroInicial()` sí: reciben primitivas. **`pendientesDe()` no**: está tipada contra `Subscription` y lee `status` | Se escribe el equivalente en `cards`, sin tocar `subscriptions` |

### Un defecto vivo que este RFC hereda y no arregla

[`CardVisual.tsx:34`](../../src/features/cards/components/CardVisual.tsx) calcula la deuda como
`card.accounts.reduce( (sum, ca) => sum + deudaDe( ca.account ) , 0 )`: **suma el saldo de todas las
divisas de la tarjeta en un único número** y después lo formatea con `monedaPrincipal`, que es
`card.accounts[0].currency` (`:38`). Una tarjeta con saldo en pesos y en dólares —el caso que el
RFC 007 §7 describe como el escenario argentino típico— muestra la suma aritmética de dos monedas
distintas rotulada como pesos.

**Este RFC no lo arregla, pero tampoco lo empeora:** las cuotas futuras se calculan **por divisa** y
se entregan como un mapa, no como un escalar. El arreglo de `deudaTotal` pertenece al RFC 007 y queda
anotado en §10.

---

## 1. Contexto y objetivos

Comprar en cuotas con tarjeta es, en Argentina, la forma normal de comprar. No es un préstamo con
contraparte propia: es una compra que el banco factura fraccionada **dentro del resumen de esa
tarjeta**, en el mismo ciclo de cierre y vencimiento que todo lo demás.

### Objetivos

1.  **Modelar el plan de cuotas** como un compromiso asociado a una tarjeta, sin dinero acumulado propio.
2.  **Imputar una cuota por vez al resumen**, con el motor del RFC 023: proyección pura, puntero de idempotencia, sin cron y sin filas de pendientes.
3.  **Separar la fecha de compra de la fecha de la primera cuota**, que en la práctica casi nunca coinciden.
4.  **Completar el disponible** con el término que le falta, que es lo que el RFC 007 §8B pedía y no podía calcular.

### No objetivos

*   **Cancelación anticipada del plan con quita de intereses.** Se da de baja el plan; lo que ya se imputó queda en el libro. Ver §10.
*   **Refinanciación del resumen impago y devengamiento de intereses.** Es el §5 del RFC 007 y depende de los crons de la Fase 3.
*   **Arreglar la suma multidivisa de `deudaTotal`.** Pertenece al RFC 007. Ver §0 y §10.
*   **Cuotas de préstamos.** Ésas son el RFC 008, y son otra cosa: tienen contraparte, desembolso y amortización con interés.

---

## 2. La decisión que define este RFC: cuándo es el gasto

Comprás una heladera de $120.000 en 12 cuotas de $10.000.

**Decisión del usuario, 2026-09-11: el gasto son $10.000 por mes durante doce meses.** La compra no
emite ningún asiento; cada cuota se reconoce cuando entra al resumen.

La alternativa evaluada era registrar los $120.000 completos el día de la compra contra una cuenta
puente de «cuotas por vencer», y trasladar una cuota por mes a la tarjeta. Se descartó.

**Lo que se gana:**

*   **El saldo de la tarjeta es el resumen.** Lo que el motor contable dice que debés es lo que el banco te está pidiendo. La partición facturado / en curso de `cardCycleService.ts` sigue siendo correcta **sin tocar una línea**.
*   **El gasto mensual refleja el impacto mensual.** El presupuesto de septiembre no se distorsiona con una compra que se paga durante un año.
*   **Es lo que el RFC 007 §8B ya asumía.** Resta las cuotas futuras **aparte** del saldo consumido, lo que sólo tiene sentido si las cuotas futuras no están en el libro.

**El costo, declarado y no escondido:** el patrimonio neto ignora los $110.000 que ya se deben. Y es
una asimetría real con el RFC 008 — un préstamo de $120.000 a doce meses **sí** registra el pasivo
completo el día uno. Dos formas de financiar la misma heladera dan patrimonios netos distintos.

**Cómo se mitiga, y dónde:**

1.  **En la tarjeta**, las cuotas futuras se muestran explícitas y se restan del disponible (§6). No quedan invisibles.
2.  **En la página de estadísticas**, el Patrimonio Neto debe restar las cuotas futuras como compromiso fuera del libro. **Es un requisito que este RFC le deja a esa propuesta**, junto con la convención de signo de `monthly_summaries` que ya le había dejado el RFC 024 §9.

---

## 3. El modelo

### 3.1 Una tabla, colgada de la tarjeta

`card_installment_plans` vive en `src/features/cards/`, no en una feature nueva: el instrumento es la
tarjeta y la vista es `/cards`.

**No hay tabla puente hacia el libro mayor**, y es la diferencia con `cards`, `loans` y todo lo que
el RFC 024 §4 manda puentear. La razón: **un plan de cuotas no tiene saldo propio.** Sus asientos
acreditan la cuenta de la tarjeta, que ya está puenteada por `card_accounts`. Crear
`installment_plan_accounts` sería abrir una cuenta contable que nunca tendría movimientos propios.

### 3.2 Comprar y empezar a pagar son dos fechas distintas

Comprás el 20 de septiembre, pero la tarjeta cerró el 18: la primera cuota entra en el resumen de
octubre. O la promoción dice «comprá hoy, empezá a pagar en marzo». **Son dos hechos independientes:**

*   **`purchasedAt`** (`timestamp`): cuándo compraste. **Es informativo: no emite ningún asiento** (§2). Sirve para ordenar, buscar y mostrar.
*   **`firstInstallmentDate`** (`date` civil): en qué resumen entra la primera cuota. **Es el ancla del cronograma.**

**Al dar de alta el plan, la primera cuota se propone calculada y el usuario la corrige.** El cálculo
usa código que ya existe: `calcularPeriodos( closingDay , dueDay , purchasedAt , zonaHoraria )`
([`ciclo.ts:191`](../../src/features/cards/utils/ciclo.ts)) devuelve el cierre vigente; si la compra
es posterior a ese cierre, la primera cuota cae en el mes siguiente. **Es una propuesta por defecto,
nunca una imposición:** las promociones con período de gracia no se deducen de ninguna fecha de
cierre, las dice el comercio.

### 3.3 El cronograma se proyecta, no se materializa

Nada de doce filas de cuotas. El circuito del RFC 023 ([`patterns.md`](../patterns.md) §10) entero:

*   **`ocurrenciaN( firstInstallmentDate , "monthly" , 1 , n )`** ([`recurrenceService.ts:81`](../../src/features/subscriptions/services/recurrenceService.ts)) proyecta la fecha civil de la cuota `n`. Se reusa tal cual.
*   **`resolvedThrough`** (`date` civil) es la guarda de idempotencia y de orden: sólo se puede imputar la cuota pendiente más antigua, y dos sesiones simultáneas no pueden imputar la misma.
*   **`calcularPunteroInicial()`** ([`recurrenceService.ts:206`](../../src/features/subscriptions/services/recurrenceService.ts)) inicializa el puntero. **Verificado que resuelve bien la primera cuota futura:** cuando ninguna ocurrencia tiene la ventana abierta devuelve el puntero un intervalo **antes** del inicio de la serie, y `pendientesDe()` filtra por `fecha <= resolved`, así que la primera cuota queda pendiente y ninguna anterior se inventa.

**Lo que NO se reusa:** `pendientesDe()` ([`recurrenceService.ts:153`](../../src/features/subscriptions/services/recurrenceService.ts)) está tipada contra `Subscription` concreto y lee `suscripcion.status !== "active"`. Un plan de cuotas no tiene esa columna, y además tiene un final: **la serie termina en `totalInstallments`**, cosa que una suscripción no hace. Se escribe el equivalente en `cards` —con su tope y su corte— **sin tocar la feature `subscriptions`, que ya está cerrada y verde.**

### 3.4 El importe de la cuota es el dato, el total es derivado

Se guarda `installmentAmount`: lo que el resumen factura cada mes. **El precio total de la compra no
se guarda en ninguna columna**; es `installmentAmount × totalInstallments`.

El motivo es que el redondeo lo decide el banco, no nosotros. $100.000 en 3 cuotas no son tres cuotas
de $33.333,33: son las tres que el banco imprime en el resumen. Guardar el total y dividirlo produce
un número que no coincide con ninguna cuota real; guardar los dos produce dos verdades que se
contradicen. **El dato que el usuario tiene delante, en el resumen y en el ticket, es el importe de
la cuota.**

### 3.5 Imputar una cuota no mueve plata

Es la diferencia con una suscripción, y hay que nombrarla porque el molde a copiar es
`resolveSubscriptionAction.ts`, que **sí** pide una cuenta de pago.

Confirmar la cuota de una suscripción dice «me lo cobraron»: sale plata de una cuenta. Confirmar la
cuota de un plan dice «entró al resumen»: **aumenta la deuda de la tarjeta y no toca ninguna cuenta
bancaria.** El pago es otro hecho, posterior, que ya existe hoy como una transferencia contra la
cuenta de la tarjeta.

Por eso la acción de este RFC **no recibe `accountId` de pago, y no debe pedirlo.**

---

## 4. Esquema de base de datos

```typescript
/**
 * Plan de cuotas de una compra con tarjeta de crédito (RFC 025).
 * Cero dinero acumulado: cada cuota imputada vive como asiento contra la cuenta de la tarjeta.
 */
export const cardInstallmentPlans = pgTable( "card_installment_plans" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  cardId:         uuid( "card_id"         ).references( () => cards.id         , {onDelete: "cascade"} ).notNull() ,

  description:  varchar( "description"   , {length: 255} ).notNull() , // Ej: "Heladera Samsung"
  merchantName: varchar( "merchant_name" , {length: 150} ) ,
  categoryId:   uuid( "category_id" ).references( () => categories.id , {onDelete: "set null"} ) ,

  // El importe de CADA cuota, en centavos. El total de la compra es derivado (§3.4)
  installmentAmount: bigint( "installment_amount" , {mode: "number"} ).notNull() ,
  totalInstallments: integer( "total_installments" ).notNull() , // NO es dinero: integer
  currency:          varchar( "currency" , {length: 10} ).default( "ARS" ).notNull() ,

  // Comprar y empezar a facturar son dos fechas distintas (§3.2)
  purchasedAt:          timestamp( "purchased_at" , {withTimezone: true} ).notNull() , // Informativa: no emite asiento
  firstInstallmentDate: date( "first_installment_date" ).notNull() ,                   // Ancla del cronograma. Civil
  resolvedThrough:      date( "resolved_through" ) ,                                   // Puntero (RFC 023)

  archivedAt: timestamp( "archived_at" , {withTimezone: true} ) , // Baja lógica
  createdAt:  timestamp( "created_at"  , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:  timestamp( "updated_at"  , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  orgCardIdx: index( "card_installment_plans_org_card_idx" ).on( table.organizationId , table.cardId ) ,
} ) ; } ) ;
```

### 4.1 Decisiones de esquema y su fundamento

*   **No hay `frequency` ni `intervalCount`.** Las cuotas de tarjeta son mensuales por definición del instrumento. Se le pasan `"monthly"` y `1` literales a `ocurrenciaN()`. Una columna que siempre vale lo mismo es una invitación a que alguien la cambie y descubra que nada la respeta.
*   **`cardId` con `cascade`, igual que [`cardAccounts`](../../src/features/cards/schema.db.ts).** Es coherente con el puente existente, y no pierde historia contable: los asientos ya imputados viven en `ledger_transactions`, que no depende de esta tabla.
*   **`categoryId` con `set null`**, idéntico a [`ledgerTransactions`](../../src/features/accounting/schema.db.ts) y a [`subscriptions`](../../src/features/subscriptions/schema.db.ts). La categoría se resuelve a hoja en el momento de imputar (RFC 022 §5), no al dar de alta.
*   **`totalInstallments` es `integer` y `installmentAmount` es `bigint`.** La cantidad de cuotas no es dinero; es la misma familia que `year`, `month` e `interval_count`.
*   **`firstInstallmentDate` es `date` civil, no `timestamp`.** El motor de recurrencias compara fechas **como cadenas** `YYYY-MM-DD`, y `extraerComponentesCiviles()` ([`recurrenceService.ts:38`](../../src/features/subscriptions/services/recurrenceService.ts)) las lee con una expresión regular sin construir ningún `Date` —verificado—, así que una columna civil no se corre un día por zona horaria. Mezclar tipos rompería la comparación contra `resolvedThrough`.
*   **`archivedAt`, no `isActive`.** Igual que `cards` y `contacts`, y por el mismo motivo que la regla R4 del RFC 022.
*   **Sin `CHECK` en la base.** `totalInstallments >= 1` y `installmentAmount > 0` se validan con Zod en el servicio: el repositorio no usa constraints de chequeo en ninguna tabla y este RFC no introduce el primero.

### 4.2 Radio de impacto

**Una tabla nueva con FK ⇒ va agregada a [`limpiarBase()`](../../src/shared/db/testCleanup.ts)**, o rompe suites de otras features de forma intermitente según el orden en que Vitest corra los archivos ([`patterns.md`](../patterns.md) §11). El orden topológico **ya está resuelto en el archivo y no se recalcula**:

*   `card_installment_plans` tiene FK contra `cards` (paso 8) y contra `categories` (paso 15). Va **antes de las dos**: su lugar es el **paso 7**, junto a `card_accounts`, empujando la numeración de los comentarios.
*   **El barril `src/shared/db/schema.ts` no se toca:** ya hace `export * from "@/features/cards/schema.db"`, y la tabla nueva vive en ese mismo archivo. Es la diferencia con el RFC 008, que sí estrena feature.

**Lo que cambia porque `CicloTarjeta` gana campos.** Éste es el radio real, y es donde aparecen los defectos si el plan de ejecución no lo nombra:

| Archivo | Qué cambia |
| :--- | :--- |
| [`cards/types.ts`](../../src/features/cards/types.ts) | `CicloTarjeta` suma `cuotasFuturas`. **Es un mapa divisa → centavos, no un escalar** (§0) |
| [`cardCycleService.ts`](../../src/features/cards/services/cardCycleService.ts) | Calcula el término nuevo. Hoy devuelve `null` para débito y para crédito sin `closingDay`: **un plan de cuotas existe igual sin día de cierre**, así que el cálculo no puede quedar dentro de esa guarda |
| [`CardVisual.tsx`](../../src/features/cards/components/CardVisual.tsx) | `:40` resta el término nuevo; se agrega la fila que lo muestra |
| [`cardsRepository.ts`](../../src/features/cards/repositories/cardsRepository.ts) | Alta, listado, archivado e imputación del plan |
| `cardCycleService.test.ts` , `cardsRepository.test.ts` , `cards.schema.test.ts` | Fixtures y casos nuevos |
| [`dictionaries/es.json`](../../src/dictionaries/es.json) , `en.json` , `br.json` | Ver la deuda de abajo |

> [!WARNING]
> **`/cards` tiene la misma deuda de i18n que `/settings`, y este RFC la agrava si no se nombra.**
> Verificado: `cardsPage` en los tres diccionarios tiene **sólo `title` y `subtitle`**, mientras
> `CardVisual.tsx` rotula en español directo `"Saldo facturado"` (`:108`), `"Deuda Total"` (`:133`),
> `"Disponible"` y `"Límite"` (`:148-149`). **El plan de ejecución de este RFC agrega sus rótulos a
> los tres diccionarios desde el principio**; internacionalizar los que ya están es deuda aparte y
> va a [`TECHNICAL_DEBT.md`](../TECHNICAL_DEBT.md).

---

## 5. Flujos contables

Todos los importes en centavos. Todos los asientos, dos patas y Debe = Haber en la misma divisa.

### A. Alta del plan

**No se emite ningún asiento.** Es la consecuencia directa de §2. El plan nace con
`resolvedThrough` calculado por `calcularPunteroInicial()`.

### B. Imputación de una cuota al resumen

Cuota de $10.000 de la heladera, categoría Hogar, tarjeta en ARS:

| | Cuenta | Debe | Haber |
| :--- | :--- | ---: | ---: |
| **Debe** | Gasto — hoja de la categoría en ARS (RFC 022) | 10.000 | |
| **Haber** | Cuenta de la tarjeta en ARS (`card_accounts`) | | 10.000 |

*   `occurredAt` = **la fecha civil de la ocurrencia**, no el día en que el usuario hace clic. Es lo que preserva los cierres históricos y lo que hace que la cuota caiga en el ciclo correcto de `cardCycleService`.
*   La cuenta de gasto se resuelve con `resolveToLeaf()` y `findOrCreateAccountForCurrency()`, exactamente como en [`resolveSubscriptionAction.ts`](../../src/features/subscriptions/actions/resolveSubscriptionAction.ts).
*   **Ninguna cuenta bancaria participa** (§3.5).
*   El asiento, el avance de `resolvedThrough` y nada más ocurren **en la misma transacción ACID**. Si el puntero avanzó, el asiento existe.

### C. Compra en una divisa distinta

Una compra en USD con la misma tarjeta se imputa contra la `card_accounts` **de esa divisa**. Si la
tarjeta todavía no tiene cuenta en USD, se crea en el alta del plan con
`cardsRepository.addCardAccount()` ([`cardsRepository.ts:180`](../../src/features/cards/repositories/cardsRepository.ts)) y `getNextCode( "liability" )`, igual que hace
[`cardsActions.ts:139-153`](../../src/features/cards/actions/cardsActions.ts) al dar de alta la tarjeta.

**Cada moneda es un libro propio:** el motor rechaza con excepción cualquier asiento cuya divisa no
coincida con la de su cuenta (RFC 007 §0). No hay conversión implícita.

### D. Pago del resumen

**Este RFC no lo toca.** Ya existe: es una transferencia desde una cuenta bancaria contra la cuenta
de la tarjeta, que reduce el pasivo. Que el resumen incluya cuotas no lo cambia en nada.

### E. Invariantes de emisión

1.  Sólo se puede imputar **la cuota pendiente más antigua** del plan.
2.  No se puede imputar más allá de `totalInstallments`: la serie **termina**.
3.  No se puede imputar una cuota cuya ventana no abrió todavía (`ventanaAbierta()`, [`recurrenceService.ts:130`](../../src/features/subscriptions/services/recurrenceService.ts)).
4.  Un plan archivado no propone ni imputa nada.
5.  Toda consulta filtra por `organizationId` (`.agents/AGENTS.md` §8.3).

---

## 6. El disponible, que es lo que el RFC 007 pedía

**Cuotas futuras de un plan** = `installmentAmount × ( totalInstallments − imputadas )`.

`imputadas` no es una columna: se cuenta proyectando ocurrencias con `ocurrenciaN()` hasta pasar
`resolvedThrough`. Con el tope de `totalInstallments` el bucle está acotado por construcción.

**El disponible pasa a ser:**

```
disponible = limite − deudaTotal − cuotasFuturas
```

donde `deudaTotal` es lo que `CardVisual.tsx:34` ya calcula con `deudaDe()`.

### La corrección que este RFC le hace al RFC 007

El RFC 007 §321 escribe `Disponible = Límite − (Facturado + En curso + Cuotas Futuras)`. **Está mal, y
el código ya lo había corregido sin decirlo.** `facturado` y `enCurso` son los asientos de un rango de
fechas: el saldo impago de ciclos anteriores no cae en ninguno de los dos, así que la fórmula del RFC
deja deuda afuera y sobrestima el disponible.

Se aplica el procedimiento con que el RFC 023 caducó una parte del RFC 004
([`004-subscriptions-management.md:123`](004-subscriptions-management.md)): **no se abre una enmienda
aparte.** La línea 321 del RFC 007 recibe su nota en el lugar exacto, apuntando a esta sección.

---

## 7. Lo que la interfaz muestra

En la ficha de la tarjeta, debajo de la partición facturado / en curso que ya existe:

*   **Cuotas futuras**, con el total y cuántas cuotas quedan.
*   **La lista de planes activos**, cada uno con su progreso (`3 de 12`) y la fecha de la próxima cuota.
*   **Las cuotas pendientes de imputar**, con su botón de confirmación.

**La bandeja de cuotas vive en `/cards`, no en `/subscriptions`.** Son hechos de la tarjeta, se leen
contra el resumen de la tarjeta y se confirman mirando ese resumen. Llevarlas a la bandeja de
recurrencias obligaría a mezclar dos acciones que no son la misma (§3.5: una mueve plata, la otra no)
en un componente que ya está cerrado y verde.

**Lo que no hay que construir, porque ya existe:**

| Ya existe | Dónde | Cómo se usa |
| :--- | :--- | :--- |
| Ciclo, cierre y vencimiento | `calcularPeriodos()` , [`ciclo.ts:191`](../../src/features/cards/utils/ciclo.ts) | Para proponer `firstInstallmentDate` en el alta (§3.2) |
| Partición facturado / en curso | [`cardCycleService.ts`](../../src/features/cards/services/cardCycleService.ts) | Sin tocar. Las cuotas imputadas entran solas por `occurredAt` |
| Deuda positiva de un pasivo | `deudaDe()` , [`ciclo.ts:23`](../../src/features/cards/utils/ciclo.ts) | Tal cual |
| Proyección de la cuota `n` | `ocurrenciaN()` , [`recurrenceService.ts:81`](../../src/features/subscriptions/services/recurrenceService.ts) | Tal cual, con `"monthly"` y `1` |
| Puntero inicial | `calcularPunteroInicial()` , [`recurrenceService.ts:206`](../../src/features/subscriptions/services/recurrenceService.ts) | Tal cual |
| Ventana de propuesta | `ventanaAbierta()` , [`recurrenceService.ts:130`](../../src/features/subscriptions/services/recurrenceService.ts) | Tal cual |
| Categoría → hoja → cuenta por divisa | `resolveToLeaf()` , `findOrCreateAccountForCurrency()` , [`categoryRepository.ts`](../../src/features/accounting/repositories/categoryRepository.ts) | Al imputar (§5B) |
| Alta de cuenta de tarjeta en otra divisa | `addCardAccount()` , [`cardsRepository.ts:180`](../../src/features/cards/repositories/cardsRepository.ts) | §5C |
| Molde de la acción de confirmación | [`resolveSubscriptionAction.ts`](../../src/features/subscriptions/actions/resolveSubscriptionAction.ts) | **Copiar la estructura, no el `accountId` de pago** (§3.5) |
| Bloqueo `FOR UPDATE` contra doble confirmación | `findByIdForUpdate()` , [`subscriptionRepository.ts`](../../src/features/subscriptions/repositories/subscriptionRepository.ts) | El equivalente para planes |
| Envoltura de resultado | `Result` , `ok()` , `fail()` , [`result.ts`](../../src/shared/lib/result.ts) | Toda acción devuelve `Result` |

---

## 8. Verificación

```bash
pnpm test
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit
pnpm build
```

**`pnpm build` no es typecheck:** no tipa los archivos de test, y vitest tampoco. La compuerta corre
`tsc --noEmit` por separado (`.github/workflows/compuerta.yml:62`).

Contraste del esquema contra la base real, una vez migrado:

```bash
podman exec postgres-dev psql -U postgres -d finanzas_db -c "\d card_installment_plans"
```

`installment_amount` debe figurar como `bigint`; `total_installments` como `integer`;
`first_installment_date` y `resolved_through` como `date`, sin zona horaria.

---

## 9. Casos de prueba que este RFC exige

1.  **Debe = Haber por divisa** en el asiento de §5B.
2.  **El alta no emite ningún asiento**: dar de alta un plan deja `ledger_transactions` sin filas nuevas.
3.  **Idempotencia:** imputar dos veces la misma cuota escribe un solo asiento y falla la segunda.
4.  **Orden:** imputar una cuota que no es la más antigua pendiente falla sin escribir.
5.  **Fin de serie:** un plan de 3 cuotas con las 3 imputadas no propone una cuarta.
6.  **Primera cuota futura:** un plan comprado el 20/09 con primera cuota el 10/11 no propone nada hasta el 1/11, y la primera que propone es la del 10/11.
7.  **Ancla de fin de mes:** un plan con primera cuota el 31/01 proyecta 28/02 y vuelve a 31/03, sin degradarse.
8.  **La cuota cae en el ciclo correcto:** una cuota imputada con `occurredAt` anterior al cierre entra en `facturado`; una posterior, en `enCurso`.
9.  **Divisa:** un plan en USD sobre una tarjeta sin cuenta en USD la crea, y el asiento no se mezcla con el libro en ARS.
10. **Disponible:** con un plan de 12 cuotas de $10.000 y una imputada, el disponible baja en $110.000 por cuotas futuras además de los $10.000 de deuda.
11. **Aislamiento:** ninguna consulta del repositorio devuelve filas de otra organización.
12. **`limpiarBase()`** deja la tabla vacía y no rompe ninguna suite existente.

---

## 10. Lo que este RFC deja abierto

*   **La suma multidivisa de `deudaTotal`** ([`CardVisual.tsx:34`](../../src/features/cards/components/CardVisual.tsx)). Defecto vivo, verificado, anterior a este RFC. Pertenece al RFC 007 y necesita decidir qué significa el `creditLimit` de una tarjeta que opera en dos monedas: hoy es una columna sin divisa declarada.
*   **El Patrimonio Neto y las cuotas futuras.** Requisito que este RFC le deja a la propuesta de estadísticas: las cuotas no imputadas son un compromiso real que no está en el libro (§2).
*   **Cancelación anticipada con quita.** Devolver el producto o cancelar el plan pagando el remanente. Hoy se archiva el plan y lo imputado queda; la quita de intereses no está especificada.
*   **Planes con interés explícito.** «12 cuotas sin interés» trae el interés adentro del precio. Un plan con interés declarado aparte necesitaría separar capital de interés en cada cuota, como hace el RFC 008 §5D con los préstamos.
*   **Cuotas no mensuales.** Existen planes quincenales. El esquema los rechaza por construcción (§4.1); habilitarlos pide las dos columnas de frecuencia.
*   **Alta desde la transacción.** Hoy el plan se da de alta en `/cards`. Cargarlo desde el formulario de transacciones, marcando una compra como «en cuotas», es una mejora de flujo que depende de que `/transactions` sepa de tarjetas — hoy no sabe: su formulario elige una cuenta, no un instrumento.
