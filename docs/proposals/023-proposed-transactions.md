# RFC 023: Transacciones propuestas — recurrencias

*   **ID de la Propuesta:** 023
*   **Título:** Bandeja de transacciones propuestas, acotada a recurrencias, y su confirmación al libro mayor
*   **Estado:** `APPROVED` (2026-09-10) — aprobado por el usuario. Habilita código contra este texto.
*   **Fecha de Creación:** 2026-09-10
*   **Fecha de Aprobación:** 2026-09-10
*   **Autor:** `tanda`
*   **Origen:** §2 de [`docs/diseno/rediseno-clasificacion-y-propuestas.md`](../diseno/rediseno-clasificacion-y-propuestas.md), donde se tomaron las ocho decisiones con su fundamento.
*   **Enmienda:** revoca las secciones 3 y 4 del [RFC 004](004-subscriptions-management.md). Ver §7.

> [!IMPORTANT]
> **Escrito contrastando el código y el esquema real, no de memoria.** La Sección 0 lista lo
> verificado, incluidos **dos defectos previos que este RFC convierte en requisitos** porque la
> bandeja se apoya en ellos. Es el mismo procedimiento que atrapó los errores de los RFC 007, 008,
> 010 y 015.

---

## 0. Contraste contra el código real (2026-09-10)

| Qué se verificó | Resultado |
| :--- | :--- |
| `subscriptions` en la base real | `amount` en `bigint`, `currency` `varchar(10)` default `ARS`, `categoryId` con FK a `categories` (`onDelete: set null`) e índice. **El esquema ya está al día**: no hay que migrarlo, sólo agregarle el puntero |
| Las 8 suscripciones sembradas | Todas `active`, todas con `categoryId`, todas con `startDate` **2026-06-05** |
| `createLedgerTransaction` | `accountingService.ts:29`. Exige `organizationId` explícito, acepta `categoryId`, `description`, `merchantName`, `merchantDomain`, `occurredAt` y `entries`; valida Debe = Haber **por divisa dentro** de la transacción ACID |
| `idempotencyKeys` | Existe (`accounting/schema.db.ts:120`), con `key` como clave primaria |
| Resolución categoría padre → hoja | Duplicada literal en `transactionsActions.ts` (~150 gasto, ~188 ingreso). **Requisito previo**, ver §6 |
| `addInterval` | `subscriptions/utils/calculations.ts:55`. **Roto**: usa `setMonth` y desborda. **Requisito previo**, ver §6 |
| `calcularCicloDeTarjeta` | `cards/services/cardCycleService.ts:27` **recibe** `zonaHoraria` como parámetro en vez de buscarla. Es el patrón a copiar |
| `profiles.timezone` | `varchar(100)`, hoy `America/Argentina/Buenos_Aires`, en IANA válido desde la migración `0021` |
| Notificaciones | `DEMO_NOTIFICATIONS` en memoria (`NotificationsContext.tsx:26`). **No es un sistema real**: la bandeja no puede colgarse de ahí |

---

## 1. Contexto y objetivos

Una transacción **propuesta** es un asiento que existe sin que una persona lo haya afirmado. El
diseño identificó tres orígenes —lo recurrente que el sistema proyecta, lo que entra de afuera (IA,
API) y lo que registra un tercero (RFC 003)— y decidió **bandejas separadas**, porque preguntan
cosas distintas.

**Este RFC cubre únicamente el origen recurrente.** Los otros dos no tienen productor todavía: no
hay ingesta de comprobantes ni integración bancaria, y el RFC 003 no está implementado. Escribir hoy
el modelo de los tres sería diseñar contra necesidades que nadie puede verificar.

### Objetivos

1.  Que una suscripción activa **pregunte** —una vez por período— si el cargo llegó, por cuánto, y si sigue vigente.
2.  Que confirmar produzca un **asiento real** en el libro mayor, imputado a la categoría de la suscripción.
3.  Que el sistema distinga *«ese período ya lo resolviste»* de *«ese período nunca lo abrí»*, sin acumular historial.
4.  Que nada de esto necesite un proceso en segundo plano, **porque los crons son Fase 3 y no existen**.

### No objetivos

