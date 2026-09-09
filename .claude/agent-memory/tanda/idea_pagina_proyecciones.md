---
name: idea-pagina-proyecciones
description: Idea del usuario (2026-09-09) para una página de proyecciones por tendencia sobre recurrencias reales, ajustable por inflación; sin discutir todavía
metadata:
  type: project
---

**Página de proyecciones**, idea del usuario el 2026-09-09. **No discutida todavía**: quedó
explícitamente aparcada para más adelante, no es alcance de la ronda en curso.

Lo que pidió, textual en sustancia: proyecciones **por tendencia**, estimadas **teniendo en cuenta
las recurrencias reales**, **ajustadas o no por inflación**.

**Why:** surgió al definir el modelo de propuestas recurrentes, cuando quedó establecida la regla de
que **no se registran supuestos futuros en la base** — sólo el período en curso. Las estimaciones
quedaron entonces como cálculo efímero sin filas, y de ahí salió la idea de darles una pantalla
propia donde vivir. Es la contracara natural de esa regla: si no se persisten, hay que calcularlas
en algún lugar visible.

**How to apply:** cuando se escriba el RFC de la página, arranca con dos insumos que ya existen:
las recurrencias reales (`subscriptions` y, más adelante, las cuotas del RFC 008) y la serie
histórica de `monthly_summaries`. El ajuste por inflación es lo único que no tiene fuente en el
repo hoy y necesita decisión propia (índice, origen del dato, si se guarda). No confundir esta
página con registrar supuestos: sigue siendo cálculo al vuelo. Se relaciona con
[[decisiones-modelo-propuestas]].
