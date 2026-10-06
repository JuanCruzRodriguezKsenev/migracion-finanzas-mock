# Traza de supuestos — presupuestos

Historia: «Quiero ponerle un tope mensual a lo que gasto en cada categoría y ver cuánto llevo gastado, para no pasarme.»
Pedida por el usuario el 2026-10-06. Referencia visual: `/presupuestos` de FinanzasMock (hero con % utilizado y restante, tres indicadores,
tabla por categoría con barra de progreso). **No hay RFC**: se escribe uno (RFC 028) después de la spec.
Depende de: la spec de estadísticas (la regla de qué cuenta como gasto es la misma) y de las categorías del RFC 022.

Estado: ronda 1, sin responder.

| # | Supuesto | Estado |
| :-: | :--- | :--- |
| 1 | Ruta `/budgets`, rótulo «Presupuestos» | asumido |
| 2 | Un presupuesto es un **límite mensual de gasto** para una categoría (padre u hoja), en una divisa | asumido |
| 3 | Sólo se presupuesta gasto; los ingresos no | asumido |
| 4 | Fuera: períodos que no sean el mes, arrastrar el sobrante al mes siguiente, avisos por correo o push, avisar al cargar un gasto, consejos automáticos, el widget del dashboard | asumido |
| 5 | Cambiar un límite rige desde el mes en curso; **los meses pasados conservan el límite que tenían** | asumido |
| 6 | El presupuesto de un padre cuenta el gasto de todas sus hojas; uno de una hoja y el de su padre conviven y se evalúan por separado | asumido |
| 7 | Qué cuenta como gasto es lo mismo que en Estadísticas: cuentas `expense`, sin reversados, mes en la zona del usuario, en la divisa del presupuesto | asumido |
| 8 | Estados: en orden (< 85 %), en alerta (de 85 % a 100 %) y excedido (> 100 %); el umbral es fijo | asumido |
| 9 | Restante = límite − gastado; si es negativo se muestra «excedido por X» | asumido |
| 10 | Como máximo un presupuesto vigente por categoría y divisa | asumido |
| 11 | Archivar una categoría no borra su presupuesto: se sigue viendo en los meses en que tuvo gasto, y no se crean nuevos sobre una archivada | asumido |
| 12 | Se puede presupuestar una categoría que todavía no tuvo gasto | asumido |
| 13 | `owner` y `member` crean, editan y eliminan; `viewer` sólo mira | asumido |
| 14 | Eliminar un presupuesto lo deja de evaluar desde el mes en curso; la historia de los meses pasados no se pierde | asumido |
| 15 | Arriba: un resumen con el % utilizado y lo restante del total (la suma de los límites de la divisa elegida) y tres indicadores: categorías excedidas, en alerta y días que quedan del mes | asumido |
| 16 | El selector de mes es el existente; por defecto el mes en curso; no hay meses futuros; un mes pasado muestra el resultado final | asumido |
| 17 | Una divisa a la vez, con selector, como Estadísticas | asumido |
| 18 | Una fila por categoría con barra de progreso, porcentaje y estado, ordenadas de mayor a menor porcentaje usado | asumido |
| 19 | El alta y la edición van en un modal: categoría (el selector jerárquico que ya existe), límite y divisa | asumido |
| 20 | Sin presupuestos: estado vacío que invita a crear el primero | asumido |
| 21 | Respeta el ojito de privacidad, los tres idiomas y el celular primero | asumido |
| 22 | Los datos: una tabla de presupuestos y una de límites con vigencia desde un mes; importes en centavos enteros; todo con `organizationId` | asumido |
