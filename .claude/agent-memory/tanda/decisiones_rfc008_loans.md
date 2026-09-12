---
name: decisiones-rfc008-loans
description: Reescritura del RFC 008 (2026-09-11) — por qué la ruta es /loans y no /debts, por qué no existe /activos, y las decisiones de modelado de préstamos con su fundamento.
metadata:
  type: project
---

# RFC 008 reescrito — préstamos bidireccionales y `/loans`

Escrito el **2026-09-11** y **`APPROVED` el mismo día**: `docs/proposals/008-loans-and-installments.md`.
**Habilita código contra ese texto.**

## Las dos decisiones que el RFC delegaba al plan, ya cerradas (2026-09-11)

*   **La categoría de intereses sale fija por código, sin tocar el esquema.** El §5D necesita cuenta
    de gasto y el §5E de ingreso, pero `loans` **no tiene columna de categoría** y no se le agrega.
    `borrowed` → `5.1.11.02 Intereses` (hoja que **ya existe** en `initialCatalog.ts`); `lent` →
    padre `4.1.04 Intereses y rendimientos`, que cae a su hoja `General` vía `resolveToLeaf()`
    porque sus dos hojas reales son *Plazo fijo* y *Cuenta remunerada* y **ninguna sirve**.
    Respaldo obligatorio: `findOrCreateTypeGeneralLeaf( type )`, porque el catálogo inicial **sólo lo
    aplica `src/shared/db/seed.ts`** y una organización creada por fuera puede no tenerlo.
    Elegida por el usuario sobre las otras dos (columna `interestCategoryId`, o elegir en cada cuota)
    por no requerir nota de corrección a un RFC `APPROVED`.
*   **`/loans` va en la sección «Finanzas» del `Navbar`, justo después de `/cards`** — deja juntos
    accounts/cards/loans antes de suscripciones y contactos. Con `dict.loans` en los tres
    diccionarios, no en duro como el `<span>Tarjetas</span>` de al lado.

## Las tres decisiones de la tanda 2 (UI), cerradas el 2026-09-11

Elegidas por el usuario con `AskUserQuestion` + mockups ASCII, **una pregunta por vez**; eligió la
recomendada en las tres. Están en `docs/planes/008-tanda-2-interfaz-de-loans.md` §1.

*   **`/loans` es una tabla con tabs por dirección** (Todos/Pedidos/Dados), con `MetricsSection`
    arriba. **No** es una grilla de tarjetas al estilo `/cards`: el argumento que decidió fue que un
    préstamo tiene seis columnas numéricas —saldo, progreso, cuotas, próximo vencimiento— que en una
    tarjeta no entran, y que `/cards` es una grilla porque una tarjeta tiene identidad visual propia
    (marca, plástico, últimos cuatro dígitos) que un préstamo no tiene.
*   **La liquidación vive en una bandeja global arriba de la tabla**, como en `/cards` y
    `/subscriptions`, con modal de selección de cuenta (la acción exige `paymentAccountId`). **La
    bandeja muestra una sola fila por préstamo, su cuota más antigua**, porque
    `payLoanInstallmentAction` rechaza cualquier otra dentro de la transacción
    (`loansActions.ts:98-100`): listar tres vencidas y dejar tocar la tercera es un error garantizado.
*   **La familia «Préstamos» del detalle de entidad de `/accounts` entra en la misma tanda**, junto
    con el filtro que excluye las cuentas espejo de la lista de cuentas — el mismo `cardAccountIds`
    que ya existe para tarjetas (`AccountsContainer.tsx:81-83` y el filtro de `:324-326`). Sin eso, la
    cuenta `2.1.01.NN` del préstamo se sigue viendo como cuenta contable cruda al lado de su propio
    instrumento, que es lo que el RFC 024 §4 prohíbe.

## Trampa del propio RFC: su §4.2 tiene los pasos de `limpiarBase()` corridos

Numera `card_accounts`=7, `contacts`=10, `accounts`=13, `financial_entities`=14. **La tanda 1 del RFC
025 insertó `cardInstallmentPlans` y corrió todo uno**: hoy son 8, 11, 14 y 15, y el archivo numera
sus pasos en comentarios (`1.` a `19.`), así que insertar dos tablas **obliga a renumerar los
siguientes**. El orden topológico que el RFC describe es correcto; sólo los números están corridos.
El plan de la tanda 1 lo advierte y usa anclas textuales. **No editar el RFC: es texto aprobado.**

## Las decisiones y su porqué

