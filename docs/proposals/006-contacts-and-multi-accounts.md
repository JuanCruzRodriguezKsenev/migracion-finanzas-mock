# RFC 006: Modelado de Contactos y Multi-Cuentas de Transferencia

*   **ID de la Propuesta:** 006
*   **Título:** Estructura de Datos para Contactos con Múltiples Cuentas de Cobro y Cuentas de Transferencia
*   **Estado:** `APPROVED` (Aprobado - 2026-09-07)
*   **Fecha de Creación:** 2026-06-22
*   **Fecha de Enmienda:** 2026-09-07
*   **Autor:** Antigravity (AI Coding Assistant)

> [!IMPORTANT]
> **Enmienda de Arquitectura (2026-09-07 — Bloque B):**
> 1. **No-regresión del Core Contable en `accounts` (§2.B.1):** Se remueve la redefinición regresiva de `accounts` (`balance: integer`, `type: text`, sin `financialEntityId`). El core contable ya implementó `accounts` con `entity_id` y `balance: bigint` (RFC 018 / 019). Esta propuesta únicamente incorpora las columnas opcionales `cbu_cvu` y `alias` al esquema vigente.
> 2. **Desacoplamiento de `cards` (§2.B.2):** La definición de la tabla `cards` se extrae a su propuesta dedicada en [RFC 007: Gestión Avanzada de Tarjetas](./007-cards-management.md) para abordarse en Fase 2.
> 3. **Normalización de Entidades Financieras:** En `contact_payment_methods`, se reemplaza el campo de texto libre `institution` por `financial_entity_id` (FK a `financial_entities.id` con `onDelete: "restrict"`). Esta tabla ya existe con branding (logos, color) y circuit breaker de Brandfetch, y se reutiliza el componente existente `CreateFinancialEntityForm` para altas al vuelo.
> 4. **Baja Lógica en Contactos (`archived_at`):** Se agrega `archived_at` a `contacts` para bajas lógicas. Los contactos serán referenciados históricamente por división de gastos en eventos (RFC 003), inquilinos (RFC 010) y facturas (RFC 013); una eliminación física destruiría la integridad referencial. Siguiendo la filosofía del libro mayor (no se borra, se contra-asienta), los contactos se archivan.

---

## 1. Contexto y Objetivos

En el ecosistema financiero actual (especialmente en Argentina con el sistema de Alias, CBU y CVU), los usuarios y sus contactos poseen cuentas en múltiples entidades bancarias (BBVA, Galicia, etc.) y billeteras virtuales (Mercado Pago, Cuenta DNI, Ualá).

Para que la división de gastos en eventos (RFC 003), la gestión de cobros y las transferencias generales funcionen de manera fluida, la base de datos debe ser capaz de modelar esta multiplicidad de cuentas sin redundancia ni fuga de datos entre organizaciones.

### Objetivos:
1.  **Modelo de Contactos Flexibles con Baja Lógica:** Permitir que cada contacto tenga una agenda de múltiples cuentas de destino para transferencias (Relación 1 a Muchos) con archivado lógico (`archived_at`).
2.  **Atributos de Cobro en Cuentas Propias:** Añadir campos de transferencia (`cbu_cvu`, `alias`) a nuestras cuentas existentes del libro mayor (`accounts`) para que terceros puedan transferirnos fácilmente.
3.  **Normalización Financiera:** Vincular los métodos de pago de contactos directamente a entidades financieras (`financial_entities`) preexistentes para soporte de logos y marcas.
4.  **Aislamiento Multi-Tenant Estricto:** Asegurar que los métodos de cobro, al no tener `organization_id` directo, dependan transitivamente de `contacts` mediante validaciones obligatorias por `organizationId` en todas las operaciones del DAL.

---

## 2. Esquema de Base de Datos (Drizzle ORM)

### A. Dominio de Contactos Externos

#### 1. Tabla: `contacts`
Representa a una persona en la agenda de la organización/workspace.
```typescript
import { pgTable , uuid , varchar , text , timestamp , index } from "drizzle-orm/pg-core" ;
import { organizations } from "@/features/auth/schema.db" ;

export const contacts = pgTable( "contacts" , {
  id:             uuid( "id"              ).primaryKey().defaultRandom() ,
  organizationId: uuid( "organization_id" ).references( () => organizations.id , {onDelete: "cascade"} ).notNull() ,
  name:           varchar( "name" , {length: 150} ).notNull() , // Ej: "Pedro Gómez"
  email:          varchar( "email" , {length: 255} ) ,
  phone:          varchar( "phone" , {length: 50} ) ,
  notes:          text( "notes" ) ,
  archivedAt:     timestamp( "archived_at" , {withTimezone: true} ) , // Baja lógica
  createdAt:      timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
  updatedAt:      timestamp( "updated_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  orgNameIdx: index( "contacts_org_name_idx" ).on( table.organizationId , table.name ) ,
} ) ; } ) ;
```

