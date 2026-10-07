/**
 * @file schema.ts
 * Exportador centralizado de todos los esquemas de bases de datos del sistema.
 * Este archivo unifica las tablas del negocio para ser consumidas por las herramientas de migración (Drizzle Kit).
 */
// Features
export * from "@/features/subscriptions/schema.db" ;
export * from "@/features/accounting/schema.db" ;
export * from "@/features/contacts/schema.db" ;
export * from "@/features/profile/schema.db" ;
export * from "@/features/cards/schema.db" ;
export * from "@/features/loans/schema.db" ;
export * from "@/features/budgets/schema.db" ;
export * from "@/features/goals/schema.db" ;
export * from "@/features/notifications/schema.db" ;
export * from "@/features/splits/schema.db" ;
export * from "@/features/auth/schema.db" ;