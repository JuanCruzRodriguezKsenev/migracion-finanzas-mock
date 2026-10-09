/**
 * @file route.ts
 * Endpoint protegido para la resolución de identidad (ícono y color) de dominios de marcas.
 * Expone: GET /api/brand/identidad?domain=...
 */

// Librerías externas
import { NextRequest , NextResponse } from "next/server" ;
import { getServerSession }           from "next-auth" ;

// Shared
import { resolverIdentidad } from "@/shared/services/brand/resolutorIdentidad" ;
import { validarDominio }    from "@/shared/services/brand/fetchSeguro" ;
import { authOptions }       from "@/shared/lib/auth" ;
import { logger }            from "@/shared/lib/logger" ;

export const runtime = "nodejs" ;

/**
 * GET /api/brand/identidad?domain=...
 * Resuelve y retorna el ícono normalizado y color de marca para el dominio solicitado.
 *
 * @param request - Solicitud entrante de Next.js.
 */
export async function GET( request: NextRequest ) {
  const session = await getServerSession( authOptions ) ;
  if( !session?.user?.id ) {
    return( NextResponse.json( { error: "Unauthorized" } , { status: 401 } ) ) ;
  }

  const { searchParams } = new URL( request.url ) ;
  const domain           = searchParams.get( "domain" ) ;

  if( !domain ) {
    return( NextResponse.json( { error: "Missing domain query parameter" } , { status: 400 } ) ) ;
  }

  const domValidado = validarDominio( domain ) ;
  if( !domValidado ) {
    return( NextResponse.json( { error: "Invalid domain" } , { status: 400 } ) ) ;
  }

  try {
    const identidad = await resolverIdentidad( domValidado ) ;
    return( NextResponse.json( identidad , {
      status:  200 ,
      headers: {
        "Cache-Control": "private, max-age=86400"
      }
    } ) ) ;
  } catch( error ) {
    logger.error( "Error en el endpoint /api/brand/identidad." , { error: String( error ) } ) ;
    return( NextResponse.json( { error: "Internal error" } , { status: 500 } ) ) ;
  }
}
