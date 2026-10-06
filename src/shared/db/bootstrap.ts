/**
 * @file bootstrap.ts
 * Script de arranque y subcomandos de inicialización del sistema (RN-19, AC-17).
 * Permite crear organizaciones base aprovisionadas, generar invitaciones owner
 * y retirar la cuenta demo de administración una vez asegurada la continuidad.
 */
// Librerías externas
import { eq , and , ne } from "drizzle-orm" ;
import { z }             from "zod" ;

// Feature: Accounting
import { provisionarOrganizacion } from "@/features/accounting/services/organizationProvisioningService" ;

// Feature: Auth
import { invitationRepository , Invitation } from "@/features/auth/repositories/invitationRepository" ;
import { organizations , memberships , users } from "@/features/auth/schema.db" ;
import { normalizarEmail }                    from "@/features/auth/repositories/userRepository" ;

// Shared
import { db as defaultDb , DBOrTx } from "./client" ;


/**
 * Esquema de validación para la creación de organizaciones por arranque.
 */
export const CrearOrgSchema = z.object( {
  nombre: z.string().trim().min( 1 , "El nombre de la organización no puede estar vacío." )
} ) ;

/**
 * Esquema de validación para la creación de invitaciones por arranque.
 */
export const InvitarSchema = z.object( {
  org:   z.string().trim().min( 1 , "El slug de la organización es obligatorio." ) ,
  email: z.string().trim().email( "El email ingresado no es válido." ) ,
  rol:   z.enum( [ "owner" , "member" , "viewer" ] ) ,
  dias:  z.coerce.number().int().positive( "Los días deben ser un número entero positivo." ).default( 7 )
} ) ;

/**
 * Genera un slug alfanumérico limpio a partir de un nombre.
 *
 * @param nombre - Nombre de la organización.
 * @returns El slug normalizado en minúsculas separado por guiones.
 */
export function generarSlug( nombre: string ): string {
  return(
    nombre
      .toLowerCase()
      .trim()
      .normalize( "NFD" )
      .replace( /[\u0300-\u036f]/g , "" )
      .replace( /[^a-z0-9]+/g , "-" )
      .replace( /^-+|-+$/g , "" )
  ) ;
}

/**
 * Inserta una nueva organización con su slug y ejecuta el aprovisionamiento
 * del catálogo inicial dentro de una transacción atómica (AC-17).
 *
 * @param params - Nombre de la organización a crear.
 * @param dbOrTx - Instancia de conexión o transacción opcional.
 * @returns La organización creada.
 */
export async function crearOrganizacionBootstrap(
  params: { nombre: string } ,
  dbOrTx: DBOrTx = defaultDb
): Promise< { id: string ; name: string ; slug: string } > {
  CrearOrgSchema.parse( params ) ;
  const slug = generarSlug( params.nombre ) ;

  if( !slug ){
    throw( new Error( "El nombre provisto no genera un slug válido." ) ) ;
  }

  const ejecutar = async ( tx: DBOrTx ) => {
    const [ existente ] = await tx
      .select()
      .from( organizations )
      .where( eq( organizations.slug , slug ) )
      .limit( 1 ) ;

    if( existente ){
      throw( new Error( `La organización con slug '${slug}' ya existe.` ) ) ;
    }

    const [ org ] = await tx
      .insert( organizations )
      .values( {
        name: params.nombre.trim() ,
        slug
      } )
      .returning() ;

    await provisionarOrganizacion( org.id , tx ) ;

    return( org ) ;
  } ;

  if( "transaction" in dbOrTx ){
    return( await dbOrTx.transaction( ejecutar ) ) ;
  }

  return( await ejecutar( dbOrTx ) ) ;
}

/**
 * Genera una invitación para una organización existente, revocando invitaciones
 * pendientes previas que hayan caducado para el mismo correo (AC-17).
 *
 * @param params - Parámetros de la invitación (organización, email, rol y días de expiración).
 * @param dbOrTx - Instancia de conexión o transacción opcional.
 * @returns La invitación generada.
 */
export async function invitarUsuarioBootstrap(
  params: {
    orgSlug: string ;
    email:   string ;
    rol:     "owner" | "member" | "viewer" ;
    dias?:   number ;
  } ,
  dbOrTx: DBOrTx = defaultDb
): Promise< Invitation > {
  InvitarSchema.parse( {
    org:   params.orgSlug ,
    email: params.email ,
    rol:   params.rol ,
    dias:  params.dias ?? 7
  } ) ;

  const emailNormalizado = normalizarEmail( params.email ) ;
  const diasValidez      = ( params.dias ?? 7 ) ;
  const expiresAt        = new Date( Date.now() + (diasValidez * 24 * 60 * 60 * 1000) ) ;

  const ejecutar = async ( tx: DBOrTx ) => {
    const [ org ] = await tx
      .select()
      .from( organizations )
      .where( eq( organizations.slug , params.orgSlug ) )
      .limit( 1 ) ;

    if( !org ){
      throw( new Error( `Organización con slug '${params.orgSlug}' no encontrada.` ) ) ;
    }

    await invitationRepository.revocarVencidasPorEmailYOrganizacion(
      org.id ,
      emailNormalizado ,
      tx
    ) ;

    return(
      await invitationRepository.crearInvitacion(
        {
          organizationId: org.id ,
          email:          emailNormalizado ,
          role:           params.rol ,
          invitedBy:      null ,
          expiresAt
        } ,
        tx
      )
    ) ;
  } ;

  if( "transaction" in dbOrTx ){
    return( await dbOrTx.transaction( ejecutar ) ) ;
  }

  return( await ejecutar( dbOrTx ) ) ;
}

