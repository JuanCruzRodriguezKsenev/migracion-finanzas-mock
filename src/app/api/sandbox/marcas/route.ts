/**
 * @file route.ts
 * Endpoint protegido para el Laboratorio de Marcas del Sandbox.
 * Expone: GET /api/sandbox/marcas?fase=dominios|iconos
 */

// Librerías externas
import { NextRequest , NextResponse } from "next/server" ;
import { getServerSession }           from "next-auth" ;

// Shared
import { authOptions } from "@/shared/lib/auth" ;
import { logger }      from "@/shared/lib/logger" ;

// Feature: Sandbox
import {
  estrategiaBrandfetchSearch ,
  estrategiaCandidatos ,
  estrategiaDuckDuckGo ,
  estrategiaWikidata
} from "@/features/sandbox/services/marcas/estrategiasDominio" ;
import {
  ejecutarEstrategiasIcono
} from "@/features/sandbox/services/marcas/estrategiasIcono" ;
import {
  validarDominio
} from "@/shared/services/brand/fetchSeguro" ;

export const runtime = "nodejs" ;
export const dynamic = "force-dynamic" ;

/**
 * GET /api/sandbox/marcas
 *
 * Ejecuta en paralelo las estrategias de descubrimiento de dominios (fase=dominios)
 * o de extracción de íconos y logotipos (fase=iconos).
 */
export async function GET( request: NextRequest ) {
  // 1. Apagado en producción (evaluado estrictamente antes de la sesión)
  if( (process.env.NODE_ENV === "production") && (process.env.SANDBOX_MARCAS !== "1") ) {
    return( NextResponse.json( { error: "disabled" } , { status: 404 } ) ) ;
  }

  // 2. Sesión de usuario obligatoria
  const session = await getServerSession( authOptions ) ;
  if( !session?.user?.id ) {
    return( NextResponse.json( { error: "Unauthorized" } , { status: 401 } ) ) ;
  }

  const { searchParams } = new URL( request.url ) ;
  const fase             = searchParams.get( "fase" ) ;

  try {
    if( fase === "dominios" ) {
      const q = ( searchParams.get( "q" ) || "" ).trim() ;
      if( (q.length < 2) || (q.length > 80) ) {
        return( NextResponse.json( { error: "q" } , { status: 400 } ) ) ;
      }

      const contexto = {
        clientIdBrandfetch: process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID || "brandfetch" ,
        pais: {
          sufijo: ".com.ar" ,
          nombre: "argentina"
        }
      } ;

      const [ bf , wiki , ddg , cand ] = await Promise.all( [
        estrategiaBrandfetchSearch( q , contexto ) ,
        estrategiaWikidata( q , contexto ) ,
        estrategiaDuckDuckGo( q , contexto ) ,
        estrategiaCandidatos( q , contexto )
      ] ) ;

      return( NextResponse.json( {
        fase:       "dominios" ,
        q ,
        resultados: [ bf , wiki , ddg , cand ]
      } ) ) ;
    }

    if( fase === "iconos" ) {
      const rawDominio = ( searchParams.get( "dominio" ) || "" ).trim() ;
      const dominio    = validarDominio( rawDominio ) ;

      if( !dominio ) {
        return( NextResponse.json( { error: "dominio" } , { status: 400 } ) ) ;
      }

      const nombre          = searchParams.get( "nombre" ) || undefined ;
      const archivoLogo     = searchParams.get( "archivoLogo" ) || undefined ;
      const iconoBrandfetch = searchParams.get( "iconoBf" ) || undefined ;

      const contexto = {
        nombre ,
        archivoLogo ,
        iconoBrandfetch ,
        clientIdBrandfetch: process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID || "brandfetch"
      } ;

      const resultados = await ejecutarEstrategiasIcono( dominio , contexto ) ;

      return( NextResponse.json( {
        fase:       "iconos" ,
        dominio ,
        resultados
      } ) ) ;
    }

    return( NextResponse.json( { error: "fase" } , { status: 400 } ) ) ;
  } catch( error ) {
    logger.error( "Error en el endpoint /api/sandbox/marcas." , { error: String( error ) } ) ;
    return( NextResponse.json( { error: "Internal Server Error" } , { status: 500 } ) ) ;
  }
}
