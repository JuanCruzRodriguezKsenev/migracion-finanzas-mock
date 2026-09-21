# Registro de Cierre — panel de categorías (i18n + `Result`) y la reescritura de los RFC 010 y 003

* **Fecha de consolidación:** 2026-09-21
* **Rama base:** `master`
* **Rango consolidado:** `1dbc993..0428b22` — 13 commits, más el commit de este registro, que cierra
  el rango y es el que queda como `master`.
* **Ramas fusionadas:** tres, **encadenadas una sobre otra**, no tres ramas paralelas desde `master`:
  `docs/rfc-010-patrimonio-fisico` (`c15bfd0`) → `feat/i18n-categorias` (`d5985a6`) →
  `fix/result-panel-categorias` (`0428b22`).
* **Método:** fast-forward puro (`--ff-only`), sin conflictos. `git log --merges` sigue vacío.
* **Resultado global:** **490 tests en 68 archivos de prueba**, 0 fallos; `eslint . --max-warnings 0`
  con 0 errores y 0 warnings; `pnpm exec tsc --noEmit` en 0 errores, corrido como comando propio;
  build de producción exitoso. Verificado por el subagente `verificador` en corridas independientes
  al cerrar cada tanda, con `postgres-dev` vivo: **485 tests en 68 archivos** tras la tanda de i18n
  —los mismos 485 del cierre del RFC 008, porque esa tanda reescribió aserciones sin agregar casos— y
  **490 en 68** tras la tanda de los `Result`, que suma cinco casos sin archivos nuevos.

> ## Advertencia: este cierre mete dos RFC en `DRAFT` a `master`
>
> El **RFC 010** (patrimonio físico) y el **RFC 003** (división de gastos por eventos) entran acá
> porque la cadena de ramas es lineal, **no porque estén aprobados**. Los dos siguen en `DRAFT` y
> **no habilitan una línea de código**. Su firma —o su corrección— sigue pendiente del usuario, y
> ningún agente aprueba un RFC.

---

## Detalle de lo consolidado

### Tanda A — reescritura del RFC 010 y del RFC 003 (`5b1d566`, `c15bfd0`)

Sólo documentación: cuatro archivos, ni una línea de `src/`. Con ella **la sesión de diseño del
2026-09-09 quedó cerrada del todo**: sus siete propuestas están escritas.

**Ninguno de los dos salió enmienda: los dos salieron reescritura completa**, y los dos **bajaron** de
`APPROVED` a `DRAFT`. Estaban aprobados desde el 2026-06-23 sin estar implementados, así que durante
quince meses autorizaron formalmente a escribir el esquema equivocado — la trampa que ya se cobró el
RFC 006 y el RFC 015, y que el §0 del RFC 008 documentó por tercera vez. **Un texto en `DRAFT` no
autoriza nada, que es estrictamente mejor que uno aprobado que autoriza lo incorrecto.**

Los dos agujeros estructurales que obligaron a reescribir en vez de enmendar, y que la sesión de
diseño no había visto porque pedía sólo «contrastar los tipos de las columnas»:

* **RFC 010 — el activo nunca entraba al libro.** Un departamento de USD 100.000 no aparecía en el
  patrimonio neto, que `AccountsContainer.tsx:97-98` calcula sumando `accounts.balance`. Y el RFC
  mandaba vincular cada movimiento «al ID del activo»: **`ledgerTransactions` no tiene columna de
  instrumento** (`:82-102`), el vínculo *es la cuenta*. Misma clase de error que el
  `remainingBalance` del 008 de junio: dinero modelado fuera del libro.
* **RFC 003 — el evento era un segundo libro.** Repartía plata sin emitir un asiento, y su §4 mandaba
  que al confirmar «la deuda contable **se elimina**», cuando el libro es inmutable y el propio
  esquema lo dice (`ledgerTransactions:90-93`). Además **ninguna de sus cuatro tablas llevaba
  `organizationId`** y los participantes se modelaban contra `users` en vez de `contacts`.

Las cinco decisiones del usuario (`AskUserQuestion`, una por vez; eligió la recomendada en las cinco)
quedan en el cuerpo de cada RFC. Las dos que condicionan el código que venga:

