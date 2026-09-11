---
name: decisiones-modelo-clasificacion
description: Sesión de diseño del 2026-09-09 sobre categorías, transacciones propuestas e instrumentos; qué propuestas salieron ya, cuáles faltan, y qué partes del documento envejecieron mal
metadata:
  type: project
---

**Sesión de diseño cerrada el 2026-09-09**, registrada en
`docs/diseno/rediseno-clasificacion-y-propuestas.md`. **Leer ese documento antes de retomar**: tiene
las decisiones con su fundamento, los defectos verificados y el §7 con las propuestas que faltan
escribir. Los tres temas están decididos; quedan bordes abiertos anotados dentro de cada uno.

**Why:** la ronda iba a ser suscripciones al libro mayor (RFC 004) y al investigar aparecieron tres
decisiones de arquitectura sin tomar y sin RFC. **El hallazgo que reordenó todo:** la app no puede
responder *de dónde viene cada cosa* —su propósito declarado por el usuario— porque las estadísticas
agrupan por tipo de cuenta contable y **nadie agrupa por categoría en ningún lado**. Hay tres
registros de categoría en el proyecto y ninguno cumple función.

**Lo decidido, en una línea cada uno:**

*   **Categoría y cuenta contable son la misma cosa**, un solo árbol de dos niveles. Los padres
    agrupan y sólo las hojas reciben movimientos (hoja `General` automática). No se borra, se
    archiva. Una categoría agrupa una cuenta por divisa, con el patrón `cards` → `card_accounts`.
*   **Lo propuesto vive fuera del libro mayor**, que guarda sólo hechos. La bandeja tiene sólo lo no
    resuelto: al confirmar nace el asiento y la pendiente se borra, sin duplicar historial.
*   **Regla del usuario:** se registra lo que ocurrió o lo que está ciertamente comprometido; **no se
    registra lo que se supone que va a pasar**. Cuotas = compromiso cierto, se cargan enteras.
    Suscripción del mes que viene = supuesto, se resuelve de a una.

*   **La navegación sigue al instrumento, no al plan de cuentas** (§4). **`/accounts` es el directorio
    por entidad**: se entra por Galicia y se ven sus cuentas, sus tarjetas y sus préstamos. `/cards`,
    `/debts` y la página de patrimonio (propiedades, autos) son transversales y aparte. Un
    instrumento aparece **dos veces, en dos ejes** —quién lo emite y qué tipo de cosa es—, y eso es
    deliberado. **El Patrimonio Neto se muda a la página de estadísticas**, junto con las categorías.

## Estado de las 7 propuestas del §7 (al 2026-09-10)

| Propuesta | Estado |
| :--- | :--- |
| Transacciones propuestas | **RFC 023, `APPROVED` y entregado** |
| Clasificación unificada | **RFC 022, `APPROVED` y entregado** |
| Enmienda al RFC 004 | **Hecha** (§3 y §4 revocadas) |
| Instrumentos y navegación por entidad | **RFC 024, `DRAFT`** — escrito el 2026-09-10, esperando aprobación |
| Reescritura del RFC 008 | Pendiente. Referencia al 024: va después |
| Enmienda al RFC 010 | Pendiente. Referencia al 024: va después |
| Enmienda al RFC 003 | Pendiente |

## ⚠️ El §4 del documento de diseño envejeció mal — contrastar antes de citarlo

Al escribir el RFC 024 se verificó el §4 contra el código y **tres de sus afirmaciones ya no son
ciertas**. El documento es del 2026-09-09 y el repo se movió mucho desde entonces:

*   **«`/accounts` agrupa por `type` contable en vez de por instrumento»** — falso. Ya agrupa por
    entidad (`AccountsContainer.tsx:67-84`) y ya tiene dos tabs. El síntoma real es más acotado: la
    línea 64 mete `asset` y `liability` en la misma colección.
*   **«`/cards` no figura en el `Navbar`»** (§4bis) — falso. Figura (`Navbar.tsx:121`), y `/settings`
    también.
*   **El «Saldo Neto» por entidad anotado como sospechoso** — está **bien**. `sum + a.balance` sin
    discriminar tipo es justamente la fórmula correcta, porque los pasivos vienen negados. El que sí
    está roto es el Patrimonio Neto (`:87-89`), que resta en vez de sumar.

**How to apply:** el documento sirve por sus **decisiones y fundamentos**, que siguen válidos; sus
**observaciones sobre el estado del código, no**. Contrastar cada una antes de escribirla en un RFC.
Lo mismo vale para el **RFC 008** (junio 2026: `integer` para dinero y un `remainingBalance` que
duplica `accounts.balance`) y el **RFC 010** (siete columnas monetarias en `integer`). La página de
estadísticas sigue **sin RFC y sin nombre de ruta elegido**.
Ver [[feedback-una-pregunta-por-vez]] para el método de la discusión.
