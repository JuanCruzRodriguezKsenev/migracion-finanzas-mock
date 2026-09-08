/**
 * @file seed.ts
 * Script para poblar la base de datos local con datos iniciales de prueba (seeding).
 * Inserta organizaciones, usuarios, perfiles, categorías contables, cuentas y transacciones.
 * Garantiza idempotencia mediante limpieza previa en desarrollo y valida la partida doble.
 */
// Librerías externas
import * as dotenv from "dotenv" ;
import { eq }      from "drizzle-orm" ;

// Carga las variables de entorno de .env.local antes de inicializar la conexión
dotenv.config( {path: ".env.local"} ) ;

// Feature: Accounting
import { categories , accounts , ledgerTransactions , ledgerEntries , monthlySummaries , financialEntities } from "@/features/accounting/schema.db" ;
import { createLedgerTransaction } from "@/features/accounting/services/accountingService" ;

// Feature: Subscriptions
import { subscriptions } from "@/features/subscriptions/schema.db" ;

// Feature: Auth
import { hashPassword } from "@/features/auth/services/authService" ;
import { organizations , users } from "@/features/auth/schema.db" ;

// Feature: Profile
import { profiles } from "@/features/profile/schema.db" ;

async function main() {
  console.log( "Iniciando seed de base de datos..." ) ;

  try {
    const { db } = await import( "./client" ) ;
    const contraseniaPlana = "AdminPass123!" ;

    // 1. Garantizar idempotencia limpiando registros previos en el orden correcto
    // Se preservan organizations y users con upsert para no invalidar sesiones JWT activas
    console.log( "Limpiando registros previos..." ) ;
    await db.delete( subscriptions      ) ;
    await db.delete( ledgerEntries      ) ;
    await db.delete( ledgerTransactions ) ;
    await db.delete( monthlySummaries   ) ;
    await db.delete( accounts           ) ;
    await db.delete( financialEntities  ) ;
    await db.delete( categories         ) ;
    await db.delete( profiles           ) ;

    // 2. Crear u obtener Organización demo existente y hashear contraseña en paralelo
    const [ [org] , {hash , salt , params} ] = await Promise.all( [
      db
        .insert( organizations )
        .values( {
          name: "Finanzas Familiares Demo" ,
          slug: "finanzas-familiares-demo" ,
        } )
        .onConflictDoUpdate( {
          target: organizations.slug ,
          set:    { name: "Finanzas Familiares Demo" } ,
        } )
        .returning() ,
      hashPassword( contraseniaPlana ) ,
    ] ) ;

    console.log( `Organización demo creada con ID: ${org.id}` ) ;

    // 3. Crear u obtener Usuario administrador demo (upsert por email)
    const [ usuario ] = await db
      .insert( users )
      .values( {
        organizationId: org.id ,
        email:          "admin@ejemplo.com" ,
        name:           "Admin Demo" ,
        role:           "owner" ,
        passwordHash:   hash ,
        salt:           salt ,
        hashParams:     params ,
      } )
      .onConflictDoUpdate( {
        target: users.email ,
        set: {
          organizationId: org.id ,
          name:           "Admin Demo" ,
          role:           "owner" ,
          passwordHash:   hash ,
          salt:           salt ,
          hashParams:     params ,
          updatedAt:      new Date() ,
        } ,
      } )
      .returning() ;

    console.log( `Usuario demo creado con Email: ${usuario.email}` ) ;

    // 4. Crear Perfil y Preferencias asociadas en Argentina/ARS (idempotente)
    await db
      .insert( profiles )
      .values( {
        userId:           usuario.id ,
        phone:            "+54 9 11 1234 5678" ,
        currency:         "ARS" ,
        timezone:         "America/Argentina/Buenos_Aires" ,
        bio:              "Administrador del panel financiero de FinanzIA." ,
        theme:            "system" ,
        defaultView:      "dashboard" ,
        fastLogin:        true ,
        weeklyStart:      "monday" ,
        dateFormat:       "DD/MM/YYYY" ,
        numberFormat:     "es-AR" ,
        roundAmounts:     false ,
        includeTransfers: true ,
        defaultAccount:   "Caja de Ahorro Galicia" ,
        planName:         "Básico" ,
        planBilling:      "Mensual" ,
        planNextCharge:   "" ,
      } )
      .onConflictDoUpdate( {
        target: profiles.userId ,
        set: {
          phone:            "+54 9 11 1234 5678" ,
          currency:         "ARS" ,
          timezone:         "America/Argentina/Buenos_Aires" ,
          bio:              "Administrador del panel financiero de FinanzIA." ,
          theme:            "system" ,
          defaultView:      "dashboard" ,
          fastLogin:        true ,
          weeklyStart:      "monday" ,
          dateFormat:       "DD/MM/YYYY" ,
          numberFormat:     "es-AR" ,
          roundAmounts:     false ,
          includeTransfers: true ,
          defaultAccount:   "Caja de Ahorro Galicia" ,
          planName:         "Básico" ,
          planBilling:      "Mensual" ,
          planNextCharge:   "" ,
        } ,
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
        color:          "#2ecc71"
      } )
      .returning() ;

    const [ catGastos ] = await db
      .insert( categories )
      .values( {
        organizationId: org.id ,
        name:           "Gastos" ,
        icon:           "trending-down" ,
        color:          "#e74c3c"
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
        color:          "#27ae60"
      } )
      .returning() ;

    const [ subSupermercado ] = await db
      .insert( categories )
      .values( {
        organizationId: org.id ,
        parentId:       catGastos.id ,
        name:           "Supermercado y Alimentos" ,
        icon:           "shopping-cart" ,
        color:          "#e67e22"
      } )
      .returning() ;

    const [ subServicios ] = await db
      .insert( categories )
      .values( {
        organizationId: org.id ,
        parentId:       catGastos.id ,
        name:           "Servicios del Hogar" ,
        icon:           "home" ,
        color:          "#3498db"
      } )
      .returning() ;

    const [ subAlquiler ] = await db
      .insert( categories )
      .values( {
        organizationId: org.id ,
        parentId:       catGastos.id ,
        name:           "Alquiler y Expensas" ,
        icon:           "key" ,
        color:          "#9b59b6"
      } )
      .returning() ;

    console.log( "Categorías inicializadas con éxito." ) ;

    // 5.5 Crear Entidades Financieras
    console.log( "Inicializando entidades financieras..." ) ;
    const [ entGalicia ] = await db
      .insert( financialEntities )
      .values( {
        organizationId: org.id ,
        name:           "Banco Galicia" ,
        logo:           "bank" ,
        brandDomain:    "galicia.ar" ,
        color:          "#e67e22"
      } )
      .returning() ;

    const [ entEfectivo ] = await db
      .insert( financialEntities )
      .values( {
        organizationId: org.id ,
        name:           "Efectivo" ,
        logo:           "cash" ,
        brandDomain:    null ,
        color:          "#2ecc71"
      } )
      .returning() ;

    // 6. Crear Plan de Cuentas Contables Inicial
    console.log( "Creando plan de cuentas contables..." ) ;

    // Cuentas de Activo (Saldos se computan dinámicamente)
    const [ ctaBanco ] = await db
      .insert( accounts )
      .values( {
        organizationId: org.id ,
        code:           "1.1.01.01" ,
        name:           "Caja de Ahorro Galicia" ,
        type:           "asset" ,
        balance:        0 ,
        currency:       "ARS" ,
        entityId:       entGalicia.id
      } )
      .returning() ;

    const [ ctaEfectivo ] = await db
      .insert( accounts )
      .values( {
        organizationId: org.id ,
        code:           "1.1.01.02" ,
        name:           "Efectivo en Billetera" ,
        type:           "asset" ,
        balance:        0 ,
        currency:       "ARS" ,
        entityId:       entEfectivo.id
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
        balance:        0 ,
        currency:       "ARS" ,
        entityId:       entGalicia.id
      } )
      .returning() ;

    // Cuentas de Patrimonio, Ingresos y Gastos
    const [ ctaPatrimonio ] = await db
      .insert( accounts )
      .values( {
        organizationId: org.id ,
        code:           "3.1.01.01" ,
        name:           "Patrimonio Neto Inicial" ,
        type:           "equity" ,
        balance:        0 ,
        currency:       "ARS"
      } )
      .returning() ;

    const [ ctaIngSueldo ] = await db
      .insert( accounts )
      .values( {
        organizationId: org.id ,
        code:           "4.1.01.01" ,
        name:           "Ingresos por Sueldos" ,
        type:           "revenue" ,
        balance:        0 ,
        currency:       "ARS"
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
        currency:       "ARS"
      } )
      .returning() ;

    const [ ctaGastoServicios ] = await db
      .insert( accounts )
      .values( {
        organizationId: org.id ,
        code:           "5.1.01.02" ,
        name:           "Gastos de Servicios" ,
        type:           "expense" ,
        balance:        0 ,
        currency:       "ARS"
      } )
      .returning() ;

    const [ ctaGastoAlquiler ] = await db
      .insert( accounts )
      .values( {
        organizationId: org.id ,
        code:           "5.1.01.03" ,
        name:           "Gastos de Alquiler" ,
        type:           "expense" ,
        balance:        0 ,
        currency:       "ARS"
      } )
      .returning() ;

    console.log( "Cuentas contables inicializadas con éxito." ) ;

    // 7. Sembrar Transacciones de Partida Doble
    console.log( "Registrando transacciones contables balanceadas de prueba..." ) ;

    // Helper para registrar y fechar una transacción contable
    async function registrarTransaccion( params: Parameters< typeof createLedgerTransaction >[0] , fecha: Date ) {
      const result = await createLedgerTransaction( params ) ;
      if( !result.success ) {
        throw( new Error( `Error al registrar transacción contable: ${result.error}` ) ) ;
      }

      // Actualizar createdAt en ledger_transactions y ledger_entries
      await db
        .update( ledgerTransactions )
        .set( { createdAt: fecha } )
        .where( eq( ledgerTransactions.id , result.value.id ) ) ;

      await db
        .update( ledgerEntries )
        .set( { createdAt: fecha } )
        .where( eq( ledgerEntries.transactionId , result.value.id ) ) ;

      return( result.value ) ;
    }

    // Patrimonio Inicial (hace 12 meses, fecha de apertura)
    const ahora = new Date() ;
    const fechaInicio = new Date( ahora.getFullYear() , ahora.getMonth() - 11 , 1 , 8 , 0 ) ;

    console.log( `Sembrando patrimonio inicial en fecha: ${fechaInicio.toISOString()}` ) ;

    await registrarTransaccion( {
      organizationId: org.id ,
      description:    "Aporte de capital y saldos iniciales" ,
      entries: [
        { accountId: ctaBanco.id , debit: 20000000 , credit: 0 } ,
        { accountId: ctaEfectivo.id , debit: 1500000 , credit: 0 } ,
        { accountId: ctaTarjeta.id , debit: 0 , credit: 2500000 } ,
        { accountId: ctaPatrimonio.id , debit: 0 , credit: 19000000 }
      ]
    } , fechaInicio ) ;

    // Sembrando resúmenes mensuales históricos cerrados (los últimos 11 meses cerrados)
    console.log( "Sembrando resúmenes mensuales históricos cerrados..." ) ;
    let saldoAcumulado = 19000000 ;

    for( let m = 11 ; m >= 1 ; m-- ) {
      const fechaMes = new Date( ahora.getFullYear() , ahora.getMonth() - m , 1 ) ;
      const year = fechaMes.getFullYear() ;
      const month = fechaMes.getMonth() ;

      const totalIngresos = ( ( Math.floor( Math.random() * 60000 ) + 320000 ) * 100 ) ;
      const totalGastos = ( ( Math.floor( Math.random() * 30000 ) + 230000 ) * 100 ) ;

      saldoAcumulado = ( saldoAcumulado + totalIngresos - totalGastos ) ;

      // Pasivos mensuales coherentes (saldos de tarjeta/deudas mensuales entre 20.000 y 35.000 pesos)
      const pasivosMes = ( ( Math.floor( Math.random() * 15000 ) + 20000 ) * 100 ) ;
      const activosMes = ( saldoAcumulado + pasivosMes ) ; // Invariante contable: Activos = Patrimonio Neto + Pasivos

      await db
        .insert( monthlySummaries )
        .values( {
          organizationId:      org.id ,
          year:                year ,
          month:               month ,
          totalRevenue:        totalIngresos ,
          totalExpense:        totalGastos ,
          balanceSnapshot:     saldoAcumulado ,
          assetsSnapshot:      activosMes ,
          liabilitiesSnapshot: pasivosMes ,
          createdAt:           new Date( year , month + 1 , 0 , 23 , 59 , 59 )
        } ) ;
    }

    // Registrar ajuste de saldos por acumulación histórica de ahorros
    const diferenciaAjuste = ( saldoAcumulado - 19000000 ) ;
    const fechaFinMayo     = new Date( ahora.getFullYear() , ahora.getMonth() , 0 , 18 , 0 ) ; // 31 de Mayo

    console.log( `Registrando ajuste de saldos históricos acumulados: $${( diferenciaAjuste / 100 ).toLocaleString()} ARS...` ) ;
    await registrarTransaccion( {
      organizationId: org.id ,
      description:    "Ajuste de saldos por acumulación histórica de ahorros" ,
      entries: [
        { accountId: ctaBanco.id , debit: diferenciaAjuste , credit: 0 } ,
        { accountId: ctaPatrimonio.id , debit: 0 , credit: diferenciaAjuste }
      ]
    } , fechaFinMayo ) ;

    // Sembrando transacciones diarias únicamente para el mes actual en curso (hasta el día de hoy)
    console.log( "Sembrando transacciones diarias del mes en curso..." ) ;
    const diasMesActual = ahora.getDate() ;

    for( let d = diasMesActual ; d >= 0 ; d-- ) {
      const fechaDia = new Date( ahora.getFullYear() , ahora.getMonth() , ahora.getDate() - d ) ;
      
      const diaDelMes = fechaDia.getDate() ;
      const diaDeLaSemana = fechaDia.getDay() ;

      // --- 1. Movimientos mensuales fijos ---
      // A. Sueldo (Día 5)
      if( diaDelMes === 5 ) {
        const fechaSueldo = new Date( fechaDia.getFullYear() , fechaDia.getMonth() , diaDelMes , 9 , 0 ) ;
        const montoSueldo = ( ( Math.floor( Math.random() * 60000 ) + 320000 ) * 100 ) ;
        await registrarTransaccion( {
          organizationId: org.id ,
          categoryId:     subSueldos.id ,
          description:    "Acreditación de haberes del mes" ,
          merchantName:   "Tech Innovators S.A." ,
          entries: [
            { accountId: ctaBanco.id , debit: montoSueldo , credit: 0 } ,
            { accountId: ctaIngSueldo.id , debit: 0 , credit: montoSueldo }
          ]
        } , fechaSueldo ) ;
      }

      // B. Alquiler (Día 10)
      if( ( diaDelMes === 10 ) && ( diaDelMes <= diasMesActual ) ) {
        const fechaAlquiler = new Date( fechaDia.getFullYear() , fechaDia.getMonth() , diaDelMes , 11 , 30 ) ;
        await registrarTransaccion( {
          organizationId: org.id ,
          categoryId:     subAlquiler.id ,
          description:    "Pago de alquiler mensual" ,
          entries: [
            { accountId: ctaGastoAlquiler.id , debit: 8500000 , credit: 0 } ,
            { accountId: ctaBanco.id , debit: 0 , credit: 8500000 }
          ]
        } , fechaAlquiler ) ;
      }

      // C. Servicios (Día 15)
      if( ( diaDelMes === 15 ) && ( diaDelMes <= diasMesActual ) ) {
        const fechaServicios = new Date( fechaDia.getFullYear() , fechaDia.getMonth() , diaDelMes , 14 , 15 ) ;
        const montoServicios = ( ( Math.floor( Math.random() * 6000 ) + 22000 ) * 100 ) ;
        await registrarTransaccion( {
          organizationId: org.id ,
          categoryId:     subServicios.id ,
          description:    "Pago de luz y telecomunicaciones" ,
          merchantName:   "Edesur / Fibertel" ,
          entries: [
            { accountId: ctaGastoServicios.id , debit: montoServicios , credit: 0 } ,
            { accountId: ctaBanco.id , debit: 0 , credit: montoServicios }
          ]
        } , fechaServicios ) ;
      }

      // D. Pago de Tarjeta de Crédito (Día 22)
      if( ( diaDelMes === 22 ) && ( diaDelMes <= diasMesActual ) ) {
        const fechaTarjeta = new Date( fechaDia.getFullYear() , fechaDia.getMonth() , diaDelMes , 10 , 0 ) ;
        const montoPagoTarjeta = ( ( Math.floor( Math.random() * 30000 ) + 30000 ) * 100 ) ;
        await registrarTransaccion( {
          organizationId: org.id ,
          description:    "Pago de saldo del resumen de tarjeta" ,
          entries: [
            { accountId: ctaTarjeta.id , debit: montoPagoTarjeta , credit: 0 } ,
            { accountId: ctaBanco.id , debit: 0 , credit: montoPagoTarjeta }
          ]
        } , fechaTarjeta ) ;
      }

      // --- 2. Movimientos cotidianos (gastos diarios aleatorios) ---
      if( Math.random() < 0.65 ) {
        const cantCompras = ( Math.floor( Math.random() * 3 ) + 1 ) ;
        
        for( let c = 0 ; c < cantCompras ; c++ ) {
          const hora = ( Math.floor( Math.random() * 12 ) + 8 ) ;
          const min = Math.floor( Math.random() * 60 ) ;
          const fechaCompra = new Date( fechaDia.getFullYear() , fechaDia.getMonth() , diaDelMes , hora , min ) ;

          const montoGasto = ( ( Math.floor( Math.random() * 3900 ) + 600 ) * 100 ) ;
          const ctaPagoId = Math.random() > 0.5 ? ctaEfectivo.id : ctaBanco.id ;

          await registrarTransaccion( {
            organizationId: org.id ,
            categoryId:     subSupermercado.id ,
            description:    c === 0 ? "Café y colación de paso" : c === 1 ? "Carga de transporte público" : "Gastos menores diarios" ,
            entries: [
              { accountId: ctaGastoSuper.id , debit: montoGasto , credit: 0 } ,
              { accountId: ctaPagoId , debit: 0 , credit: montoGasto }
            ]
          } , fechaCompra ) ;
        }
      }

      // --- 3. Movimientos del fin de semana (Viernes, Sábado o Domingo) ---
      if( ( diaDeLaSemana === 0 ) || ( diaDeLaSemana === 5 ) || ( diaDeLaSemana === 6 ) ) {
        if( Math.random() < 0.40 ) {
          const hora = ( Math.floor( Math.random() * 4 ) + 20 ) ;
          const fechaSalida = new Date( fechaDia.getFullYear() , fechaDia.getMonth() , diaDelMes , hora , 0 ) ;
          
          const montoSalida = ( ( Math.floor( Math.random() * 17000 ) + 8000 ) * 100 ) ;
          const ctaPagoId = Math.random() > 0.3 ? ctaTarjeta.id : ctaBanco.id ;

          await registrarTransaccion( {
            organizationId: org.id ,
            categoryId:     subSupermercado.id ,
            description:    "Salida fin de semana y esparcimiento" ,
            entries: [
              { accountId: ctaGastoSuper.id , debit: montoSalida , credit: 0 } ,
              { accountId: ctaPagoId , debit: 0 , credit: montoSalida }
            ]
          } , fechaSalida ) ;
        }
      }
    }

    console.log( "Transacciones contables de partida doble sembradas con éxito." ) ;

    // 10. Sembrar Suscripciones Recurrentes demo (montos en centavos)
    console.log( "Sembrando suscripciones recurrentes demo..." ) ;

    const inicioSuscripciones = new Date( ahora.getFullYear() , ahora.getMonth() - 3 , 5 , 9 , 0 ) ;
    const proximoCobro        = new Date( ahora.getFullYear() , ahora.getMonth() + 1 , 5 , 9 , 0 ) ;

    await db.insert( subscriptions ).values( [
      { organizationId: org.id , name: "Netflix"              , amount: 1599000 , frequency: "monthly" , startDate: inicioSuscripciones , nextPaymentDate: proximoCobro , logoKey: "https://logo.clearbit.com/netflix.com" , color: "#E50914" , category: "entertainment" } ,
      { organizationId: org.id , name: "Spotify"              , amount: 649900  , frequency: "monthly" , startDate: inicioSuscripciones , nextPaymentDate: proximoCobro , logoKey: "https://logo.clearbit.com/spotify.com" , color: "#1DB954" , category: "entertainment" } ,
      { organizationId: org.id , name: "ChatGPT Plus"         , amount: 2000000 , frequency: "monthly" , startDate: inicioSuscripciones , nextPaymentDate: proximoCobro , logoKey: "https://logo.clearbit.com/openai.com"  , color: "#10A37F" , category: "productivity"  } ,
      { organizationId: org.id , name: "Adobe Creative Cloud" , amount: 5499000 , frequency: "monthly" , startDate: inicioSuscripciones , nextPaymentDate: proximoCobro , logoKey: "https://logo.clearbit.com/adobe.com"   , color: "#FF0000" , category: "design"        } ,
      { organizationId: org.id , name: "Gimnasio"             , amount: 3500000 , frequency: "monthly" , startDate: inicioSuscripciones , nextPaymentDate: proximoCobro , logoKey: "gym"                                   , color: "#DBEAFE" , category: "fitness"       } ,
      { organizationId: org.id , name: "iCloud+"              , amount: 129900  , frequency: "monthly" , startDate: inicioSuscripciones , nextPaymentDate: proximoCobro , logoKey: "https://logo.clearbit.com/apple.com"   , color: "#000000" , category: "storage"       } ,
      { organizationId: org.id , name: "NordVPN"              , amount: 4800000 , frequency: "yearly"  , startDate: inicioSuscripciones , nextPaymentDate: proximoCobro , logoKey: "https://logo.clearbit.com/nordvpn.com" , color: "#4687FF" , category: "security"      } ,
      { organizationId: org.id , name: "Figma"                , amount: 1200000 , frequency: "monthly" , startDate: inicioSuscripciones , nextPaymentDate: proximoCobro , logoKey: "https://logo.clearbit.com/figma.com"   , color: "#F24E1E" , category: "design"        }
    ] ) ;

    console.log( "Suscripciones demo sembradas con éxito." ) ;
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