*   Las bandejas de origen externo y de terceros (decisiones 7 y 8 del diseño).
*   La evidencia adjunta al asiento — es lo que el propio diseño dejó abierto.
*   Proyectar períodos futuros. Lo prohíbe la regla: *se registra lo que ocurrió o lo que está ciertamente comprometido; no se registra lo que se supone que va a pasar.*

---

## 2. El modelo: un puntero, sin tabla de pendientes

**No se crea ninguna tabla.** Los pendientes se **derivan** de la suscripción y de un único campo
nuevo.

```typescript
// src/features/subscriptions/schema.db.ts — columna nueva
resolvedThrough: date( "resolved_through" ) ,   // anulable
```

**Semántica:** *toda ocurrencia con fecha de cobro menor o igual a `resolvedThrough` ya está
resuelta.* `null` significa que la suscripción nunca resolvió nada.

### Por qué un puntero y no una tabla

*   **Es lo que el diseño ya decidió.** La decisión 2 dice que la bandeja contiene sólo lo no
    resuelto y que **al resolver la pendiente desaparece**, sin historial: *el asiento es el
    registro*. Una tabla de pendientes materializada guardaría filas que hay que borrar, y el
    diseño rechazó explícitamente una propuesta previa que duplicaba el dato.
*   **La decisión 5 pide literalmente «un solo campo»**, y describe el puntero como *«leído hasta
    acá»*: no crece.
*   **Resuelve la falta de cron.** Un pendiente materializado necesita quién lo cree; uno derivado
    aparece solo al leer. Ésta es la razón por la que este RFC no depende de la Fase 3.
*   La bandeja de origen externo **sí** va a necesitar tabla (guarda datos crudos, evidencia e
    identificador externo, decisión 8). No es contradicción: son bandejas separadas por diseño.

### Tipo `date` y no `varchar(7)`

Un `YYYY-MM` sólo sirve para frecuencias mensuales o mayores y deja afuera `weekly`, que la tabla ya
soporta. La fecha de cobro de la última ocurrencia resuelta sirve para las cinco frecuencias, y se
avanza con la misma función que calcula el próximo cobro.

> [!WARNING]
> **Sería el primer `date` del repositorio.** Verificado: ningún `schema.db.ts` usa hoy ese tipo de
> drizzle —todas las fechas son `timestamp` con zona—, así que el import hay que agregarlo y no hay
> precedente del que copiar.
>
> **Se usa en su modo por defecto, que devuelve `string` (`YYYY-MM-DD`), no `Date`.** Es deliberado:
> el puntero es una **fecha civil sin hora**. Declararlo `{ mode: "date" }` haría que Postgres y
> drizzle le inventen una medianoche, y una medianoche siempre pertenece a alguna zona: la misma
> trampa que el repositorio ya pagó en el ciclo de tarjetas. Comparar fechas civiles como texto en
> formato ISO es exacto y ordena bien; convertirlas a `Date` para compararlas, no.



---

## 3. Qué se propone, y cuándo

### 3.1 La serie de ocurrencias

Las fechas de cobro de una suscripción son `startDate`, y a partir de ahí `addInterval` aplicado
sucesivamente. **Esa función hoy está rota** (§6) y es la que sostiene todo este RFC.

**La serie ancla en el día nominal de `startDate` y no itera.** Una suscripción que arranca el 31 de
enero cobra el 28 en febrero y **vuelve al 31 en marzo**. Es la regla que ya aplica el ciclo de
tarjetas, y la razón por la que el §6.1 no admite un parche que sólo recorte: recortar e iterar
degrada la serie mes a mes hasta clavarla en el día 28.

**`nextPaymentDate` deja de ser un dato independiente y pasa a derivarse:** es *la primera ocurrencia
posterior a `resolvedThrough`*, y se recalcula cada vez que el puntero avanza.

*Por qué:* hoy hay dos fuentes de verdad para la misma pregunta —la columna, que sólo se escribe al
crear, y la serie, que se puede derivar— y **la columna ya miente**: las 8 suscripciones sembradas
tienen `next_payment_date` en **2026-10-05**, incluida NordVPN, que es `yearly` y arrancó en junio.
Su próximo cobro real es junio de 2027. Con dos fuentes, la bandeja podría preguntar por un período
y la tarjeta mostrar otro. La serie manda; la columna la sigue.

### 3.2 La ventana de apertura

La decisión 3 fija que el período se abre **al empezar el período**, no al vencer la fecha: el 1° de
septiembre ya se pregunta por el cargo del 5, sin esperar al 5.

