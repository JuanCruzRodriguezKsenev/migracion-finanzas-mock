# Rediseño de la clasificación y de las transacciones propuestas

*   **Estado:** 🟡 **En discusión.** Dos temas cerrados, uno sin empezar.
*   **Iniciado:** 2026-09-09
*   **Qué es esto:** el registro de una sesión de diseño que todavía no es código ni RFC. Cuando los
    tres temas estén cerrados, esto se parte en propuestas formales bajo `docs/proposals/` y recién
    ahí habilita implementación, según la regla del repositorio.
*   **Para retomar sin contexto:** leé §1 (por qué existe esto), después §2 y §3 (lo decidido) y
    arrancá por §4, que es el tema que falta.

---

## 1. Por qué existe este documento

La ronda iba a ser *"suscripciones al libro mayor"* (RFC 004): el módulo persiste en Postgres y no
emite un solo asiento contable. Al investigar el alcance aparecieron tres decisiones de arquitectura
que ese trabajo necesitaba y que nadie había tomado, ninguna con RFC:

1. **El estado de una transacción propuesta** por el sistema y no confirmada por una persona.
2. **La relación entre categoría y cuenta contable**, hoy inexistente.
3. **Instrumentos contra cuentas**: qué es una tarjeta, qué es un préstamo, y qué se muestra
   en `/accounts`.

Las tres tocan el núcleo contable y bloquean lo que viene: suscripciones necesita la 1 y la 2; las
cuotas del RFC 008 necesitan la 1 y la 3; los presupuestos necesitan la 2.

### El hallazgo que reordenó las prioridades

El tema 2 entró como secundario y terminó siendo el central. **La app hoy no puede responder "de
dónde viene cada cosa"**, que es su razón de ser declarada, y falla por dos vías simultáneas:

*   **Las estadísticas no miran las categorías.** `calcularIngresosDelMes` y `calcularGastosDelMes`
    (`src/features/accounting/utils/dashboardMetrics.ts`) filtran por el **tipo de cuenta contable**
    (`revenue` / `expense`) y suman asientos. La categoría no participa del cálculo.
*   **Nadie agrupa por categoría en ningún lado.** Búsqueda en todo `src/`: `categoryId` se guarda,
    se pasa, se actualiza y se copia al reversar. **Cero agrupaciones.** No hay un desglose, ni un
    gráfico, ni un total por categoría.

Y las cuentas contables —las que sí alimentan las estadísticas— reciben **todos** los gastos en la
misma cuenta, por el defecto descrito en §5.

**El proyecto tiene tres registros de categoría y ninguno cumple su función:**

| Dónde | Qué pasa |
| :--- | :--- |
| `ledger_transactions.categoryId` | Se guarda. Nadie agrupa por él |
| `subscriptions.category` | Se elige en el alta. No alimenta ninguna vista, ni siquiera el treemap |
| La tabla `categories` | Existe con árbol. **Ningún Server Action la puede crear**: el usuario no puede armar las suyas |

Lectura del usuario, textual en sustancia: *que las categorías no fueran parte esencial del proyecto
denota una mala lectura de los otros dos proyectos de los que éste deriva, porque en la UI del
dashboard, en estadísticas, lo principal es categorizar, filtrar, mostrar, presupuestar.* La
verificación le da la razón: **FinanzasMock tiene 40 archivos que trabajan con categorías**, con
componentes dedicados (`CategorySpending.tsx`, `ExpensesDonut.tsx`, `BudgetSummary.tsx`,
`ReportCharts.tsx`, la feature `budgets/` entera). Se portó el campo sin portar para qué servía.

---

## 2. Tema cerrado — Transacciones propuestas

### El concepto

Una transacción **propuesta** es un asiento que existe sin que una persona lo haya afirmado. Las
fuentes son varias y ninguna es exclusiva de suscripciones:

*   una IA que leyó un comprobante,
*   una API externa que empujó el movimiento,
*   un contacto que registró una transacción hacia el usuario (RFC 003),
*   **el sistema proyectando lo recurrente**: la suscripción que sigue devengando o el débito
    automático que se sigue cobrando, hasta que la persona confirme que sigue vigente, cambió de
    monto o se dio de baja.

### Decisiones

