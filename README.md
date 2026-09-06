# FinanzIA — migracion-finanzas_mock

SaaS financiero multi-tenant con un motor contable de **partida doble** (Double-Entry Bookkeeping). Construido con Next.js 16 (App Router), Drizzle ORM sobre PostgreSQL y NextAuth.

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para la arquitectura orientada a características (Feature-Driven) y las convenciones de código del proyecto.

---

## Requisitos previos

*   Node.js
*   [pnpm](https://pnpm.io/) — es el único gestor de paquetes permitido en este repositorio (ver `.agents/AGENTS.md`).
*   PostgreSQL corriendo localmente (o una URL de conexión a Neon u otro proveedor).

---

## Puesta en marcha

1.  Instalar dependencias:
    ```bash
    pnpm install
    ```

2.  Crear `.env.local` en la raíz con las siguientes variables:

    ```bash
    # Conexión a PostgreSQL (validado con Zod en runtime en src/shared/lib/env.ts)
    DATABASE_URL=postgresql://postgres:postgres_dev_pwd@localhost:5432/finanzas_db

    # Secreto de firma de JWT para NextAuth (obligatorio en producción)
    NEXTAUTH_SECRET=

    # URL canónica de la aplicación para NextAuth
    NEXTAUTH_URL=http://localhost:3000

    # Opcional: habilita metadatos enriquecidos de marcas (logos, colores corporativos)
    # vía Brandfetch. Sin esta key, el sistema usa un fallback con Clearbit.
    BRANDFETCH_API_KEY=
    NEXT_PUBLIC_BRANDFETCH_CLIENT_ID=brandfetch
    ```

3.  Aplicar las migraciones de base de datos:
    ```bash
    pnpm db:migrate
    ```

4.  Poblar la base de datos con datos de demostración (organización, usuario admin, plan de cuentas y transacciones de prueba):
    ```bash
    pnpm db:seed
    ```
    Al finalizar, el script imprime en consola el email y la contraseña de la cuenta demo generada.

5.  Levantar el servidor de desarrollo:
    ```bash
    pnpm dev
    ```

    Abrir [http://localhost:3000](http://localhost:3000).

---

## Comandos disponibles

```bash
pnpm dev              # Servidor de desarrollo
pnpm build            # Build de producción
pnpm start            # Servidor de producción (requiere build previo)
pnpm lint             # ESLint

pnpm test             # Ejecuta la suite de Vitest una sola vez
pnpm exec vitest      # Modo watch
pnpm exec vitest --ui # Interfaz gráfica de Vitest

pnpm db:generate      # Genera una migración SQL a partir de cambios en el esquema Drizzle
pnpm db:migrate       # Aplica las migraciones pendientes
pnpm db:studio        # Abre Drizzle Studio (explorador visual de la base de datos)
pnpm db:seed          # Puebla la base de datos con datos de demostración
```

Ver [docs/TESTING.md](./docs/TESTING.md) para la guía completa de testing.

---

## Estructura del proyecto

El código está organizado bajo `src/` con **Arquitectura orientada a Características (Feature-Driven)**: la lógica de negocio vive en `src/features/{feature}/`, mientras que `src/app/` actúa únicamente como enrutador/compositor visual y `src/shared/` contiene el andamiaje transversal (DB, UI base, utilidades). Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para el detalle completo.

Cualquier cambio estructural significativo (esquema de base de datos, autenticación, orquestación de servicios) requiere un RFC aprobado en `docs/proposals/` antes de implementarse.

---

## Restricciones del repositorio

*   Está **estrictamente prohibido** leer, modificar o consultar el contenido de la carpeta `migracion/`.
*   Solo se permite `pnpm` para gestionar dependencias y ejecutar scripts — no usar `npm` ni `yarn`.
