---
name: decisiones-modelo-clasificacion
description: Sesión de diseño abierta el 2026-09-09 sobre categorías, transacciones propuestas e instrumentos; dos temas cerrados y uno pendiente
metadata:
  type: project
---

**Hay una sesión de diseño abierta y sin terminar**, registrada en
`docs/diseno/rediseno-clasificacion-y-propuestas.md`. **Leer ese documento antes de retomar**: tiene
las decisiones con su fundamento, los defectos verificados y por dónde se sigue (su §4).

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

**How to apply:** el tema abierto es **instrumentos contra cuentas** (§4 del documento): el usuario
objetó que tarjetas y deudas estén modeladas como cuentas. Verificado que la cuenta de la tarjeta
aparece en `/accounts` mezclada con la caja de ahorro (`AccountsContainer.tsx:63`) y que
`createCardAction` emite un asiento de apertura contra Patrimonio, cuando una tarjeta no nace con
deuda. Nada de esto habilita código: primero se cierran los tres temas, después se escriben las
propuestas. Ver [[feedback-una-pregunta-por-vez]] para el método de la discusión.