1.  **Lo propuesto vive fuera del libro mayor.** El libro guarda sólo hechos ocurridos.
    *Fundamento:* el esquema ya declara la invariante, en el comentario de las columnas de reversión
    de `ledger_transactions`: *"El libro diario es inmutable: una transacción equivocada no se borra,
    se contra-asienta."* Un libro inmutable es un libro de hechos; una propuesta es una hipótesis.
    Mezclarlas obligaría a cada lectura futura a recordar preguntar si eso ocurrió de verdad, y basta
    que una se olvide para que un número mienta.
    *Costo aceptado:* la interfaz tiene que unir dos lugares para contar la historia completa.

2.  **La bandeja contiene sólo lo no resuelto.** Al confirmar nace el asiento y **la pendiente
    desaparece**. No se guarda historial de pendientes resueltas: el asiento **es** el registro, y se
    encuentra filtrando el libro. Decisión del usuario, contra una propuesta previa que duplicaba el
    dato en una tabla de decisiones.

3.  **No se registran supuestos futuros.** Se abre únicamente el período en curso, **al empezar el
    período** — el 1° de septiembre ya se pregunta si este mes viene el cargo, sin esperar a que pase
    la fecha de cobro. Nunca octubre ni noviembre.
    *Regla general que fijó el usuario:* **se registra lo que ocurrió o lo que está ciertamente
    comprometido; no se registra lo que se supone que va a pasar.** Las estimaciones (cuánto voy a
    gastar este año) son cálculo efímero, sin filas. De acá salió la idea de la página de
    proyecciones, aparcada.

4.  **Supuesto y compromiso son cosas distintas, de primera clase.** Doce cuotas de una compra son
    **deuda cierta**: existen desde que se contrajo la obligación aunque no hayan vencido, y se
    cargan enteras. Netflix del mes que viene es un **supuesto** y se resuelve de a uno.
    *Consecuencia:* esto es lo que hoy le falta a la tarjeta, cuyo disponible no descuenta las cuotas
    futuras (deuda ya registrada en `TECHNICAL_DEBT.md`).

5.  **Cada suscripción recuerda hasta qué período preguntó**, en un solo campo.
    *Por qué hace falta:* al resolverse, la pendiente se borra y —si se descartó— no queda asiento.
    Sin esa marca, el sistema no puede distinguir *"agosto ya lo resolviste"* de *"agosto nunca lo
    abrí"*: las dos situaciones se ven igual, y volvería a proponerlo para siempre. Es un puntero
    tipo "leído hasta acá", no un historial: no crece.

6.  **Menú de resolución de un pendiente recurrente:**

    | Acción | Este período | La serie |
    | :--- | :--- | :--- |
    | Confirmar | Asiento por el monto esperado | Sigue igual |
    | Confirmar con otro monto | Asiento por el monto real | Pregunta si fue sólo este mes o cambió el precio |
    | No me lo cobraron | Sin asiento | Sigue igual |
    | Dar de baja | Sin asiento | Termina; la suscripción pasa a cancelada |

    *"Después lo veo"* no necesita acción propia: un pendiente no resuelto sigue ahí y se le suma el
    del período siguiente.

7.  **Bandejas separadas por origen**, porque preguntan cosas distintas y llegan con distinto nivel
    de conocimiento. **Las tres terminan en categorizar al confirmar**; lo que cambia es si la
    categoría ya venía puesta o la pone el usuario ahí.

    | Origen | Categoría | Qué te pregunta |
    | :--- | :--- | :--- |
    | Recurrencia | Ya puesta desde el alta; recategorizar es corregir un error viejo | ¿Lo pagaste? ¿Cuánto? ¿Sigue? |
    | Lo que entra de afuera (IA, API, lo que sea) | La pone el usuario: es el trabajo principal | ¿Qué es esto? ¿Está bien leído? |
    | Terceros / eventos | La pone el usuario al confirmar | ¿Te llegó? |

8.  **Lo que entra de afuera** guarda: de dónde vino, los datos crudos sin tocar, la evidencia (la
    foto del comprobante o el payload) y **el identificador externo**. Sus acciones son *aceptar ·
    corregir y aceptar · rechazar · ya lo tengo registrado* — esta última no tiene equivalente en
    recurrencias y evita el gasto duplicado cuando el banco manda algo ya cargado a mano.
    *El identificador externo cumple acá el papel del puntero:* si rechazás un movimiento y la fila
    se borra, la API te lo manda de nuevo mañana. Recordar los ids rechazados es lo que lo impide.

