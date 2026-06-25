# RFC 002: Diseño del Esquema de Base de Datos para SaaS Financiero

*   **ID de la Propuesta:** 002
*   **Título:** Esquema de Base de Datos y Multi-tenancy para SaaS Financiero
*   **Estado:** `APPROVED` (Aprobado - 2026-06-23)
*   **Fecha de Creación:** 2026-06-22
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

Para un SaaS financiero escalable, el diseño del esquema de la base de datos es la decisión más crítica. Un error en la integridad del almacenamiento de saldos o transacciones puede corromper datos históricos bancarios.

### Objetivos:
1.  **Multi-tenancy Absoluto:** Asegurar que los datos de diferentes clientes (organizaciones) estén completamente aislados y que sea imposible que un cliente acceda a los datos de otro.
2.  **Partida Doble Obligatoria (Integridad Financiera):** Garantizar que cada movimiento de dinero esté perfectamente balanceado en el libro contable. No se permiten balances flotantes libres.
3.  **Auditoría Completa:** Guardar registros históricos inmutables de cada transacción contable y acción del usuario.
4.  **Velocidad de Búsqueda (Indexación):** Diseñar índices óptimos para filtrar rápidamente grandes cantidades de transacciones por organización y fecha.

---

## 2. Propuesta de Estructura de Tablas (DDL Conceptual)

Definiremos el esquema utilizando una estructura de base de datos relacional PostgreSQL.

### A. Tabla: `organizations` (Inquilinos/Tenants)
Representa a cada empresa o cliente suscrito al SaaS.
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_organizations_slug ON organizations(slug);
```

### B. Tabla: `users`
Representa a los miembros del equipo dentro de una organización.
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member' NOT NULL, -- 'owner' | 'admin' | 'member'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_users_org ON users(organization_id);
```

### C. Tabla: `accounts` (Plan de Cuentas Financieras)
Representa el catálogo de cuentas de la organización (Caja, Banco, Cuentas por Cobrar, etc.).
*   **Tipo de Cuenta (`type`):**
    *   `asset` (Activos - ej: efectivo, cuentas bancarias).
    *   `liability` (Pasivos - ej: deudas, tarjetas de crédito).
    *   `equity` (Patrimonio - ej: capital de socios).
    *   `revenue` (Ingresos - ej: ventas).
    *   `expense` (Gastos - ej: salarios, servidores).
```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    code VARCHAR(50) NOT NULL, -- Ej: '1.1.01.01' (Código contable)
    name VARCHAR(255) NOT NULL, -- Ej: 'Banco Principal'
    type VARCHAR(50) NOT NULL,
    balance BIGINT DEFAULT 0 NOT NULL, -- Almacenado en centavos (ej: $10.50 = 1050)
    currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- El código de cuenta debe ser único dentro de la misma organización
    CONSTRAINT uq_accounts_org_code UNIQUE (organization_id, code)
);
CREATE INDEX idx_accounts_org ON accounts(organization_id);
```

### C. Tabla: `categories` (Categorías Jerárquicas)
Representa la estructura de categorías y subcategorías para clasificar transacciones.
*   **Auto-referencia (`parent_id`):** Si `parent_id` es NULL, es una categoría principal. Si apunta a otro ID, es una subcategoría.
*   **Multi-tenancy:** Si `organization_id` es NULL, es una categoría global provista por el sistema. Si está definido, es una categoría personalizada creada por ese Workspace.
```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL para globales
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE, -- NULL para categorías principales
    
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(100), -- Nombre o código del icono (ej: 'shopping-cart')
    color VARCHAR(7), -- Color hexadecimal (ej: '#E50914')
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_categories_org ON categories(organization_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
```

### D. Tabla: `ledger_transactions` (Transacciones del Libro Mayor)
El registro del evento de transacción financiera general. Guarda los metadatos contextuales y del comercio (integrado con Brandfetch).
```sql
CREATE TABLE ledger_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL, -- Vinculación a categorías
    
    description VARCHAR(555) NOT NULL, -- Descripción general del usuario
    notes TEXT, -- Notas o detalles adicionales
    
    -- Integración de Comercios / Brandfetch
    merchant_name VARCHAR(255), -- Ej: 'Starbucks'
    merchant_domain VARCHAR(255), -- Ej: 'starbucks.com'
    
    -- Comprobantes adjuntos
    receipt_url VARCHAR(2048), -- URL del ticket de pago o PDF de factura
    
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, -- Fecha real del gasto
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_transactions_org_date ON ledger_transactions(organization_id, posted_at DESC);
CREATE INDEX idx_transactions_category ON ledger_transactions(category_id);
```


