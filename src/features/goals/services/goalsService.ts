/**
 * @file goalsService.ts
 * Servicio de Metas: operaciones atómicas (aportar, retirar, abandonar, crear, editar) y vista (RFC 011 §3 y §4).
 *
 * Aportar y retirar NO generan asientos contables ni tocan `accounts.balance` (RN-5, RN-16): el ahorro
 * es virtual y se calcula como suma del registro `goal_movements`.
 * Toda escritura abre su `db.transaction` y bloquea siempre en el orden **meta → cuenta**.
 */
// Shared
import { db , DBOrTx }        from "@/shared/db/client" ;
import { Result , ok , fail } from "@/shared/lib/result" ;
import { formatCurrency }     from "@/shared/lib/currencyFormatter" ;

// Feature: Profile
import { profileRepository } from "@/features/profile/repositories/profileRepository" ;

// Feature: Accounting
import { accountRepository } from "@/features/accounting/repositories/accountRepository" ;

// Feature: Goals
import { goalMovementsRepository } from "../repositories/goalMovementsRepository" ;
import { goalsRepository }         from "../repositories/goalsRepository" ;
import {
  porcentaje ,
  porcentajeParaBarra ,
  mesesRestantes ,
  aporteSugerido ,
  estaVencida ,
  transicionDeEstado
} from "./goalCalculations" ;
import type {
  Goal ,
  GoalFilter ,
  GoalPriority ,
  GoalStatus ,
  GoalView ,
  GoalsViewData ,
  GoalIndicators ,
  GoalCompatibleAccount ,
  ReservedByAccount
} from "../types" ;


const ZONA_POR_DEFECTO   = "America/Argentina/Buenos_Aires" ;
const MONEDA_POR_DEFECTO = "ARS" ;
const HISTORIAL_CORTO    = 5 ;

/**
 * Aplica `transicionDeEstado` con el ahorrado actual y persiste el cambio si lo hubo.
 * Debe correr dentro de la transacción que ya bloqueó la meta.
 *
 * @param goal - Meta bloqueada (con su estado vigente).
 * @param objetivo - Objetivo contra el que se evalúa (puede ser el nuevo, en una edición).
 * @param tx - Transacción en curso.
 * @returns El estado resultante.
 */
async function sincronizarEstado( goal: Goal , objetivo: number , tx: DBOrTx ): Promise< GoalStatus > {
  const totales  = await goalMovementsRepository.sumSignedByGoal( [ goal.id ] , goal.organizationId , tx ) ;
  const ahorrado = totales[ goal.id ] ?? 0 ;
  const nuevo    = transicionDeEstado( goal.status as GoalStatus , ahorrado , objetivo ) ;

  if( nuevo !== goal.status ) {
    await goalsRepository.setStatus( goal.id , goal.organizationId , nuevo , ( nuevo === "completed" ) ? new Date() : null , tx ) ;
  }
  return( nuevo ) ;
}

/**
 * Compara dos metas según el orden de la lista (RN-20): prioritarias, fecha más próxima
 * (las sin fecha al final) y nombre.
 */
function compararMetas( a: Goal , b: Goal ): number {
  const pa = ( a.priority === "high" ) ? 0 : 1 ;
  const pb = ( b.priority === "high" ) ? 0 : 1 ;
  if( pa !== pb ) {
    return( pa - pb ) ;
  }
  if( a.targetDate !== b.targetDate ) {
    if( !a.targetDate ) {
      return( 1 ) ;
    }
    if( !b.targetDate ) {
      return( -1 ) ;
    }
    return( a.targetDate < b.targetDate ? -1 : 1 ) ;
  }
  return( a.name.localeCompare( b.name ) ) ;
}