* **El revalúo va contra patrimonio, nunca contra resultados** — Debe Activo / Haber `Reserva por
  revalúo` (equity). Contra una cuenta `4.x`, una revalorización de USD 25.000 entraría como
  **ingreso del mes** y distorsionaría las cinco métricas de la página de estadísticas con plata que
  no entró a ninguna cuenta.
* **El vínculo activo↔cuenta es una columna `accountId` 1:1, no tabla puente.** Es el **único
  apartamiento deliberado del RFC 024 §4**, declarado dentro del propio RFC: dos cuentas espejo sobre
  el mismo inmueble lo meterían dos veces en el patrimonio neto, y el `unique (assetId, currency)`
  de `card_accounts`/`loan_accounts` **no impide la segunda fila** — dos divisas distintas lo
  satisfacen.

**Un error de conteo que circulaba por tres documentos quedó corregido:** el RFC 010 tiene **cuatro**
columnas monetarias en `integer` (`purchase_price`, `value`, `rent_amount`, `cost`), no siete;
`square_meters` y `year` también son `integer` y está bien que lo sean, porque no son dinero. Se
corrigió en la sesión de diseño y en el doc de estado; **en el RFC 024 no, que es texto `APPROVED` y
no se edita** — la discrepancia queda advertida en el §0 del 010.

### Tanda B — i18n de `CategoriesSettingsContainer` (`d9b40ea`, más `d5985a6`)

* **Plan:** [`feat-i18n-categorias.md`](../planes/feat-i18n-categorias.md) (`ed67be6`);
  **ejecución:** `d9b40ea` — ocho archivos, los seis del radio de impacto más dos docs.
* **58 claves en `settingsPage.categories`** de los tres diccionarios (`es`, `en`, `br`), con paridad
  exacta comprobada. Con esto **`/settings` queda íntegramente internacionalizado**.
* El componente recibe `dict` obligatoria con el molde de `LedgerAuditPanel.tsx:23-26`, y **no recibe
  `lang`**: no formatea números ni fechas. `patterns.md` §12.1 pide «`dict` y `lang`
  correspondiente», y seguir el precedente del código fue lo correcto.
* **Un cabo, y lo dejó el plan, no la ejecución** (`d5985a6`): la aserción
  `getByRole( "button" , { name: /Confirmar archivado/i } )` quedó con el literal español porque la
  tabla del plan enumeró **cinco** aserciones y eran **seis**. El test seguía verde, porque el valor
  de `es` coincide con la cadena vieja — o sea que la verificación estaba apagada sin avisar.

### Tanda C — dejar de descartar el `Result` en el panel (`0039f9d`, más `26e0937` y `0428b22`)

* **Plan:** [`fix-result-panel-categorias.md`](../planes/fix-result-panel-categorias.md) (`916dd7a`);
  **ejecución:** `0039f9d` — cuatro archivos, **un solo archivo de producción**.
* **Sin RFC y sin necesitarlo:** no agrega comportamiento ni toca el modelo, corrige un defecto de UX
  preexistente. `CategoriesSettingsContainer` llamaba a tres acciones de escritura sin mirar
  `res.success` —si el servidor rechazaba, cerraba el modal y refrescaba como si hubiera funcionado— y
  se comía el error de dos lecturas.
* **Dos canales de error separados, no uno compartido:** `actionError` pinta el banner del panel y
  `formError` pinta dentro del modal. Con un solo estado, el mismo texto se renderizaría en los dos
  lugares a la vez. El precedente del patrón `actionError` + `FormError` ya estaba tres veces en el
  repo (`PendingInstallmentsInbox`, `PendingLoanSettlementsInbox`, `PendingOccurrencesInbox`), y **no
  se usó el `NotificationsContext`**, que es la bandeja de dominio y no un canal de errores.
* **Dos decisiones de detalle que valen para el próximo que toque esto:** la casilla «Ver archivadas»
  es estado optimista y **vuelve atrás** si la lectura falla; y el `setCustomVisuals( null )` quedó
  *después* del chequeo, para que un guardado rechazado no le borre al usuario lo que tipeó.
* Cinco tests nuevos —uno por camino de fallo—, los tres viejos intactos.

---

## Deuda que este cierre movió

