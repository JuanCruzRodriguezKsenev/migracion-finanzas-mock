# Memoria de `tanda` — FinanzIA

Índice. Lo aprendido en rondas anteriores: consultar antes de investigar de cero, actualizar al
cerrar cada ronda. El detalle vive en los archivos enlazados, no acá.

## Dónde quedó todo

- [Login con Google roto: Neon desalineada](login_google_neon_desalineada.md) — plan 28 listo para `obra`; WIP de marcas en stash (2026-10-09).
- [Estado al cerrar 2026-10-08](estado_2026-10-08.md) — master pusheado, Neon desalineada (plan 28), plan 29 en obra; **Vercel despliega por push**.

- [Estado al cerrar la última ronda](estado_actual.md) — plan 02 integrado a master (2026-10-06); rama `feat/acceso-1-aprovisionamiento` lista para `obra`. **Contrastar con `git log`.**

- [Serie «acceso con Google»](acceso_con_google_serie.md) — spec aprobada + 5 planes escritos (2026-10-06, commit 451d0b0); el plan 0 sigue sin ejecutar y precede.

- [La bóveda de Obsidian, pendiente en los agentes](boveda_obsidian_pendiente_en_agentes.md) — diseño de forja decidido (2026-09-26), sin aplicar a tanda/obra; este repo sigue en `docs/`.

- [Planes 33 y 34: búsqueda de marcas](marcas_planes_33_34.md) — módulo de funciones y no hook; misma rama; qué duplicación queda (2026-10-08).

- [Brandfetch se elimina; plan 40 reescrito](marcas_sin_brandfetch.md) — nombre→dominio vs dominio→ícono, lo medido, plan 41 pendiente (2026-10-09).

## Antes de planificar

- [Trampas del repo](trampas_del_repo.md) — verificación, migraciones que rompen fixtures, RFCs viejos con esquemas previos al core contable, signo de pasivos, y código que los docs dicen que existe y no.
- [Patrones que conviene reusar](patrones_reusables.md) — `Result` con `value`, bloqueo `FOR UPDATE`, contenedores server-driven, aislamiento multi-tenant, vitest. Nombrarlos con archivo y línea en el plan.
- [Tests de componentes cliente](testing_de_componentes_cliente.md) — qué mockea el setup global y qué se monta real; `vi.hoisted`, dict real, provider real.
- [Las tres trampas de `seed.ts`](trampas_del_seed.md) — su limpieza queda atrás de cada feature, nunca escribió `occurredAt`, y los «doce meses de historia» no existen.
- [Postgres caído se disfraza de bug](entorno_postgres_caido.md) — `AggregateError` + 401 en login, o suite roja: suele ser `postgres-dev` apagado. Chequearlo primero.

## Decisiones tomadas

- [Rediseño de clasificación y propuestas](decisiones_modelo_clasificacion.md) — sesión **cerrada y con sus siete propuestas escritas** (2026-09-12): categoría = cuenta contable, propuestas fuera del libro, navegación por instrumento.
- [RFC 008 — préstamos y `/loans`, `APPROVED`](decisiones_rfc008_loans.md) — bidireccional, sin `remainingBalance`; categoría de intereses fija por código; y los pasos corridos de su §4.2.
- [RFC 025 — compras en cuotas con tarjeta](decisiones_rfc025_cuotas_tarjeta.md) — una cuota por mes y no el total al comprar; la asimetría declarada con el 008 y quién la cierra.
- [RFC 012 — la API de ingreso de asientos, reescrita](rfc012_api_de_ingreso.md) — y la maquinaria de idempotencia que ya existe y no usa nadie.
- [Los eventos se van a una app aparte](decision_eventos_app_aparte.md) — RFC 003 `SUPERSEDED`, la puerta es el RFC 012 (aprobado sin construir), y `/contacts` no muestra importes.
- [RFC 010 y RFC 003, reescritos y en `DRAFT`](decisiones_rfc010_y_rfc003.md) — patrimonio físico y eventos: por qué se les bajó el sello, el revalúo contra patrimonio, y el único apartamiento del 024 §4.
- [RFC 022 — clasificación unificada, ya implementado](rfc022_clasificacion_unificada.md) — hoja `General` (.99), resolución padre→hoja, cascada de archivado, y los cabos que dejó.
- [i18n del panel de categorías](i18n_panel_de_categorias.md) — cómo se traduce de verdad en este repo, por qué los errores del servidor quedan fuera, y el `patterns.md` que miente.
- [Feature `profile`](feature_profile.md) — los códigos canónicos ya se migraron; por qué las preferencias todavía no afectan a nada y qué quedó abierto.
- [Cómo levantar los repos hermanos](repos_hermanos_como_levantarlos.md) — FinanzasMock está atado a Neon: sin base, con bypass de login. Y qué hay adentro de cada uno.

## Cómo trabajar

- [Carriles en paralelo](carriles_en_paralelo.md) — worktree + base propia por carril; qué planes son independientes; choque de migraciones.

- [El ciclo: preparar a `obra`, cerrar una rama, qué forma de plan sale limpia](ciclo_de_trabajo.md) — árbol limpio antes del traspaso, fast-forward sin merge commits, y la tabla "lo que NO hay que construir".
- [Mientras corre `verificador`, el árbol no se toca](verificacion_no_tocar_el_arbol.md) — `pgrep` no prueba que terminó; sólo su notificación. Y cómo diagnosticar una suite "intermitente".

- [Reglas para lanzar `obra`](feedback_lanzar_obra.md) — hasta 2 a la vez, sonnet medium; **orden vigente: no lanzar más al terminar los actuales**.

## Cómo consultarle al usuario

- [Una pregunta por vez en diseño](feedback_una_pregunta_por_vez.md) — decisiones de arquitectura: una sola, con el impacto analizado antes. "Haceme las preguntas que necesites" no es permiso para agrupar.
- [El mapa completo primero, la decisión después](preferencias_consulta_mapa_primero.md) — y si corta con "pará", contestá eso antes de volver.

## Ideas aparcadas

- [Cargar movimientos por otra persona, con autoría](idea_cargar_por_otro.md) — idea del 2026-10-06, Deuda §16; pide spec nueva, depende de la autoría por movimiento.

- [Página de proyecciones](idea_pagina_proyecciones.md) — por tendencia sobre recurrencias reales, ajustable por inflación. Sin discutir; idea del 2026-09-09.
