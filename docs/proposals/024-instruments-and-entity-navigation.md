# RFC 024: Instrumentos y navegación por entidad

*   **ID de la Propuesta:** 024
*   **Título:** `/accounts` como directorio por entidad, el instrumento presentado como instrumento, y el plan de cuentas fuera de la operación diaria
*   **Estado:** `DRAFT` — **no habilita código.** Requiere aprobación explícita del usuario.
*   **Fecha de Creación:** 2026-09-10
*   **Autor:** `tanda`
*   **Origen:** §4 de [`docs/diseno/rediseno-clasificacion-y-propuestas.md`](../diseno/rediseno-clasificacion-y-propuestas.md), donde se tomaron las cinco decisiones con su fundamento, y §7 del mismo documento, que dejó pedida esta propuesta.
*   **Decisiones de forma tomadas antes de escribir:** propuesta **nueva** y no enmienda al RFC 007 —de las cinco decisiones del §4 sólo una es sobre tarjetas—; y el plan de cuentas **se muda a `/settings` como pestaña de sólo lectura**.

> [!IMPORTANT]
> **Escrito contrastando el código y el esquema real, no de memoria.** La Sección 0 lista lo
> verificado. **Tres afirmaciones de la sesión de diseño resultaron inexactas y acá quedan
> corregidas**, y aparecieron **dos defectos activos** que este RFC convierte en requisitos. Es el
> mismo procedimiento que atrapó los errores de los RFC 007, 008, 010 y 015.

---

## 0. Contraste contra el código real (2026-09-10)

| Qué se verificó | Resultado |
| :--- | :--- |
| ¿Existe la tabla de entidades? | **Sí, y hace tiempo.** `financial_entities` (`accounting/schema.db.ts:36-44`) con `name`, `logo`, `brandDomain`, `color` y `organizationId`. Hay `financialEntityRepository.ts` |
| ¿Las tablas a cruzar tienen la columna? | **Las tres.** `accounts.entityId` (`:57`), `cards.entityId` (`cards/schema.db.ts:25`) y `contact_payment_methods.financialEntityId` (`contacts/schema.db.ts:39`). Las tres con FK `onDelete: restrict` |
| ¿`/accounts` agrupa por tipo contable? | **No. La sesión de diseño se equivocó en esto.** `AccountsContainer.tsx:67-84` ya arma `groupedWallets` agrupando por `entity.name`, y ya hay dos tabs (`wallets` / `ledger`, `:54` y `:114-117`) |
| ¿Hay vista de detalle de una entidad? | **Sí, pero es un modal** (`AccountsContainer.tsx:344-360`), no una página. No existe `/accounts/[id]`: la carpeta de ruta sólo tiene `page.tsx` y `loading.tsx` |
| ¿Por qué la tarjeta aparece junto a la caja de ahorro? | `AccountsContainer.tsx:64` mete `asset` **y** `liability` en la misma colección `walletAccounts`, que es la que después se agrupa por entidad. Ése es el síntoma real, y es más acotado que «agrupa por tipo contable» |
| El Patrimonio Neto de `/accounts` | **Defecto activo, líneas 87-89.** Ver §6 |
| `CreateAccountForm` | **Defecto activo, líneas 122-126.** Ofrece los cinco tipos contables. Ver §5 |
| El asiento de apertura contra Patrimonio | **El contraargumento de la sesión se sostiene.** `accountingActions.ts:248` y `cardsActions.ts:163` usan la misma técnica; lo único asimétrico es el texto. Ver §7 |
| Entidades en el seed | Dos: `Banco Galicia` y `Efectivo` (`seed.ts:251` y `:262`) |

**Consecuencia de peso para el alcance: este RFC no lleva migración de base de datos.** El esquema
que la navegación por entidad necesita ya está construido y poblado. Lo que falta es de lectura y de
presentación.

---

## 1. Contexto y objetivos

