/**
 * @file budgetsActions.ts
 * Server Actions de presupuestos mensuales por categoría (RFC 028 §4).
 * El organizationId sale siempre de la sesión, nunca del cliente.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { db }                 from "@/shared/db/client" ;
import { Result , ok , fail } from "@/shared/lib/result" ;
import { logger }             from "@/shared/lib/logger" ;
import { claveDeMesActual }   from "@/shared/lib/monthKey" ;
import { authOptions }        from "@/shared/lib/auth" ;

// Feature: Accounting
import { categoryRepository } from "@/features/accounting/repositories/categoryRepository" ;

// Feature: Budgets
import {
  getBudgetsSchema ,
  createBudgetSchema ,
  updateBudgetLimitSchema ,
  deleteBudgetSchema ,
  type GetBudgetsInput ,
  type CreateBudgetInput ,
  type UpdateBudgetLimitInput ,
  type DeleteBudgetInput
} from "../schemas/budget.schema" ;
import { budgetsRepository } from "../repositories/budgetsRepository" ;
import { budgetsService }    from "../services/budgetsService" ;
import type { Budget , EvaluacionMes } from "../types" ;


const MENSAJE_DUPLICADO = "Ya hay un presupuesto vigente para esa categoría y divisa." ;

/**
 * Detecta la violación de unicidad de Postgres (23505), con o sin envoltorio de causa.
 */
function esViolacionDeUnicidad( error: unknown ): boolean {
  const e = error as { code?: string ; cause?: { code?: string } } ;
  return( (e?.code === "23505") || (e?.cause?.code === "23505") ) ;
}

/**
 * Presupuestos activos de un mes, ya evaluados, con las divisas disponibles y el resumen.
 *
 * @param params - Mes y divisa opcionales (por defecto, mes en curso y divisa del perfil).
 * @returns Result con la evaluación del mes.
 */
export async function getBudgetsAction( params: GetBudgetsInput = {} ): Promise< Result< EvaluacionMes , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para ver presupuestos." ) ) ;
  }

  const validation = getBudgetsSchema.safeParse( params ) ;
  if( !validation.success ) {
    return( fail( validation.error.issues[ 0 ]?.message || "Parámetros inválidos." ) ) ;
  }

  try {
    return( ok( await budgetsService.evaluarMes( {
      orgId:    session.user.organizationId ,
      userId:   session.user.id ,
      monthKey: validation.data.monthKey ,
      currency: validation.data.currency ,
    } ) ) ) ;
  } catch( error ) {
    logger.error( "Error al evaluar presupuestos en getBudgetsAction." , { error: String(error) } ) ;
    return( fail( "Error al cargar los presupuestos." ) ) ;
  }
}

/**
 * Crea un presupuesto y su primer límite en una sola transacción, vigente desde el mes en curso.
 *
 * @param params - Categoría, divisa y límite en centavos.
 * @returns Result con el presupuesto creado.
 */
export async function createBudgetAction( params: CreateBudgetInput ): Promise< Result< Budget , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para crear presupuestos." ) ) ;
  }

  const validation = createBudgetSchema.safeParse( params ) ;
  if( !validation.success ) {
    return( fail( validation.error.issues[ 0 ]?.message || "Datos de presupuesto inválidos." ) ) ;
  }

  const orgId = session.user.organizationId ;
  const data  = validation.data ;

  try {
    const { zona } = await budgetsService.preferenciasDe( session.user.id ) ;
    const monthKey = claveDeMesActual( zona ) ;

    const resultado = await db.transaction( async ( tx ) => {
      const categoria = await categoryRepository.findById( data.categoryId , orgId , tx ) ;

      if( !categoria ) {
        return( fail( "Categoría no encontrada o no pertenece a la organización." ) ) ;
      }
      if( categoria.type !== "expense" ) {
        return( fail( "Sólo se pueden presupuestar categorías de gasto." ) ) ;
      }
      if( categoria.archivedAt ) {
        return( fail( "No se puede presupuestar una categoría archivada." ) ) ;
      }
      if( categoria.isSystemLeaf ) {
        return( fail( "No se puede presupuestar una hoja de sistema." ) ) ;
      }

      const presupuesto = await budgetsRepository.create( {
        orgId ,
        categoryId: data.categoryId ,
        currency:   data.currency ,
        monthKey ,
        amount:     data.amount ,
      } , tx ) ;

      return( ok( presupuesto ) ) ;
    } ) ;

    return( resultado ) ;
  } catch( error ) {
    if( esViolacionDeUnicidad( error ) ) {
      return( fail( MENSAJE_DUPLICADO ) ) ;
    }
    logger.error( "Error al crear presupuesto en createBudgetAction." , { error: String(error) } ) ;
    return( fail( "Error al crear el presupuesto en el servidor." ) ) ;
  }
}

/**
 * Cambia el límite del mes en curso (reemplaza si ya había uno de ese mes: RN-7).
 *
 * @param params - Presupuesto y nuevo límite en centavos.
 * @returns Result con el presupuesto actualizado.
 */
export async function updateBudgetLimitAction( params: UpdateBudgetLimitInput ): Promise< Result< Budget , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para modificar presupuestos." ) ) ;
  }

  const validation = updateBudgetLimitSchema.safeParse( params ) ;
  if( !validation.success ) {
    return( fail( validation.error.issues[ 0 ]?.message || "Datos de presupuesto inválidos." ) ) ;
  }

  const orgId = session.user.organizationId ;
  const data  = validation.data ;

  try {
    const { zona } = await budgetsService.preferenciasDe( session.user.id ) ;
    const monthKey = claveDeMesActual( zona ) ;

    return( await db.transaction( async ( tx ) => {
      const presupuesto = await budgetsRepository.findById( data.budgetId , orgId , tx ) ;

      if( !presupuesto || presupuesto.endedFrom ) {
        return( fail( "Presupuesto no encontrado o ya finalizado." ) ) ;
      }

      await budgetsRepository.upsertLimit( presupuesto.id , monthKey , data.amount , tx ) ;

      return( ok( presupuesto ) ) ;
    } ) ) ;
  } catch( error ) {
    logger.error( "Error al cambiar el límite en updateBudgetLimitAction." , { error: String(error) } ) ;
    return( fail( "Error al actualizar el límite en el servidor." ) ) ;
  }
}

/**
 * Elimina un presupuesto: fija su fin en el mes en curso (RN-8). No borra filas.
 *
 * @param params - Presupuesto a finalizar.
 * @returns Result con el presupuesto finalizado.
 */
export async function deleteBudgetAction( params: DeleteBudgetInput ): Promise< Result< Budget , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para eliminar presupuestos." ) ) ;
  }

  const validation = deleteBudgetSchema.safeParse( params ) ;
  if( !validation.success ) {
    return( fail( validation.error.issues[ 0 ]?.message || "Datos de presupuesto inválidos." ) ) ;
  }

  try {
    const { zona } = await budgetsService.preferenciasDe( session.user.id ) ;
    const finalizado = await budgetsRepository.end( validation.data.budgetId , claveDeMesActual( zona ) , session.user.organizationId ) ;

    if( !finalizado ) {
      return( fail( "Presupuesto no encontrado o ya finalizado." ) ) ;
    }

    return( ok( finalizado ) ) ;
  } catch( error ) {
    logger.error( "Error al eliminar presupuesto en deleteBudgetAction." , { error: String(error) } ) ;
    return( fail( "Error al eliminar el presupuesto en el servidor." ) ) ;
  }
}
