# Arquitectura del Proyecto

Este documento describe la estructura del proyecto, las convenciones de desarrollo y las reglas del sistema de este repositorio de Next.js. Todos los desarrolladores y herramientas automatizadas deben seguir estas directrices.

---

## 1. Stack Tecnológico

El proyecto está construido utilizando las siguientes tecnologías:
*   **Framework Principal:** [Next.js](https://nextjs.org/) (App Router) v16+
*   **Biblioteca de UI:** [React](https://react.dev/) v19+
*   **ORM de Base de Datos:** [Drizzle ORM](https://orm.drizzle.team/) v0.38+ con PostgreSQL (Neon / Local)
*   **Lenguaje:** [TypeScript](https://www.typescriptlang.org/) para tipado estático y seguridad en tiempo de desarrollo.
*   **Motor de Pruebas:** [Vitest](https://vitest.dev/) configurado en entorno Node por defecto para máxima velocidad de ejecución (usando jsdom bajo demanda mediante directivas).

---

## 2. Estructura de Directorios (Feature-Driven Architecture)

El código fuente del proyecto se organiza bajo la carpeta `src/`. Adoptamos una **Arquitectura orientada a Características (Feature-Driven)** para maximizar la cohesión del código de un mismo dominio y minimizar el acoplamiento técnico global.

```text
raiz/
├── docs/                      # Guías y especificaciones detalladas de la documentación
│   └── proposals/             # Propuestas de arquitectura y decisiones técnicas (RFC)
├── public/                    # Archivos estáticos públicos (imágenes, iconos, fuentes)
├── src/
│   ├── app/                   # Enrutamiento, layouts, páginas y Server Actions de Next.js
│   ├── features/              # Módulos o características auto-contenidas por dominio
│   │   └── {nombre_feature}/  # Ejemplo: 'cards', 'ledger', 'accounts', 'goals'
│   │       ├── components/    # Componentes de UI específicos de la característica
│   │       ├── services/      # Lógica de datos, consultas de base de datos y llamadas API de la feature
│   │       ├── lib/           # Utilidades y lógica de negocio puramente interna
│   │       ├── schema.db.ts   # Declaración de tablas Drizzle específicas del dominio
│   │       ├── types.ts       # Tipos TypeScript específicos de la característica
│   │       └── *.test.ts      # Pruebas unitarias e integración de la característica
│   └── shared/                # Recursos transversales e independientes del dominio de negocio
│       ├── components/        # Componentes base y genéricos (ej: botones de UI base, modales comunes)
│       ├── db/                # Cliente de base de datos centralizado y unificación de esquemas
│       ├── lib/               # Utilidades de bajo nivel genéricas (formateo, fechas, etc.)
│       └── services/          # Servicios transversales independientes del dominio (ej: logs de auditoría global)
└── migracion/                 # [RESTRINGIDO] Carpeta con lógica de migración heredada
```

### Descripción Detallada de Carpetas de Código:
*   `docs/proposals/`: Centraliza los RFCs de arquitectura. Ninguna característica estructural se implementa sin un RFC aprobado.
*   `src/app/`: Estructura del App Router de Next.js. Las páginas actúan puramente como compositores visuales que importan y organizan componentes de `features/` o `shared/`.
*   `src/features/{nombre_feature}/`: Es la unidad básica de desarrollo. Toda la lógica del negocio (ej. tarjetas de crédito en `features/cards`, cuentas en `features/accounts`) se encuentra encapsulada aquí. Un feature puede exportar componentes o servicios a otros, pero manteniendo un acoplamiento bajo.
*   `src/shared/`: Contiene el andamiaje del proyecto. No posee lógica asociada a reglas de negocio directas de una feature concreta.

---

## 3. Reglas Especiales del Proyecto (Restricciones)

> [!IMPORTANT]
> **Carpeta `migracion/`:** Está estrictamente prohibido leer, modificar o consultar los contenidos de la carpeta `migracion`. Toda herramienta automatizada de IA o desarrollador tiene prohibido procesar este directorio durante el desarrollo ordinario del frontend de la aplicación.

---

## 4. Convenciones de Nomenclatura y Código

Para mantener el código legible y homogéneo, aplicamos las siguientes convenciones:

### Nombres de Archivos y Carpetas:
*   **Componentes de React:** Utilizar **PascalCase** (ej: `Button.tsx`, `UserProfile.tsx`).
*   **Esquemas de Base de Datos (Drizzle):** Usar siempre el sufijo `.db.ts` (ej: `schema.db.ts`) dentro del directorio del feature.
*   **Archivos de Utilidad / Servicios / Tests:** Utilizar **camelCase** o **kebab-case** (ej: `mathHelpers.ts`, `authService.ts`).
*   **Archivos de Estilos:** Usar CSS Modules adjuntos a su componente (ej: `page.module.css` o `button.module.css`).

### Documentación de Código (Estándar TSDoc):
Todas las interfaces, tipos y funciones públicas críticas deben documentarse utilizando bloques de comentario compatibles con TSDoc. Esto permite autocompletado inteligente en el editor de código.

#### Ejemplo de uso:
```typescript
/**
 * Formatea un monto numérico a un string con formato de moneda local.
 * 
 * @param monto - El valor numérico a formatear en centavos.
 * @param divisa - El código ISO de la divisa (por defecto 'USD').
 * @returns El monto formateado como cadena de texto (ej: "$1,250.00").
 */
export function formatearMoneda(monto: number, divisa: string = "USD"): string {
  const montoDecimal = monto / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: divisa,
  }).format(montoDecimal);
}
```

---

## 5. Estructura y Reglas de Pruebas (Tests)

Las pruebas deben convivir directamente al lado de la funcionalidad que están verificando para facilitar su mantenimiento.

*   **Ubicación:** 
    *   Si tienes `src/features/ledger/services/ledgerService.ts`, su archivo de pruebas debe ser `src/features/ledger/services/ledgerService.test.ts`.
    *   Si tienes `src/shared/lib/math.ts`, su archivo de pruebas debe ser `src/shared/lib/math.test.ts`.
*   **Ámbito de Ejecución:** Vitest ejecutará de forma automática archivos `.test.ts` (o `.test.tsx`) ubicados bajo:
    *   `src/shared/lib/**/*.test.ts`
    *   `src/shared/services/**/*.test.ts`
    *   `src/features/**/*.test.ts`
*   **Configuración de Entorno:** Por defecto, el entorno de pruebas es `"node"`. Si un test requiere simular el DOM del navegador (por ejemplo, para probar un componente visual interactivo), se debe indicar explícitamente agregando el comentario `@vitest-environment jsdom` en la primera línea del archivo:
    ```typescript
    // @vitest-environment jsdom
    import { render, screen } from "@testing-library/react";
    // ...resto del test
    ```
*   **Comandos de Ejecución:**
    *   Ejecución única: `pnpm test`
    *   Modo observador (Watch Mode): `pnpm exec vitest`

---

## 6. Proceso de Decisiones y Propuestas de Arquitectura (RFC)

Para garantizar un desarrollo libre de improvisación y técnicamente robusto, cualquier cambio estructural significativo (como la definición de base de datos, autenticación, orquestación de servicios, etc.) debe seguir el siguiente flujo de trabajo:

1.  **Redacción de la Propuesta (Draft):** Se crea un archivo Markdown en `docs/proposals/` enumerado de forma secuencial (ej: `001-orm-selection.md`). Este archivo debe detallar el problema, las opciones analizadas, los pros/contras, y la recomendación técnica.
2.  **Debate y Refinamiento:** El equipo de desarrollo y el usuario discuten la propuesta. Las sugerencias y mejoras se aplican directamente al documento.
3.  **Aprobación (Approved):** Una vez consensuada la solución, el estado de la propuesta en el archivo cambia a `APPROVED` y se añade la firma de aprobación.
4.  **Implementación:** Se procede a escribir el código siguiendo estrictamente lo dictado en el documento de propuesta aprobado.

### Estados de un Documento de Propuesta (RFC):
*   `DRAFT` (Borrador): En redacción o discusión activa. No se debe programar código asociado.
*   `APPROVED` (Aprobado): Aceptado para su implementación. Sirve como especificación técnica oficial.
*   `REJECTED` (Rechazado): Descartado tras discusión. Se conserva para registro histórico.
*   `SUPERSEDED` (Superado): Aprobado en su momento, pero reemplazado por una propuesta de diseño posterior.