### E. Tabla: `ledger_entries` (Apuntes/Líneas Contables)
Las líneas de detalle contable que componen una transacción financiera.
*   **La Regla de Oro:** La suma de todos los `debit` (Debe) debe ser exactamente igual a la suma de todos los `credit` (Haber) para una sola `transaction_id`.
```sql
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES ledger_transactions(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES accounts(id) NOT NULL,
    debit BIGINT DEFAULT 0 NOT NULL CHECK (debit >= 0),  -- Debe (centavos)
    credit BIGINT DEFAULT 0 NOT NULL CHECK (credit >= 0), -- Haber (centavos)
    currency VARCHAR(3) DEFAULT 'ARS' NOT NULL, -- Divisa de la línea contable (ARS, USD)
    
    -- Una línea contable no puede tener débito y crédito a la vez
    CONSTRAINT chk_debit_credit_exclusivity CHECK (
        (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
    )
);
CREATE INDEX idx_ledger_entries_transaction ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_account ON ledger_entries(account_id);
```


### F. Tabla: `audit_logs` (Registro de Auditoría Técnica y Operativa)
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL, -- Ej: 'ACCOUNT_CREATED', 'TRANSACTION_POSTED'
    metadata JSONB, -- Para guardar datos del cambio
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);
```

---

## 3. Estrategias de Aislamiento y Reglas de Negocio

### A. Aislamiento Multi-tenant
Todas las tablas críticas contienen `organization_id`. Al hacer cualquier consulta o mutación, la capa de servicio/ORM **debe** filtrar incondicionalmente por `organization_id` obtenido del contexto de sesión autenticado del usuario.

### B. Consistencia de la Partida Doble
Para asegurar que no se creen transacciones contables desbalanceadas, la inserción de una transacción y sus apuntes contables se debe ejecutar dentro de una **transacción de base de datos (DB Transaction)** en la capa de servicios con esta lógica:
1.  **Iniciar transacción DB.**
2.  Insertar el registro en `ledger_transactions`.
3.  Insertar los múltiples `ledger_entries` asociados.
4.  **Verificar:** Sumar los débitos e igualarlos a los créditos. Si la resta de la suma no es cero, lanzar un rollback inmediatamente.
5.  **Actualizar saldos (`balance`) en `accounts`:** Aplicar los cambios a las cuentas correspondientes mediante incrementos en base a su tipo de cuenta (las cuentas de activos aumentan con débitos y disminuyen con créditos, mientras que los pasivos aumentan con créditos y disminuyen con débitos).
6.  **Confirmar transacción (Commit).**

---

## 4. Preguntas para el Debate y Opiniones del Equipo

1.  **¿Estructura de Ledger en Debit/Credit o single Amount?** 
    *   *Propuesta actual:* Columnas separadas `debit` y `credit` con valores positivos. Es la convención contable estándar que facilita auditorías de libros mayores.
    *   *Alternativa:* Una única columna `amount` donde valores positivos son Débitos y negativos son Créditos. Es más compacta, pero propensa a confusiones de signos.
2.  **¿Uso de UUID v7 en lugar de UUID v4?**
    *   Los UUID v7 son ordenables cronológicamente por diseño. Para transacciones financieras y logs de auditoría, esto agiliza las búsquedas por fecha y la indexación en base de datos. PostgreSQL los soporta nativamente o vía generación en Node.js.

---

## 5. Organización de Archivos de Esquema (Modularización)

Para mantener la base de datos mantenible, altamente modular y evitar archivos de configuración gigantescos, los esquemas de Drizzle ORM estarán descentralizados directamente dentro de sus respectivos dominios de negocio bajo la carpeta `src/features/`.

### Estructura de Directorios Adoptada:

```text
src/
├── features/
│   ├── auth/
│   │   └── schema.db.ts      # Esquema de perfiles, usuarios y tokens de sesion (Auth.js)
│   ├── accounts/
│   │   └── schema.db.ts      # Esquema de cuentas financieras y balances
│   ├── categories/
│   │   └── schema.db.ts      # Esquema de categorías jerárquicas
│   ├── ledger/
│   │   └── schema.db.ts      # Esquema de transacciones y apuntes de partida doble (ledger_entries)
│   ├── splitting/
│   │   └── schema.db.ts      # Esquema de division de gastos y liquidacion entre pares
│   ├── subscriptions/
│   │   └── schema.db.ts      # Esquema de suscripciones y debitos recurrentes
│   ├── brandfetch/
│   │   └── schema.db.ts      # Esquema de marcas y cache-aside de logotipos
│   ├── contacts/
│   │   └── schema.db.ts      # Esquema de contactos y metodos de transferencia/CBU
│   ├── cards/
│   │   └── schema.db.ts      # Esquema de tarjetas de credito, debito y ciclos
│   ├── loans/
│   │   └── schema.db.ts      # Esquema de prestamos y compras en cuotas
│   ├── wealth/
│   │   └── schema.db.ts      # Esquema de patrimonio fisico (inmuebles/vehiculos)
│   ├── goals/
│   │   └── schema.db.ts      # Esquema de metas de ahorro y sobres de reserva
│   ├── integrations/
│   │   └── schema.db.ts      # Esquema de integraciones API Keys externas y logs de webhooks
│   ├── invoicing/
│   │   └── schema.db.ts      # Esquema de facturas de clientes, lineas de detalle y señas
│   └── investments/
│       └── schema.db.ts      # Esquema de portafolio multi-broker, activos e ingresos de dividendos
└── shared/
    └── db/
        ├── client.ts         # Cliente unificado de conexion a PostgreSQL (local y Neon Cloud)
        └── schema.ts         # Archivo central de Drizzle (re-exportador unico de esquemas)
