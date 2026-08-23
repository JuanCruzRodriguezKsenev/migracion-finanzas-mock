/**
 * @file route.ts
 * Endpoint de API (Route Handler) protegido para consultar metadatos de marcas.
 * Expone: GET /api/brand?domain=...
 */
import { NextRequest , NextResponse } from "next/server" ;
import { getServerSession }           from "next-auth" ;

// Shared
import { getBrandMetadata } from "@/shared/services/brand/brandService" ;
import { authOptions }      from "@/shared/lib/auth" ;
import { logger }           from "@/shared/lib/logger" ;

/**
 * GET /api/brand?domain=netflix.com
 * Retorna metadatos completos oficiales de la marca si el usuario está autenticado.
 * 
 * @param request - Solicitud de entrada de Next.js.
 */
export async function GET( request: NextRequest ) {
  // Validar sesión del usuario
  const session = await getServerSession( authOptions ) ;
  if( !session?.user?.id ) {
    return( NextResponse.json( {error: "Unauthorized"} , {status: 401} ) ) ;
  }

  // Analizar parámetros de consulta
  const { searchParams } = new URL( request.url ) ;
  const domain           = ( searchParams.get( "domain" ) || searchParams.get( "q" ) ) ;

  if( !domain ) {
    return( NextResponse.json( {error: "Missing domain query parameter"} , {status: 400} ) ) ;
  }

  try {
    const metadata = await getBrandMetadata( domain ) ;
    if( !metadata ) {
      return( NextResponse.json( {error: "Brand not found"} , {status: 404} ) ) ;
    }
    return( NextResponse.json( metadata ) ) ;
  } catch( error ) {
    logger.error( "Error en el endpoint /api/brand." , {error: String(error)} ) ;
    return( NextResponse.json( {error: "Internal Server Error"} , {status: 500} ) ) ;
  }
}
