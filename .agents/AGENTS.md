# Reglas del Proyecto para Agentes de IA

Este archivo contiene instrucciones, restricciones y directrices operativas específicas para este espacio de trabajo que todos los agentes inteligentes (incluidos asistentes de codificación como Antigravity) deben seguir obligatoriamente.

---

## 1. Restricción de Acceso Crítica

> [!CAUTION]
> **ESTÁ ESTRICTAMENTE PROHIBIDO LEER, ESCRIBIR, LISTAR O ACCEDER DE CUALQUIER FORMA A LA CARPETA `migracion/` Y SUS CONTENIDOS.**
> 
> *   Ninguna herramienta de búsqueda (como `grep_search`), lectura de archivos (`view_file`), listado (`list_dir`) o modificación de archivos debe ejecutarse sobre el directorio `migracion/` o sus subcarpetas.
> *   Esta regla es absoluta y no debe omitirse bajo ninguna circunstancia sin autorización explícita y directa del usuario por escrito.

---

## 2. Directrices de Arquitectura (Feature-Driven Architecture)

*   Seguir estrictamente la distribución definida en el archivo de arquitectura [ARCHITECTURE.md](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/ARCHITECTURE.md).
*   **Código de Características (Features):** Debe ubicarse modularizado por dominio de negocio dentro de `src/features/{nombre_feature}/`. Cada carpeta de feature encapsula sus propios componentes de React, helpers lógicos, servicios de API y esquemas de Drizzle (`schema.db.ts`).
*   **Rutas e Interfaz de Next.js:** Se ubican en [src/app/](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/app). Las páginas y layouts actúan únicamente como contenedores/enrutadores que importan y renderizan las características de la carpeta `features/`.
*   **Recursos Globales Compartidos:** Deben ubicarse en `src/shared/` (ej: componentes base de UI en `shared/components`, conexión central de DB en `shared/db`, helpers matemáticos globales en `shared/lib` y lógica contable transversal en `shared/services`).


---

## 3. Normas de Testing

*   Todas las pruebas nuevas deben ubicarse junto al código fuente correspondiente (ej: `nombre.ts` al lado de `nombre.test.ts`).
*   Los tests deben crearse en [src/features/](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/features) (para lógica modular de features), en [src/shared/lib/](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/lib) o en `src/shared/services/` para que Vitest los detecte automáticamente de acuerdo con el archivo [vitest.config.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/vitest.config.ts).
*   El entorno por defecto de pruebas es `"node"`. Si se requiere simular DOM, usar `// @vitest-environment jsdom` en la primera línea del archivo de test respectivo en lugar de alterar la configuración global.

---

## 4. Estilo de Código y Documentación

*   Utilizar **TSDoc** para documentar clases, interfaces, tipos y funciones públicas nuevas.
*   **Reglas de Espaciado Estricto de Delimitadores (`( )`, `{ }`, `[ ]`, `< >`):**
    *   **Delimitadores Exteriores:** Si un delimitador es el contenedor más externo de una expresión o bloque sintáctico en una línea, debe llevar un espacio en sus extremos internos: `( expr )`, `[ item ]`, `{ key: val }`, `< Type >`. Esto aplica a delimitadores que, aun estando anidados en bloques multilínea, sean el contenedor más externo **en esa línea física en particular** (ej: `dbCredentials: { url: process.env.DATABASE_URL! } ,`).
    *   **Delimitadores Anidados:** Si un delimitador está físicamente dentro de otro en la misma línea, sus extremos internos no llevan ningún espacio: `(inner)`, `{inner}`, `[inner]`, `<inner>` (ej: `dotenv.config( {path: ".env.local"} ) ;`).
    *   **Multilínea:** Si se desglosa en varias líneas, se usa salto de línea e indentación estándar en lugar de espaciados internos.
    *   **Excepciones de Control:** Las estructuras condicionales `if(condicion)` y bucles `for(iterador)` no llevan espacios internos en sus límites de paréntesis. *Excepción:* Los early returns con condiciones muy simples y cortas escritos inline en una única línea física sí llevan espacios internos en la condición, ej: `if( err ){ return( reject(err) ) ; }`.
    *   **Punto y coma:** Siempre se coloca exactamente un espacio antes de cada punto y coma: `const a = 1 ;`.
    *   **Comas:** Las comas van siempre aisladas por espacios a ambos lados: `func( a , b , c )`. No se debe colocar coma final (trailing comma) al último elemento de una lista de propiedades de un objeto literal si no es multilínea o si cierra el bloque del objeto.
    *   **Retornos (`return`):** Siempre se envuelve el retorno como `return( expresion ) ;` (sin espacio antes de `(`, y respetando la regla de espaciado en la expresión interna). *Excepción:* En retornos de promesas que envuelven funciones flecha, ej: `return( new Promise( (resolve , reject) => {`, se admite la sintaxis habitual del constructor.
*   **Alineación Horizontal de Columnas por Contexto (Visual Grid Layout):**
    *   Si líneas consecutivas vecinas tienen una estructura similar (ej: asignaciones, tipos en interfaces, columnas en esquemas, desestructuraciones, llamadas repetitivas o importaciones simples), se alinea verticalmente en bloque su estructura homóloga (los `=`, `:`, `,`, los cierres `)`, los encadenamientos o el operador `from` de los `import`) rellenando con espacios para formar columnas uniformes (ej: alineando el `from` en `import path   from "path"`).
*   **Criterio de Organización y Ordenamiento de Imports:**
    *   **Configuración y Librerías Externas:** Deben ubicarse siempre al inicio del archivo.
    *   **Importaciones Locales y del Proyecto (`@/...`):** Deben agruparse en bloques coherentes según su dominio de negocio o feature (ej: por módulo o capa) separados por una línea en blanco. Cada bloque de importaciones (locales o externas) debe ser precedido por un comentario aclaratorio descriptivo (ej: `// Librerías externas`, `// Feature: Auth`).
    *   **Orden por Longitud (Pirámide Invertida):** Dentro de cada bloque de importaciones locales/del proyecto, las líneas deben ordenarse obligatoriamente de mayor a menor longitud física de línea.
    *   **Imports Simples (monoImport):** Si hay importaciones simples consecutivas dentro de un grupo, estas se alinean además por su palabra clave `from`. Las destructuradas (con `{ }`) no se alinean de esta forma pero sí se ordenan por su longitud física.
*   **Expresiones Lógicas Complejas:**
    *   Al combinar sub-expresiones de comparación con `&&` o `||`, aísla cada comparación entre paréntesis `( ... )`. Al estar anidados, no llevan espacios internos: `(a === b)`.
    *   Ejemplo `return`: `return( (user.role === "admin") || (user.role === "owner") ) ;`
    *   Ejemplo `if`: `if( !((a === b) || (c === d)) ){`
