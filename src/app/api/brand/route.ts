/**
 * @file route.ts
 * Endpoint de API (Route Handler) protegido para búsqueda y resolución de marcas.
 * Expone: GET /api/brand?q=... o GET /api/brand?domain=...
 */

// Librerías externas
import { NextRequest , NextResponse } from "next/server" ;
import { getServerSession }           from "next-auth" ;

// Shared: Auth & Logger
import { authOptions } from "@/shared/lib/auth" ;
import { logger }      from "@/shared/lib/logger" ;

// Shared: Brand
import { resolverIdentidad }    from "@/shared/services/brand/resolutorIdentidad" ;
import { estrategiaVerificados } from "@/shared/services/brand/verificados" ;

/**
 * Representa una marca encontrada en el endpoint de búsqueda.
 */
export interface MarcaEncontrada {
  name:          string ;
  domain:        string ;
  icon?:         string ;
  coincide:      boolean ;
  confianzaAlta: boolean ;
}

/**
 * GET /api/brand
 * Si recibe `q`: busca marcas verificadas en base a la consulta.
 * Si recibe `domain`: devuelve la identidad del dominio (color y logo).
 * 
 * @param request - Solicitud de entrada de Next.js.
 */
export async function GET( request: NextRequest ): Promise< NextResponse > {
  const session = await getServerSession( authOptions ) ;
  if( !session?.user?.id ) {
    return( NextResponse.json( { error: "Unauthorized" } , { status: 401 } ) ) ;
  }

  const { searchParams } = new URL( request.url ) ;
  const q                = searchParams.get( "q" ) ;
  const domain           = searchParams.get( "domain" ) ;

  if( !q && !domain ) {
    return( NextResponse.json( { error: "Missing q or domain query parameter" } , { status: 400 } ) ) ;
  }

  try {
    if( q ) {
      const paisParam = searchParams.get( "pais" ) || "ar" ;
      const contextoPais = ( paisParam === "ar" )
        ? { sufijo: ".com.ar" , nombre: "argentina" }
        : { sufijo: `.${paisParam}` , nombre: paisParam } ;

      const resultado = await estrategiaVerificados( q , {
        pais: contextoPais
      } ) ;

      const marcas: MarcaEncontrada[] = resultado.candidatos
        .filter( ( c ) => c.resuelve === true )
        .map( ( c ) => {
          return( {
            name:          c.nombre || c.titulo || c.dominio ,
            domain:        c.dominio ,
            icon:          `https://www.google.com/s2/favicons?domain=${encodeURIComponent( c.dominio )}&sz=128` ,
            coincide:      c.coincide === true ,
            confianzaAlta: c.confianzaAlta === true
          } ) ;
        } ) ;

      return(
        NextResponse.json( marcas , {
          headers: {
            "Cache-Control": "private, max-age=3600"
          }
        } )
      ) ;
    }

    if( domain ) {
      const identidad = await resolverIdentidad( domain ) ;
      return(
        NextResponse.json( {
          domain ,
          name:         domain ,
          primaryColor: identidad.color ,
          logoUrl:      identidad.icono?.dataUri || null
        } , {
          headers: {
            "Cache-Control": "private, max-age=3600"
          }
        } )
      ) ;
    }

    return( NextResponse.json( { error: "Missing q or domain query parameter" } , { status: 400 } ) ) ;
  } catch( error ) {
    logger.error( "Error en el endpoint /api/brand." , { error: String( error ) } ) ;
    return( NextResponse.json( { error: "Internal Server Error" } , { status: 500 } ) ) ;
  }
}
