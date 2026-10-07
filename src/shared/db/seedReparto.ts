/**
 * @file seedReparto.ts
 * Seed pequeño y aparte para probar a mano el reparto y la caja común.
 * Arma la organización `reparto-demo` con tres miembros, cuentas, contactos, un acuerdo de reparto
 * sin caja activada y los movimientos del mes en curso. No toca ninguna otra organización.
 * Es idempotente: si la organización ya existe, la elimina por completo y la recrea.
 */
// Librerías externas
import * as dotenv from "dotenv" ;
import { eq }      from "drizzle-orm" ;

// Carga las variables de entorno de .env.local antes de inicializar la conexión
dotenv.config( {path: ".env.local"} ) ;

// Feature: Accounting
import { provisionarOrganizacion } from "@/features/accounting/services/organizationProvisioningService" ;
import { createLedgerTransaction } from "@/features/accounting/services/accountingService" ;
import { accounts , financialEntities } from "@/features/accounting/schema.db" ;

// Feature: Contacts
import { contacts } from "@/features/contacts/schema.db" ;

// Feature: Splits
import { organizationAgreements , agreementPercentages } from "@/features/splits/schema.db" ;

// Feature: Auth
import { organizationRepository } from "@/features/auth/repositories/organizationRepository" ;
import { organizations , users , memberships } from "@/features/auth/schema.db" ;
import { hashPassword } from "@/features/auth/services/authService" ;

// Feature: Profile
import { profiles } from "@/features/profile/schema.db" ;

/** Miembros de la organización demo: correo, nombre y rol. */
const MIEMBROS = [
  { email: "juan@demo.test" , name: "Juan" , role: "owner"  } ,
  { email: "ana@demo.test"  , name: "Ana"  , role: "member" } ,
  { email: "vera@demo.test" , name: "Vera" , role: "viewer" } ,
] as const ;

const CONTRASENIA = "AdminPass123!" ;