* **Cerrada:** «`CategoriesSettingsContainer` no está internacionalizado» (§3). Con ella cierra el
  resto de i18n de `/settings`.
* **Abierta — los `Result.error` son frases humanas en español, no códigos** (§3, 2026-09-20): 201
  `fail()` en 13 archivos devuelven prosa que la UI pinta cruda. **La tanda C la volvió más visible,
  no más grave**: ahora el panel muestra esos textos donde antes los tragaba. **Exige RFC propio**
  que fije el contrato (código + parámetros) y su mapeo en los tres diccionarios; una excepción local
  en un solo archivo la dejaría a medias y el próximo lector la copiaría.
* **Abierta — CSS inline estático en JSX, contra el §4** (§1, 2026-09-21): verificados a mano
  `PendingInstallmentsInbox.tsx:156,221,237`, `CardFormModal.tsx:198`,
  `InstallmentPlansModal.tsx:112` y `CardVisual.tsx:79`. Un barrido heurístico marca ~22 casos en 13
  archivos **con falsos positivos** (`style={cardStyle}` es dinámico): el conteo exacto es parte de
  cerrarla.
* **Sigue abierta sin moverse:** las 5 declaraciones de `dict?:` opcional heredadas.

---

## Lo que quedó verificado y no hay que volver a barrer

* **El resto del repo maneja bien el `Result`.** Cuatro barridos distintos: los `.then()` de
  `useSubscriptions` y `AddSubscriptionModal` chequean los cuatro; los `Promise.all` de las ocho
  `page.tsx` destructuran y chequean (`settings/page.tsx:31-32` es el molde); y ninguna de las 28
  llamadas a acciones deja el `Result` sin consultar. El panel de categorías era **la** excepción.
* **Dos residuos que parecen defectos y no lo son.** `installmentPlansActions.test.ts:429,492` llama
  a dos acciones descartando el `Result`: es siembra de test, y está bien.
  `CategoriesSettingsContainer.tsx:451` tiene un `style={{ backgroundColor: … }}` calculado de
  `activeParent.color`: es dinámico, o sea la excepción explícita del §4. **Los dos son
  preexistentes** y ninguno entra a la deuda del CSS inline.

---

## Correcciones de documentación aplicadas en este cierre

Contrastadas contra el **código**, no contra los informes de ejecución.

* **`patterns.md:363` dejó de mentir sin que nadie lo editara.** Citaba a
  `CategoriesSettingsContainer.test.tsx` como ejemplo de referencia del patrón i18n, diciendo que
  «carga `getDictionary( "es" )` en `beforeAll`» — y era falso: ese test no importaba `getDictionary`
  y el componente ni siquiera recibía `dict`. La tanda B lo volvió verdadero (`:4`, `:8`, `:36-39`).
  **Por eso el plan mandó no tocar `patterns.md`:** el doc no estaba mal escrito, estaba adelantado.
* **El doc de estado se atribuía una verificación independiente que todavía no existía.** El párrafo
  de cierre de la tanda C decía «ejecutado y verificado» antes de que `verificador` corriera, y había
  perdido los números de la batería. Corregido en `0428b22`, con las cifras reales.

---

## Los defectos de esta consolidación fueron de planificación, y los dos son del mismo tipo

Ninguna de las tres tandas tuvo desvío de ejecución — **son cuatro rondas seguidas sin hallazgos de
`obra`**. Lo que falló fueron **enumeraciones y salidas escritas sin correr el comando que las
produce**:

1. La tabla de aserciones del plan de i18n dijo cinco y eran seis (tanda B), y la sexta quedó sin
   traducir.
2. El plan de la tanda C predijo dos salidas de `grep` vacías y las dos salieron con líneas: el
   barrido de `await …Action(` dijo «3, todas en este archivo» y eran 5, y el de `style={` daba un
   caso dinámico legítimo. No costó un defecto porque `obra` no ejecuta las salidas esperadas como
   órdenes, pero **una salida esperada falsa convierte un cierre sano en una discrepancia que hay que
   investigar**, igual que un total de tests mal predicho.

La regla que queda: **cuando un plan enumera ocurrencias o predice una salida, esa enumeración se
arma con el comando que las lista todas, corrido al escribir el plan** — o lleva arriba la regla
general, para que la lista sea ejemplo y no límite.
