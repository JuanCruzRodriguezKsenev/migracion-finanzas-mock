# Reglas del Proyecto para Agentes de IA

Este archivo contiene instrucciones, restricciones y directrices operativas específicas para este espacio de trabajo que todos los agentes inteligentes (incluidos asistentes de codificación como Antigravity) deben seguir obligatoriamente.


> ## Por dónde empezar
>
> **Este archivo no lleva estado.** Punteros:
> - **Qué hay a medias y cuál es el próximo paso** → [`docs/trabajo-en-vuelo.md`](../docs/trabajo-en-vuelo.md).
>   **Si retomás sin contexto, empezá por ahí**: dice en qué rama está el trabajo, qué tanda sigue y qué decisiones se tomaron en conversación.
> - **Backlog de deuda** → [`docs/TECHNICAL_DEBT.md`](../docs/TECHNICAL_DEBT.md) (creado en Tanda H).
> - **Propuestas técnicas y decisiones** → [`docs/proposals/`](../docs/proposals/).
> - **Arquitectura del sistema** → [`ARCHITECTURE.md`](../ARCHITECTURE.md).

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
    *   **Delimitadores Anidados:** Si un delimitador está físicamente dentro de otro en la misma línea, sus extremos internos no llevan ningún espacio: `(inner)`, `{inner}`, `[inner]`, `<inner>` (ej: `dotenv.config( {path: ".env.local"} ) ;`). *Excepción:* Se tolera la sintaxis nativa de React para propiedades de estilo inline directas en JSX `style={{...}}` sin requerir espacios adicionales, pero si se escribe con un solo nivel de llaves o espaciado interno, debe cumplir con la regla de anidamiento (ej: `style={{color: "red"}}` en lugar de `style={ { color: "red" } }`).
    *   **Multilínea:** Si se desglosa en varias líneas, se usa salto de línea e indentación estándar en lugar de espaciados internos.
    *   **Estructuras de Control:** Las estructuras condicionales `if( condicion ) {` y bucles `for( iterador ) {` sí llevan espacios internos en sus límites de paréntesis y un espacio antes de la llave de apertura `) {`.
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
    *   Al combinar sub-expresiones con `&&` o `||`, aísla únicamente las comparaciones complejas entre paréntesis `( ... )`. Las variables booleanas simples o propiedades no necesitan ser envueltas en paréntesis adicionales. Al estar anidados, no llevan espacios internos: `(a === b)`.
    *   Ejemplo `return`: `return( (user.role === "admin") || (user.role === "owner") ) ;`
    *   Ejemplo `if`: `if( !key || (key.trim() === "") ) {` o `if( (existingRecord.status === "COMPLETED") && existingRecord.responseBody ) {`
*   **Estilos (CSS):**
    *   Está **estrictamente prohibido el CSS inline** (`style={{...}}`) en JSX. *Excepción:* valores genuinamente dinámicos calculados en runtime (ej: `style={{color: brandColor}}` o inyección de custom properties `style={{"--user-brand-color": color}}`), que no pueden expresarse en una clase estática.
    *   Está **estrictamente prohibido** el uso de Tailwind CSS o cualquier framework de clases utilitarias.
    *   Todo estilo debe vivir en un archivo `*.module.css` colocado junto a su componente, y debe consumir los design tokens de `src/app/globals.css` (`var(--...)`) en lugar de valores hardcodeados de color, tipografía, radios, sombras o z-index. Antes de usar una variable, verificar que exista en `globals.css`.
    *   **Prohibición de desplazamiento y cambio de tamaño en `:hover` (Regla Anti-Layout-Shift / Anti-Flicker):**
        Está **estrictamente prohibido** alterar dimensiones físicas (`width`, `height`, `padding`, `margin`, `border-width`), fuentes (`font-weight`), o posiciones/escalas físicas (`transform: translateY(...)`, `transform: scale(...)`, `top`, `left`, etc.) en estados `:hover`. Toda micro-interacción de hover debe ser puramente cromática o lumínica (`background-color`, `color`, `border-color`, `box-shadow`, `opacity`), garantizando estabilidad visual estricta y eliminando bucles de parpadeo (*flicker*) y *Cumulative Layout Shift* (CLS).

---

## 5. Gestión de Dependencias y Herramientas

*   Está estrictamente prohibido el uso de `npm` para gestionar dependencias o ejecutar tareas/scripts del proyecto.
*   En su lugar, debe utilizarse únicamente `pnpm` de manera obligatoria (ej: `pnpm install`, `pnpm test`, `pnpm dev`).

---

## 6. Responsividad y Medidas

*   Está estrictamente prohibido utilizar medidas estáticas no responsive (ej: píxeles fijos como `width: 240px` o `130px`) para dimensiones de contenedores principales o componentes estructurales de la interfaz.
*   En su lugar, deben utilizarse siempre unidades dinámicas fluidas (como `clamp()`, `vw`, `vh`, `%`, etc.) para asegurar una adaptación fluida del layout a diferentes pantallas.

