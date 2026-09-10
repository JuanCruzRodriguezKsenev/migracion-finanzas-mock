# Memoria de `tanda` — FinanzIA

Índice. Lo aprendido en rondas anteriores: consultar antes de investigar de cero, actualizar al
cerrar cada ronda. El detalle vive en los archivos enlazados, no acá.

## Dónde quedó todo

- [Estado al cerrar la última ronda](estado_actual.md) — ramas sin consolidar, qué está verificado, qué está en vuelo y qué hay sobre la mesa. **Contrastar con `git log` antes de actuar.**

## Antes de planificar

- [Trampas del repo](trampas_del_repo.md) — verificación, migraciones que rompen fixtures, RFCs viejos con esquemas previos al core contable, signo de pasivos, y código que los docs dicen que existe y no.
- [Patrones que conviene reusar](patrones_reusables.md) — `Result` con `value`, bloqueo `FOR UPDATE`, contenedores server-driven, aislamiento multi-tenant, vitest. Nombrarlos con archivo y línea en el plan.
- [Postgres caído se disfraza de bug](entorno_postgres_caido.md) — `AggregateError` + 401 en login, o suite roja: suele ser `postgres-dev` apagado. Chequearlo primero.

## Decisiones tomadas

- [Rediseño de clasificación y propuestas](decisiones_modelo_clasificacion.md) — sesión **cerrada**: categoría = cuenta contable, propuestas fuera del libro, navegación por instrumento. Faltan las propuestas.
- [RFC 022 — clasificación unificada, ya implementado](rfc022_clasificacion_unificada.md) — hoja `General` (.99), resolución padre→hoja, cascada de archivado, y los cabos que dejó.
- [Feature `profile`](feature_profile.md) — los códigos canónicos ya se migraron; por qué las preferencias todavía no afectan a nada y qué quedó abierto.
- [Cómo levantar los repos hermanos](repos_hermanos_como_levantarlos.md) — FinanzasMock está atado a Neon: sin base, con bypass de login. Y qué hay adentro de cada uno.

## Cómo trabajar

- [El ciclo: preparar a `obra`, cerrar una rama, qué forma de plan sale limpia](ciclo_de_trabajo.md) — árbol limpio antes del traspaso, fast-forward sin merge commits, y la tabla "lo que NO hay que construir".
- [Mientras corre `verificador`, el árbol no se toca](verificacion_no_tocar_el_arbol.md) — `pgrep` no prueba que terminó; sólo su notificación. Y cómo diagnosticar una suite "intermitente".

## Cómo consultarle al usuario

- [Una pregunta por vez en diseño](feedback_una_pregunta_por_vez.md) — decisiones de arquitectura: una sola, con el impacto analizado antes. "Haceme las preguntas que necesites" no es permiso para agrupar.
- [El mapa completo primero, la decisión después](preferencias_consulta_mapa_primero.md) — y si corta con "pará", contestá eso antes de volver.

## Ideas aparcadas

- [Página de proyecciones](idea_pagina_proyecciones.md) — por tendencia sobre recurrencias reales, ajustable por inflación. Sin discutir; idea del 2026-09-09.