*   **`loans` + `loan_accounts`, sin `remainingBalance`.** El patrón `cards` → `card_accounts` del
    RFC 007, que el RFC 024 §4 manda repetir para «todo instrumento que venga». El saldo pendiente se
    lee del libro; una columna paralela se desincroniza en cuanto haya un pago anticipado o un
    contra-asiento.
*   **Instrumento bidireccional**: `direction: 'borrowed' | 'lent'`. Prestado = `liability` con
    balance negativo; dado = `asset` con balance positivo.
    **Trampa que el RFC nombra explícito: `deudaDe()` sirve para `borrowed` y NO para `lent`** — una
    cuenta por cobrar ya es positiva, negarla la muestra al revés.
*   **Cronograma proyectado, no materializado.** Se reusa `ocurrenciaN()` (genérica, recibe
    primitivas) + puntero `resolvedThrough`, del RFC 023. **`pendientesDe()` NO se reusa**: está
    tipada contra `Subscription` concreto y lee `status`, que un préstamo no tiene. Se escribe el
    equivalente en la feature nueva **sin tocar `subscriptions`**, que ya está verde y cerrada.
*   **Contraparte**: `entityId` XOR `contactId`, validado con Zod en el servicio. **No con `CHECK` en
    la base**: el repo no usa constraints de chequeo en ninguna tabla y este RFC no introduce el
    primero. La versión de junio tenía `type: 'bank'|'peer'` + `contactId`, que es el mismo dato dos
    veces y admite estados incoherentes.
*   **Escisión**: las compras en cuotas con tarjeta salen al **RFC 025**, escrito el mismo día
    (pertenecen a `/cards`). Ver [[decisiones-rfc025-cuotas-tarjeta]].
*   **Desembolso y primera cuota son dos columnas**: `startDate` (`timestamp`, la fecha del asiento de
    alta) y `firstInstallmentDate` (`date` civil, **el único ancla del cronograma**). Pedido del
    usuario el 2026-09-11: períodos de gracia y «empezá a pagar en marzo». Anclar en `startDate`
    corría las doce cuotas al día equivocado del mes, en silencio.

## `/loans`, no `/debts` — y por qué no hay `/activos`

El usuario eligió `/loans`. El argumento que lo decidió, y que conviene no reabrir:

*   **El eje 2 del RFC 024 agrupa por tipo de instrumento, no por clase contable.** La prueba está en
    el repo: una tarjeta de crédito **es un pasivo y no está en `/debts`, está en `/cards`**. Si el
    criterio fuera contable habría una sola `/pasivos`.
*   `/cards` ya es el precedente exacto de una ruta bidireccional: cubre `credit` y `debit`, que son
    contablemente opuestos, y nadie las partió.
*   **Por eso tampoco se crea `/activos`.** Es el techo de la jerarquía, no un tipo de cosa; se
    solaparía con `/accounts` (la mayoría de los activos ya son cuentas). Ese fue el modelo de
    `assets` de FinanceApp-WSL —tabla plana `REAL_ESTATE|STOCKS|CASH|CRYPTO|OTHER`, con el efectivo
    registrado a la vez ahí y en `bank_accounts`— y es el que este repo abandonó con la partida doble.
*   **«Cuánto tengo en total» se contesta en estadísticas**, adonde el RFC 024 §6.2 mandó el
    Patrimonio Neto.
*   **Alquileres → `/wealth`** (RFC 010 ya los tiene como `wealth_asset_tenants`); **inversiones →
    `/investments`** (RFC 014); **neto por contacto → ficha de `/contacts`**, que hoy no muestra ni un
    importe: es tanda aparte.

## Cómo se caduca una parte de un RFC ya `APPROVED`

**Precedente del repo, seguirlo:** el RFC 023 no abrió una enmienda en `DRAFT` — revocó la parte que
caducaba y dejó la nota en el documento viejo (`004-subscriptions-management.md:123`). Igual acá: el
008 declara el rename y el 024 recibe su nota en las líneas **62, 79, 85, 291 y 297**.
Fuera del 024: `ARCHITECTURE.md:81` y `trabajo-en-vuelo.md:61`.

**Lo que NO se edita nunca al renombrar:** `docs/registro/`, `docs/planes/` ya ejecutados y
`docs/diseno/`. Son actas de algo que pasó y deben seguir diciendo lo que decían.

## Cómo se investigó el modelo anterior

Las tres referencias, por si hay que volver:
`~/Dev/finanzas/FinanceApp-WSL/src/features/wealth/schema.db.ts` (assets/liabilities/credit_cards/
net_worth_snapshots, sin partida doble) y `~/Dev/finanzas/FinanzasMock/src/features/wealth/`
(`/patrimonio` sólo `real_estate|vehicle|other`, `/inversiones` y `/deudas` como pantallas separadas).
