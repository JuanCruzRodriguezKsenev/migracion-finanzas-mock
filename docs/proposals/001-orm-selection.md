# RFC 001: Selección del ORM / Driver de Base de Datos

*   **ID de la Propuesta:** 001
*   **Título:** Selección del ORM / Driver de Base de Datos para PostgreSQL (Local y Neon)
*   **Estado:** `APPROVED` (Aprobado)
*   **Fecha de Decisión:** 2026-06-22
*   **Autor:** Antigravity (AI Coding Assistant)


---

## 1. Contexto y Problema

Estamos construyendo un SaaS financiero escalable que utilizará una base de datos PostgreSQL local en desarrollo y una base de datos PostgreSQL en la nube (como Neon) en producción. Para interactuar con la base de datos desde Next.js (TypeScript) de forma segura y eficiente, necesitamos elegir cómo estructuraremos las consultas y las migraciones.

### Requisitos y Restricciones Clave:
1.  **Escalabilidad y Rendimiento:** La latencia de consulta y los tiempos de arranque de las funciones serverless de Next.js (Cold Starts) deben ser mínimos.
2.  **Seguridad (Integridad de Tipos):** En un SaaS financiero, un error en los tipos de datos (como pasar un string en lugar de un entero para el saldo) es inaceptable. Necesitamos tipado estricto extremo.
3.  **Seguridad de Dependencias:** Minimizar la instalación de paquetes remotos pesados y priorizar dependencias seguras de autores fiables.
4.  **Facilidad de Pruebas (Testability):** Debe integrarse de manera limpia con Vitest para realizar pruebas de integración y base de datos veloces.

---

## 2. Alternativas Analizadas

### Alternativa A: Drizzle ORM (Recomendada)
Drizzle es un ORM moderno diseñado para ser "cercano a SQL" y optimizado para entornos serverless (como Vercel/Neon).

*   **Cómo funciona:** Defines tu esquema en TypeScript puro. Drizzle traduce tus esquemas a comandos SQL e infiere los tipos de TypeScript automáticamente.
*   **Pros:**
    *   **Cold Starts Mínimos:** No tiene un motor en segundo plano; es solo un traductor de JavaScript a SQL muy delgado.
    *   **Type-Safe Nativo:** Al estar escrito en TypeScript, la inferencia de tipos es automática y perfecta.
    *   **Migraciones transparentes:** Genera archivos `.sql` planos que puedes revisar visualmente antes de aplicarlos.
    *   **Neon Integration:** Drizzle cuenta con soporte específico y optimizado para la API de conexión serverless de Neon.
*   **Contras:**
    *   No tiene un panel visual integrado de base de datos como Prisma Studio (aunque cuenta con Drizzle Studio via terminal).

### Alternativa B: Prisma ORM
Prisma es el ORM más popular en el ecosistema TypeScript, conocido por su esquema declarativo central.

*   **Cómo funciona:** Defines tu esquema en un archivo propietario `schema.prisma`. Prisma compila un motor binario en Rust (`query-engine`) que maneja las consultas.
*   **Pros:**
    *   Sintaxis de consulta muy amigable y declarativa.
    *   Gran comunidad y herramientas como Prisma Studio (interfaz visual).
*   **Contras:**
    *   **Tiempos de Cold Start:** El motor en Rust (`query-engine`) añade un retraso notable en el primer arranque de funciones serverless (Vercel/Neon).
    *   **Abstracción pesada:** El binario de Rust se descarga en producción, aumentando el tamaño del bundle del servidor.

### Alternativa C: Cliente Nativo PostgreSQL (`pg` o `postgres-js`) sin ORM
Escribir consultas SQL directamente usando cadenas de texto en JavaScript.

*   **Cómo funciona:** Utilizas el driver básico de PostgreSQL para enviar strings de SQL directo.
*   **Pros:**
    *   **Rendimiento absoluto:** Cero capas de abstracción. Es la opción más rápida posible.
    *   **Cero dependencias complejas:** Máxima seguridad al no instalar paquetes de terceros que autogeneren código.
*   **Contras:**
    *   **Mantenimiento manual:** Tienes que escribir manualmente todos los tipos de TypeScript para cada resultado de consulta.
    *   **Riesgo de errores humanos:** No hay validación en tiempo de compilación para comprobar si una columna en tu consulta de SQL existe en la base de datos.
    *   **Migraciones manuales:** Manejo manual de archivos SQL para actualizar la estructura.

---

## 3. Matriz de Decisión

| Criterio | A. Drizzle ORM | B. Prisma ORM | C. Cliente Nativo (`pg`) |
| :--- | :--- | :--- | :--- |
| **Rendimiento / Latencia** | Excelente (Alta) | Media-Baja (por Rust Engine) | Excelente (Máxima) |
| **Seguridad de Tipos (TS)** | Excelente (Automática) | Excelente (Generada) | Manual / Deficiente |
| **Serverless Cold Starts** | Excelente (Mínimo) | Deficiente (Lento) | Excelente (Mínimo) |
| **Mantenimiento Migraciones**| Excelente (Auto SQL) | Excelente (Auto SQL) | Manual (Complejo) |
| **Seguridad / Dependencias** | Alta | Media (descarga binarios) | Alta |

---

## 4. Recomendación del Proponente

Recomendamos utilizar **Drizzle ORM** (Alternativa A) por los siguientes motivos:
1.  Es la opción que garantiza la mejor experiencia de usuario en producción al evitar los arranques lentos de Prisma en Neon.
2.  Ofrece el tipado estricto absoluto necesario para las transacciones financieras de forma nativa sin mantenimiento manual.
3.  Genera archivos SQL tradicionales para las migraciones, lo que permite un control total y auditoría sobre qué se ejecuta exactamente en las bases de datos locales y de producción.

---

## 5. Próximos Pasos (Tras aprobación)
1.  Instalar las dependencias de desarrollo y producción estrictamente necesarias (`drizzle-orm`, `pg`, `@types/pg`, `drizzle-kit`).
2.  Configurar el archivo de configuración `drizzle.config.ts`.
3.  Establecer la estructura de carpetas en `src/shared/db/` para centralizar la conexión.