9.  **El RFC 003 necesita enmienda.** Su flujo (`pending → sent → confirmed` sobre `event_debts`)
    **confirma sin categorizar**. Al enmendarlo, dejar explícito que **cada parte categoriza en su
    propio libro**: Carlos te devuelve lo de la cena, en tu libro es un recupero y en el de él una
    salida. Se comparte el hecho, no la categorización.

### Lo que queda abierto en este tema

*   Qué pasa con la **evidencia** cuando aceptás: el comprobante escaneado debería quedar vinculado
    al asiento, o se pierde la prueba justo cuando la transacción pasa a ser real.

---

## 3. Tema cerrado — Categorías y cuentas contables

### La duplicación que lo motivó

Las dos tablas contienen hoy **el mismo concepto escrito dos veces**, con nombres distintos y sin
ningún vínculo. Filas reales de la base local:

```
CATEGORÍAS (árbol, parentId)         PLAN DE CUENTAS (accounts)
────────────────────────────         ──────────────────────────────
Gastos                               5   (expense)
 ├─ Supermercado y Alimentos    ↔    5.1.01.01  Gastos de Supermercado
 ├─ Servicios del Hogar         ↔    5.1.01.02  Gastos de Servicios
 └─ Alquiler y Expensas         ↔    5.1.01.03  Gastos de Alquiler

Ingresos                             4   (revenue)
 └─ Sueldos y Honorarios        ↔    4.1.01.01  Ingresos por Sueldos
```

Correspondencia uno a uno, exacta. Y las dos son árboles: el plan de cuentas por la codificación
(`5` → `5.1` → `5.1.01` → `5.1.01.01`), las categorías por `parentId`.

**Ninguno de los tres repositorios había resuelto esto**, así que no hay implementación de
referencia que copiar:

| Repo | Cómo guarda la categoría | Jerarquía | Ligada a contabilidad |
| :--- | :--- | :--- | :--- |
| FinanzasMock | Texto suelto en la fila (`category: text`) | No | No tiene contabilidad |
| FinanceApp-WSL | Dentro de un JSON `metadata`, fallback `"Otros"` | No | No — tabla plana |
| **Este repo** | Tabla propia con `parentId` | **Sí** | **No** |

Los presupuestos del mock ni siquiera apuntan a una categoría: `budgets` guarda un `label` de texto.

### Decisiones

1.  **Categoría y cuenta contable son la misma cosa.** Un solo árbol. La categoría es la cara
    amigable de la cuenta: el usuario ve *Supermercado*, la contabilidad ve `5.1.01.01`, y el usuario
    nunca ve el número. Cualquier categoría que cree nace con su cuenta, así que **sus estadísticas y
    su contabilidad no pueden discrepar**.

2.  **Sólo los gastos e ingresos son categorías.** Las raíces `Gastos` e `Ingresos` son los **tipos
    contables**, no categorías editables. La Caja de Ahorro, la cuenta de la tarjeta y el Patrimonio
    Neto son cuentas pero no categorías: contestan *de dónde salió la plata*, no *qué fue ese gasto*.
    El mock ya separaba esas dos preguntas, con `category` y `paymentMethod` como campos distintos.

3.  **Dos niveles:** categoría y subcategoría, colgando del tipo. Cubre los casos reales, mantiene un
    solo nivel de sangría en cada selector, y da una respuesta obvia a *por qué nivel agrupa un
    reporte*: por el de arriba.

4.  **Los padres agrupan y no reciben movimientos; sólo las hojas reciben.** Cuando el usuario elige
    *Supermercado* sin detallar, se imputa a una hoja `General` que el sistema crea sola la primera
    vez. Al crear la primera subcategoría, **lo ya imputado al padre se mueve a esa hoja**.
    *Por qué:* hoy `Supermercado` ya tiene $63.666 imputados. Sin esta regla quedaría un padre con
    saldo propio **más** hijas, y cada reporte tendría que acordarse de sumar las dos cosas — el tipo
    de detalle que se olvida en la consulta número once y produce doble conteo.

5.  **No se borra, se archiva.** Deja de ofrecerse y desaparece de los menús; los movimientos viejos
    conservan su categoría y los reportes históricos siguen siendo correctos. Se puede desarchivar.
    *Fundamento:* `ledger_entries` protege las cuentas con `onDelete: "restrict"` justamente para que
    no se borre una cuenta con movimientos. Al unificar, esa protección pasa a valer para las
    categorías, y archivar es lo único compatible con un libro inmutable.

