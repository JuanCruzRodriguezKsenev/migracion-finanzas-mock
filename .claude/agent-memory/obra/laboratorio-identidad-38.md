---
name: laboratorio-identidad-38
description: Plan 38 integración del resolutor de identidad a la batería del laboratorio: fake timers y afterEach, mutaciones con respaldo, vi.importActual para fixtures y sanitización de dataUri
metadata:
  type: project
---

Plan 38 ejecutado hasta el §4 sobre la rama `marcas-identidad` (commit `63655a6`).

**Lecciones y patrones de testing y ejecución:**
- **Fake timers y `afterEach` con Vitest:**
  - Si un test activa `vi.useFakeTimers()` para saltarse pausas (`setTimeout`), cualquier aserción que falle antes de la línea `vi.useRealTimers()` deja los fake timers encendidos. Esto provoca que el siguiente test que utilice `waitFor` o `findBy*` espere indefinidamente hasta el timeout de 5000 ms. Se debe definir siempre `afterEach( () => { vi.useRealTimers() ; } )`.
- **Mutaciones en código en vuelo (sin commit previo):**
  - Nunca usar `git checkout -- <archivo>` para revertir una mutación temporal si el paso del plan todavía no fue commiteado en git: descarta todo el código recién escrito devolviendo el archivo al commit base. El patrón seguro es realizar una copia de respaldo (`cp file file.bak`), aplicar la mutación, validar el fallo del test y restaurar con `mv file.bak file`.
- **Testeo de listas fijas mockeadas con `vi.importActual`:**
  - Cuando un componente se prueba mockeando su archivo de configuración con un subconjunto chico (`vi.mock( "./bateria" , ... )` para acelerar los tiempos de test), las mutaciones sobre la lista real (ej. `bateria.ts`) no romperían ningún test a menos que se use `await vi.importActual< typeof import( "./bateria" ) >( "./bateria" )` en un test específico que fije el tamaño y los valores canónicos (ej. Banco Nación con `bna.com.ar`).
- **Sanitización de `dataUri` en exportación JSON:**
  - Al copiar al portapapeles estructuras con imágenes embebidas, clonar limpiamente y hacer `delete copia.icono.dataUri` tanto en la búsqueda individual como en cada fila de la matriz para evitar cadenas base64 gigantes en el portapapeles.
