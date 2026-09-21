---
name: result-panel-categorias
description: Lecciones aprendidas y evidencia de ejecución del manejo de Result en CategoriesSettingsContainer
metadata:
  type: reference
---

# Manejo de Result en CategoriesSettingsContainer

- **Precisión del plan:** El plan `fix-result-panel-categorias.md` detalló con exactitud los 5 puntos a modificar (3 escrituras y 2 lecturas), los 2 puntos de renderizado de error y la reversión de `showArchived`. Las predicciones de conteo (`res.success` de 6 a 9, `await ...Action` de 3 a 0 en UI) se cumplieron de forma literal.
- **Separación estricta de canales de error:** Separar `formError` (para modales) de `actionError` (para el panel) evitó duplicación de nodos DOM y permitió aserciones unívocas con `screen.getByText( ERROR_SERVIDOR )`.
- **Patrón de verificación de fallos:** Simular `fail( ERROR_SERVIDOR )` en acciones de mutación comprobando `expect( getCategoryTreeAction ).not.toHaveBeenCalled()` asegura que la interfaz no procede a refrescar ni asume éxito tras un rechazo del backend.
- **Limpieza cruzada de errores:** `handleOpenArchiveModal` y `handleConfirmArchive` deben limpiar proactivamente los errores del canal opuesto para no arrastrar mensajes residuales entre formularios y panel.
