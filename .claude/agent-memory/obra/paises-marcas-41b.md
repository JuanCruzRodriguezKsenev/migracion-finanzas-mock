---
name: paises-marcas-41b
description: Plan 41b resolución y validación de países en búsqueda de marcas, mock de Intl.DateTimeFormat en Node 26/jsdom y comportamiento de select en React
metadata:
  type: execution-lessons
---

# Plan 41b: La búsqueda de marcas respeta el país elegido

## Resumen de ejecución
- **Alcance cumplido:** Mapeo de códigos ISO a sufijos y nombres de países con `countries.json` centralizado en `src/shared/data/` y módulo `paisBusqueda.ts`; validación regex `^[A-Za-z]{2}$` con 400 en `/api/brand`; remoción de `sufijos` y `construirConsultas` en `brandSearch.ts`; detección de país en `CreateFinancialEntityForm.tsx` priorizando zona horaria antes que idiomas y validando pertenencia a `COUNTRIES`; eliminación de `sufijos` en `AddSubscriptionModal.tsx`; suite `paisBusqueda.test.ts` (4 tests); tests 5, 6 y 7 en `brand.route.test.ts`; reescritura del test 11 en `CreateFinancialEntityForm.test.tsx`; 5 mutaciones comprobadas y revertidas; batería oficial delegada a `verificador` en verde (172 suites, 1568 tests, 0 lint warnings, 0 type errors, build OK). Commit de código `be1fc79` en rama `marcas-39b` y commits de estado e informe en la bóveda (`03119a0` y `02e0af4`).

## Lecciones aprendidas para futuros planes y para `tanda`

1. **Simulación de `Intl.DateTimeFormat` en Node 26 / jsdom:**
   - En Node 26 y el entorno jsdom de Vitest, las instancias creadas con `new Intl.DateTimeFormat()` inicializan `resolvedOptions` como propiedad propia ligada (`[Function: bound resolvedOptions]`) en lugar de delegar al prototipo.
   - Espiar `Intl.DateTimeFormat.prototype.resolvedOptions` mediante `vi.spyOn( Intl.DateTimeFormat.prototype , "resolvedOptions" )` no intercepta llamadas a instancias creadas posteriormente en el componente.
   - Solución limpia: espiar el constructor `Intl.DateTimeFormat` directamente (`vi.spyOn( Intl , "DateTimeFormat" )`) retornando un objeto simulado con `resolvedOptions: () => ({ ...baseOptions, timeZone: "..." })`.

2. **Comprobación de valores no soportados en elementos `<select>`:**
   - En HTML y jsdom, un `<select>` de React con `value` que no coincide con ninguna opción `<option>` disponible no refleja ese valor no emparejado en `select.value` (el DOM selecciona por defecto la primera opción disponible o `""`).
   - Para verificar en pruebas que el componente descartó un país no soportado (como `"de"` no listado en `COUNTRIES`), no alcanza con leer `selectorPais().value`; se debe comprobar que la acción disparada por el componente (en este caso el autocompletado que consulta `/api/brand?q=...&pais=...`) utilice efectivamente el fallback esperado (`pais=ar`).
