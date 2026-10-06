/**
 * @file reportsActions.ts
 * Acciones de servidor (Server Actions) para consulta de reportes y estadísticas (RFC 027 §5).
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;
import { z }                from "zod" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;

// Feature: Reports
import { reportsService } from "../services/reportsService" ;
import { ReportData }     from "../types" ;

const getReportsSchema = z.object( {
  monthKey: z.string().regex( /^\d{4}-\d{2}$/ , "Formato de mes inválido (esperado YYYY-MM)" ).optional() ,
  currency: z.string().length( 3 , "La divisa debe tener 3 caracteres" ).optional() ,
} ) ;

/**
 * Consulta y arma el reporte de estadísticas para la organización del usuario en sesión.
 *
 * @param params - Parámetros opcionales de mes (YYYY-MM) y divisa (código de 3 letras).
 * @returns Result con ReportData o mensaje de error en español.
 */
export async function getReportsAction(
  params?: { monthKey?: string ; currency?: string }
): Promise< Result< ReportData , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para consultar estadísticas." ) ) ;
  }

  const parsed = getReportsSchema.safeParse( params || {} ) ;
  if( !parsed.success ) {
    return( fail( parsed.error.issues[ 0 ]?.message || "Parámetros inválidos." ) ) ;
  }

  try {
    const reportData = await reportsService.armarReporte( {
      orgId:    session.user.organizationId ,
      userId:   session.user.id ,
      monthKey: parsed.data.monthKey ,
      currency: parsed.data.currency ,
    } ) ;

    return( ok( reportData ) ) ;
  } catch( error ) {
    logger.error( "Error en getReportsAction." , { error: String( error ) } ) ;
    return( fail( "Error al consultar las estadísticas en el servidor." ) ) ;
  }
}
