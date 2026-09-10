# Rediseño de la clasificación y de las transacciones propuestas

*   **Estado:** 🟢 **Los tres temas cerrados.** Quedan bordes abiertos anotados dentro de cada uno.
*   **Iniciado:** 2026-09-09 · **Cerrado:** 2026-09-09
*   **Qué es esto:** el registro de una sesión de diseño que todavía no es código ni RFC. Con los
    tres temas cerrados, el paso siguiente es partirlo en las propuestas formales del §7 bajo
    `docs/proposals/`; recién ahí habilita implementación, según la regla del repositorio.
*   **Para retomar sin contexto:** leé §1 (por qué existe esto) y después §2, §3 y §4, que son lo
    decidido. El §5 son los defectos vivos que la discusión destapó.

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

## 4. Tema cerrado — Instrumentos contra cuentas

### De dónde salió

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

### Lo que se verificó antes de decidir

**Ninguno de los dos proyectos de referencia agrupa por tipo contable.** Los dos cortan por
**instrumento**, y este repositorio es el único que corta por el plan de cuentas — que es exactamente
lo que produjo la mezcla:

| | FinanzasMock | FinanceApp-WSL | Este repo |
| :--- | :--- | :--- | :--- |
| Corte de las páginas | por instrumento | por instrumento | **por tipo contable** |
| Modelo de datos | tabla por instrumento | tabla por instrumento | cuenta del plan |
| Partida doble | no tiene | no tiene | **sí** |

*   **FinanzasMock** ya tiene en su menú lateral `Cuentas`, `Tarjetas`, `Deudas`, `Patrimonio`,
    `Inversiones` y `Reportes` como entradas **separadas**. Comprobado levantándolo en local.
*   **FinanceApp-WSL** resuelve su dashboard con tres tarjetas cuyos nombres son la decisión entera:
    `NetWorthCard`, `LiquidityCard`, `DebtsCard`. Su esquema es una tabla por instrumento
    (`bank_accounts`, `digital_wallets`, `assets`, `liabilities`, `credit_cards`), más
    `net_worth_snapshots`.
*   Los dos podían darse ese lujo **porque no tienen libro mayor**. Nosotros lo tenemos, y el RFC 007
    ya encontró la salida: instrumento en su tabla, reflejo en el libro. Lo que faltaba era que la
    **navegación** siguiera al instrumento en vez de seguir al plan de cuentas.

### Decisiones

1.  **`/accounts` es el directorio por entidad, no el listado del plan de cuentas.** Se entra por
    quién emite —Galicia, Mercado Pago, Efectivo— y al abrir una entidad aparece **todo lo que se
    tiene con ella**: sus cuentas corrientes, sus tarjetas, sus préstamos.
    *Fundamento:* la pregunta que contesta esa página es *"¿qué tengo con este banco?"*, y hoy la
    contesta a medias porque agrupa por `type` contable en vez de agrupar por instrumento.

2.  **Cada familia de instrumento tiene además su página transversal propia:** `/cards` (ya existe),
    `/debts` y la de patrimonio. Un mismo instrumento aparece **dos veces, en dos ejes distintos** —
    por quién lo emite y por qué tipo de cosa es—, y eso no es duplicación: son dos preguntas
    reales, *"¿qué tengo con Galicia?"* contra *"¿cómo vienen mis tarjetas?"*.

3.  **La página de patrimonio cubre los activos no financieros:** propiedades, autos y demás. **Ya
    tiene RFC**: el **010 (`010-wealth-assets-management.md`), `APPROVED` desde el 2026-06-23**,
    cubre inmuebles y vehículos, historial de valuaciones en cualquier divisa, fotos, inquilinos
    vinculados a `contacts` y bitácora de incidencias con su costo. Está en la Fase 4 de la hoja de
    ruta. **No hay que escribirle propuesta nueva, hay que contrastarlo**: es de junio de 2026, con
    la misma trampa que el 008 y que el 015 — sus siete columnas monetarias son `integer` y el
    repositorio migró todo a `bigint` en el RFC 019.

4.  **El instrumento se presenta como instrumento, no como fila del plan.** Dentro de Galicia, la
    tarjeta se muestra como tarjeta —marca, últimos cuatro, ciclo— y no como `2.1.01.01` con saldo
    negativo al lado de la Caja de Ahorro. La cuenta contable **sigue existiendo por debajo**, sin
    cambios: el patrón `cards` → `card_accounts` del RFC 007 es el que se repite para lo que venga.

5.  **El Patrimonio Neto se va a la página de estadísticas.** Deja de ser la métrica hero de
    `/accounts`.
    *Fundamento:* si `/accounts` es el directorio de entidades, el patrimonio neto **ya no se puede
    calcular ahí** — necesita los autos y las propiedades, que viven en otra página. Y el cálculo que
    hay hoy está roto: ver el defecto 8 del §5.

### Lo que queda abierto en este tema

*   **El nombre de las rutas.** Por `ARCHITECTURE.md` §4 los segmentos van en inglés, así que serían
    `/debts` y `/wealth`; y la página de estadísticas todavía no tiene nombre elegido — el mock la
    llama `/reportes`, lo que daría `/reports`, pero se habló de ella como "stats".
