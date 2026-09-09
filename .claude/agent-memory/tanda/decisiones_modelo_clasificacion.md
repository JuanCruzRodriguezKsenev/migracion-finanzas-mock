---
name: decisiones-modelo-clasificacion
description: Sesión de diseño del 2026-09-09 sobre categorías, transacciones propuestas e instrumentos; los tres temas cerrados, faltan escribir las propuestas
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

**How to apply:** nada de esto habilita código: falta escribir las propuestas del §7. El **RFC 008 hay
que reescribirlo, no implementarlo** (junio 2026: `integer` para dinero y un `remainingBalance` que
duplica `accounts.balance`). La página de estadísticas y la de patrimonio **no tienen RFC ninguno**.
Ver [[feedback-una-pregunta-por-vez]] para el método de la discusión.