6.  **Una categoría agrupa una cuenta contable por divisa**, con el mismo patrón que `cards` →
    `card_accounts`, ya construido y probado en este repo. El usuario ve *Supermercado*; por debajo
    hay `5.1.01.01-ARS` y `5.1.01.01-USD`, que nacen solas la primera vez que se gasta en esa moneda.
    *Por qué hace falta:* una cuenta contable tiene una sola divisa y el motor valida Debe = Haber
    por divisa. Sin esto, el usuario vería *Supermercado* y *Supermercado (USD)* como dos categorías,
    y el donut partiría en dos el mismo concepto — que es literalmente lo que pasa hoy con
    `Gastos Generales (USD)`.
    *Consecuencia:* **el total por categoría de quien gasta en varias divisas necesita la conversión
    a moneda base**, que es el §4 del RFC 015 y está bloqueado hasta la Fase 4. Con una sola divisa
    funciona completo desde el día uno.

7.  **Las suscripciones usan el árbol único.** El campo `subscriptions.category` desaparece y sus
    siete valores (`design`, `productivity`, `entertainment`, `fitness`, `security`, `storage`,
    `other`) pasan a ser categorías del catálogo inicial bajo Gastos. Un solo vocabulario para todo
    el gasto.

### Lo que queda abierto en este tema

*   **Qué categorías trae un usuario nuevo.** Hoy el seed trae cuatro; con las de suscripciones
    quedarían once.
*   **Cómo se migra lo existente:** fusionar las cuatro categorías con sus cuatro cuentas gemelas y
    reapuntar las transacciones que hoy apuntan a ambas por separado.

---

## 4. Tema sin empezar — Instrumentos contra cuentas

**Acá se retoma mañana.** Lo que está planteado y sin decidir:

El usuario objetó que tarjetas y deudas estén modeladas como cuentas: *que pertenezcan a una entidad
no quiere decir que sean una cuenta; son un sistema independiente, sin saldo inicial, con una
complejidad enorme — débitos automáticos, gastos a pagar que quedan en la misma — y ameritan una
sección propia.*

**Verificado en la base y el código, para no discutir de memoria:**

*   La cuenta `2.1.01.01 Tarjeta Visa Galicia` (`liability`, `-2.500.000`) **aparece en `/accounts`
    mezclada con la Caja de Ahorro**, porque `AccountsContainer.tsx:63` arma `walletAccounts` con
    `asset` y `liability` juntos. Ése es el síntoma visible.
*   `createCardAction` emite un asiento *"Apertura deuda inicial"* contra `3.1.01.01 Patrimonio Neto`
    cuando se carga una tarjeta con deuda. **Una tarjeta no nace con deuda**: la deuda nace de
    consumos. Ese asiento inventa un hecho económico que no ocurrió, contra la cuenta más sensible
    del plan.
*   El RFC 008 (deudas y préstamos) **no está implementado**: se está a tiempo de no repetirlo, y es
    donde más importa, porque un préstamo tiene capital, interés, cronograma y cuotas devengadas, y
    nada de eso entra en un saldo.

**Postura de partida a discutir**, no decidida: la deuda de una tarjeta **sí** es un pasivo y debe
estar en el libro, o el patrimonio neto miente; y el RFC 007 tal como se implementó **ya separa** el
instrumento de su reflejo contable (`cards` no guarda dinero, `card_accounts` lo vincula a cuentas de
pasivo por divisa). Lo que estaría mal no es que exista la cuenta, sino tres cosas: que se presente
como una cuenta operable del usuario, el asiento de apertura contra Patrimonio, y que el instrumento
se agote en su reflejo contable cuando tiene ciclo, límite, cuotas comprometidas y débitos adheridos.

---

## 5. Defectos verificados durante la discusión

Todos comprobados contra el código o la base, no inferidos. Los que son defectos vivos quedaron
anotados en [`TECHNICAL_DEBT.md`](../TECHNICAL_DEBT.md).

