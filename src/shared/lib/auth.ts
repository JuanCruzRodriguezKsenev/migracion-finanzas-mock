/**
 * @file auth.ts
 * Configuración central y callbacks para NextAuth.
 * Implementa la estrategia de sesión basada en JWT y el proveedor de credenciales locales.
 */
// Librerías externas
import CredentialsProvider from "next-auth/providers/credentials" ;
import { NextAuthOptions , Session } from "next-auth" ;

// Shared
import { logger } from "@/shared/lib/logger" ;

// Feature: Auth
import { verificarBloqueo , registrarFallo , limpiarIntentos , claveEmail , claveIp , MAX_FALLOS_EMAIL , MAX_FALLOS_IP } from "@/features/auth/services/loginAttemptService" ;
import { verifyPassword , hashPassword , necesitaRehash , serializarParams , PARAMS_ACTUALES } from "@/features/auth/services/authService" ;
import { userRepository }             from "@/features/auth/repositories/userRepository" ;
import { ERROR_DEMASIADOS_INTENTOS }  from "@/features/auth/constants" ;

// Hash y salt señuelo (valores fijos arbitrarios) para igualar el tiempo de respuesta
// cuando el email no existe. Nunca validan a nadie: solo consumen el mismo costo de scrypt.
// El largo del hash señuelo se deriva de PARAMS_ACTUALES.keylen para que el camino falso llegue
// hasta timingSafeEqual igual que el real: un señuelo de otro largo saldría antes por el chequeo
// de longitud de verifyPassword, y esa salida temprana es justo lo que delata el tiempo.
const DUMMY_SALT   = "0123456789abcdef0123456789abcdef" ;
const DUMMY_HASH   = "0".repeat( PARAMS_ACTUALES.keylen * 2 ) ;
// El señuelo se deriva con los parámetros vigentes, que son los del camino dominante una vez que
// las filas viejas se rehashean en su siguiente login.
const DUMMY_PARAMS = serializarParams( PARAMS_ACTUALES ) ;

// Vida de la sesión. El default de NextAuth son 30 días, demasiado para una aplicación financiera:
// con estrategia JWT no hay revocación del lado del servidor, así que la expiración es el único
// límite duro que existe. `updateAge` renueva la cookie de un usuario activo sin extender la
// sesión de uno que dejó la pestaña abierta y se fue.
const SESION_MAX_AGE_SEGUNDOS    = ( 12 * 60 * 60 ) ; // 12 horas
const SESION_UPDATE_AGE_SEGUNDOS = ( 60 * 60 ) ;      // 1 hora

// Cada cuánto se revalida contra la base que el usuario y su organización sigan existiendo.
// Más corto en desarrollo para que un reseed se note enseguida.
const REVALIDACION_MS = (
  (process.env.NODE_ENV === "production") ? (5 * 60 * 1000) : (30 * 1000)
) ;

// Falla rápido en producción si falta el secreto de firma del JWT:
// sin él, NextAuth generaría sesiones con un secreto derivado inseguro.
if( (process.env.NODE_ENV === "production") && !process.env.NEXTAUTH_SECRET ){
  throw new Error( "NEXTAUTH_SECRET no está definida. Configurala en las variables de entorno antes de desplegar." ) ;
}

/**
 * Extrae la dirección de origen de la petición para limitar la fuerza bruta por procedencia.
 *
 * @param headers - Cabeceras de la petición entrante, tal como las entrega NextAuth a `authorize`.
 * @returns La primera IP de la cadena de proxies, o null si no se puede determinar.
 */
function obtenerIp( headers: Record< string , string > | undefined ): string | null {
  if( !headers ) { return( null ) ; }

  const reenviada = ( headers["x-forwarded-for"] || headers["X-Forwarded-For"] ) ;

  if( reenviada ) {
    // 'x-forwarded-for' es una lista "cliente, proxy1, proxy2": la primera entrada es el origen.
    return( reenviada.split( "," )[0].trim() || null ) ;
  }

  return( headers["x-real-ip"] || null ) ;
}

