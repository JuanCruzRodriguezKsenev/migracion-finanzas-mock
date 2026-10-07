/**
 * @file acuerdoService.ts
 * Reglas del acuerdo de reparto: validar lo que guarda un `owner` y resolver cómo se reparte un gasto.
 * Todo se lee de la base dentro de la transacción recibida; nada viene del token ni del cliente.
 */
// Librerías externas
import { eq , and , inArray } from "drizzle-orm" ;

// Shared
import { Result , ok , fail } from "@/shared/lib/result" ;
import { db , DBOrTx }        from "@/shared/db/client" ;
import { claveDeMes }         from "@/shared/lib/monthKey" ;

// Feature: Budgets
import { budgetsService } from "@/features/budgets/services/budgetsService" ;

// Feature: Auth
import { membershipRepository } from "@/features/auth/repositories/membershipRepository" ;

// Feature: Accounting
import { accounts } from "@/features/accounting/schema.db" ;

// Feature: Splits
import { acuerdoRepository }              from "../repositories/acuerdoRepository" ;
import { decidirReparto , calcularPesos , repartir , type ModoAcuerdo , type MotivoReparto } from "../utils/reparto" ;


/** Total de puntos básicos de un acuerdo completo (100 %). */
export const TOTAL_BP = 10000 ;

/** Mensaje de rechazo cuando el acuerdo no cuadra con los miembros actuales (S-S). */
export const MENSAJE_DESACTUALIZADO = "El acuerdo está desactualizado: un owner debe revisarlo." ;

/**
 * Puntos básicos como texto de porcentaje: `9000` → `"90"`, `3333` → `"33,33"`, `1050` → `"10,5"`.
 *
 * @param bp - Puntos básicos enteros.
 * @returns Porcentaje con coma decimal y sin ceros sobrantes.
 */
export function porcentajeComoTexto( bp: number ): string {
  const entero   = Math.trunc( bp / 100 ) ;
  const decimal  = String( Math.abs( bp % 100 ) ).padStart( 2 , "0" ).replace( /0+$/ , "" ) ;

  return( decimal ? `${entero},${decimal}` : String( entero ) ) ;
}

/** Datos de entrada de la validación. */
export interface EntradaValidarAcuerdo {
  modo:             ModoAcuerdo ;
  porcentajes:      { userId: string ; percentageBp: number }[] ;
  miembrosNoViewer: string[] ;
}

/**
 * Valida el acuerdo que quiere guardar un `owner`. En `fixed_percentages` cada `userId` tiene que ser un
 * miembro no `viewer` actual de la organización de la sesión (AC-29) y la suma tiene que ser exactamente
 * `10000` bp (A6). En `monthly_contributions` y `none` no hay porcentajes.
 *
 * @param datos - Modo, porcentajes y miembros no `viewer` vigentes.
 * @returns Los porcentajes a guardar, o `fail` con el motivo.
 */
export function validarAcuerdo( datos: EntradaValidarAcuerdo ): Result< { userId: string ; percentageBp: number }[] , string > {
  const { modo , porcentajes , miembrosNoViewer } = datos ;

  if( modo !== "fixed_percentages" ) {
    return( ok( [] ) ) ;
  }

  const vistos = new Set< string >() ;
  let suma     = 0 ;

  for( const p of porcentajes ) {
    if( !miembrosNoViewer.includes( p.userId ) ) {
      return( fail( "Un porcentaje corresponde a alguien que no es miembro de la organización." ) ) ;
    }

    if( vistos.has( p.userId ) ) {
      return( fail( "Hay un miembro repetido en los porcentajes." ) ) ;
    }

    if( !Number.isInteger( p.percentageBp ) || (p.percentageBp < 0) || (p.percentageBp > TOTAL_BP) ) {
      return( fail( "Cada porcentaje debe estar entre 0 y 100." ) ) ;
    }

    vistos.add( p.userId ) ;
    suma += p.percentageBp ;
  }

  if( suma !== TOTAL_BP ) {
    const faltan = ( suma < TOTAL_BP ) ;
    const resto  = Math.abs( TOTAL_BP - suma ) ;

    return( fail( `Suman ${porcentajeComoTexto( suma )} %: ${faltan ? "faltan" : "sobran"} ${porcentajeComoTexto( resto )}` ) ) ;
  }

  return( ok( porcentajes.filter( ( p ) => (p.percentageBp > 0) ) ) ) ;
}

/** Datos de un gasto para resolver su reparto. */
export interface EntradaResolverReparto {
  orgId:           string ;
  autorId:         string ;
  /** Titular pedido; si falta, el titular es el autor (RN-7). */
  titularId?:      string | null ;
  tipo:            string ;
  montoEnCentavos: number ;
  currency:        string ;
  occurredAt?:     Date | string | null ;
  /** Ids de las cuentas de los asientos. */
  cuentas:         string[] ;
  esGastoManual:   boolean ;
}

