# Traza de supuestos — metas de ahorro

Historia: «Quiero apartar plata para un objetivo —un viaje, un fondo de emergencia— y ver cuánto llevo ahorrado.»
Pedida por el usuario el 2026-10-06. Referencia visual: `/metas` de FinanzasMock (indicadores, tarjetas con barra de progreso, «Aportar ahorro»).
**Hay un RFC 011 `APPROVED` (2026-06-23) que está viejo:** usa `integer` y no `bigint`, importa un `features/accounts/schema.db` que no existe, no tiene divisa,
y es anterior al core contable. Hay que **reescribirlo y bajarle el sello a `DRAFT`**, como se hizo con el 008, el 010 y el 003.
Su idea de fondo se conserva: ahorro **virtual** apartado del saldo de una cuenta («reservas»), con un «saldo libre».

Estado: ronda 1, sin responder.

| # | Supuesto | Estado |
| :-: | :--- | :--- |
| 1 | Ruta `/goals`, rótulo «Metas» | asumido |
| 2 | Una meta tiene nombre, monto objetivo, divisa, fecha límite opcional y prioridad (normal o prioritaria) | asumido |
| 3 | El ahorro de una meta es **virtual**: se aparta una parte del saldo de una cuenta, no se mueve plata y **no se genera ningún asiento contable** | asumido |
| 4 | Aportar = apartar plata de una cuenta de activo hacia la meta; retirar = devolverla. La cuenta tiene que ser de la divisa de la meta | asumido |
| 5 | No se puede apartar más que el saldo libre de la cuenta (saldo − lo ya apartado) | asumido |
| 6 | El saldo libre se muestra en `/accounts`, junto al saldo de cada cuenta de activo | asumido |
| 7 | Si un gasto deja el saldo de la cuenta por debajo de lo apartado, no se bloquea: se avisa y esa reserva queda marcada como descubierta | asumido |
| 8 | Progreso = ahorrado ÷ monto objetivo; al llegar al 100 % la meta pasa sola a «completada» y se puede reabrir | asumido |
| 9 | Si hay fecha límite, la meta muestra el aporte mensual sugerido (restante ÷ meses que faltan); sin fecha, no hay sugerencia | asumido |
| 10 | Abandonar una meta devuelve todo lo apartado a su cuenta y la archiva | asumido |
| 11 | Gastar lo ahorrado no es una acción de metas: el usuario carga el gasto como un movimiento normal y después libera la parte apartada | asumido |
| 12 | Fuera: aportes automáticos y recurrentes, rendimientos o intereses, metas compartidas entre organizaciones, metas por categoría, imagen o emoji propio | asumido |
| 13 | `owner` y `member` crean, aportan y retiran; `viewer` sólo mira | asumido |
| 14 | Las reservas **no cambian el Patrimonio Neto** de Estadísticas: la plata sigue siendo del usuario | asumido |
| 15 | Lista de metas con indicadores arriba (total de metas, monto objetivo total, ahorrado total, completadas, por completar) y un filtro Todas / Activas / Completadas | asumido |
| 16 | Cada meta es una tarjeta con barra de progreso, monto ahorrado, objetivo, fecha y su historial de aportes | asumido |
| 17 | El alta y los aportes van en un modal cada uno | asumido |
| 18 | Los indicadores se calculan por divisa, con selector; no se suman divisas | asumido |
| 19 | Los datos: una tabla de metas y un registro de **movimientos de reserva** (aporte o retiro, monto, cuenta, fecha); lo apartado de cada cuenta y meta es la suma del registro; importes en centavos enteros; todo con `organizationId` | asumido |
| 20 | Sin metas: estado vacío que invita a crear la primera; ojito de privacidad, tres idiomas y celular primero | asumido |
