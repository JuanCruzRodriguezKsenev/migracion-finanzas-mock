---
name: suscripciones-busqueda-34
description: Plan 34 conexión de AddSubscriptionModal a buscarMarcas compartida, blindaje de directMatch sin domain, tests 15 y 16 y 5 mutaciones comprobadas
metadata:
  type: project
---

Plan 34 ejecutado completo sobre la rama activa `marcas-busqueda-compartida` (commit `3c2e5ff`).

**Lecciones y patrones de conexión de componentes a la búsqueda de marcas compartida**
- **Sufijos dinámicos por país en `buscarMarcas`:**
  - `AddSubscriptionModal` agrega `.tld` sólo si el país seleccionado tiene TLD definido y es distinto de `.com`. Al delegar en `buscarMarcas( cleanQuery , { sufijos } )`, si la consulta ya contiene un punto se omite la expansión automáticamente en la función compartida, manteniendo el comportamiento anterior de una sola consulta.
- **Blindaje ante respuestas parciales de `/api/brand` (`directMatch`):**
  - Si `/api/brand?domain=...` responde 200 pero carece de `domain` o `name` (o vienen como cadenas vacías), asumir que `directMatch.domain.toLowerCase()` es seguro causa un `TypeError: Cannot read properties of undefined` no capturado.
  - La guarda robusta exige que ambos campos sean cadenas de texto no vacías; en caso contrario, se descarta el `directMatch` sin alterar los resultados devueltos por Brandfetch y sin lanzar excepciones.
- **Exclusión posterior de dominios directos en lugar de sembrado inicial en `Set`:**
  - Al separar la llamada compartida de la rama directa, excluir la coincidencia directa de los resultados iterando la lista resultante (`!dominioDirecto || (marca.domain.toLowerCase() !== dominioDirecto)`) preserva el orden prioritario del dominio directo al inicio sin alterar la deduplicación interna de `buscarMarcas`.
- **Preservación estricta de tests previos:**
  - Agregar nuevos casos al final de la suite verificando con `git diff -U0 ... | grep -c "^-[^-]"` que dé `0` asegura que los tests de regresión previos no sufran relajaciones ni modificaciones inadvertidas.
- **Pruebas de mutaciones con refactor de código de producción:**
  - Cuando un plan introduce cambios de producción antes de ejecutar mutaciones sobre ese mismo archivo, se debe respaldar el código refactorizado antes de mutar para que la restauración entre mutaciones vuelva siempre a la base refactorizada limpia.