1.  **La categoría elegida por el usuario no tiene ningún efecto contable.** Al registrar un gasto,
    `createTransactionFromFormAction` (`transactionsActions.ts:150`) resuelve la cuenta con
    `obtenerCuentaPorMoneda({ codigoBase: "5.1.01.99", nombreBase: "Gastos Generales" })`, **sin mirar
    la categoría elegida**, que sólo se guarda como etiqueta en la cabecera.
2.  **`obtenerCuentaPorMoneda` descarta el `codigoBase` que recibe.** Busca la cuenta existente por
    `(type, currency)` únicamente (`transactionsActions.ts:80`), así que devuelve **la primera cuenta
    de gasto que exista en esa moneda**. Con el plan actual eso significa que **todos los gastos del
    formulario se imputan a `5.1.01.01 Gastos de Supermercado`**.
3.  **`addInterval` deriva en fin de mes** (`subscriptions/utils/calculations.ts:55`). Usa `setMonth`,
    que desborda y JavaScript normaliza hacia adelante. Comprobado ejecutándolo: una suscripción que
    cobra el **31 de enero** salta a **3 de marzo** —se saltea febrero entero— y queda clavada en el
    día 3 para siempre; la del 31 de marzo pasa al 1 de mayo y queda en día 1.
    **El patrón correcto ya existe en este repo:** `cards/utils/ciclo.ts:48` recorta el día nominal al
    último real del mes con `Math.min(day, maxDias)` y ancla en vez de iterar, así que una tarjeta que
    cierra el 31 cierra el 28 en febrero y **vuelve al 31 en marzo**.
4.  **`getNextCode` no sabe anidar y topea en 99** (`accounting/utils/accountCodes.ts`). Genera
    códigos planos —prefijo fijo más correlativo de dos dígitos— así que no puede crear una
    subcategoría, y al llegar a 100 el `padStart(2, "0")` rompe el formato.
5.  **`accounts` no tiene jerarquía real.** El árbol existe sólo como convención dentro del texto del
    código; no hay `parentId` ni relación.
6.  **El usuario no puede crear categorías.** `categoryRepository.create` existe y **ningún Server
    Action lo expone**; sólo hay `getCategoriesAction` para leer. Las seis categorías actuales vienen
    del seed.
7.  **`1.1.01.02 Efectivo en Billetera` tiene balance negativo** (`-1.032.300`). Un activo de efectivo
    en negativo es imposible: no se puede tener menos que cero de plata física. Dato del seed o falta
    de validación; hay que mirarlo.

## 6. Datos del motor que condicionaron las decisiones

*   **El saldo está materializado**, no se calcula sumando asientos: `accounts.balance` lo actualiza
    `accountingService.ts:129` dentro de la transacción ACID, con bloqueo de fila. Todo lo que entra
    al libro mueve el saldo, por diseño.
*   **Todo el acceso al libro mayor está encapsulado en `ledgerRepository.ts`** (50 referencias allí,
    6 en `seed.ts`, 4 en `types.ts`): **cero consultas sueltas** en acciones o componentes. Sus
    métodos de lectura son siete: `findById`, `findByIdForUpdate`, `findEntriesByTransactionId`,
    `findEntriesByTransactionIds`, `findTransactionsWithEntries`, `findTransactionsPage` y
    `sumEntriesByAccountInRange`.
*   **`ledger_transactions` no tiene ninguna columna de estado ni de procedencia.** El §4 del RFC 004
    pide marcar el asiento con `needs_review` y esa columna no existe.
*   **`updateSubscriptionSchema = createSubscriptionSchema.partial()`**: hoy todo es editable en una
    suscripción, `frequency`, `intervalCount` y `startDate` incluidos.

---

## 7. Qué produce esto cuando se cierre

Propuestas a escribir bajo `docs/proposals/`, todas contrastadas contra el esquema real antes de
aprobarse — el procedimiento que evitó implementar los RFC 007 y 015 contra tablas que no existen:

| Propuesta | Qué cubre |
| :--- | :--- |
| **Transacciones propuestas** | §2 completo. Nueva |
| **Clasificación unificada** | §3 completo: categoría = cuenta. Nueva |
| **Instrumentos financieros** | §4, cuando se cierre. Nueva o enmienda al RFC 007 — a decidir |
| **Enmienda al RFC 003** | Categorizar al confirmar; cada parte en su propio libro |
| **Enmienda al RFC 004** | El §4 pide `needs_review` en el libro; queda reemplazado por §2 |