async function main() {
  console.log( "Iniciando seed de reparto..." ) ;

  try {
    const { db } = await import( "./client" ) ;

    // 1. Idempotencia: sólo se elimina la organización demo, nunca otra
    const [ existente ] = await db.select( {id: organizations.id} ).from( organizations ).where( eq( organizations.slug , "reparto-demo" ) ) ;

    if( existente ) {
      console.log( "Eliminando la organización 'reparto-demo' previa..." ) ;
      await db.transaction( async ( tx ) => {
        await organizationRepository.eliminarCompleta( existente.id , tx ) ;
      } ) ;
    }

    const [ org ] = await db.insert( organizations ).values( {name: "Reparto Demo" , slug: "reparto-demo"} ).returning() ;
    const { hash , salt , params } = await hashPassword( CONTRASENIA ) ;

    // 2. Usuarios, membresías y perfiles
    const idPorEmail = new Map< string , string >() ;

    for( const miembro of MIEMBROS ) {
      const [ usuario ] = await db
        .insert( users )
        .values( {
          lastOrganizationId: org.id ,
          email:              miembro.email ,
          name:               miembro.name ,
          passwordHash:       hash ,
          salt:               salt ,
          hashParams:         params ,
        } )
        .onConflictDoUpdate( {
          target: users.email ,
          set: {
            lastOrganizationId: org.id ,
            name:               miembro.name ,
            passwordHash:       hash ,
            salt:               salt ,
            hashParams:         params ,
            updatedAt:          new Date() ,
          } ,
        } )
        .returning() ;

      idPorEmail.set( miembro.email , usuario.id ) ;

      await db.insert( memberships ).values( {userId: usuario.id , organizationId: org.id , role: miembro.role} ) ;

      await db
        .insert( profiles )
        .values( {
          userId:       usuario.id ,
          currency:     "ARS" ,
          timezone:     "America/Argentina/Buenos_Aires" ,
          theme:        "system" ,
          defaultView:  "dashboard" ,
          fastLogin:    true ,
          weeklyStart:  "monday" ,
          dateFormat:   "DD/MM/YYYY" ,
          numberFormat: "es-AR" ,
        } )
        .onConflictDoUpdate( {
          target: profiles.userId ,
          set:    { currency: "ARS" } ,
        } ) ;
    }

    // 3. Catálogo, entidades y cuentas
    const { categoriasPorCodigo , cuentasPorCodigo , cuentaPatrimonio } = await provisionarOrganizacion( org.id , db ) ;

    const [ entBanco ] = await db
      .insert( financialEntities )
      .values( {organizationId: org.id , name: "Banco Demo" , logo: "bank" , brandDomain: null , color: "#e67e22"} )
      .returning() ;

    const [ entEfectivo ] = await db
      .insert( financialEntities )
      .values( {organizationId: org.id , name: "Efectivo" , logo: "cash" , brandDomain: null , color: "#2ecc71"} )
      .returning() ;

    const [ ctaBanco ] = await db
      .insert( accounts )
      .values( {organizationId: org.id , code: "1.1.01.01" , name: "Banco" , type: "asset" , balance: 0 , currency: "ARS" , entityId: entBanco.id} )
      .returning() ;

    const [ ctaCaja ] = await db
      .insert( accounts )
      .values( {organizationId: org.id , code: "1.1.01.03" , name: "Caja común" , type: "asset" , balance: 0 , currency: "ARS" , entityId: entEfectivo.id} )
      .returning() ;

    await db
      .insert( accounts )
      .values( {organizationId: org.id , code: "2.1.01.01" , name: "Tarjeta" , type: "liability" , balance: 0 , currency: "ARS" , entityId: entBanco.id} ) ;

    // 4. Contactos
    await db.insert( contacts ).values( [
      {organizationId: org.id , name: "Pedro Gómez" , email: "pedro@demo.test" , phone: "+54 9 11 5555 0001"} ,
      {organizationId: org.id , name: "Lucía Pérez" , email: "lucia@demo.test" , phone: "+54 9 11 5555 0002"} ,
    ] ) ;

    // 5. Acuerdo: 50/50 entre Juan y Ana, Vera sin porcentaje, sin caja común
    await db.insert( organizationAgreements ).values( {
      organizationId:  org.id ,
      mode:            "fixed_percentages" ,
      usesCommonPot:   false ,
      updatedByUserId: idPorEmail.get( "juan@demo.test" )! ,
    } ) ;

    await db.insert( agreementPercentages ).values( [
      {organizationId: org.id , userId: idPorEmail.get( "juan@demo.test" )! , percentageBp: 5000} ,
      {organizationId: org.id , userId: idPorEmail.get( "ana@demo.test"  )! , percentageBp: 5000} ,
    ] ) ;

    // 6. Movimientos de este mes, con fecha no posterior a hoy
    const ahora = new Date() ;

    function fechaDelMes( dia: number , hora: number ): Date {
      const fecha = new Date( ahora.getFullYear() , ahora.getMonth() , Math.min( dia , ahora.getDate() ) , hora , 0 ) ;
      return( ( fecha > ahora ) ? ahora : fecha ) ;
    }

    async function registrarTransaccion( params: Parameters< typeof createLedgerTransaction >[0] , fecha: Date ) {
      const result = await createLedgerTransaction( { ...params , occurredAt: fecha } ) ;
      if( !result.success ) {
        throw( new Error( `Error al registrar transacción contable: ${result.error}` ) ) ;
      }

      return( result.value ) ;
    }

    const catSueldo        = categoriasPorCodigo.get( "4.1.01.01" )! ;
    const catSupermercado  = categoriasPorCodigo.get( "5.1.03.01" )! ;
    const catServicios     = categoriasPorCodigo.get( "5.1.02.04" )! ;
    const ctaIngSueldo     = cuentasPorCodigo.get( "4.1.01.01" )! ;
    const ctaGastoSuper    = cuentasPorCodigo.get( "5.1.03.01" )! ;
    const ctaGastoServicio = cuentasPorCodigo.get( "5.1.02.04" )! ;

    await registrarTransaccion( {
      organizationId: org.id ,
      description:    "Saldos iniciales" ,
      entries: [
        { accountId: ctaBanco.id , debit: 200000000 , credit: 0 } ,
        { accountId: ctaCaja.id , debit: 50000000 , credit: 0 } ,
        { accountId: cuentaPatrimonio.id , debit: 0 , credit: 250000000 }
      ]
    } , fechaDelMes( 1 , 8 ) ) ;

    await registrarTransaccion( {
      organizationId: org.id ,
      categoryId:     catSueldo.id ,
      description:    "Acreditación de haberes del mes" ,
      entries: [
        { accountId: ctaBanco.id , debit: 40000000 , credit: 0 } ,
        { accountId: ctaIngSueldo.id , debit: 0 , credit: 40000000 }
      ]
    } , fechaDelMes( 2 , 9 ) ) ;

    await registrarTransaccion( {
      organizationId: org.id ,
      categoryId:     catSupermercado.id ,
      description:    "Compra de supermercado" ,
      entries: [
        { accountId: ctaGastoSuper.id , debit: 4500000 , credit: 0 } ,
        { accountId: ctaBanco.id , debit: 0 , credit: 4500000 }
      ]
    } , fechaDelMes( 3 , 10 ) ) ;

    await registrarTransaccion( {
      organizationId: org.id ,
      categoryId:     catServicios.id ,
      description:    "Pago de servicios" ,
      entries: [
        { accountId: ctaGastoServicio.id , debit: 3000000 , credit: 0 } ,
        { accountId: ctaBanco.id , debit: 0 , credit: 3000000 }
      ]
    } , fechaDelMes( 4 , 11 ) ) ;

    await registrarTransaccion( {
      organizationId: org.id ,
      categoryId:     catSupermercado.id ,
      description:    "Compra de supermercado con la caja común" ,
      entries: [
        { accountId: ctaGastoSuper.id , debit: 2000000 , credit: 0 } ,
        { accountId: ctaCaja.id , debit: 0 , credit: 2000000 }
      ]
    } , fechaDelMes( 5 , 12 ) ) ;

    // 7. Salida para el checklist manual
    console.log( "Seed de reparto completado." ) ;
    console.log( `Correos: ${MIEMBROS.map( ( m ) => `${m.email} (${m.role})` ).join( " , " )}` ) ;
    console.log( `Contraseña: ${CONTRASENIA}` ) ;
    console.log( "Ruta del paso 1 del checklist: /es/settings" ) ;

    process.exit( 0 ) ;
  } catch( error ) {
    console.error( "Error durante el seed de reparto:" , error ) ;
    process.exit( 1 ) ;
  }
}

main() ;
