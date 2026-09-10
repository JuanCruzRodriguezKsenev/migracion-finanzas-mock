---
name: preferencias-consulta-mapa-primero
description: Antes de cualquier AskUserQuestion, el usuario necesita el mapa de qué hay hoy y dónde está el hueco; y si corta con "pará", se contesta lo que preguntó antes de volver.
metadata:
  type: feedback
---

**El mapa completo primero, la decisión después.** No pongas un `AskUserQuestion` arriba de la mesa
hasta que el usuario tenga claro qué hay hoy y dónde está el hueco.

**Why:** el 2026-09-07 `forja` le disparó una consulta con cuatro opciones antes de explicar el ciclo
completo y lo cortó en seco (*"para para y entonces a `verificador` cuando lo uso?"*). Le faltaba una
pieza y no podía elegir sobre un mapa incompleto. Contestada esa pregunta, decidió todo en un solo
mensaje.

**How to apply:** el orden es *qué hay → cómo funciona → dónde está el hueco → recién ahí, qué
hacemos*. Y el mapa se arma **contrastando el repo**, con rutas y líneas, no de memoria.

**Cuando corta con "pará", no reinsistas con la pregunta:** contestá exactamente lo que preguntó, y
recién después volvé a lo tuyo.

Ver [[feedback-una-pregunta-por-vez]] para la cantidad de preguntas por turno.