export const authOptions: NextAuthOptions = {
  secret:  process.env.NEXTAUTH_SECRET ,
  session: {
    strategy:  "jwt" ,
    maxAge:    SESION_MAX_AGE_SEGUNDOS ,
    updateAge: SESION_UPDATE_AGE_SEGUNDOS
  } ,

  providers: [
    CredentialsProvider( {
      name: "credentials" ,
      credentials: {
        email:    { label: "Email"    , type: "email"    } ,
        password: { label: "Password" , type: "password" } ,
      } ,
      /**
       * Método encargado de autenticar y autorizar a un usuario validando credenciales
       * contra la base de datos física PostgreSQL.
       *
       * @param credentials - Credenciales enviadas por el formulario (email y contraseña).
       * @param req - Petición entrante; se usa únicamente para obtener la IP de origen.
       * @returns Un objeto de usuario si la verificación es exitosa, o null en caso contrario.
       * @throws {Error} Con el código ERROR_DEMASIADOS_INTENTOS si el bloqueo por fuerza bruta está activo.
       */
      async authorize( credentials , req ) {
        if( !credentials?.email || !credentials?.password ){
          return( null ) ;
        }

        const ip           = obtenerIp( req?.headers as Record< string , string > | undefined ) ;
        const claveCuenta  = claveEmail( credentials.email ) ;
        const claveOrigen  = claveIp( ip ) ;

        // El bloqueo se consulta antes de tocar scrypt: sin este corte, cada intento rechazado
        // seguiría costando una derivación completa y el freno serviría de poco contra una botnet.
        const bloqueo = await verificarBloqueo( [ claveCuenta , claveOrigen ] ) ;

        if( bloqueo.bloqueado ){
          logger.warn( "Intento de login rechazado por bloqueo temporal." , {
            email:             credentials.email ,
            ip ,
            segundosRestantes: bloqueo.segundosRestantes
          } ) ;

          throw new Error( ERROR_DEMASIADOS_INTENTOS ) ;
        }

        // Buscar el usuario utilizando el repositorio de la feature auth
        const usuario = await userRepository.findByEmail( credentials.email ) ;

        if( !usuario ){
          // Ejecutar una verificación señuelo con costo criptográfico idéntico al camino real.
          // Sin esto, la respuesta inmediata delataría por tiempo qué emails existen en el sistema
          // (el propio authService.ts documenta esta amenaza en verifyPassword).
          await verifyPassword( credentials.password , DUMMY_HASH , DUMMY_SALT , DUMMY_PARAMS ) ;

          await registrarFallo( [
            {clave: claveCuenta , maximo: MAX_FALLOS_EMAIL} ,
            {clave: claveOrigen , maximo: MAX_FALLOS_IP}
          ] ) ;

          return( null ) ;
        }

        // Verificar la contraseña cifrada con los parámetros de costo con los que fue derivada
        const esContraseniaValida = await verifyPassword(
          credentials.password ,
          usuario.passwordHash ,
          usuario.salt ,
          usuario.hashParams ,
        ) ;

        if( !esContraseniaValida ){
          await registrarFallo( [
            {clave: claveCuenta , maximo: MAX_FALLOS_EMAIL} ,
            {clave: claveOrigen , maximo: MAX_FALLOS_IP}
          ] ) ;

          return( null ) ;
        }

        // Login válido: el historial de fallos se borra para que una racha de errores de tipeo
        // no siga contando contra un usuario que ya demostró conocer su contraseña.
        await limpiarIntentos( [ claveCuenta , claveOrigen ] ) ;

        // Rehash transparente: este es el único momento en que la contraseña en texto plano está
        // disponible, así que es el único momento posible para migrar una fila a los parámetros
        // vigentes. Si falla, el login continúa: la contraseña es válida y el hash viejo sigue
        // siendo verificable.
        if( necesitaRehash( usuario.hashParams ) ){
          try {
            const credencialesNuevas = await hashPassword( credentials.password ) ;

            await userRepository.updatePasswordHash( usuario.id , credencialesNuevas ) ;

            logger.info( "Hash de contraseña migrado a los parámetros vigentes." , {userId: usuario.id} ) ;
          } catch( error ) {
            logger.error( "No se pudo rehashear la contraseña tras el login." , {
              userId: usuario.id ,
              error:  String( error )
            } ) ;
          }
        }

        // Retornar la información del usuario mapeada con los tipos extendidos
        return( {
          id:             usuario.id ,
          email:          usuario.email ,
          name:           usuario.name ,
          organizationId: usuario.organizationId ,
          role:           usuario.role ,
        } ) ;
      } ,
    } ) ,
  ] ,
  callbacks: {
    /**
     * Transfiere la información de identidad del usuario al JWT durante el inicio de sesión y
     * revalida periódicamente contra la base que el usuario y su organización sigan existiendo.
     *
     * Se revalida el usuario y no sólo la organización: comprobar únicamente la organización deja
     * viva la sesión de un usuario borrado, y arrastra para siempre el `role` que tenía al iniciar
     * sesión. La consulta devuelve ambos datos de un viaje y refresca el rol.
     */
    async jwt( {token , user} ) {
      if( user ){
        token.id             = user.id ;
        token.organizationId = user.organizationId ;
        token.role           = user.role ;
        token.lastVerified   = Date.now() ;
        return( token ) ;
      }

      // Un token ya invalidado no se vuelve a consultar: `id` y `organizationId` quedaron vacíos,
      // así que esta guarda no se cumple. Es deliberado — la sesión muerta sólo se recupera con un
      // login nuevo, incluso si la organización reapareciera con el mismo identificador.
      if( token.id && token.organizationId ){
        const ahora = Date.now() ;

        if( !token.lastVerified || ((ahora - token.lastVerified) > REVALIDACION_MS) ){
          try {
            const identidad = await userRepository.findIdentidadVigente( token.id ) ;

            // Se invalida tanto si la identidad ya no existe (usuario u organización eliminados)
            // como si la organización del token no es la que la base le asigna hoy. Reescribir el
            // valor en silencio sería más permisivo: dejaría pasar un token manipulado como si
            // fuese un token viejo, y ninguna de las dos situaciones debería sobrevivir sin un
            // login nuevo.
            if( !identidad || (identidad.organizationId !== token.organizationId) ){
              logger.warn( "Sesión huérfana o inconsistente detectada en JWT; invalidando token." , {
                organizationId: token.organizationId ,
                userId:         token.id ,
              } ) ;
              token.invalid        = true ;
              token.organizationId = "" ;
              token.id             = "" ;
              token.role           = "" ;
              return( token ) ;
            }

            // El rol sí se refresca desde la base: un cambio de permisos tiene que reflejarse en la
            // sesión vigente, y no amerita expulsar al usuario como sí lo amerita un cambio de tenant.
            token.role         = identidad.role ;
            token.lastVerified = ahora ;
          } catch( error ) {
            logger.error( "Error al revalidar la identidad en el callback jwt." , {error: String(error)} ) ;
          }
        }
      }

      return( token ) ;
    } ,
    /**
     * Inyecta los metadatos multi-tenant desde el JWT decodificado en la sesión
     * de React, haciéndolos accesibles para componentes servidor y cliente.
     *
     * Ante un token invalidado se devuelve una sesión **vacía**, no una a medio llenar:
     * `getServerSession` convierte el objeto sin claves en `null` (next-auth 4.24, `next/index.js`
     * comprueba `Object.keys(body).length`), que es el contrato que esperan los consumidores.
     * El proxy corta antes por `token.invalid`, así que el cliente no llega a renderizar en este
     * estado; esta rama es la segunda barrera, no la primera.
     */
    async session( {session , token} ) {
      if( token.invalid || !token.organizationId || !token.id ){
        return( {} as Session ) ;
      }

      if( session.user ){
        session.user.id             = token.id ;
        session.user.organizationId = token.organizationId ;
        session.user.role           = token.role ;
      }
      return( session ) ;
    } ,
  } ,
  pages: {signIn: "/auth/signin"} ,
} ;
