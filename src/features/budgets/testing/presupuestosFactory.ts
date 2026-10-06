/**
 * @file presupuestosFactory.ts
 * Fixtures de integración compartidos por las suites de presupuestos: organización, árbol de
 * categorías con su cuenta de gasto y una cuenta de banco para generar gastos reales en el libro.
 */
// Shared
import { db } from "@/shared/db/client" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import { accounts , categories , categoryAccounts }  from "@/features/accounting/schema.db" ;
import { createLedgerTransaction }                   from "@/features/accounting/services/accountingService" ;


export interface EscenarioPresupuestos {
  orgId:      string ;
  banco:      string ;
  padre:      string ;
  hoja:       string ;
  general:    string ;
  otraHoja:   string ;
  otroPadre:  string ;
  ingreso:    string ;
  cuentaDe:   Record< string , string > ;
}

/**
 * Crea una organización con: padre "Hogar" (hoja "Alquiler" y hoja de sistema "General"),
 * padre "Ocio" (hoja "Cine"), una categoría de ingresos y una cuenta de banco ARS.
 * Cada categoría con hojas imputables tiene su cuenta de gasto (o ingreso) en ARS.
 *
 * @param slug - Slug único de la organización.
 * @returns Identificadores del escenario.
 */
export async function crearEscenario( slug: string ): Promise< EscenarioPresupuestos > {
  const [ org ] = await db.insert( organizations ).values( { name: `Org ${slug}` , slug } ).returning() ;
  const orgId   = org.id ;

  const crearCat = async ( name: string , code: string , type: string , parentId: string | null , isSystemLeaf = false ) => {
    const [ c ] = await db.insert( categories ).values( { organizationId: orgId , name , accountCode: code , type , parentId , isSystemLeaf } ).returning() ;
    return( c ) ;
  } ;

  const padre     = await crearCat( "Hogar"    , "5.1"       , "expense" , null ) ;
  const hoja      = await crearCat( "Alquiler" , "5.1.01"    , "expense" , padre.id ) ;
  const general   = await crearCat( "General"  , "5.1.99"    , "expense" , padre.id , true ) ;
  const otroPadre = await crearCat( "Ocio"     , "5.2"       , "expense" , null ) ;
  const otraHoja  = await crearCat( "Cine"     , "5.2.01"    , "expense" , otroPadre.id ) ;
  const ingreso   = await crearCat( "Sueldos"  , "4.1"       , "revenue" , null ) ;

  const [ banco ] = await db.insert( accounts ).values( {
    organizationId: orgId , code: "1.1.01.01" , name: "Banco ARS" , type: "asset" , balance: 0 , currency: "ARS" ,
  } ).returning() ;

  const cuentaDe: Record< string , string > = {} ;
  let n = 1 ;
  for( const cat of [ hoja , general , otraHoja ] ) {
    const [ cta ] = await db.insert( accounts ).values( {
      organizationId: orgId , code: `5.9.01.0${n++}` , name: `Gasto ${cat.name}` , type: "expense" , balance: 0 , currency: "ARS" ,
    } ).returning() ;
    await db.insert( categoryAccounts ).values( { categoryId: cat.id , accountId: cta.id , currency: "ARS" } ) ;
    cuentaDe[ cat.id ] = cta.id ;
  }

  return( {
    orgId ,
    banco:     banco.id ,
    padre:     padre.id ,
    hoja:      hoja.id ,
    general:   general.id ,
    otraHoja:  otraHoja.id ,
    otroPadre: otroPadre.id ,
    ingreso:   ingreso.id ,
    cuentaDe ,
  } ) ;
}

/**
 * Registra un gasto real en el libro (Debe gasto / Haber banco).
 *
 * @param e - Escenario.
 * @param categoryId - Categoría hoja cuya cuenta de gasto se debita.
 * @param monto - Centavos.
 * @param fecha - Instante del asiento.
 * @returns ID de la transacción creada.
 */
export async function registrarGasto( e: EscenarioPresupuestos , categoryId: string , monto: number , fecha: string ): Promise< string > {
  const r = await createLedgerTransaction( {
    organizationId: e.orgId ,
    occurredAt:     new Date( fecha ) ,
    description:    "Gasto de prueba" ,
    entries: [
      { accountId: e.cuentaDe[ categoryId ] , debit: monto , credit: 0 } ,
      { accountId: e.banco                  , debit: 0 , credit: monto } ,
    ] ,
  } ) ;

  if( !r.success ) {
    throw( new Error( r.error ) ) ;
  }

  return( r.value.id ) ;
}
