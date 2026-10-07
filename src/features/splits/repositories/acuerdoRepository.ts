/**
 * @file acuerdoRepository.ts
 * Repositorio del acuerdo de reparto de una organización: modo, porcentajes y aportes mensuales (Capa DAL).
 * Toda consulta filtra por `organizationId`.
 */
// Librerías externas
import { eq , and , inArray , sql } from "drizzle-orm" ;

// Shared
import { db , DBOrTx } from "@/shared/db/client" ;

// Feature: Splits
import { organizationAgreements , agreementPercentages , monthlyContributions } from "../schema.db" ;
import type { ModoAcuerdo , AporteMensual }                                     from "../utils/reparto" ;


/** Acuerdo guardado: el modo, la casilla de caja común y los porcentajes (en puntos básicos). */
export interface AcuerdoGuardado {
  modo:          ModoAcuerdo ;
  usesCommonPot: boolean ;
  porcentajes:   { userId: string ; percentageBp: number }[] ;
}

/** Datos a guardar del acuerdo. */
export interface DatosAcuerdo {
  modo:          ModoAcuerdo ;
  usesCommonPot: boolean ;
  porcentajes:   { userId: string ; percentageBp: number }[] ;
}

/**
 * Repositorio del acuerdo de reparto.
 */
export const acuerdoRepository = {
  /**
   * Serializa los cambios del acuerdo de una organización dentro de la transacción (candado de aviso
   * de Postgres, liberado al terminar). Evita que dos guardados simultáneos mezclen sus porcentajes.
   *
   * @param organizationId - Organización.
   * @param tx - Transacción activa.
   */
  async bloquear( organizationId: string , tx: DBOrTx ): Promise< void > {
    await tx.execute( sql`select pg_advisory_xact_lock( hashtext( ${"acuerdo:" + organizationId} ) )` ) ;
  } ,

  /**
   * Lee el acuerdo de una organización. Sin fila no hay reparto (RN-13): devuelve `null`.
   *
   * @param organizationId - Organización.
   * @param tx - Instancia de transacción opcional.
   * @returns El acuerdo con sus porcentajes, o `null`.
   */
  async obtener( organizationId: string , tx: DBOrTx = db ): Promise< AcuerdoGuardado | null > {
    const [ fila ] = await tx
      .select()
      .from( organizationAgreements )
      .where( eq( organizationAgreements.organizationId , organizationId ) )
      .limit( 1 ) ;

    if( !fila ) {
      return( null ) ;
    }

    const porcentajes = await tx
      .select( { userId: agreementPercentages.userId , percentageBp: agreementPercentages.percentageBp } )
      .from( agreementPercentages )
      .where( eq( agreementPercentages.organizationId , organizationId ) ) ;

    return( { modo: fila.mode as ModoAcuerdo , usesCommonPot: fila.usesCommonPot , porcentajes } ) ;
  } ,

  /**
   * Guarda el acuerdo: upsert de la fila y **reemplazo completo** de los porcentajes, en la misma transacción.
   *
   * @param organizationId - Organización.
   * @param datos - Modo, caja común y porcentajes ya validados.
   * @param actorId - Quien lo guarda.
   * @param tx - Transacción activa.
   */
  async guardar( organizationId: string , datos: DatosAcuerdo , actorId: string , tx: DBOrTx ): Promise< void > {
    await tx
      .insert( organizationAgreements )
      .values( { organizationId , mode: datos.modo , usesCommonPot: datos.usesCommonPot , updatedByUserId: actorId } )
      .onConflictDoUpdate( {
        target: organizationAgreements.organizationId ,
        set:    { mode: datos.modo , usesCommonPot: datos.usesCommonPot , updatedByUserId: actorId , updatedAt: new Date() } ,
      } ) ;

    await tx.delete( agreementPercentages ).where( eq( agreementPercentages.organizationId , organizationId ) ) ;

    if( datos.porcentajes.length > 0 ) {
      await tx
        .insert( agreementPercentages )
        .values( datos.porcentajes.map( ( p ) => ( { organizationId , userId: p.userId , percentageBp: p.percentageBp } ) ) ) ;
    }
  } ,

  /**
   * Todos los aportes declarados por los usuarios dados en la organización.
   *
   * @param organizationId - Organización.
   * @param userIds - Usuarios a consultar.
   * @param tx - Instancia de transacción opcional.
   * @returns Aportes de cualquier mes.
   */
  async aportesDe( organizationId: string , userIds: string[] , tx: DBOrTx = db ): Promise< AporteMensual[] > {
    if( userIds.length === 0 ) {
      return( [] ) ;
    }

    return(
      await tx
        .select( {
          userId:        monthlyContributions.userId ,
          year:          monthlyContributions.year ,
          month:         monthlyContributions.month ,
          amountInCents: monthlyContributions.amountInCents ,
        } )
        .from( monthlyContributions )
        .where(
          and(
            eq( monthlyContributions.organizationId , organizationId ) ,
            inArray( monthlyContributions.userId , userIds )
          )
        )
    ) ;
  } ,

  /**
   * Declara (o corrige) el aporte de un miembro en un mes.
   *
   * @param organizationId - Organización.
   * @param userId - Miembro.
   * @param year - Año.
   * @param month - Mes de 1 a 12.
   * @param amountInCents - Aporte en centavos, entero `>= 0`.
   * @param tx - Transacción activa.
   */
  async upsertAporte( organizationId: string , userId: string , year: number , month: number , amountInCents: number , tx: DBOrTx ): Promise< void > {
    await tx
      .insert( monthlyContributions )
      .values( { organizationId , userId , year , month , amountInCents } )
      .onConflictDoUpdate( {
        target: [ monthlyContributions.organizationId , monthlyContributions.userId , monthlyContributions.year , monthlyContributions.month ] ,
        set:    { amountInCents } ,
      } ) ;
  } ,
} ;