#### 2. Tabla: `contact_payment_methods` (Cuentas de Cobro del Contacto)
Representa los CBUs/CVUs y Alias que el contacto utiliza para recibir dinero. **No tienen saldo ni afectan el balance contable.**
```typescript
import { pgTable , uuid , varchar , boolean , timestamp , index } from "drizzle-orm/pg-core" ;
import { financialEntities } from "@/features/accounting/schema.db" ;
import { contacts }          from "./schema.db" ;

export const contactPaymentMethods = pgTable( "contact_payment_methods" , {
  id:                uuid( "id"                  ).primaryKey().defaultRandom() ,
  contactId:         uuid( "contact_id"          ).references( () => contacts.id , {onDelete: "cascade"} ).notNull() ,
  financialEntityId: uuid( "financial_entity_id" ).references( () => financialEntities.id , {onDelete: "restrict"} ).notNull() ,
  type:              varchar( "type" , {length: 20} ).default( "wallet" ).notNull() , // 'bank_account' | 'wallet'
  
  // Datos de transferencia
  cbuCvu:            varchar( "cbu_cvu" , {length: 22} ) , // 22 dígitos numéricos validados
  alias:             varchar( "alias"   , {length: 20} ) , // 6 a 20 caracteres (charset AFIP)
  
  holderName:        varchar( "holder_name"   , {length: 150} ) ,
  holderTaxId:       varchar( "holder_tax_id" , {length: 20 } ) , // CUIT/CUIL validado por módulo 11
  
  isDefault:         boolean( "is_default" ).default( false ).notNull() ,
  createdAt:         timestamp( "created_at" , {withTimezone: true} ).defaultNow().notNull() ,
} , ( table ) => { return( {
  contactIdIdx: index( "contact_payment_methods_contact_id_idx" ).on( table.contactId ) ,
} ) ; } ) ;
```

> [!CAUTION]
> **Aislamiento Multi-Tenant Transitivo:**
> `contact_payment_methods` no posee columna `organization_id` directa. Su pertenencia organizacional es estrictamente transitiva a través de `contact_id`. En consecuencia:
> - Todo `SELECT`, `UPDATE`, `DELETE` o mutación de `setDefault` debe unir (`INNER JOIN`) con la tabla `contacts` verificando que `contacts.organization_id = session.organizationId`.
> - Jamás debe confiarse ciegamente en un `contactId` provisto desde el cliente sin verificar su pertenencia a la organización de la sesión.

---

## 3. Dominio de Cuentas Propias (Nuestra Contabilidad)

### A. Ampliación de `accounts`
En lugar de redefinir la tabla de cuentas del core contable (RFC 018 / 019), se agregan únicamente los dos campos opcionales de transferencia sobre la tabla existente `accounts` en `src/features/accounting/schema.db.ts`:

```typescript
// Columnas agregadas a la tabla 'accounts' preexistente:
cbuCvu: varchar( "cbu_cvu" , {length: 22} ) , // CBU/CVU propio de 22 dígitos
alias:  varchar( "alias"   , {length: 20} ) , // Alias bancario/billetera (6-20 caracteres)
```

El esquema resultante de `accounts` preserva su arquitectura de partida doble:
* `balance`: `bigint("balance", { mode: "number" })` en centavos.
* `entityId`: clave foránea a `financial_entities.id` (`onDelete: "restrict"`).
* `code`: código del plan contable con índice único `(organization_id, code)`.

### B. Desacoplamiento de Tarjetas
El modelado de tarjetas (`cards`), que figuraba preliminarmente en este RFC, fue desacoplado y consolidado en el **[RFC 007: Gestión Avanzada de Tarjetas de Crédito, Ciclos e Intereses](./007-cards-management.md)**. No forma parte del Bloque B.

---

## 4. Integración en Flujos de Pago

Cuando se gestiona un pago o división de deudas (ej: *"Pedro le debe $5.000 a la Organización"* o *"Se le transfiere a Pedro"*):
1.  **Datos Propios para Cobro:** La aplicación consulta en `accounts` de la organización aquellas cuentas activas que tengan `alias` o `cbu_cvu` configurado para ofrecerlas al deudor.
2.  **Agenda de Métodos de Destino:** Al emitir un pago a un contacto, la UI despliega sus métodos de pago cargados en `contact_payment_methods`, priorizando el que tenga `isDefault = true`, con su logo institucional y CBU/CVU o Alias verificado.
3.  **Baja Lógica y Consistencia:** Si un contacto es archivado (`archived_at IS NOT NULL`), se oculta de la agenda activa para nuevas transacciones, pero los comprobantes y asientos contables históricos mantienen su vínculo intacto.