Este repositorio es el único de los tres que tiene libro mayor, y por eso fue el único que ordenó sus
pantallas por **plan de cuentas** en vez de por **instrumento**. FinanzasMock y FinanceApp-WSL cortan
los dos por instrumento —comprobado en el §4 de la sesión de diseño— y podían darse ese lujo porque
no tienen partida doble. Nosotros la tenemos, y el RFC 007 ya encontró la salida: el instrumento vive
en su tabla, su reflejo vive en el libro. **Lo que faltaba era que la navegación siguiera al
instrumento.**

### Objetivos

1.  Que `/accounts` conteste *«¿qué tengo con este banco?»* de forma completa: cuentas, tarjetas y
    —cuando exista el RFC 008— préstamos, todo bajo la entidad que los emite.
2.  Que un instrumento se presente **como lo que es** y no como una fila del plan de cuentas con
    código y saldo negativo.
3.  Sacar el plan de cuentas crudo de la operación diaria sin perder la capacidad de auditarlo.
4.  Dejar escritas las dos reglas transversales que hoy se aplican de forma inconsistente: el signo
    de los pasivos al agregar, y el asiento de apertura de saldo inicial.

### No objetivos

*   **No se construye `/debts` ni `/wealth`.** Este RFC fija que existen como vistas transversales y
    dónde encajan; sus contenidos son el RFC 008 —a reescribir— y el RFC 010 —a contrastar—.
*   **No se toca el motor contable.** Ni el plan de cuentas, ni `category_accounts`, ni el signo
    almacenado. Todo lo de acá es capa de lectura y presentación.
*   **No se construye la página de estadísticas.** El §6 manda el Patrimonio Neto hacia allá, pero
    esa pantalla necesita propuesta propia y todavía no la tiene.
*   **No se renombra ninguna ruta existente.**

---

## 2. El modelo: dos ejes, y un instrumento que aparece en los dos

Un mismo instrumento se ve desde dos preguntas distintas, y las dos son legítimas:

| Eje | Ruta | Pregunta que contesta |
| :--- | :--- | :--- |
| Por **quién lo emite** | `/accounts` | *¿Qué tengo con Galicia?* |
| Por **qué tipo de cosa es** | `/cards`, `/debts`, `/wealth` | *¿Cómo vienen mis tarjetas?* |

**Que un instrumento aparezca dos veces no es duplicación**: es la misma fila leída por dos criterios.
La fuente es única —la tabla del instrumento— y ninguno de los dos ejes guarda estado propio.

Por `ARCHITECTURE.md` §4 los segmentos van en inglés, así que las vistas transversales futuras se
llaman **`/debts`** y **`/wealth`**. La página de estadísticas queda sin nombre elegido: no es alcance
de este RFC.

---

## 3. `/accounts` es el directorio por entidad

### 3.1 Lo que ya está y no hay que construir

Esta tabla existe para que la ejecución no reescriba lo que funciona:

| Ya existe | Dónde | Estado |
| :--- | :--- | :--- |
| Agrupación por entidad | `AccountsContainer.tsx:67-84` | Funciona. **No rehacer** |
| Tabs de navegación | `AccountsContainer.tsx:54` , `:114-117` , `:214-219` | Reusar el `Tabs` compartido |
| Detalle de entidad | `AccountsContainer.tsx:344-360` | Existe como **modal**; se amplía, ver 3.3 |
| Alta de cuenta con entidad preseleccionada | `AccountsContainer.tsx:137` , `:334` | Funciona |
| Repositorio de entidades | `financialEntityRepository.ts` | Reusar |
| Resolución de logo de marca | `brandService.ts` , campo `brandDomain` | Reusar |

### 3.2 Lo que cambia

**La colección `walletAccounts` se parte en dos.** Hoy `AccountsContainer.tsx:64` mezcla `asset` y
`liability`, y por eso la tarjeta aterriza al lado de la caja de ahorro. Dentro de cada entidad, los
instrumentos se presentan por familia:

*   **Cuentas** — las cuentas `asset` de esa entidad, como hoy.
*   **Tarjetas** — leídas de `cards` por `entityId`, **no** de las cuentas `liability` que las
    reflejan.
