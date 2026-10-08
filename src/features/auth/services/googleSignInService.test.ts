/**
 * @file googleSignInService.test.ts
 * Pruebas de integración de la resolución atómica de identidad con Google contra PostgreSQL.
 * Valida la tabla de decisión de la spec (Filas 1 a 6 y casos de borde AC-1 a AC-6, AC-9).
 */
// Librerías externas
import { describe , it , expect , beforeEach , afterEach } from "vitest" ;
import { eq , and , isNotNull }                             from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Profile
import { profiles } from "@/features/profile/schema.db" ;

// Feature: Auth
import { organizations , memberships , users , invitations } from "../schema.db" ;
import { googleSignInService }                               from "./googleSignInService" ;
import { invitationRepository }                              from "../repositories/invitationRepository" ;


describe( "googleSignInService.resolverIdentidadGoogle" , () => {
  let orgId1: string ;
  let orgId2: string ;

  beforeEach( async () => {
    await limpiarBase() ;

    const [ org1 ] = await db
      .insert( organizations )
      .values( { name: "Organización Test 1" , slug: "org-test-1" } )
      .returning() ;
    orgId1 = org1.id ;

    const [ org2 ] = await db
      .insert( organizations )
      .values( { name: "Organización Test 2" , slug: "org-test-2" } )
      .returning() ;
    orgId2 = org2.id ;
  } ) ;

  afterEach( async () => {
    await limpiarBase() ;
  } ) ;

  // Fila 1: email no verificado, con invitación vigente (AC-3)
  it( "Fila 1: debería denegar acceso ('no_verificado') y no crear usuarios si el email no está verificado en Google (AC-3)" , async () => {
    await invitationRepository.crearInvitacion( {
      organizationId: orgId1 ,
      email:          "no-verificado@ejemplo.com" ,
      role:           "member" ,
      expiresAt:      new Date( Date.now() + 86400000 )
    } ) ;

    const res = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-no-verif" ,
      email:           "no-verificado@ejemplo.com" ,
      emailVerificado: false
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ){
      expect( res.error ).toBe( "no_verificado" ) ;
    }

    const usuarios = await db.select().from( users ).where( eq( users.email , "no-verificado@ejemplo.com" ) ) ;
    expect( usuarios.length ).toBe( 0 ) ;

    const [ inv ] = await db.select().from( invitations ).where( eq( invitations.email , "no-verificado@ejemplo.com" ) ) ;
    expect( inv.status ).toBe( "pending" ) ;
  } ) ;

  // Fila 2: sub ya vinculado, con invitación pendiente a otra organización (AC-9)
  it( "Fila 2: debería autenticar usuario por sub y aceptar invitaciones pendientes a otras organizaciones (AC-9)" , async () => {
    const usr = await crearUsuarioConMembresia( {
      organizationId: orgId1 ,
      email:          "existente-sub@ejemplo.com" ,
      role:           "owner"
    } ) ;

    await db
      .update( users )
      .set( { googleSub: "sub-vinculado-2" } )
      .where( eq( users.id , usr.id ) ) ;

    // Invitación pendiente para la segunda organización
    await invitationRepository.crearInvitacion( {
      organizationId: orgId2 ,
      email:          "existente-sub@ejemplo.com" ,
      role:           "viewer" ,
      expiresAt:      new Date( Date.now() + 86400000 )
    } ) ;

    const res = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-vinculado-2" ,
      email:           "existente-sub@ejemplo.com" ,
      emailVerificado: true
    } ) ;

    expect( res.success ).toBe( true ) ;
    if( res.success ){
      expect( res.value.userId ).toBe( usr.id ) ;
    }

    // Comprobar membresías en ambas organizaciones
    // Las dos organizaciones y el espacio Personal que se le asegura al entrar
    const m = await db.select().from( memberships ).where( eq( memberships.userId , usr.id ) ) ;
    expect( m.length ).toBe( 3 ) ;

    const [ inv ] = await db.select().from( invitations ).where( eq( invitations.organizationId , orgId2 ) ) ;
    expect( inv.status ).toBe( "accepted" ) ;
    expect( inv.acceptedAt ).toBeDefined() ;
  } ) ;

  // Fila 3: usuario con contraseña, mismo email, sin sub (AC-5)
  it( "Fila 3: debería vincular sub al usuario con contraseña y mismo email (AC-5), resolviendo en el siguiente login por sub" , async () => {
    const usr = await crearUsuarioConMembresia( {
      organizationId: orgId1 ,
      email:          "password-user@ejemplo.com" ,
      passwordHash:   "hash_secreto" ,
      salt:           "salt_secreto"
    } ) ;

    const res = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-nuevo-vinculo" ,
      email:           "password-user@ejemplo.com" ,
      emailVerificado: true
    } ) ;

    expect( res.success ).toBe( true ) ;
    if( res.success ){
      expect( res.value.userId ).toBe( usr.id ) ;
    }

    const [ usuarioActualizado ] = await db.select().from( users ).where( eq( users.id , usr.id ) ) ;
    expect( usuarioActualizado.googleSub ).toBe( "sub-nuevo-vinculo" ) ;

    // Siguiente login: encuentra por sub directamente
    const res2 = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-nuevo-vinculo" ,
      email:           "password-user@ejemplo.com" ,
      emailVerificado: true
    } ) ;
    expect( res2.success ).toBe( true ) ;
  } ) ;

  // Fila 3b: usuario con otro sub y el mismo email
  it( "Fila 3b: debería rechazar con 'sin_acceso' si el email ya pertenece a otro sub de Google" , async () => {
    const usr = await crearUsuarioConMembresia( {
      organizationId: orgId1 ,
      email:          "otro-sub@ejemplo.com"
    } ) ;

    await db
      .update( users )
      .set( { googleSub: "sub-original" } )
      .where( eq( users.id , usr.id ) ) ;

    const res = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-distinto-atacante" ,
      email:           "otro-sub@ejemplo.com" ,
      emailVerificado: true
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ){
      expect( res.error ).toBe( "sin_acceso" ) ;
    }

    const [ u ] = await db.select().from( users ).where( eq( users.id , usr.id ) ) ;
    expect( u.googleSub ).toBe( "sub-original" ) ;
  } ) ;

  // Fila 4: sin usuario, con invitación vigente (AC-1)
  it( "Fila 4: debería crear usuario, membresía y fila en profiles al entrar con invitación vigente (AC-1)" , async () => {
    await invitationRepository.crearInvitacion( {
      organizationId: orgId1 ,
      email:          "nuevo-invitado@ejemplo.com" ,
      role:           "member" ,
      expiresAt:      new Date( Date.now() + 86400000 )
    } ) ;

    const res = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-nuevo-invitado" ,
      email:           "nuevo-invitado@ejemplo.com" ,
      emailVerificado: true ,
      nombre:          "Juan Google" ,
      imagen:          "https://lh3.googleusercontent.com/avatar.png"
    } ) ;

    expect( res.success ).toBe( true ) ;
    let nuevoUserId = "" ;
    if( res.success ){
      nuevoUserId = res.value.userId ;
    }

    const [ nuevoUsuario ] = await db.select().from( users ).where( eq( users.id , nuevoUserId ) ) ;
    expect( nuevoUsuario.email ).toBe( "nuevo-invitado@ejemplo.com" ) ;
    expect( nuevoUsuario.googleSub ).toBe( "sub-nuevo-invitado" ) ;
    expect( nuevoUsuario.name ).toBe( "Juan Google" ) ;
    expect( nuevoUsuario.image ).toBe( "https://lh3.googleusercontent.com/avatar.png" ) ;
    expect( nuevoUsuario.passwordHash ).toBeNull() ;
    expect( nuevoUsuario.lastOrganizationId ).toBe( orgId1 ) ;

    // Verificar fila en profiles creada
    const [ perfil ] = await db.select().from( profiles ).where( eq( profiles.userId , nuevoUserId ) ) ;
    expect( perfil ).toBeDefined() ;
    expect( perfil.userId ).toBe( nuevoUserId ) ;

    // Verificar membresía
    const [ m ] = await db.select().from( memberships ).where( and( eq( memberships.userId , nuevoUserId ) , eq( memberships.organizationId , orgId1 ) ) ) ;
    expect( m.organizationId ).toBe( orgId1 ) ;
    expect( m.role ).toBe( "member" ) ;

    // Verificar invitación aceptada
    const [ inv ] = await db.select().from( invitations ).where( eq( invitations.email , "nuevo-invitado@ejemplo.com" ) ) ;
    expect( inv.status ).toBe( "accepted" ) ;
  } ) ;

  // Fila 5: sin usuario ni invitación (AC-2)
  it( "Fila 5: debería rechazar con 'sin_acceso' y no crear usuarios si no hay usuario ni invitación (AC-2)" , async () => {
    const res = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-desconocido" ,
      email:           "desconocido@ejemplo.com" ,
      emailVerificado: true
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ){
      expect( res.error ).toBe( "sin_acceso" ) ;
    }

    const u = await db.select().from( users ).where( eq( users.email , "desconocido@ejemplo.com" ) ) ;
    expect( u.length ).toBe( 0 ) ;
  } ) ;

  // Fila 6: usuario existente con cero membresías y sin invitación
  it( "Fila 6: debería rechazar con 'sin_acceso' si el usuario existe pero no tiene ninguna membresía activa (RN-5)" , async () => {
    await db
      .insert( users )
      .values( {
        email:     "huerfano@ejemplo.com" ,
        googleSub: "sub-huerfano"
      } ) ;

    const res = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-huerfano" ,
      email:           "huerfano@ejemplo.com" ,
      emailVerificado: true
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ){
      expect( res.error ).toBe( "sin_acceso" ) ;
    }
  } ) ;

  // Casos de borde: invitación vencida o revocada (AC-4)
  it( "debería rechazar con 'sin_acceso' ante invitación vencida o revocada (AC-4)" , async () => {
    // Invitación vencida
    await db
      .insert( invitations )
      .values( {
        organizationId: orgId1 ,
        email:          "vencida@ejemplo.com" ,
        role:           "member" ,
        status:         "pending" ,
        expiresAt:      new Date( Date.now() - 60000 )
      } ) ;

    const res1 = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-vencida" ,
      email:           "vencida@ejemplo.com" ,
      emailVerificado: true
    } ) ;
    expect( res1.success ).toBe( false ) ;

    // Invitación revocada
    await db
      .insert( invitations )
      .values( {
        organizationId: orgId1 ,
        email:          "revocada@ejemplo.com" ,
        role:           "member" ,
        status:         "revoked" ,
        expiresAt:      new Date( Date.now() + 86400000 )
      } ) ;

    const res2 = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-revocada" ,
      email:           "revocada@ejemplo.com" ,
      emailVerificado: true
    } ) ;
    expect( res2.success ).toBe( false ) ;
  } ) ;

  // Caso: cambio de email en Google con mismo sub (AC-6)
  it( "debería ingresar al mismo usuario si cambió su email en Google pero conserva el mismo sub (AC-6)" , async () => {
    const usr = await crearUsuarioConMembresia( {
      organizationId: orgId1 ,
      email:          "email-viejo@ejemplo.com"
    } ) ;

    await db
      .update( users )
      .set( { googleSub: "sub-cambio-email" } )
      .where( eq( users.id , usr.id ) ) ;

    const res = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-cambio-email" ,
      email:           "email-nuevo-en-google@ejemplo.com" ,
      emailVerificado: true
    } ) ;

    expect( res.success ).toBe( true ) ;
    if( res.success ){
      expect( res.value.userId ).toBe( usr.id ) ;
    }
  } ) ;

  // Caso: normalización de email con mayúsculas y espacios
  it( "debería normalizar espacios y mayúsculas en el email al resolver identidad e invitaciones" , async () => {
    await invitationRepository.crearInvitacion( {
      organizationId: orgId1 ,
      email:          "espacios-mayus@ejemplo.com" ,
      role:           "member" ,
      expiresAt:      new Date( Date.now() + 86400000 )
    } ) ;

    const res = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-espacios" ,
      email:           "   Espacios-Mayus@Ejemplo.COM   " ,
      emailVerificado: true
    } ) ;

    expect( res.success ).toBe( true ) ;
    if( res.success ){
      const [ u ] = await db.select().from( users ).where( eq( users.id , res.value.userId ) ) ;
      expect( u.email ).toBe( "espacios-mayus@ejemplo.com" ) ;
    }
  } ) ;

  // Caso: dos invitaciones vigentes del mismo email
  it( "debería aceptar múltiples invitaciones vigentes para un mismo usuario (RN-4, RN-14)" , async () => {
    await invitationRepository.crearInvitacion( {
      organizationId: orgId1 ,
      email:          "multi-invitacion@ejemplo.com" ,
      role:           "owner" ,
      expiresAt:      new Date( Date.now() + 86400000 )
    } ) ;

    await invitationRepository.crearInvitacion( {
      organizationId: orgId2 ,
      email:          "multi-invitacion@ejemplo.com" ,
      role:           "viewer" ,
      expiresAt:      new Date( Date.now() + 86400000 )
    } ) ;

    const res = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-multi-inv" ,
      email:           "multi-invitacion@ejemplo.com" ,
      emailVerificado: true
    } ) ;

    expect( res.success ).toBe( true ) ;
    let userId = "" ;
    if( res.success ){
      userId = res.value.userId ;
    }

    const userMembresias = await db.select().from( memberships ).where( eq( memberships.userId , userId ) ) ;
    expect( userMembresias.length ).toBe( 3 ) ; // las dos invitaciones y su Personal

    const [ u ] = await db.select().from( users ).where( eq( users.id , userId ) ) ;
    // RN-14: lastOrganizationId fijado a la primera aceptada
    expect( [ orgId1 , orgId2 ] ).toContain( u.lastOrganizationId ) ;
  } ) ;
} ) ;

