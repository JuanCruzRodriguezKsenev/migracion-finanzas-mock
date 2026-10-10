---
name: habilitaciones-propietarios-45
description: Plan 45 aviso en Habilitaciones sobre propietarios, tipo dict en componente cliente, nota incondicional y paridad de diccionarios
metadata:
  type: reference
---

# Lecciones del Plan 45 — Aviso en Habilitaciones sobre los propietarios

- **Planes explicativos sin cambio de reglas de negocio (RN-5, RN-6):** El plan 45 abordó una duda real de producto («el propietario no es detectado como miembro elegible para permitir transaccionar en mi nombre»). La lógica de servidor (`otorgarHabilitacionAction`, `listarHabilitacionesAction`, `titularService`) ya era correcta por diseño al restringir candidatos a `member`. La solución consistió exclusivamente en un texto neutro informativo bajo el subtítulo del panel, visible siempre (haya o no candidatos), sin alterar permisos ni añadir props por rol.
- **Propagación del contrato de `dict`:** En `HabilitacionesPanelProps`, el tipo `dict` tipa explícitamente las claves consumidas por el panel. Como el contenedor padre (`SettingsContainer.tsx`) suministra `dict.habilitaciones` directo del JSON y los tests usan `getDictionary("es").habilitaciones`, agregar `ownersNote: string` en la interfaz y en los tres archivos JSON `{es,en,br}.json` satisface el contrato de extremo a extremo sin necesidad de tocar los ancestros.
- **Comprobación de nota incondicional con mutación:** Se agregaron tests específicos para ambos estados (con candidatos y con cero candidatos junto al mensaje de lista vacía). La mutación consistente en omitir el párrafo `<p className={styles.note}>` rompió de forma inmediata ambos tests nuevos, confirmando la cobertura estricta del requisito.