*   **Préstamos** — vacío hasta que exista el RFC 008. La sección no se dibuja si no hay filas.

**Una cuenta `liability` que no sea el reflejo de ningún instrumento sigue mostrándose como cuenta.**
No se ocultan pasivos: se ocultan los pasivos que *ya están representados* por su instrumento, para
no contar dos veces la misma deuda en la misma pantalla.

### 3.3 El detalle de entidad

La decisión 1 pide que al abrir una entidad aparezca todo lo que se tiene con ella. El modal actual
sólo lista cuentas. **Se mantiene como modal** —no se crea `/accounts/[id]`— porque el contenido es
un resumen y no una pantalla de trabajo, y porque una ruta nueva arrastra `generateMetadata`, estado
de carga propio y una entrada más de navegación sin ganar nada hoy. Si el día que existan préstamos
el modal queda chico, se promueve a ruta: la decisión se revisa entonces, con contenido real
adelante.

El modal pasa a mostrar las tres familias de 3.2, cada una con su acción de alta.

---

## 4. El instrumento se presenta como instrumento

Dentro de una entidad, una tarjeta se muestra con **marca, últimos cuatro dígitos y ciclo** —lo que
`CardVisual.tsx` ya sabe dibujar— y nunca como `2.1.01.01` con saldo negativo al lado.

**La cuenta contable sigue existiendo por debajo, sin cambios.** El patrón `cards` → `card_accounts`
del RFC 007 es el que se repite para todo instrumento que venga: el instrumento en su tabla, su
reflejo en el libro, vinculados **por divisa**.

**Regla de presentación, que hoy se aplica de forma inconsistente:** la deuda de un pasivo se muestra
al usuario como **cantidad positiva**, porque el motor la guarda negada (`patterns.md` §8).
Ya existe el helper que lo resuelve: **`deudaDe()` en `cards/utils/ciclo.ts:23`**, que devuelve
`-balance` tratando el cero como cero para no producir `-0`. Todo lugar nuevo que muestre un pasivo
**reusa ese helper**, no reimplementa la negación.

---

## 5. El plan de cuentas se muda a `/settings`, y se cierra la puerta de atrás

### 5.1 El defecto: dos puertas para crear una cuenta de gasto

**Éste es el hallazgo más serio del contraste, y no estaba en la sesión de diseño.**

`CreateAccountForm.tsx:122-126` ofrece los cinco tipos contables, Ingreso y Egreso incluidos. Y
`createAccountAction` (`accountingActions.ts:69`) escribe **únicamente en `accounts`**: no toca
`categories` ni `category_accounts` en ningún punto.

Desde que entró el RFC 022 hay entonces dos puertas para crear una cuenta de gasto:

| Puerta | Qué crea | Resultado |
| :--- | :--- | :--- |
| Categorías, en `/settings` | La categoría **y** su cuenta por divisa | Coherente |
| `CreateAccountForm`, en `/accounts` | Sólo la fila en `accounts` | **Cuenta huérfana del árbol** |

Una cuenta nacida por la segunda puerta no aparece en la pantalla de Categorías, no se puede elegir
en el formulario de transacciones —que lee `categories`— y sí figura en el plan de cuentas. El RFC
022 cerró el circuito por delante y dejó esta puerta abierta por detrás.

### 5.2 Lo que se decide

1.  **`CreateAccountForm` pierde los tres tipos nominales.** Quedan `asset` y `liability`, que son
    los que tienen entidad emisora. Ingresos y gastos se crean **sólo** desde Categorías, que es la
    puerta que mantiene sincronizados el árbol y la cuenta por divisa.
2.  **`createAccountSchema` rechaza `equity`, `revenue` y `expense`.** La restricción vive en el
    esquema Zod y no sólo en el `<select>`: una Server Action es un endpoint público, y esconder una
    opción en el formulario no impide que llegue el valor. Es el mismo criterio que llevó a
    `updateProfileAction` a validar en modo `.strict()`.
