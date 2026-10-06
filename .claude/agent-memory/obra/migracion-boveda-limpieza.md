---
name: migracion-boveda-limpieza
description: Lecciones y discrepancias de la migración de documentos a la bóveda (plan 01)
metadata:
  type: reference
---

# Migración a la bóveda 2/2: limpiar el repo y apuntar a la bóveda

- **Sustitución de enlaces vs grep de comprobación:** La regla del Paso 5 prescribió sustituir un enlace markdown a `trabajo-en-vuelo.md` por el texto del enlace + `(~/Boveda/Proyectos/migracion-finanzas-mock/Estado.md)`. Como en los RFCs 003 y 008 el texto del enlace era `trabajo-en-vuelo.md` y `trabajo-en-vuelo.md:61`, la cadena `trabajo-en-vuelo` se conservó intencionalmente, lo que hace que el grep del Paso 8 (que buscaba `trabajo-en-vuelo` esperando `# vacío`) reporte esas menciones históricas preservadas.
- **Menciones en texto plano no contempladas explícitamente:** En el RFC 011:27 existía una mención en texto plano entre comillas invertidas (`(inventario de \`trabajo-en-vuelo.md\`, Fase 3)`), no en forma de enlace markdown. Se mantuvo intacta para no alterar el texto del RFC sin instrucción del plan.
- **Reducción de enlaces muertos:** La línea base previa arrojaba 48 enlaces rotos en el repositorio (mayormente por enlaces relativos a archivos que ya no existían o paths truncados en planes viejos). Tras la eliminación de documentos obsoletos y la corrección de rutas a la bóveda, los enlaces muertos se redujeron a 7, con 0 enlaces nuevos rotos (`comm -13` vacío).
- **Lección para tanda:** Al diseñar planes de migración documental que definen expresiones regulares para verificar que no queden referencias a archivos mudados, tener en cuenta si las reglas de sustitución preservan el texto original del enlace para evitar falsos positivos en las verificaciones de cierre.
