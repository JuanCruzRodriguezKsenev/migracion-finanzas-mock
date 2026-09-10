// Librerías externas
import { describe , it , expect , beforeEach , afterEach , afterAll } from "vitest" ;

// Shared
import { db }          from "@/shared/db/client" ;
import { limpiarBase } from "@/shared/db/testCleanup" ;

// Feature: Auth
import {
  verificarBloqueo ,
  registrarFallo ,
  limpiarIntentos ,
  claveEmail ,
  claveIp ,
  MAX_FALLOS_EMAIL
} from "./loginAttemptService" ;
import { loginAttempts } from "../schema.db" ;


/**
 * Suite de pruebas para el freno de fuerza bruta del proveedor de credenciales.
 * Verifica el conteo, el bloqueo al superar el umbral, la limpieza tras un login exitoso
 * y el reinicio del contador pasada la ventana de inactividad.
 */
describe( "loginAttemptService" , () => {
  const EMAIL = "atacado@ejemplo.com" ;
  const IP    = "203.0.113.7" ;

  const cuenta = claveEmail( EMAIL ) ;
  const origen = claveIp( IP ) ;

  const objetivos = [
    {clave: cuenta , maximo: MAX_FALLOS_EMAIL} ,
  ] ;

  beforeEach( async () => {
    await limpiarBase() ;
  } ) ;

  afterEach( async () => {
    await limpiarBase() ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  /**
   * Caso de prueba: un identificador sin historial nunca está bloqueado.
   */
  it( "no debería bloquear a un identificador sin intentos previos" , async () => {
    const estado = await verificarBloqueo( [ cuenta , origen ] ) ;

    expect( estado.bloqueado ).toBe( false ) ;
  } ) ;

  /**
   * Caso de prueba: los fallos por debajo del umbral no bloquean.
   * Un usuario que se equivoca un par de veces tiene que poder seguir intentando.
   */
  it( "no debería bloquear mientras los fallos no alcancen el umbral" , async () => {
    for( let i = 0 ; i < (MAX_FALLOS_EMAIL - 1) ; i++ ) {
      await registrarFallo( objetivos ) ;
    }

    const estado = await verificarBloqueo( [ cuenta ] ) ;

    expect( estado.bloqueado ).toBe( false ) ;
  } ) ;

  /**
   * Caso de prueba: alcanzado el umbral, el identificador queda bloqueado con vencimiento futuro.
   */
  it( "debería bloquear al alcanzar el umbral de fallos" , async () => {
    for( let i = 0 ; i < MAX_FALLOS_EMAIL ; i++ ) {
      await registrarFallo( objetivos ) ;
    }

    const estado = await verificarBloqueo( [ cuenta ] ) ;

    expect( estado.bloqueado ).toBe( true ) ;
    expect( estado.hasta ).toBeInstanceOf( Date ) ;
    expect( estado.segundosRestantes ).toBeGreaterThan( 0 ) ;
  } ) ;

  /**
   * Caso de prueba: el bloqueo de una cuenta no alcanza a las demás.
   */
  it( "debería bloquear sólo al identificador que superó el umbral" , async () => {
    for( let i = 0 ; i < MAX_FALLOS_EMAIL ; i++ ) {
      await registrarFallo( objetivos ) ;
    }

    const otra = await verificarBloqueo( [ claveEmail( "inocente@ejemplo.com" ) ] ) ;

    expect( otra.bloqueado ).toBe( false ) ;
  } ) ;

  /**
   * Caso de prueba: un login exitoso borra el historial.
   * Sin esto, una racha de errores de tipeo seguiría contando contra el usuario legítimo.
   */
  it( "debería limpiar el historial de fallos tras un login exitoso" , async () => {
    for( let i = 0 ; i < MAX_FALLOS_EMAIL ; i++ ) {
      await registrarFallo( objetivos ) ;
    }

    expect( (await verificarBloqueo( [ cuenta ] )).bloqueado ).toBe( true ) ;

    await limpiarIntentos( [ cuenta , origen ] ) ;

    expect( (await verificarBloqueo( [ cuenta ] )).bloqueado ).toBe( false ) ;
  } ) ;

  /**
   * Caso de prueba: reinicio del contador pasada la ventana de inactividad.
   * Se simula envejeciendo la última marca temporal en la base, que es lo que mira la sentencia SQL.
   */
  it( "debería reiniciar el contador si los fallos previos quedaron fuera de la ventana" , async () => {
    for( let i = 0 ; i < (MAX_FALLOS_EMAIL - 1) ; i++ ) {
      await registrarFallo( objetivos ) ;
    }

    // Envejecer artificialmente el registro más allá de la ventana de inactividad
    await db.execute(
      `UPDATE login_attempts SET last_failed_at = now() - interval '1 hour' WHERE identifier = '${cuenta}'`
    ) ;

    // Este fallo debería contar como el primero de una racha nueva, no como el que colma el umbral
    await registrarFallo( objetivos ) ;

    const estado = await verificarBloqueo( [ cuenta ] ) ;

    expect( estado.bloqueado ).toBe( false ) ;

    const [ fila ] = await db.select().from( loginAttempts ) ;

    expect( fila.failedCount ).toBe( 1 ) ;
  } ) ;

  /**
   * Caso de prueba: identificadores nulos.
   * `claveIp` devuelve null cuando no se puede determinar el origen, y eso no debe romper nada.
   */
  it( "debería ignorar identificadores nulos sin fallar" , async () => {
    expect( claveIp( null ) ).toBeNull() ;
    expect( claveIp( undefined ) ).toBeNull() ;

    await registrarFallo( [ {clave: null , maximo: MAX_FALLOS_EMAIL} ] ) ;
    await limpiarIntentos( [ null ] ) ;

    const estado = await verificarBloqueo( [ null ] ) ;

    expect( estado.bloqueado ).toBe( false ) ;
  } ) ;
} ) ;