/** Resultado de resolver el reparto de un gasto. */
export interface RepartoResuelto {
  aplica:        boolean ;
  motivo:        MotivoReparto ;
  /** Titular efectivo (acreedor) cuando aplica. */
  titularId:     string | null ;
  deudas:        { userId: string ; montoEnCentavos: number }[] ;
  parteTitular:  number ;
  /** Peso de cada miembro no `viewer` (con 0 incluido), en el orden de la lista de miembros. */
  pesos:         { userId: string ; peso: number }[] ;
  partesIguales: boolean ;
  desactualizado: boolean ;
}

const SIN_REPARTO = ( motivo: MotivoReparto ): RepartoResuelto => ( {
  aplica: false , motivo , titularId: null , deudas: [] , parteTitular: 0 , pesos: [] , partesIguales: false , desactualizado: false ,
} ) ;

/**
 * Resuelve el reparto de un gasto. Lee de la base **dentro de `tx`**: acuerdo, miembros y roles actuales,
 * porcentajes, aportes, `is_common_pot` de las cuentas, la zona del autor y el mes del gasto (S-V).
 * Es el único cálculo: lo usan la carga y la vista previa (RN-17).
 *
 * En modo `fixed_percentages`, si los porcentajes de los miembros actuales no suman `10000` el resultado
 * es `desactualizado: true` y no hay deudas (S-S).
 *
 * @param datos - El gasto: autor, titular, tipo, monto, fecha y cuentas.
 * @param tx - Transacción activa (o la base, para la vista previa).
 * @returns Si aplica, el motivo y las deudas.
 */
export async function resolverReparto( datos: EntradaResolverReparto , tx: DBOrTx = db ): Promise< RepartoResuelto > {
  const { orgId , autorId , tipo , montoEnCentavos , occurredAt , cuentas , esGastoManual } = datos ;

  const acuerdo  = await acuerdoRepository.obtener( orgId , tx ) ;
  const modo     = acuerdo?.modo ?? "none" ;
  const miembros = await membershipRepository.findByOrganization( orgId , tx ) ;
  const noViewer = miembros.filter( ( m ) => (m.rol !== "viewer") ).map( ( m ) => m.userId ) ;
  const titular  = ( datos.titularId || autorId ) ;
  const rolTitular = miembros.find( ( m ) => (m.userId === titular) )?.rol ;

  const cuentasDelGasto = ( cuentas.length > 0 )
    ? await tx.select( { id: accounts.id , isCommonPot: accounts.isCommonPot } ).from( accounts ).where( and( eq( accounts.organizationId , orgId ) , inArray( accounts.id , cuentas ) ) )
    : [] ;

  const decision = decidirReparto( {
    esGastoManual ,
    tipo ,
    modo ,
    cantidadMiembrosNoViewer: noViewer.length ,
    algunaCuentaEsCajaComun:  cuentasDelGasto.some( ( c ) => c.isCommonPot ) ,
    titularEsViewer:          ( !rolTitular || (rolTitular === "viewer") ) ,
  } ) ;

  if( !decision.aplica ) {
    return( SIN_REPARTO( decision.motivo ) ) ;
  }

  const porcentajesBp = new Map( ( acuerdo?.porcentajes ?? [] ).map( ( p ) => [ p.userId , p.percentageBp ] as [ string , number ] ) ) ;

  if( modo === "fixed_percentages" ) {
    const sumaActual = noViewer.reduce( ( s , id ) => ( s + (porcentajesBp.get( id ) ?? 0) ) , 0 ) ;

    if( sumaActual !== TOTAL_BP ) {
      return( { ...SIN_REPARTO( "aplica" ) , aplica: true , titularId: titular , desactualizado: true } ) ;
    }
  }

  // El mes se calcula con la zona del autor (S-V)
  const { zona } = await budgetsService.preferenciasDe( autorId ) ;
  const [ year , month ] = claveDeMes( occurredAt ?? new Date() , zona ).split( "-" ).map( Number ) ;

  const aportes = ( modo === "monthly_contributions" ) ? await acuerdoRepository.aportesDe( orgId , noViewer , tx ) : [] ;
  const { pesos , partesIguales } = calcularPesos( { modo , miembros: noViewer , porcentajesBp , aportes , mes: { year , month } } ) ;
  const { deudas , parteTitular } = repartir( { montoEnCentavos , titularId: titular , pesos } ) ;

  return( {
    aplica:         true ,
    motivo:         "aplica" ,
    titularId:      titular ,
    deudas ,
    parteTitular ,
    pesos:          noViewer.map( ( userId ) => ( { userId , peso: ( pesos.get( userId ) ?? 0 ) } ) ) ,
    partesIguales ,
    desactualizado: false ,
  } ) ;
}