```

### Unificación Central en `src/shared/db/schema.ts`:
El archivo central [schema.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/src/shared/db/schema.ts) se encarga de importar y re-exportar todo. De este modo, Drizzle Kit y las migraciones del sistema leen una sola fuente de verdad central, mientras que el código mantiene su modularidad y encapsulación.

```typescript
// src/shared/db/schema.ts
export * from "@/features/auth/schema.db";
export * from "@/features/accounts/schema.db";
export * from "@/features/categories/schema.db";
export * from "@/features/ledger/schema.db";
export * from "@/features/splitting/schema.db";
export * from "@/features/subscriptions/schema.db";
export * from "@/features/brandfetch/schema.db";
export * from "@/features/contacts/schema.db";
export * from "@/features/cards/schema.db";
export * from "@/features/loans/schema.db";
export * from "@/features/wealth/schema.db";
export * from "@/features/goals/schema.db";
export * from "@/features/integrations/schema.db";
export * from "@/features/invoicing/schema.db";
export * from "@/features/investments/schema.db";
```

> [!IMPORTANT]
> **Regla de Optimización (`bundle-barrel-imports`):**
> El archivo central `src/shared/db/schema.ts` actúa como un *barrel file* y se usará **únicamente por Drizzle Kit** (en `drizzle.config.ts`) para la compilación e inicialización de migraciones en desarrollo. 
> El código de la aplicación (Server Actions, servicios, componentes y páginas de Next.js) **nunca** debe importar tablas desde este archivo unificado, sino que debe importarlas directamente desde su respectivo archivo de origen modular (ej. `import { accounts } from "@/features/accounts/schema.db"`), previniendo que Next.js cargue y analice todos los esquemas lógicos del sistema ante cada consulta sencilla, optimizando el rendimiento de Cold Starts.

### Ventajas de esta organización:
1. **Cohesión Alta y Acoplamiento Bajo:** El programador encuentra el esquema de base de datos de una funcionalidad al lado de los componentes y la lógica de negocio correspondientes en `features/`.
2. **Facilidad de Mantenimiento:** Elimina los cuellos de botella en Git al no tener que modificar un único esquema monolítico para añadir tablas de diferentes dominios.
3. **Escalabilidad Limpia:** Permite a Drizzle Kit rastrear automáticamente los esquemas utilizando la importación central o configurando `drizzle.config.ts` con el patrón globs `schema: "./src/features/**/schema.db.ts"`.