---

## 7. Flujo de Trabajo y Control de Cambios (Anti-Improvisación)

Para evitar modificaciones no planificadas o prematuras en la base de código, todos los agentes deben seguir estrictamente el siguiente proceso en fases antes de realizar cualquier cambio:

1.  **Investigación e Informe:** Realizar una exploración y análisis completo de la base de código relevante. Presentar un informe detallado del problema, la arquitectura afectada y la propuesta técnica general, sin realizar modificaciones de código aún.
2.  **Autorización Inicial:** Esperar la indicación explícita del usuario para avanzar.
3.  **Plan de Acción Detallado:** Si el usuario autoriza avanzar, redactar un plan de acción detallado paso a paso con los archivos a modificar, el impacto de los cambios y el código propuesto.
4.  **Aprobación Final:** Esperar la aprobación explícita y final del usuario sobre el plan de acción antes de ejecutar cualquier herramienta de escritura de archivos (`write_to_file`, `replace_file_content`, `multi_replace_file_content`) o comandos que modifiquen el entorno.



---

## 8. Lo que este proyecto cobra caro

*   **1. El balance Debe/Haber nunca se rompe:**  
    La suma de débitos debe ser estrictamente idéntica a la suma de créditos en cualquier transacción contable. En [`src/features/accounting/schema.db.ts:71-76`](../src/features/accounting/schema.db.ts#L71-L76), cada movimiento en `ledger_entries` vincula un débito y un crédito. La validación vive centralizada en [`src/features/accounting/services/accountingService.ts:35-46`](../src/features/accounting/services/accountingService.ts#L35-L46) (`totalDebit !== totalCredit` rechaza la mutación). Si se insertan asientos directos en la base sin pasar por el servicio contable, la integridad de la partida doble queda destruida.
*   **2. Prohibido usar números con punto flotante (floats):**  
    Todo importe monetario viaja y se almacena en **centavos enteros** (`integer` / `bigint`). Definido en [`src/features/accounting/schema.db.ts:47,75,76,113-115`](../src/features/accounting/schema.db.ts#L47) (`balance`, `debit`, `credit`, `totalRevenue`, `totalExpense`). La conversión a formato visible la realiza exclusivamente [`src/features/accounting/utils/dashboardMetrics.ts:14-19`](../src/features/accounting/utils/dashboardMetrics.ts#L14-L19) (`formatCents`). Manipular importes dividiendo o multiplicando por 100 en componentes de UI introduce errores de redondeo acumulativos.
*   **3. Aislamiento multi-tenant obligatorio:**  
    Toda consulta a la base de datos debe filtrar obligatoriamente por `organizationId`. El esquema lo impone como clave foránea no anulable con eliminación en cascada en [`src/features/accounting/schema.db.ts:16,26,38,57,110`](../src/features/accounting/schema.db.ts#L16). Omitir este filtro en una consulta en repositorios ([`src/features/accounting/repositories/`](../src/features/accounting/repositories/)) filtra datos entre distintas organizaciones sin generar ningún error visible de compilación.
*   **4. `monthly_summaries.month` es 0-indexed en la base, mientras que `beforeMonth` en `findRecent()` es 1-indexed:**  
    La columna `month` de la tabla `monthly_summaries` ([`src/features/accounting/schema.db.ts:112`](../src/features/accounting/schema.db.ts#L112)) almacena los meses del 0 al 11 (0 = Enero, 11 = Diciembre, igual que `Date.getMonth()`). Sin embargo, el parámetro público `beforeMonth` del repositorio [`src/features/accounting/repositories/monthlySummaryRepository.ts:42-51`](../src/features/accounting/repositories/monthlySummaryRepository.ts#L42-L51) recibe meses del 1 al 12 (1-indexed por convención de API pública). Asumir que ambos son 0-indexed o ambos 1-indexed desfasa los cierres contables un mes entero.
*   **5. Las series temporales de meses no son contiguas:**  
    El método `findRecent()` en [`src/features/accounting/repositories/monthlySummaryRepository.ts:97-107`](../src/features/accounting/repositories/monthlySummaryRepository.ts#L97-L107) solo agrega al resultado los meses que ya tienen resumen generado, descartando silenciosamente los huecos. Consumir este array por índice de posición o asumir doce meses consecutivos hacia atrás desde hoy (como hacía `getMonthsLabelSequence()` en [`src/shared/ui/display/RechartsSparkline/Sparkline.tsx:14-27`](../src/shared/ui/display/RechartsSparkline/Sparkline.tsx#L14-L27) o el relleno con `unshift(0)` en [`src/features/accounting/utils/dashboardMetrics.ts:93-95`](../src/features/accounting/utils/dashboardMetrics.ts#L93-L95)) desplaza los valores y atribuye saldos al mes equivocado (bug S1). La etiqueta de mes debe viajar siempre emparejada con el dato (`{ value, monthKey }`).

