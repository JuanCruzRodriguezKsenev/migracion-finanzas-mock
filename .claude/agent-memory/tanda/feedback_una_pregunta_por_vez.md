---
name: feedback-una-pregunta-por-vez
description: En decisiones de diseño, una sola pregunta por turno con su análisis de impacto antes; nunca tandas de preguntas simultáneas
metadata:
  type: feedback
---

**En discusiones de diseño, preguntar de a UNA, y poner el análisis de impacto ANTES de la
pregunta.** Nada de tandas de tres o cuatro `AskUserQuestion` juntas.

**Why:** el 2026-09-08, al definir el estado de propuesta de asientos, le mandé cuatro preguntas de
arquitectura en una sola llamada y las rechazó: *"la idea es ir pregunta a pregunta y que
analicemos el impacto de cada una antes de decidir a ciegas"*. Cada decisión de arquitectura
condiciona a la siguiente, así que preguntarlas todas juntas obliga a responder las últimas sin
saber cómo quedaron las primeras — y sin ver qué se rompe con cada opción.

**How to apply:** aplica cuando la decisión es de diseño y las opciones tienen consecuencias que
sólo se ven investigando el repo. El turno correcto es: investigo el radio de impacto real (quién
lee esto, cuántos archivos se tocan, qué se rompe) → lo expongo con las rutas y líneas concretas →
**una** pregunta → discutimos → recién ahí la siguiente.

Distinto es una tanda de preguntas **operativas** sobre trabajo ya mapeado (qué rama, qué toma la
próxima ronda, dónde va la deuda): ésas sí las aceptó juntas el mismo día, sin objeción. Ver
[[preferencias-consulta-mapa-primero]].