*   **El asiento de apertura contra Patrimonio.** El planteo original de este §4 lo daba por defecto a
    corregir. Contra-argumento a resolver: es la técnica estándar de saldo inicial y es **idéntica**
    a la que usa `createAccountForEntityAction` para el saldo inicial de una caja de ahorro; si se
    saca de tarjetas hay que sacarlo de cuentas, y entonces ningún saldo de arranque puede entrar sin
    romper Debe = Haber. Lo que sí está mal es la **descripción** del asiento, que se lee como un
    hecho económico en vez de como una apertura.
*   **Qué pasa con la solapa "Plan contable"** de `/accounts` y con `CreateAccountForm`, que hoy
    ofrece los cinco tipos contables al usuario. El §3 se lleva ingresos y gastos al árbol de
    categorías; falta decidir si queda alguna vista del plan crudo y para quién.

---

## 4bis. Decisiones de interfaz (2026-09-09, después de ejecutar la primera tajada del RFC 022)

Tomadas una por una, con el estado del repositorio verificado antes de cada una.

1.  **La gestión del árbol de categorías vive en `/settings`, como pestaña.** No es una ruta propia:
    es ajuste de la aplicación, no operación diaria.
    *Verificado antes de decidir:* la navegación de este repositorio ya está desactualizada —
    `Navbar.tsx` lista dashboard, sandbox, transactions, accounts, subscriptions y contacts, y
    **`/cards` no figura** pese a existir desde el 2026-09-08. Sumar entradas al menú no era el
    camino.

2.  **No hay ruta `/profile`: el perfil es otra pestaña de `/settings`.** Enmienda al RFC 015, ya
    anotada en ese documento.
    *Fundamento:* el mock **duplica** la pantalla — `/perfil` y `/configuracion` muestran ambas
    *Información personal* y *Preferencias*, y las ocho pestañas de `/configuracion` son
    decorativas (`activeTab` no condiciona ningún render). Se unifica en vez de portar la
    duplicación.

3.  **`/settings` nace con una sola pestaña: Categorías.** De las ocho del mock, sólo cuatro tienen
    backend en este repositorio —Perfil, Preferencias, Categorías y Seguridad, esta última sobre el
    `userRepository.updatePasswordHash` que ya existe—; **Etiquetas no existe en ningún lado**
    (ni tabla, ni RFC, ni concepto) y Notificaciones **no persiste**: es contexto de UI en memoria.
    Las preferencias quedan para la pestaña siguiente, con su deuda de "sin consumidor de
    producción" todavía abierta.

4.  **El selector de categorías del formulario se agrupa por padre y permite crear al vuelo.**
    *Por qué es urgente:* `TransactionFormModal.tsx:277-286` dibuja un `<select>` plano con un
    `.map()` sobre todas las categorías. Con 6 funcionaba; **el catálogo del RFC 022 lo dejó en 67**,
    ordenadas alfabéticamente, sin jerarquía, con ingresos y gastos mezclados y con nombres
    repetidos —cada padre tiene su hoja `General`, y *Entretenimiento* existe dos veces—.
    **La rama del RFC 022 no tocó ese archivo**, porque el plan decía explícitamente que la UI de
    transacciones no cambiaba: es un defecto que el plan no nombró.
    Se resuelve con `<optgroup>` por padre, más un `+ Crear categoría` que llame a
    `createCategoryAction` sin salir del modal. **Crear al vuelo exige resolver padre y tipo**, así
    que no es un campo de texto suelto: es un mini-formulario dentro del modal.

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
8.  **El Patrimonio Neto de `/accounts` suma la deuda en vez de restarla.** El motor guarda los
    pasivos con **signo negativo**: `accountingService.ts:117` los trata con la misma regla que los
    activos —aumentan con el Debe, disminuyen con el Haber—, así que un consumo de tarjeta
    (Debe Gasto / Haber Tarjeta) deja la cuenta en negativo. La convención es coherente y el resto
    del repositorio la respeta: `accountingActions.ts:99` invierte el signo al alta manual de un
    pasivo, y `CardVisual.tsx:34` calcula la deuda como `-balance`. **`AccountsContainer` no la
    respeta:** la línea 87 acumula `sum + a.balance` sobre los pasivos —total negativo— y la 88 hace
    `netWorth = totalAssets - totalLiabs`, o sea *activos − (−deuda)*. Con la tarjeta en `-2.500.000`
    el patrimonio se infla en 5.000.000.
    **Y las dos mitades de la misma tarjeta usan convenciones opuestas:** la sparkline que va debajo
    de ese número sale de `monthly_summaries.balanceSnapshot`, que el seed calcula con los pasivos en
    **positivo** (`activosMes = saldoAcumulado + pasivosMes`, invariante A = PN + P).
    *Nota:* en la misma pantalla, el "Saldo Neto" por entidad (línea 220) hace `sum + a.balance` sin
    restar nada y **da bien**. El mismo dato, dos cálculos, uno correcto y otro no.

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
| **Instrumentos y navegación por entidad** | §4: `/accounts` por entidad, `/cards`, `/debts`. Nueva o enmienda al RFC 007 — a decidir |
| **Reescritura del RFC 008** | Es de junio de 2026: usa `integer` para dinero y guarda un `remainingBalance` propio que duplicaría el saldo ya materializado en `accounts.balance` |
| **Enmienda al RFC 010** | Patrimonio físico **ya está aprobado**; hay que contrastarlo contra el esquema real: sus siete columnas monetarias son `integer` y el repositorio migró a `bigint` en el RFC 019 |
| **Enmienda al RFC 003** | Categorizar al confirmar; cada parte en su propio libro |
| **Enmienda al RFC 004** | El §4 pide `needs_review` en el libro; queda reemplazado por §2 |
