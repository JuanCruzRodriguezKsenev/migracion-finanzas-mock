# Traza de supuestos — página de estadísticas

Historia: «Quiero ver mis finanzas resumidas —cuánto entra, cuánto sale, en qué se me va la plata y cuánto valgo— para
tomar decisiones; y que mi contador pueda mirarlas.» Pedida por el usuario el 2026-10-06 (junto con presupuestos y metas).

Estado: ronda 1 aprobada «sin leer» (2026-10-06), los 22 supuestos. Spec escrita en [`spec.md`](spec.md), estado `draft`. Los RFC que ya fijan partes de esto **no son supuestos**, son contexto: RFC 022 §10 (el donut por
categoría es esta pantalla), RFC 024 §6 y §9 (el Patrimonio Neto se muda acá; la convención de signo de `monthly_summaries` y el
nombre de la ruta quedan para esta propuesta), RFC 025 §6 (el Patrimonio Neto resta las cuotas futuras). Referencia visual: `/reportes`
de FinanzasMock. Dependencia: el plan `fix-resumenes-mensuales` (los resúmenes derivados del libro).

| # | Supuesto | Estado |
| :-: | :--- | :--- |
| 1 | Ruta `/reports` (ya listada en `ARCHITECTURE.md` §4); rótulo visible «Estadísticas» | resuelto |
| 2 | Es sólo lectura: ninguna acción modifica datos, y un `viewer` la ve completa | resuelto |
| 3 | Fuera: reportes guardados, exportar, filtros por cuenta/tarjeta/contacto, proyecciones, inflación, comparar organizaciones | resuelto |
| 4 | Todo se calcula en **una divisa a la vez**, con selector; por defecto la de `profiles.currency`. Sin conversión (no hay cotizaciones guardadas) | resuelto |
| 5 | Ingresos y gastos salen sólo de cuentas de resultado: transferencias, cambios de divisa y aperturas no cuentan | resuelto |
| 6 | Un movimiento reversado no cuenta, ni como original ni como reversa, tampoco en el conteo de transacciones | resuelto |
| 7 | Ahorro neto = ingresos − gastos; tasa de ahorro = ahorro neto ÷ ingresos; sin ingresos se muestra «—», no 0 % | resuelto |
| 8 | El período es un mes calendario con el `MonthSelector` existente, comparado con el mes anterior; más una tendencia de los últimos 12 meses | resuelto |
| 9 | Gastos por categoría: donut con una porción por categoría padre (las 6 mayores y «Otras»); al elegir una se ve su desglose por subcategoría | resuelto |
| 10 | Un interruptor Gastos / Ingresos cambia el donut y la lista; el mismo componente para los dos | resuelto |
| 11 | «Top gastos»: los 5 movimientos de mayor monto del período, cada uno con su categoría y fecha | resuelto |
| 12 | Patrimonio Neto = activos + pasivos (pasivos negativos, como el motor, `patterns.md` §8) − cuotas futuras de tarjeta, en la divisa elegida | resuelto |
| 13 | El Patrimonio Neto se **retira de `/accounts`** en la misma tanda que lo muestra acá (RFC 024 §6) | resuelto |
| 14 | La convención de signo de `monthly_summaries.liabilitiesSnapshot` queda en la del motor (negativa) y se documenta en `patterns.md`; cierra el §9 del RFC 024 | resuelto |
| 15 | La evolución histórica sale de `monthly_summaries`; el mes en curso, las categorías y el top se calculan del libro en vivo | resuelto |
| 16 | No se agregan tablas ni columnas | resuelto |
| 17 | Sin movimientos en el período: estado vacío con mensaje, no gráficos en cero | resuelto |
| 18 | No se navega a meses anteriores al primer movimiento (precedente M3 de `TECHNICAL_DEBT.md`) | resuelto |
| 19 | Respeta el ojito de privacidad: importes como «••••••» (precedente S2) | resuelto |
| 20 | Textos en es/en/br desde el primer día; etiquetas de mes con `Intl` | resuelto |
| 21 | Pensada para el celular primero: sin tablas anchas, gráficos legibles en pantalla chica | resuelto |
| 22 | Recharts, con el estilo del dashboard; cada gráfico con su alternativa textual accesible | resuelto |

## Derivados al escribir la spec (no estaban en la lista aprobada)

Aparecieron al contrastar con el código; la spec los lleva como reglas y los marca para que el usuario los lea.

| # | Derivado | Dónde quedó |
| :-: | :--- | :--- |
| D-1 | Los flujos del dashboard y de `monthly_summaries` suman sólo un lado del asiento, así que lo reversado hoy **sí cuenta**; hay que corregirlo para cumplir el supuesto 6 | RN-6, RN-20, Dependencias 2 |
| D-2 | Reversar un asiento de un mes cerrado obliga a volver a derivar el resumen de ese mes | RN-21, Dependencias 3 |
| D-3 | El Patrimonio Neto es siempre el de hoy; la serie histórica se rotula «patrimonio según libro» | RN-15, RN-16 |
| D-4 | `monthly_summaries` no tiene divisa: la tendencia de una divisa no principal sale del libro en vivo | PA-2 |
| D-5 | Un asiento reversado en otro mes deja de reconciliar flujos contra saldo | PA-3, tabla de decisión fila 5 |
| D-6 | La cascada y el «Resumen por cuenta» del mock quedan fuera | PA-1 |