**Regla:** una ocurrencia con fecha de cobro `F` se propone desde:

| Frecuencia | Se abre el |
| :--- | :--- |
| `monthly`, `quarterly`, `yearly`, `custom` | primer día del **mes calendario** de `F` |
| `weekly` | el **mismo día** `F` |

*Fundamento de la asimetría:* adelantar la pregunta tiene sentido cuando el período es largo y el
día exacto del cargo es incierto. Una semana es corta: preguntar el lunes por el cargo del jueves
sólo agrega ruido.

**Todo se evalúa en la zona horaria del perfil**, porque de ella depende a qué día pertenece «hoy».
El servicio la **recibe como parámetro**, igual que `calcularCicloDeTarjeta`; no la busca por su
cuenta.

### 3.3 Qué queda pendiente

Las ocurrencias posteriores a `resolvedThrough` cuya ventana ya abrió. Si hay varias sin resolver,
**se muestran todas** — la decisión 6 dice que *«después lo veo»* no necesita acción propia: el
pendiente sigue ahí y se le suma el del período siguiente.

### 3.4 El arranque del puntero — la regla que evita 32 pendientes inventados

Al agregar la columna, **`resolvedThrough` se inicializa en la última ocurrencia anterior al período
en curso**, no en `null` y no en `startDate`.

*Por qué:* las 8 suscripciones sembradas arrancan el **2026-06-05**. Con `startDate` como origen, la
primera vez que alguien abra la bandeja aparecerían junio, julio, agosto y septiembre de cada una:
**32 pendientes por hechos que nadie registró y que el sistema no tiene forma de conocer**. Proponer
retroactivo es inventar historia, y contradice el objetivo 3 del diseño.

La misma regla vale para el alta: **una suscripción nueva nace con el puntero en el período
anterior**, así su primer pendiente es el período en curso y no el histórico desde `startDate`.

---

## 4. Resolver un pendiente

Las cuatro acciones son las de la decisión 6, más su efecto exacto:

| Acción | Asiento | `resolvedThrough` | `subscriptions` |
| :--- | :--- | :--- | :--- |
| **Confirmar** | Sí, por `amount` | avanza a esa ocurrencia | sin cambios |
| **Confirmar con otro monto** | Sí, por el monto real | avanza a esa ocurrencia | `amount` se actualiza **sólo si** el usuario dice que cambió el precio |
| **No me lo cobraron** | No | avanza a esa ocurrencia | sin cambios |
| **Dar de baja** | No | avanza a esa ocurrencia | `status` pasa a `cancelled` |

### 4.1 El asiento

*   **Debe:** la cuenta de la categoría de la suscripción, en la divisa de la cuenta de pago.
*   **Haber:** la cuenta de pago.
*   `occurredAt` es **la fecha de cobro de la ocurrencia**, no el día en que se confirma. Un cargo de septiembre confirmado en octubre pertenece a septiembre, o el cierre mensual miente.
*   `categoryId` es el de la suscripción, **resuelto a hoja** por el servicio del §6.
*   `description` es el nombre de la suscripción; `merchantName` y `merchantDomain` se completan si la suscripción los tiene.

### 4.2 La cuenta de pago

`subscriptions.accountId` ya existe y es anulable. Si está vacío, **se pregunta al confirmar** y la
elección se guarda para la próxima. Es el mismo criterio del RFC 004 §5B.

### 4.3 Divisa

`subscriptions.currency` y la divisa de la cuenta de pago **deben coincidir**. Si no coinciden, la
acción falla con un mensaje explícito y no se emite nada.

*Fundamento:* el motor valida Debe = Haber **por divisa**, dentro de la transacción. Un cargo en
dólares contra una caja en pesos no es un asiento incompleto: es dos asientos y una cotización, que
es el terreno del RFC 015 y **no está construido**. Fallar es honesto; adivinar la cotización no.

### 4.4 Atomicidad e idempotencia

**El asiento y el avance del puntero se escriben en la misma transacción ACID.** De ahí sale la
garantía: si el puntero avanzó, el asiento existe; si algo falla, no avanzó nada y el pendiente
sigue ahí.