describe( "googleSignInService — espacio Personal (AC-1, AC-2, A8)" , () => {
  let orgId: string ;

  beforeEach( async () => {
    await limpiarBase() ;

    const [ org ] = await db
      .insert( organizations )
      .values( { name: "Casa" , slug: "casa-personal-test" } )
      .returning() ;
    orgId = org.id ;
  } ) ;

  afterEach( async () => {
    await limpiarBase() ;
  } ) ;

  it( "AC-1: un usuario nuevo con invitación queda con su espacio Personal y su destino es la organización invitada" , async () => {
    await invitationRepository.crearInvitacion( {
      organizationId: orgId ,
      email:          "con-invitacion@ejemplo.com" ,
      role:           "member" ,
      expiresAt:      new Date( Date.now() + 86400000 )
    } ) ;

    const res = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-con-invitacion" ,
      email:           "con-invitacion@ejemplo.com" ,
      emailVerificado: true
    } ) ;

    expect( res.success ).toBe( true ) ;
    if( !res.success ){ return ; }

    const personales = await db.select().from( organizations ).where( eq( organizations.personalOwnerUserId , res.value.userId ) ) ;
    expect( personales.length ).toBe( 1 ) ;
    expect( personales[0].name ).toBe( "Personal" ) ;

    const [ membresia ] = await db.select().from( memberships ).where( and( eq( memberships.userId , res.value.userId ) , eq( memberships.organizationId , personales[0].id ) ) ) ;
    expect( membresia.role ).toBe( "owner" ) ;

    // RN-7: el espacio no se fija como organización activa
    const [ u ] = await db.select().from( users ).where( eq( users.id , res.value.userId ) ) ;
    expect( u.lastOrganizationId ).toBe( orgId ) ;
  } ) ;

  it( "AC-2 / A8: sin invitación sigue el rechazo y no queda ningún espacio Personal" , async () => {
    const res = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-sin-invitacion" ,
      email:           "sin-invitacion@ejemplo.com" ,
      emailVerificado: true
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ){
      expect( res.error ).toBe( "sin_acceso" ) ;
    }

    const personales = await db.select().from( organizations ).where( isNotNull( organizations.personalOwnerUserId ) ) ;
    expect( personales.length ).toBe( 0 ) ;
  } ) ;

  it( "AC-2: un usuario existente sin ninguna membresía sigue rechazado y no se le crea el espacio" , async () => {
    const [ huerfano ] = await db
      .insert( users )
      .values( { email: "huerfano-personal@ejemplo.com" , googleSub: "sub-huerfano-personal" } )
      .returning() ;

    const res = await googleSignInService.resolverIdentidadGoogle( {
      sub:             "sub-huerfano-personal" ,
      email:           "huerfano-personal@ejemplo.com" ,
      emailVerificado: true
    } ) ;

    expect( res.success ).toBe( false ) ;

    const personales = await db.select().from( organizations ).where( eq( organizations.personalOwnerUserId , huerfano.id ) ) ;
    expect( personales.length ).toBe( 0 ) ;
  } ) ;

  it( "A9: un usuario con membresía y sin espacio lo recibe al entrar, y un segundo ingreso no lo duplica" , async () => {
    const usr = await crearUsuarioConMembresia( { organizationId: orgId , email: "sin-espacio@ejemplo.com" , role: "member" } ) ;
    await db.update( users ).set( { googleSub: "sub-sin-espacio" } ).where( eq( users.id , usr.id ) ) ;

    for( let ingreso = 0 ; ingreso < 2 ; ingreso++ ) {
      const res = await googleSignInService.resolverIdentidadGoogle( { sub: "sub-sin-espacio" , email: "sin-espacio@ejemplo.com" , emailVerificado: true } ) ;
      expect( res.success ).toBe( true ) ;
    }

    const personales = await db.select().from( organizations ).where( eq( organizations.personalOwnerUserId , usr.id ) ) ;
    expect( personales.length ).toBe( 1 ) ;

    // El destino no cambia: sigue siendo la organización donde estaba
    const [ u ] = await db.select().from( users ).where( eq( users.id , usr.id ) ) ;
    expect( u.lastOrganizationId ).toBe( orgId ) ;
  } ) ;
} ) ;