3.  **El plan de cuentas crudo se va a `/settings` como pestaña de sólo lectura**, junto a
    Categorías. Sirve para auditar cuando un saldo no cuadre; no sirve para operar. La tab `ledger`
    desaparece de `/accounts`, que queda siendo una sola cosa: el directorio de entidades.
4.  **El código contable no se muestra en la operación diaria.** En la pestaña de auditoría sí: es su
    razón de ser. Esto es coherente con el RFC 022, que lo oculta en la administración de categorías.

### 5.3 Radio de impacto de este cambio

Lo que toca `createAccountAction` o el formulario, y hay que revisar en la misma tanda:

| Archivo | Por qué entra |
| :--- | :--- |
| `accounting/components/CreateAccountForm.tsx` | Pierde tres opciones y su lógica condicional de entidad (`:53` , `:133-136`) |
| `accounting/actions/accountingActions.ts` | `createAccountAction` (`:69`) y su validación |
| `accounting/schemas/` — esquema de `createAccountSchema` | Restringir el `type` admitido |
| `accounting/components/AccountsContainer.tsx` | Desaparece la tab `ledger` y su `groupedLedger` (`:76-77`) |
| La pantalla de `/settings` | Recibe la pestaña nueva |
| `accountingActions.test.ts` | Cubre `createAccountAction`: hay que agregar el caso que **rechaza** un tipo nominal |

---

## 6. El Patrimonio Neto se va — y la fórmula que se lleva estaba mal

### 6.1 El defecto, todavía vivo

`AccountsContainer.tsx:87-89`:

```ts
const totalAssets = walletAccounts.filter( a => a.type === "asset"     ).reduce( ( sum , a ) => (sum + a.balance) , 0 ) ;
const totalLiabs  = walletAccounts.filter( a => a.type === "liability" ).reduce( ( sum , a ) => (sum + a.balance) , 0 ) ;
const netWorth    = ( totalAssets - totalLiabs ) ;
```

El motor guarda los pasivos **negados** (`patterns.md` §8: una sola fórmula para activos, gastos y
pasivos). Entonces `totalLiabs` ya es negativo, y restarlo **suma la deuda**. Con la tarjeta del seed
en `-2.500.000`, el patrimonio se infla en 5.000.000.

**Lo grave no es la resta: es que el patrón ya lo advertía por escrito.** `patterns.md` §1 punto 5
dice, textual, que la identidad `Activos − Pasivos` *«no se aplica directamente sobre la columna
`balance`»* y que **la fórmula sobre los saldos del repositorio es una suma**. El resto del
repositorio respeta la convención: `accountingActions.ts:99` invierte el signo al alta manual de un
pasivo y `deudaDe()` (`cards/utils/ciclo.ts:23`) centraliza la negación para mostrarla.

### 6.2 Lo que se decide

1.  **La métrica Patrimonio Neto sale de `/accounts`.** Si la página es el directorio de entidades, el
    patrimonio **ya no se puede calcular ahí**: necesita los activos no financieros —propiedades,
    autos— que viven en `/wealth`. Un patrimonio que ignora la mitad de los activos es un número que
    miente aunque la fórmula sea correcta.
2.  **La fórmula no se muda como está.** Se corrige al moverla, o se propaga el defecto a la pantalla
    nueva. La forma correcta sobre los saldos de este repositorio es **una suma**.
3.  **Hay una segunda inconsistencia en la misma pantalla, y este RFC no la resuelve.** La sparkline
    que va debajo sale de `monthly_summaries.balanceSnapshot`, que el seed calcula con los pasivos en
    **positivo**. Las dos mitades del mismo widget usan convenciones opuestas. Queda anotada en §9:
    tocarla exige decidir qué convención guarda `monthly_summaries`, y eso pertenece a la propuesta de
    estadísticas.
