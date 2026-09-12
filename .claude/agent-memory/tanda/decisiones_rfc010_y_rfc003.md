---
name: decisiones-rfc010-y-rfc003
description: Reescritura del RFC 010 (patrimonio físico) y del RFC 003 (eventos) el 2026-09-12 — por qué los dos quedaron en DRAFT, las cinco decisiones del usuario y el apartamiento deliberado del RFC 024 §4.
metadata:
  type: project
---

# RFC 010 y RFC 003, reescritos el 2026-09-12 — ambos en `DRAFT`

`docs/proposals/010-wealth-assets-management.md` y `docs/proposals/003-event-splitting.md`.
**Ninguno habilita código todavía: el usuario tiene que aprobarlos.**

## Por qué quedaron en `DRAFT` y no en `APPROVED`

Estaban `APPROVED` desde el 2026-06-23 **sin estar implementados**, así que durante quince meses
autorizaron formalmente a escribir el esquema equivocado. **Bajar el sello no cuesta nada cuando no
hay código detrás y quita la autorización.** Un texto en `DRAFT` no autoriza nada, que es
estrictamente mejor que uno aprobado que autoriza lo incorrecto. Y la regla del repo es explícita:
**ningún agente aprueba un RFC.**

## El patrón del contraste: el tipo de columna es la capa de arriba

La sesión de diseño pedía «contrastar los tipos». Debajo había un agujero estructural por RFC, y son
los que obligaron a reescribir en vez de enmendar:

*   **010 — el activo nunca entraba al libro.** Un depto de USD 100.000 no aparecía en el patrimonio
    neto, que `AccountsContainer.tsx:97-98` calcula sumando `accounts.balance`. Y el RFC decía
    vincular cada movimiento «al ID del activo»: **`ledgerTransactions` no tiene columna de
    instrumento** (`:82-102`), el vínculo *es la cuenta*.
*   **003 — el evento era un segundo libro.** Repartía plata sin emitir un asiento y su §4 mandaba
    que al confirmar «la deuda contable **se elimina**». El libro es inmutable y lo dice el propio
    esquema (`ledgerTransactions:90-93`). Además **ninguna de sus 4 tablas tenía `organizationId`** y
    los participantes se modelaban contra `users` en vez de `contacts`.

## Las cinco decisiones del usuario (`AskUserQuestion`, una por vez, eligió la recomendada en todas)

1.  **Revalúo contra patrimonio, nunca contra resultados.** Debe Activo / Haber `Reserva por revalúo`
    (equity, creada on-demand con `getNextCode("equity")` → sale `3.1.01.NN`, el RFC **no** fija el
    número para no contradecir al generador). *Por qué:* contra una cuenta `4.x`, una revalorización
    de USD 25.000 entraría como **ingreso del mes** y distorsionaría las cinco métricas de la página
    de estadísticas con plata que no entró a ninguna cuenta.
2.  **El 010 se acota al núcleo patrimonial** (activos + valuaciones + imágenes). **Inquilinos e
    incidencias escindidos** a propuestas propias, con el precedente 008→025. *Por qué:* un contrato
    de alquiler no es una tabla, es el motor de recurrencias del RFC 023 entero; modelarlo con un
    `paymentFrequency` suelto sería la cuarta implementación paralela del mismo circuito. El cap rate
    se va con ellos porque necesita el numerador de ingresos.
3.  **La cuenta del activo nace con `getNextCode("asset")` → `1.1.01.NN`**, igual que tarjetas y
    préstamos. Contablemente un inmueble es activo **no** corriente, pero **el repo no distingue
    corriente de no corriente para nadie** y un préstamo dado ya vive en ese cajón. Usar `1.1.01`
    mantiene la regla en vez de abrir una excepción; ningún cálculo se afecta (el patrimonio suma por
    tipo y signo, no por código). **Deuda declarada, no resuelta.**
4.  **El vínculo activo↔cuenta es una columna `accountId` 1:1, NO tabla puente.** *Único
    apartamiento deliberado del RFC 024 §4*, declarado dentro del propio RFC. *Por qué:* dos cuentas
    espejo sobre el mismo inmueble lo meterían **dos veces en el patrimonio neto**, y el
    `unique (assetId, currency)` de `card_accounts`/`loan_accounts` **no impide la segunda fila** —
    dos divisas distintas lo satisfacen. Con columna, el doble conteo es imposible por construcción.
5.  **El evento toca el libro sólo al cobrar**, contra `4.1.05 Reintegros y devoluciones`, que **ya
    existe y no tiene subcategorías** (`initialCatalog.ts:220`), así que resuelve por
    `resolveToLeaf()` a su hoja `General` — mismo camino que el 008 para los intereses de un préstamo
    dado, con respaldo `findOrCreateTypeGeneralLeaf`. *Se descartó apoyarse en `loans` con
    `direction: 'lent'`*, que modela exactamente lo mismo, **por un detalle de implementación**:
    `loansActions.ts:141` crea una cuenta contable por préstamo, y diez asados con cuatro amigos
    serían cuarenta cuentas en el plan.

## Datos que el contraste dejó verificados y sirven para otras rondas

*   **`getNextCode( type )`** (`accounting/utils/accountCodes.ts:16-25`) mapea `asset → 1.1.01.`,
    `liability → 2.1.01.`, `equity → 3.1.01.`, `revenue → 4.1.01.`, `expense → 5.1.01.`, con respaldo
    `9.9.99.`. **Los dos instrumentos lo usan sin prefijo propio**: `cardsActions.ts:139`,
    `loansActions.ts:141`.
*   **La cuenta de patrimonio se resuelve así**: `code === "3.1.01.01"` **con respaldo
    `type === "equity"`** (`cardsActions.ts:112`). La crea `seed.ts:373-378`, y una organización
    creada por fuera del seed puede no tenerla.
*   **El catálogo inicial NO tiene cuentas patrimoniales** (1.x/2.x/3.x): sólo categorías de ingreso
    (4.x) y gasto (5.x). Las patrimoniales nacen dinámicamente.
*   **`AccountsContainer` tiene dos filtros distintos y es fácil confundirlos:** `walletAccounts`
    (`:74`) y `totalAssets` (`:97`) alimentan el patrimonio neto — una cuenta espejo **debe** seguir
    contando ahí; `cardAccountIds`/`loanAccountIds` (`:87-92`, usados en `:338-339`) la sacan de la
    **lista visible**. Todo instrumento nuevo suma un tercer conjunto.

## Lo que queda encolado detrás de estos dos

*   **El neto por contacto en `/contacts`** ahora tiene **dos** fuentes: préstamos (§9 del 008) y
    eventos (§9 del 003). **Quien lo escriba tiene que sumar las dos** o muestra la mitad.
*   **Inquilinos, incidencias y cap rate**, escindidos (§8 del 010).
*   **La liquidación entre usuarios distintos** que el 003 de junio daba por resuelta: supone que dos
    organizaciones se ven entre sí y el modelo multi-tenant no lo permite. La reescritura modela el
    evento **desde el lado del organizador**; el flujo real necesita propuesta propia.
