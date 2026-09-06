# 0001. Adopción de Registros de Decisiones de Arquitectura (ADR)

* **Fecha:** 2026-09-06
* **Estado:** Aceptado
* **Autores:** Equipo de Ingeniería FinanzIA

---

## Contexto y Planteo del Problema
FinanzIA cuenta con un catálogo de 20 propuestas técnicas en `docs/proposals/` que definieron la arquitectura inicial. Sin embargo, a medida que el sistema evoluciona mediante refactorizaciones y correcciones (como la migración de Sparklines a `SparklinePoint[]`, la adopción de `useSyncExternalStore` o la validación estricta de entorno con Zod), las decisiones operativas y de diseño quedan dispersas en commits y mensajes de pull request sin un registro unificado cronológico.

## Decisión
Adoptamos el formato estándar de **Architecture Decision Records (ADR)** ubicado en `docs/adr/` para documentar de forma acumulativa y versionada cualquier decisión técnica o de diseño que afecte a dos o más módulos o modifique el comportamiento del sistema.

Cada ADR nuevo se numerará correlativamente y seguirá la plantilla definida en `docs/adr/template.md`.

## Alternativas Consideradas
* **Mantener solo `docs/proposals/`:** Las propuestas (RFC) son extensas y adecuadas para diseños desde cero, pero excesivamente pesadas para decisiones puntuales de evolución o refactorización.
* **Documentar solo en mensajes de commit:** Inaccesible como índice consultable y difícil de mantener sincronizado ante cambios de equipo.

## Consecuencias
### Positivas
* Registro histórico trazable de las razones detrás de cada cambio arquitectónico.
* Facilitación del onboarding para nuevos desarrolladores y agentes de IA.
* Claridad en las compensaciones (*trade-offs*) aceptadas.

### Negativas / Riesgos
* Requiere disciplina continua para redactar el registro en el mismo commit donde se toma la decisión.