4.  **Qué queda en su lugar.** `/accounts` conserva el «Saldo Neto» por entidad, y **esa métrica ya
    está bien calculada**: `AccountsContainer.tsx:231` hace `list.reduce( sum + a.balance )` sobre
    todos los instrumentos de la entidad, sin discriminar tipo. Como los pasivos vienen negados, la
    suma da el neto real. **Es exactamente la fórmula que `patterns.md` §1 punto 5 prescribe**, y es
    el ejemplo a seguir para la métrica que se mude. La sesión de diseño la anotó como sospechosa
    —«hace `sum + a.balance` sin discriminar tipo»—; el contraste muestra que no discriminar es
    justamente lo correcto acá. **No tocarla.**

---

## 7. El asiento de apertura: se conserva, se unifica la descripción

La sesión de diseño abrió este cabo y **lo cierra la evidencia, no una decisión de gusto**.

El planteo original decía que `createCardAction` inventa un hecho económico al emitir *«Apertura deuda
inicial»* contra `3.1.01.01 Patrimonio Neto`, porque una tarjeta no nace con deuda. El contraargumento
que la sesión anotó sin resolver **se sostiene entero**, y se verificó:

| Acción | Línea | Descripción que emite |
| :--- | :--- | :--- |
| `createAccountForEntityAction` | `accountingActions.ts:248` | `Apertura ${cuentaCreada.name}` |
| `createCardAction` | `cardsActions.ts:163` | `Apertura deuda inicial ${tarjetaCreada.label}` |

Es **la misma técnica** —la estándar para saldo inicial— aplicada a los dos instrumentos. Si se saca
de tarjetas hay que sacarla de cuentas, y entonces **ningún saldo de arranque puede entrar sin romper
Debe = Haber**. El asiento se conserva.

**Lo único que está mal es el texto.** `Apertura deuda inicial` se lee como un hecho económico; la de
cuentas, `Apertura <nombre>`, se lee como lo que es. Se unifica al patrón neutro.

**Regla que este RFC deja escrita:** todo instrumento que se dé de alta con saldo distinto de cero
asienta contra Patrimonio Neto con una descripción de **apertura**, nunca con una que narre un hecho
económico. Es apertura de saldo, no un consumo.

---

## 8. Los dos defectos que este RFC convierte en requisitos

No son deuda a mirar después: la pantalla nueva los hereda si no se corrigen primero.

*   **8.1 — El signo al agregar pasivos** (§6.1). Afecta **sólo** al Patrimonio Neto (`:87-89`); el
    Saldo Neto por entidad (`:231`) está correcto. Requisito porque la fórmula se muda a la pantalla
    de estadísticas, y mudarla como está propaga el defecto a una pantalla nueva.
*   **8.2 — La puerta de atrás de `CreateAccountForm`** (§5.1). Requisito porque este RFC mueve el
    plan de cuentas a una pestaña de sólo lectura: si la puerta queda abierta, quedan cuentas
    huérfanas creándose sin ninguna pantalla donde verlas.

---

## 9. Lo que este RFC deja abierto

*   **La convención de signo de `monthly_summaries.balanceSnapshot`** (§6.2 punto 3). El seed la
    calcula con pasivos en positivo, al revés que el motor. Pertenece a la propuesta de estadísticas.
*   **El nombre de la ruta de estadísticas.** El mock la llama `/reportes`, lo que daría `/reports`;
    se habló de ella como *stats*. Se decide en su propia propuesta.
*   **`/debts` y `/wealth` no tienen contenido acá.** El RFC 008 hay que reescribirlo —usa `integer`
    para dinero y guarda un `remainingBalance` propio que duplicaría `accounts.balance`— y el RFC 010
    hay que contrastarlo: sus siete columnas monetarias son `integer` y el repositorio migró a
    `bigint` en el RFC 019.
*   **La navegación lateral ya está al día, contra lo que decía la sesión de diseño.** El §4bis
    afirmaba que «`/cards` no figura» en `Navbar.tsx`; hoy sí figura (`:121`), y `/settings` también
    (`:91`). No hay nada que rehacer ahí. Lo que sí habrá que decidir es dónde entran `/debts` y
    `/wealth` cuando existan.
*   **Si el modal de entidad debe promoverse a ruta** (§3.3). Se revisa cuando existan préstamos.
