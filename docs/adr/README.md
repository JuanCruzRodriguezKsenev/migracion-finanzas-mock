# Registros de Decisiones de Arquitectura (ADRs)

Este directorio almacena los Registros de Decisiones de Arquitectura (**Architecture Decision Records - ADRs**) de FinanzIA.

## ¿Qué es un ADR?
Un ADR es un documento breve que captura una decisión arquitectónica significativa tomada en el proyecto, junto con su contexto, las alternativas consideradas y las consecuencias esperadas.

## Estructura de nombres
Los archivos se numeran correlativamente con cuatro dígitos seguidos de un slug descriptivo en minúsculas:
```
docs/adr/0001-registro-de-decisiones-arquitectonicas.md
docs/adr/0002-migracion-de-suscripciones-a-postgresql.md
```

## Estados posibles de un ADR
*   **Propuesto:** En discusión, sujeto a revisión.
*   **Aceptado:** Aprobado e implementado o en proceso de implementación.
*   **Rechazado:** Evaluado y descartado justificadamente.
*   **Superado:** Reemplazado por una decisión posterior (haciendo referencia al nuevo ADR).

## Plantilla
Para crear un nuevo ADR, copiar la estructura de [`template.md`](template.md).