export const goalsService = {
  /**
   * Crea una meta activa. La divisa es inmutable desde acá.
   */
  async crear( params: {
    orgId:        string ;
    name:         string ;
    currency:     string ;
    targetAmount: number ;
    targetDate?:  string | null ;
    priority?:    GoalPriority ;
  } ): Promise< Result< Goal , string > > {
    if( !Number.isInteger( params.targetAmount ) || (params.targetAmount <= 0) ) {
      return( fail( "El monto objetivo debe ser un entero mayor a cero." ) ) ;
    }

    const goal = await goalsRepository.create( {
      organizationId: params.orgId ,
      name:           params.name ,
      currency:       params.currency ,
      targetAmount:   params.targetAmount ,
      targetDate:     params.targetDate ?? null ,
      priority:       params.priority ?? "normal" ,
    } ) ;
    return( ok( goal ) ) ;
  } ,

  /**
   * Edita nombre, objetivo, fecha y prioridad (nunca la divisa) y aplica la transición de estado
   * con el objetivo nuevo (AC-9).
   */
  async editar( params: {
    orgId:        string ;
    goalId:       string ;
    name:         string ;
    targetAmount: number ;
    targetDate?:  string | null ;
    priority:     GoalPriority ;
  } ): Promise< Result< Goal , string > > {
    if( !Number.isInteger( params.targetAmount ) || (params.targetAmount <= 0) ) {
      return( fail( "El monto objetivo debe ser un entero mayor a cero." ) ) ;
    }

    return( await db.transaction( async ( tx ) => {
      const goal = await goalsRepository.findByIdForUpdate( params.goalId , params.orgId , tx ) ;
      if( !goal ) {
        return( fail( "Meta no encontrada." ) ) ;
      }
      if( goal.status === "abandoned" ) {
        return( fail( "La meta está abandonada y no se puede editar." ) ) ;
      }

      const actualizada = await goalsRepository.update( goal.id , params.orgId , {
        name:         params.name ,
        targetAmount: params.targetAmount ,
        targetDate:   params.targetDate ?? null ,
        priority:     params.priority ,
      } , tx ) ;
      if( !actualizada ) {
        return( fail( "Meta no encontrada." ) ) ;
      }

      await sincronizarEstado( actualizada , params.targetAmount , tx ) ;
      const final = await goalsRepository.findById( goal.id , params.orgId , tx ) ;
      return( ok( final as Goal ) ) ;
    } ) ) ;
  } ,

  /**
   * Aparta plata de una cuenta de activo hacia una meta, sin tocar el libro (RN-5).
   * Orden de bloqueo: meta → cuenta. El reservado se calcula DENTRO de la transacción
   * y DESPUÉS de bloquear la cuenta (AC-4).
   */
  async aportar( params: {
    orgId:     string ;
    goalId:    string ;
    accountId: string ;
    amount:    number ;
  } ): Promise< Result< { status: GoalStatus ; ahorrado: number } , string > > {
    const { orgId , goalId , accountId , amount } = params ;

    if( !Number.isInteger( amount ) || (amount <= 0) ) {
      return( fail( "El monto debe ser un entero mayor a cero." ) ) ;
    }

    return( await db.transaction( async ( tx ) => {
      // 1) bloquea la meta
      const goal = await goalsRepository.findByIdForUpdate( goalId , orgId , tx ) ;
      if( !goal ) {
        return( fail( "Meta no encontrada." ) ) ;
      }

      // 2) rechaza si está abandonada
      if( goal.status === "abandoned" ) {
        return( fail( "La meta está abandonada: no admite aportes." ) ) ;
      }

      // 3) bloquea la cuenta
      const account = await accountRepository.findByIdForUpdate( accountId , orgId , tx ) ;

      // 4) organización (el repositorio filtra), tipo y divisa
      if( !account ) {
        return( fail( "Cuenta no encontrada." ) ) ;
      }
      if( account.type !== "asset" ) {
        return( fail( "Sólo se puede aportar desde una cuenta de activo." ) ) ;
      }
      if( account.currency !== goal.currency ) {
        return( fail( `La divisa de la cuenta (${account.currency}) no coincide con la de la meta (${goal.currency}).` ) ) ;
      }

      // 5) reservado dentro de la transacción y después de bloquear la cuenta
      const reservados = await goalMovementsRepository.sumReservedByAccount( orgId , [ accountId ] , tx ) ;
      const reservado  = reservados[ accountId ] ?? 0 ;
      const libre      = account.balance - reservado ;

      if( (libre <= 0) || (amount > libre) ) {
        const libreVisible = formatCurrency( Math.max( libre , 0 ) , account.currency , "es-AR" ) ;
        return( fail( `El monto supera el saldo libre de la cuenta (${libreVisible}).` ) ) ;
      }

      // 6) inserta el movimiento
      await goalMovementsRepository.insert( {
        organizationId: orgId ,
        goalId ,
        accountId ,
        kind:           "contribution" ,
        amount ,
      } , tx ) ;

      // 7) recalcula el ahorrado y aplica la transición
      const status  = await sincronizarEstado( goal , goal.targetAmount , tx ) ;
      const totales = await goalMovementsRepository.sumSignedByGoal( [ goalId ] , orgId , tx ) ;
      return( ok( { status , ahorrado: totales[ goalId ] ?? 0 } ) ) ;
    } ) ) ;
  } ,

  /**
   * Devuelve plata de una meta a una cuenta en particular. No se retira más de lo que
   * esa meta tiene apartado en esa cuenta (AC-7).
   */
  async retirar( params: {
    orgId:     string ;
    goalId:    string ;
    accountId: string ;
    amount:    number ;
  } ): Promise< Result< { status: GoalStatus ; ahorrado: number } , string > > {
    const { orgId , goalId , accountId , amount } = params ;

    if( !Number.isInteger( amount ) || (amount <= 0) ) {
      return( fail( "El monto debe ser un entero mayor a cero." ) ) ;
    }

    return( await db.transaction( async ( tx ) => {
      const goal = await goalsRepository.findByIdForUpdate( goalId , orgId , tx ) ;
      if( !goal ) {
        return( fail( "Meta no encontrada." ) ) ;
      }
      if( goal.status === "abandoned" ) {
        return( fail( "La meta está abandonada: ya no tiene plata apartada." ) ) ;
      }

      const porCuenta = await goalMovementsRepository.sumSignedByGoalAndAccount( goalId , orgId , tx ) ;
      const apartado  = porCuenta.find( ( r ) => { return( r.accountId === accountId ) ; } )?.total ?? 0 ;

      if( amount > apartado ) {
        const visible = formatCurrency( Math.max( apartado , 0 ) , goal.currency , "es-AR" ) ;
        return( fail( `El monto supera lo apartado por esta meta en la cuenta (${visible}).` ) ) ;
      }

      await goalMovementsRepository.insert( {
        organizationId: orgId ,
        goalId ,
        accountId ,
        kind:           "withdrawal" ,
        amount ,
      } , tx ) ;

      const status  = await sincronizarEstado( goal , goal.targetAmount , tx ) ;
      const totales = await goalMovementsRepository.sumSignedByGoal( [ goalId ] , orgId , tx ) ;
      return( ok( { status , ahorrado: totales[ goalId ] ?? 0 } ) ) ;
    } ) ) ;
  } ,

  /**
   * Abandona una meta: un retiro por cada cuenta con neto positivo y después `status = 'abandoned'`.
   * Una meta sin plata apartada también se puede abandonar (AC-12).
   */
  async abandonar( params: { orgId: string ; goalId: string } ): Promise< Result< Goal , string > > {
    const { orgId , goalId } = params ;

    return( await db.transaction( async ( tx ) => {
      const goal = await goalsRepository.findByIdForUpdate( goalId , orgId , tx ) ;
      if( !goal ) {
        return( fail( "Meta no encontrada." ) ) ;
      }
      if( goal.status === "abandoned" ) {
        return( fail( "La meta ya está abandonada." ) ) ;
      }

      const porCuenta = await goalMovementsRepository.sumSignedByGoalAndAccount( goalId , orgId , tx ) ;
      for( const fila of porCuenta ) {
        if( fila.total > 0 ) {
          await goalMovementsRepository.insert( {
            organizationId: orgId ,
            goalId ,
            accountId:      fila.accountId ,
            kind:           "withdrawal" ,
            amount:         fila.total ,
          } , tx ) ;
        }
      }

      await goalsRepository.setStatus( goalId , orgId , "abandoned" , goal.completedAt , tx ) ;
      const final = await goalsRepository.findById( goalId , orgId , tx ) ;
      return( ok( final as Goal ) ) ;
    } ) ) ;
  } ,

  /**
   * Arma la vista de Metas para una divisa: metas visibles con lo calculado, indicadores por
   * divisa y las cuentas compatibles con su saldo libre.
   */
  async vista( params: {
    orgId:     string ;
    userId?:   string ;
    currency?: string ;
    filter?:   GoalFilter ;
    hoy?:      Date ;
  } ): Promise< GoalsViewData > {
    const { orgId , userId } = params ;
    const filter = params.filter ?? "all" ;
    const hoy    = params.hoy ?? new Date() ;

    let zona       = ZONA_POR_DEFECTO ;
    let prefMoneda = MONEDA_POR_DEFECTO ;
    if( userId ) {
      const perfil = await profileRepository.findByUserId( userId ) ;
      if( perfil?.timezone ) {
        zona = perfil.timezone ;
      }
      if( perfil?.currency ) {
        prefMoneda = perfil.currency ;
      }
    }

    const cuentas        = await accountRepository.findAll( orgId ) ;
    const cuentasActivo  = cuentas.filter( ( c ) => { return( c.type === "asset" ) ; } ) ;
    const divisasDeMetas = await goalsRepository.currenciesByOrganization( orgId ) ;
    const divisas        = Array.from( new Set( [
      ...cuentasActivo.map( ( c ) => { return( c.currency ) ; } ) ,
      ...divisasDeMetas
    ] ) ).sort() ;

    let activa = prefMoneda ;
    if( params.currency && divisas.includes( params.currency ) ) {
      activa = params.currency ;
    } else if( !divisas.includes( prefMoneda ) && (divisas.length > 0) ) {
      activa = divisas[ 0 ] ;
    }

    const visibles = await goalsRepository.findVisibleByOrganization( orgId , activa ) ;
    const ids      = visibles.map( ( g ) => { return( g.id ) ; } ) ;
    const totales  = await goalMovementsRepository.sumSignedByGoal( ids , orgId ) ;
    const historia = await goalMovementsRepository.history( ids , orgId , HISTORIAL_CORTO ) ;

    const vistas: GoalView[] = visibles.sort( compararMetas ).map( ( goal ) => {
      const ahorrado   = totales[ goal.id ] ?? 0 ;
      const activaMeta = ( goal.status === "active" ) ;
      const vencida    = ( activaMeta && !!goal.targetDate && estaVencida( hoy , goal.targetDate , zona ) ) ;

      let meses:    number | null = null ;
      let sugerido: number | null = null ;
      if( activaMeta && goal.targetDate && !vencida ) {
        meses    = mesesRestantes( hoy , goal.targetDate , zona ) ;
        sugerido = aporteSugerido( goal.targetAmount - ahorrado , meses ) ;
      }

      return( {
        goal ,
        ahorrado ,
        porcentaje:      porcentaje( ahorrado , goal.targetAmount ) ,
        porcentajeBarra: porcentajeParaBarra( ahorrado , goal.targetAmount ) ,
        mesesRestantes:  meses ,
        aporteSugerido:  sugerido ,
        vencida ,
        historial:       historia[ goal.id ] ?? [] ,
      } ) ;
    } ) ;

    const objetivoTotal = vistas.reduce( ( s , v ) => { return( s + v.goal.targetAmount ) ; } , 0 ) ;
    const ahorradoTotal = vistas.reduce( ( s , v ) => { return( s + v.ahorrado ) ; } , 0 ) ;
    const completadas   = vistas.filter( ( v ) => { return( v.goal.status === "completed" ) ; } ).length ;

    const indicadores: GoalIndicators = {
      cantidad:        vistas.length ,
      objetivoTotal ,
      ahorradoTotal ,
      porcentajeTotal: porcentaje( ahorradoTotal , objetivoTotal ) ,
      completadas ,
      porCompletar:    vistas.length - completadas ,
    } ;

    const filtradas = vistas.filter( ( v ) => {
      if( filter === "active" ) {
        return( v.goal.status === "active" ) ;
      }
      if( filter === "completed" ) {
        return( v.goal.status === "completed" ) ;
      }
      return( true ) ;
    } ) ;

    const compatibles = cuentasActivo.filter( ( c ) => { return( c.currency === activa ) ; } ) ;
    const reservados  = await goalMovementsRepository.sumReservedByAccount( orgId , compatibles.map( ( c ) => { return( c.id ) ; } ) ) ;
    const cuentasVista: GoalCompatibleAccount[] = compatibles.map( ( c ) => {
      const reservado = reservados[ c.id ] ?? 0 ;
      return( { id: c.id , name: c.name , currency: c.currency , balance: c.balance , reservado , libre: c.balance - reservado } ) ;
    } ) ;

    return( { currency: activa , divisas , metas: filtradas , indicadores , cuentas: cuentasVista } ) ;
  } ,

  /**
   * Reservado y libre por cuenta de activo con reservado > 0 (para `/accounts`).
   */
  async reservadoPorCuenta( orgId: string ): Promise< Record< string , ReservedByAccount > > {
    const reservados = await goalMovementsRepository.sumReservedByAccount( orgId ) ;
    const cuentas    = await accountRepository.findAll( orgId ) ;
    const resultado: Record< string , ReservedByAccount > = {} ;

    for( const c of cuentas ) {
      const reservado = reservados[ c.id ] ?? 0 ;
      if( (c.type === "asset") && (reservado > 0) ) {
        resultado[ c.id ] = { reservado , libre: c.balance - reservado } ;
      }
    }
    return( resultado ) ;
  }
} ;
