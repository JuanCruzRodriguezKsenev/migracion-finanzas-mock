---
name: presupuestos-2-pagina
description: Lecciones del plan 12 (página /budgets): huecos del plan 11 que obligaron a desviarse (minKey, divisas con presupuesto), trampas de MetricCard hero y ojito.
metadata:
  type: project
---

Plan 12 salió sin paradas; 44 tests nuevos, batería verde (653 tests, 87 suites). No se hizo el checklist del navegador (queda al usuario).

- El contrato de `getBudgetsAction` (plan 11) no daba `minKey` ni "divisas con presupuesto": se omitió `minKey` (spec A2 lo pide habilitado) y la página llama al repositorio. **Why:** plan de página escrito sin revisar qué devolvía la acción. **How to apply:** al ejecutar un plan de página, cotejar primero qué datos entrega la acción.
- `MetricsSection.hero` enmascara siempre el valor (MetricCard `isSensitive` por defecto); para mostrar % con ojito cerrado usar `heroComponent` con `MetricCard variant="hero" isSensitive={false}`. `progressBar` sólo se pinta en variante hero.
- Tests del ojito: envolver en `MetricsVisibilityContext.Provider` con `isContentVisible:false`; `MetricsSection allowVisibilityToggle` lo respeta.
- `PageHeader.currentMonthKey` define también `maxKey`: pasar el mes en curso, no el seleccionado.
- `CurrencySelector` de reports es genérico y se importa tal cual.
- Edición de JSON de diccionarios con python `json.dumps(indent=2, ensure_ascii=False)` conserva el formato exacto.
