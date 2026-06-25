/**
 * @file seed.ts
 * Script para poblar la base de datos local con datos iniciales de prueba (seeding).
 * Inserta organizaciones, usuarios, perfiles, categorías contables, cuentas y transacciones.
 * Garantiza idempotencia mediante limpieza previa en desarrollo y valida la partida doble.
 */
import * as dotenv from "dotenv" ;

// Carga las variables de entorno de .env.local antes de inicializar la conexión
dotenv.config( {path: ".env.local"} ) ;

import { organizations , users } from "@/features/auth/schema.db" ;
import { profiles } from "@/features/profile/schema.db" ;
import { categories , accounts , ledgerTransactions , ledgerEntries } from "@/features/accounting/schema.db" ;
import { hashPassword } from "@/features/auth/services/authService" ;
import { createLedgerTransaction } from "@/features/accounting/services/accountingService" ;

async function main() {
  console.log( "Iniciando seed de base de datos..." ) ;

  try {
    const { db } = await import( "./client" ) ;
    const contraseniaPlana = "AdminPass123!" ;

    // 1. Garantizar idempotencia limpiando registros previos en el orden correcto
    console.log( "Limpiando registros previos..." ) ;
    await db.delete( ledgerEntries      ) ;
    await db.delete( ledgerTransactions ) ;
    await db.delete( accounts           ) ;
    await db.delete( categories         ) ;
    await db.delete( profiles           ) ;
    await db.delete( users              ) ;
    await db.delete( organizations      ) ;

    // 2. Crear Organización y hashear contraseña en paralelo
    const [ [org] , {hash , salt} ] = await Promise.all( [
      db
        .insert( organizations )
        .values( {
          name: "Finanzas Familiares Demo" ,
          slug: "finanzas-familiares-demo" ,
        } )
        .returning() ,
      hashPassword( contraseniaPlana ) ,
    ] ) ;

    console.log( `Organización demo creada con ID: ${org.id}` ) ;

    // 3. Crear Usuario administrador de prueba
    const [ usuario ] = await db
      .insert( users )
      .values( {
        organizationId: org.id ,
        email:          "admin@ejemplo.com" ,
        name:           "Admin Demo" ,
        role:           "owner" ,
        passwordHash:   hash ,
        salt:           salt ,
      } )
      .returning() ;

    console.log( `Usuario demo creado con Email: ${usuario.email}` ) ;

    // 4. Crear Perfil y Preferencias asociadas en Argentina/ARS
    await db
      .insert( profiles )
      .values( {
        userId:           usuario.id ,
        phone:            "+54 9 11 1234 5678" ,
        currency:         "Peso argentino (ARS)" ,
        timezone:         "(GMT-03:00) Buenos Aires" ,
        bio:              "Administrador del panel financiero de FinanzIA." ,
        theme:            "system" ,
        defaultView:      "Dashboard" ,
        fastLogin:        true ,
        weeklyStart:      "Lunes" ,
        dateFormat:       "DD/MM/YYYY" ,
        numberFormat:     "1.234,56" ,
        roundAmounts:     false ,
        includeTransfers: true ,
        defaultAccount:   "Caja de Ahorro Galicia" ,
        planName:         "Básico" ,
        planBilling:      "Mensual" ,
        planNextCharge:   "" ,
      } ) ;

    console.log( "Perfil del administrador inicializado con éxito." ) ;

    // 5. Crear Categorías Contables Jerárquicas
    console.log( "Inicializando categorías contables..." ) ;
    
    // Categorías Raíz
    const [ catIngresos ] = await db
      .insert( categories )
      .values( {
        organizationId: org.id ,
        name:           "Ingresos" ,
        icon:           "trending-up" ,
        color:          "#2ecc71" ,
      } )
      .returning() ;

    const [ catGastos ] = await db
      .insert( categories )
      .values( {
        organizationId: org.id ,
        name:           "Gastos" ,
        icon:           "trending-down" ,
        color:          "#e74c3c" ,
      } )
      .returning() ;

    // Subcategorías
    const [ subSueldos ] = await db
      .insert( categories )
      .values( {
        organizationId: org.id ,
        parentId:       catIngresos.id ,
        name:           "Sueldos y Honorarios" ,
        icon:           "briefcase" ,
        color:          "#27ae60" ,
      } )
      .returning() ;

    const [ subSupermercado ] = await db
      .insert( categories )
      .values( {
        organizationId: org.id ,
        parentId:       catGastos.id ,
        name:           "Supermercado y Alimentos" ,
        icon:           "shopping-cart" ,
        color:          "#e67e22" ,
      } )
      .returning() ;

    console.log( "Categorías inicializadas con éxito." ) ;

    // 6. Crear Plan de Cuentas Contables Inicial
    console.log( "Creando plan de cuentas contables..." ) ;
    
    // Cuentas de Activo (Saldos positivos por defecto)
    const [ ctaBanco ] = await db
      .insert( accounts )
      .values( {
        organizationId: org.id ,
        code:           "1.1.01.01" ,
        name:           "Caja de Ahorro Galicia" ,
        type:           "asset" ,
        balance:        50000000 , // $500.000,00 ARS en centavos
        currency:       "ARS" ,
      } )
      .returning() ;

    const [ ctaEfectivo ] = await db
      .insert( accounts )
      .values( {
        organizationId: org.id ,
        code:           "1.1.01.02" ,
        name:           "Efectivo en Billetera" ,
        type:           "asset" ,
        balance:        2000000 , // $20.000,00 ARS en centavos
        currency:       "ARS" ,
      } )
      .returning() ;

    // Cuentas de Pasivo (Saldos negativos representan deudas)
    const [ ctaTarjeta ] = await db
      .insert( accounts )
      .values( {
        organizationId: org.id ,
        code:           "2.1.01.01" ,
        name:           "Tarjeta Visa Galicia" ,
        type:           "liability" ,
        balance:        -4500000 , // -$45.000,00 ARS en centavos (deuda inicial)
        currency:       "ARS" ,
      } )
      .returning() ;

    // Cuentas de Patrimonio, Ingresos y Gastos
    await db
      .insert( accounts )
      .values( {
        organizationId: org.id ,
        code:           "3.1.01.01" ,
        name:           "Patrimonio Neto Inicial" ,
        type:           "equity" ,
        balance:        47500000 , // Aportes y capital neto inicial
        currency:       "ARS" ,
      } ) ;

    const [ ctaIngSueldo ] = await db
      .insert( accounts )
      .values( {
        organizationId: org.id ,
        code:           "4.1.01.01" ,
        name:           "Ingresos por Sueldos" ,
        type:           "revenue" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    const [ ctaGastoSuper ] = await db
      .insert( accounts )
      .values( {
        organizationId: org.id ,
        code:           "5.1.01.01" ,
        name:           "Gastos de Supermercado" ,
        type:           "expense" ,
        balance:        0 ,
        currency:       "ARS" ,
      } )
      .returning() ;

    console.log( "Cuentas contables inicializadas con éxito." ) ;

    // 7. Sembrar Transacciones de Partida Doble Iniciales usando el motor oficial
    console.log( "Registrando transacciones contables balanceadas de prueba..." ) ;

    // Transacción 1: Cobro de Sueldo Neto ($350.000,00 ARS)
    // - Débito en Galicia (Activo sube): 35000000
    // - Crédito en Ingresos por Sueldos (Ingresos sube): 35000000
    await createLedgerTransaction( {
      organizationId: org.id ,
      categoryId:     subSueldos.id ,
      description:    "Sueldo Neto de Junio" ,
      merchantName:   "Tech Innovators S.A." ,
      entries: [
        {
          accountId: ctaBanco.id ,
          debit:     35000000 ,
          credit:    0 ,
        } ,
        {
          accountId: ctaIngSueldo.id ,
          debit:     0 ,
          credit:    35000000 ,
        }
      ] ,
    } ) ;

    // Transacción 2: Gasto en Supermercado con Efectivo ($12.500,00 ARS)
    // - Débito en Gastos de Supermercado (Gastos sube): 1250000
    // - Crédito en Efectivo (Activo baja): 1250000
    await createLedgerTransaction( {
      organizationId: org.id ,
      categoryId:     subSupermercado.id ,
      description:    "Compra semanal de despensa" ,
      merchantName:   "Supermercados Coto" ,
      merchantDomain: "coto.com.ar" ,
      entries: [
        {
          accountId: ctaGastoSuper.id ,
          debit:     1250000 ,
          credit:    0 ,
        } ,
        {
          accountId: ctaEfectivo.id ,
          debit:     0 ,
          credit:    1250000 ,
        }
      ] ,
    } ) ;

    // Transacción 3: Pago parcial de la deuda de Tarjeta de Crédito ($15.000,00 ARS)
    // - Débito en Tarjeta Visa (Pasivo deudor, disminuye deuda acercando a 0): 1500000
    // - Crédito en Galicia (Activo acreedor, disminuye saldo): 1500000
    await createLedgerTransaction( {
      organizationId: org.id ,
      description:    "Pago parcial de Tarjeta Visa" ,
      entries: [
        {
          accountId: ctaTarjeta.id ,
          debit:     1500000 ,
          credit:    0 ,
        } ,
        {
          accountId: ctaBanco.id ,
          debit:     0 ,
          credit:    1500000 ,
        }
      ] ,
    } ) ;

    console.log( "Transacciones contables de partida doble sembradas con éxito." ) ;
    console.log( "-------------------------------------------------------------" ) ;
    console.log( "Credenciales de prueba listas para usar:"                      ) ;
    console.log( `Email:    ${usuario.email}`                                    ) ;
    console.log( `Password: ${contraseniaPlana}`                                 ) ;
    console.log( "-------------------------------------------------------------" ) ;

  } catch( error ) {
    console.error( "Error durante el seeding de base de datos:" , error ) ;
    process.exit( 1 ) ;
  }

  console.log( "Seed finalizado con éxito." ) ;
  process.exit( 0 ) ;
}

main() ;