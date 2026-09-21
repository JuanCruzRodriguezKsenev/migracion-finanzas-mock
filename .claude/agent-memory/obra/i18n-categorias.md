---
name: i18n-categorias
description: Lecciones aprendidas y evidencia de ejecución de la internacionalización de CategoriesSettingsContainer
metadata:
  type: reference
---

# Internacionalización de CategoriesSettingsContainer

- **Precisión del plan:** El plan `feat-i18n-categorias.md` detalló las 58 claves exactas en los 3 idiomas (`es`, `en`, `br`) y la tabla de correspondencia línea por línea. No hubo desvíos ni supuestos rotos.
- **Interpolación en UI:** El patrón canónico `.replace( "{clave}" , String( valor ) )` funciona sin helpers adicionales y sin librerías externas.
- **Patrón de tests con i18n:** Cargar el diccionario real con `dict = await getDictionary( "es" )` en `beforeAll` y asertar contra `dict.settingsPage.categories.*` garantiza que si se renombra una clave el test falla inmediatamente por tipos en compile-time (`tsc --noEmit`).
- **Deuda identificada:** Los 201 `fail()` en 13 archivos de acciones de servidor retornan mensajes directos en español consumidos por `FormError`. Requiere un RFC transversal para tipar códigos de error y parámetros interpolables en los diccionarios.