Además, la acción **rechaza resolver una ocurrencia que no sea la más antigua pendiente**. Dos
pestañas abiertas confirmando el mismo período: la primera avanza el puntero, la segunda encuentra
que esa ocurrencia ya quedó por detrás y falla sin escribir. No hace falta `idempotencyKeys` para
esto — el puntero **es** la guarda.

---

## 5. Interfaz

Alcance mínimo y deliberado: **la bandeja vive en `/subscriptions`**, arriba del treemap, y no se
crea ruta nueva.

*   Si no hay pendientes, no se muestra nada — no un cartel de vacío.
*   Cada pendiente muestra marca, período, monto esperado y las cuatro acciones.
*   *Confirmar con otro monto* abre un campo y, al aceptar, pregunta **«¿fue sólo este mes o cambió el precio?»**. Esa segunda pregunta es la que decide si se toca `subscriptions.amount`.
*   *Dar de baja* pide confirmación, porque termina la serie.

**No entra en este RFC:** un aviso en la barra de navegación. Las notificaciones son demo en memoria
y cablearlas de verdad es otra ronda.

---

## 6. Requisitos previos — dos defectos que dejan de ser deuda

Los dos están anotados en [`TECHNICAL_DEBT.md`](../TECHNICAL_DEBT.md) y este RFC **no se puede
implementar correctamente sin ellos**.

### 6.1 `addInterval` deriva en fin de mes

`subscriptions/utils/calculations.ts:55` usa `setMonth`, que desborda y JavaScript normaliza hacia
adelante. Verificado ejecutándolo: una suscripción que cobra el **31 de enero** salta al **3 de
marzo** —saltea febrero entero— y queda clavada en el día 3 para siempre.

Toda la serie de ocurrencias del §3.1 sale de esta función. Con el defecto, la bandeja pregunta por
períodos que no existen y saltea los que sí.

**El patrón correcto ya está en el repositorio:** `cards/utils/ciclo.ts:48` recorta el día nominal al
último real del mes (`Math.min(day, maxDias)`) y **ancla en el día nominal en vez de iterar**, así
que una serie que cobra el 31 vuelve al 31 en marzo después de haber cobrado el 28 en febrero.

### 6.2 La resolución categoría padre → hoja, duplicada

`transactionsActions.ts` repite el mismo bloque literal en la rama `expense` (~150) y en la de
`income` (~188): buscar la categoría, contar hijas reales, y elegir entre `findOrCreateGeneralLeaf`
y la categoría misma.

Confirmar un pendiente necesita exactamente esa resolución. **Sin extraerla, sería el tercer
duplicado**, y la migración `0024` ya dejó suscripciones cuyo `categoryId` apunta al padre `5.1.09`
—que no es hoja— confiando en que ese resolutor exista del lado del consumidor.

Va a `categoryRepository` como una sola operación, y `transactionsActions` pasa a llamarla.

---

## 7. Enmienda al RFC 004

El [RFC 004](004-subscriptions-management.md) está `APPROVED` desde el 2026-06-23, y dos de sus
secciones quedan **revocadas** por este texto:

*   **§4 — «La transacción se crea con una etiqueta especial `needs_review: true»`.** Revocada. Lo
    propuesto **no entra al libro mayor**. El fundamento es la invariante que el propio esquema
    declara en las columnas de reversión de `ledger_transactions`: *«el libro diario es inmutable»*.
    Un libro inmutable es un libro de hechos.
*   **§3 — el worker nocturno que procesa los cobros vencidos.** Revocada en su forma: no hay proceso
    en segundo plano, los pendientes se derivan al leer. Cuando los crons de la Fase 3 existan,
    podrán **avisar** que hay pendientes, pero no resolverlos solos.

Lo demás del RFC 004 sigue vigente, incluida su adenda de julio de 2026.

---

## 8. Lo que este RFC deja abierto

*   **La evidencia** — el comprobante escaneado vinculado al asiento. Es lo que el propio diseño dejó abierto y pertenece a la bandeja de origen externo.
*   **El aviso de pendientes** fuera de `/subscriptions`, que necesita notificaciones reales.
*   **Suscripciones en otra divisa**: hoy fallan al confirmar (§4.3). Se resuelven cuando exista la consolidación del RFC 015.
*   **`status` `paused`**: la adenda del RFC 004 lo dejó sin gestión de UI. Una suscripción pausada no propone nada; pausarla y reanudarla sigue sin pantalla.