/**
 * Elimina la cuenta administradora demo 'admin@ejemplo.com' sólo si todas
 * las organizaciones donde posee rol 'owner' cuentan con al menos otro 'owner' (RN-19, AC-17).
 *
 * @param dbOrTx - Instancia de conexión o transacción opcional.
 * @returns Resultado con el identificador del usuario eliminado.
 */
export async function retirarAdminBootstrap(
  dbOrTx: DBOrTx = defaultDb
): Promise< { eliminado: boolean ; userId: string } > {
  const emailAdmin = normalizarEmail( "admin@ejemplo.com" ) ;

  const ejecutar = async ( tx: DBOrTx ) => {
    const [ admin ] = await tx
      .select()
      .from( users )
      .where( eq( users.email , emailAdmin ) )
      .limit( 1 ) ;

    if( !admin ){
      throw( new Error( "El usuario admin@ejemplo.com no existe." ) ) ;
    }

    const membresiasAdmin = await tx
      .select()
      .from( memberships )
      .where( eq( memberships.userId , admin.id ) ) ;

    for( const m of membresiasAdmin ){
      if( m.role === "owner" ){
        const [ otroOwner ] = await tx
          .select()
          .from( memberships )
          .where(
            and(
              eq( memberships.organizationId , m.organizationId ) ,
              eq( memberships.role           , "owner" ) ,
              ne( memberships.userId         , admin.id )
            )
          )
          .limit( 1 ) ;

        if( !otroOwner ){
          throw(
            new Error(
              `No se puede retirar admin@ejemplo.com: es el único owner de la organización '${m.organizationId}'.`
            )
          ) ;
        }
      }
    }

    await tx.delete( users ).where( eq( users.id , admin.id ) ) ;

    return( { eliminado: true , userId: admin.id } ) ;
  } ;

  if( "transaction" in dbOrTx ){
    return( await dbOrTx.transaction( ejecutar ) ) ;
  }

  return( await ejecutar( dbOrTx ) ) ;
}

/**
 * Función principal para la ejecución interactiva por CLI.
 */
async function main() {
  const argv = process.argv.slice( 2 ) ;
  const subcomando = argv[0] ;

  if( !subcomando ){
    console.error( "Uso: pnpm db:bootstrap <crear-organizacion|invitar|retirar-admin> [opciones]" ) ;
    process.exit( 1 ) ;
  }

  const flags: Record< string , string > = {} ;
  for( let i = 1 ; i < argv.length ; i++ ){
    const arg = argv[i] ;
    if( arg.startsWith( "--" ) ){
      const clave = arg.slice( 2 ) ;
      const valor = argv[i + 1] ;
      if( valor && !valor.startsWith( "--" ) ){
        flags[clave] = valor ;
        i++ ;
      } else {
        flags[clave] = "true" ;
      }
    }
  }

  try {
    if( subcomando === "crear-organizacion" ){
      const validado = CrearOrgSchema.parse( { nombre: flags.nombre } ) ;
      const org = await crearOrganizacionBootstrap( validado ) ;
      console.log( `[✓] Organización creada y aprovisionada exitosamente:` ) ;
      console.log( `    ID:   ${org.id}` ) ;
      console.log( `    Slug: ${org.slug}` ) ;
      console.log( `    Name: ${org.name}` ) ;
    } else if( subcomando === "invitar" ){
      const validado = InvitarSchema.parse( {
        org:   flags.org ,
        email: flags.email ,
        rol:   flags.rol ,
        dias:  flags.dias
      } ) ;
      const inv = await invitarUsuarioBootstrap( {
        orgSlug: validado.org ,
        email:   validado.email ,
        rol:     validado.rol ,
        dias:    validado.dias
      } ) ;
      console.log( `[✓] Invitación creada exitosamente:` ) ;
      console.log( `    ID:        ${inv.id}` ) ;
      console.log( `    Email:     ${inv.email}` ) ;
      console.log( `    Rol:       ${inv.role}` ) ;
      console.log( `    Expira:    ${inv.expiresAt.toISOString()}` ) ;
    } else if( subcomando === "retirar-admin" ){
      const res = await retirarAdminBootstrap() ;
      console.log( `[✓] Usuario admin@ejemplo.com (${res.userId}) retirado exitosamente.` ) ;
    } else {
      console.error( `Subcomando desconocido: '${subcomando}'. Use crear-organizacion, invitar o retirar-admin.` ) ;
      process.exit( 1 ) ;
    }
  } catch( error ) {
    if( error instanceof z.ZodError ){
      console.error( "[✗] Error de validación en argumentos:" ) ;
      for( const err of error.issues ){
        console.error( `    - ${err.path.join( "." )}: ${err.message}` ) ;
      }
    } else {
      console.error( `[✗] Error: ${(error as Error).message}` ) ;
    }
    process.exit( 1 ) ;
  }
}

// Ejecución directa por CLI
if( process.argv[1]?.endsWith( "bootstrap.ts" ) ){
  main().then( () => process.exit( 0 ) ).catch( () => process.exit( 1 ) ) ;
}
