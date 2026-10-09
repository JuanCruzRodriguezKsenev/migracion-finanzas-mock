---
name: busqueda-marcas-33
description: Plan 33 extracción de búsqueda de marcas compartida a brandSearch.ts y CreateFinancialEntityForm: funciones puras, deduplicación case-insensitive, suite brandSearch.test.ts y 7 mutaciones
metadata:
  type: project
---

Plan 33 ejecutado completo sobre la rama activa `marcas-busqueda-compartida` (commit `ab19e96`).

**Lecciones y patrones de extracción a servicios compartidos de marcas**
- **Funciones puras en lugar de hooks:**
  - Separar la receta de consulta (`construirConsultas`, `buscarMarcas`, `banderaDeDominio`) del ciclo de vida y rebote en React (`useState`, `useEffect`, `setTimeout`) permite reutilizar la lógica en componentes con diferentes estrategias de activación (ej: búsqueda reactiva continua vs búsqueda disparada bajo demanda por acción de usuario).
- **Deduplicación insensible a mayúsculas:**
  - La clave del `Set` de dominios vistos se normaliza con `toLowerCase()`, pero el objeto resultante conserva el `name`, `domain` e `icon` de la primera ocurrencia encontrada.
- **Ordenación estable por país prioritario:**
  - El comparador de `paisPrioritario` mantiene orden estable para empates devolviendo `0`, garantizando que dentro del grupo priorizado o dentro del grupo global se respete el orden original de variantes devuelto por la API.
- **Manejo de resiliencia ante errores de red:**
  - `buscarMarcas` captura tanto respuestas `!ok` como rechazos de promesa en cada variante individual devolviendo `[]` y filtrando respuestas que no sean arreglos, evitando propagar excepciones al componente cliente.
- **Comportamiento de suites completas y asincronismo ajeno:**
  - En ejecuciones concurrentes masivas de vitest (157 suites, 1403 tests), tests ajenos que hacen assertions sobre estado intermedio (como `SaldosPanel.test.tsx`) pueden sufrir condiciones de carrera momentáneas en `waitFor` que se despejan al ejecutarse de forma aislada o secuencial.
