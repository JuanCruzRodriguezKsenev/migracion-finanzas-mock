// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                   from "next-auth" ;
import type { Session }                                       from "next-auth" ;
import { eq , and }                                           from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Accounting
import { createLedgerTransaction } from "@/features/accounting/services/accountingService" ;
import { accounts , ledgerTransactions } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { membershipRepository }  from "@/features/auth/repositories/membershipRepository" ;
import { googleSignInService }   from "@/features/auth/services/googleSignInService" ;
import { crearEspacioPersonal }  from "@/features/auth/services/espacioPersonalService" ;
import { userRepository }        from "@/features/auth/repositories/userRepository" ;
import { organizations , memberships , users , invitations } from "@/features/auth/schema.db" ;

// Feature: Organizations
import {
  listarMiembrosAction ,
  invitarMiembroAction ,
  revocarInvitacionAction ,
  quitarMiembroAction ,
  cambiarRolAction
} from "./membersActions" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

/** Fija la sesión simulada; `role` es lo que dice el token, no necesariamente lo que hay en la base. */
function sesionDe( userId: string , organizationId: string , role = "owner" ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "membersActions — gestión de miembros e invitaciones" , () => {
  let orgA:   string ;
  let orgB:   string ;
  let ownerA: string ;
  let ownerB: string ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Org A" , slug: "org-a-miembros" } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Org B" , slug: "org-b-miembros" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    ownerA = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "owner-a@ejemplo.com" , role: "owner" } ) ).id ;
    ownerB = ( await crearUsuarioConMembresia( { organizationId: orgB , email: "owner-b@ejemplo.com" , role: "owner" } ) ).id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  describe( "Autorización" , () => {
    it( "un member recibe fail en listar, invitar, revocar y quitar" , async () => {
      const member = await crearUsuarioConMembresia( { organizationId: orgA , role: "member" } ) ;
      sesionDe( member.id , orgA , "member" ) ;

      expect( (await listarMiembrosAction()).success ).toBe( false ) ;
      expect( (await invitarMiembroAction( { email: "x@ejemplo.com" , rol: "member" } )).success ).toBe( false ) ;
      expect( (await revocarInvitacionAction( "00000000-0000-0000-0000-000000000000" )).success ).toBe( false ) ;
      expect( (await quitarMiembroAction( ownerA )).success ).toBe( false ) ;
    } ) ;

    it( "un owner cuya sesión dice owner pero cuya membresía en la base ya es member recibe fail" , async () => {
      await db.update( memberships ).set( { role: "member" } ).where( eq( memberships.userId , ownerA ) ) ;
      sesionDe( ownerA , orgA , "owner" ) ;

      expect( (await listarMiembrosAction()).success ).toBe( false ) ;
      expect( (await invitarMiembroAction( { email: "x@ejemplo.com" , rol: "member" } )).success ).toBe( false ) ;
    } ) ;

    it( "sin sesión recibe fail" , async () => {
      vi.mocked( getServerSession ).mockResolvedValue( null ) ;
      expect( (await listarMiembrosAction()).success ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "listar e invitar" , () => {
    it( "lista miembros y sólo invitaciones pendientes y vigentes" , async () => {
      sesionDe( ownerA , orgA ) ;
      await invitarMiembroAction( { email: "ella@ejemplo.com" , rol: "member" } ) ;
      await db.insert( invitations ).values( {
        organizationId: orgA ,
        email:          "vencida@ejemplo.com" ,
        role:           "member" ,
        expiresAt:      new Date( Date.now() - 1000 ) ,
      } ) ;

      const res = await listarMiembrosAction() ;

      expect( res.success ).toBe( true ) ;
      if( res.success ) {
        expect( res.value.miembros.map( ( m ) => m.email ) ).toEqual( [ "owner-a@ejemplo.com" ] ) ;
        expect( res.value.invitaciones.map( ( i ) => i.email ) ).toEqual( [ "ella@ejemplo.com" ] ) ;
      }
    } ) ;

    it( "AC-9: invitar a alguien que ya tiene usuario en otra organización → tras entrar con Google ve las dos" , async () => {
      const ana = await crearUsuarioConMembresia( { organizationId: orgB , email: "ana@ejemplo.com" , role: "owner" } ) ;
      sesionDe( ownerA , orgA ) ;

      expect( (await invitarMiembroAction( { email: "Ana@Ejemplo.com " , rol: "member" } )).success ).toBe( true ) ;

      const login = await googleSignInService.resolverIdentidadGoogle( {
        sub: "sub-ana" , email: "ana@ejemplo.com" , emailVerificado: true ,
      } ) ;

      expect( login.success ).toBe( true ) ;
      // Las dos organizaciones reales; además, al entrar se le asegura su espacio Personal (que va primero)
      const orgs = ( await membershipRepository.findByUser( ana.id ) ).filter( ( o ) => !o.esPersonal ) ;
      expect( orgs.map( ( o ) => o.organizationId ).sort() ).toEqual( [ orgA , orgB ].sort() ) ;
    } ) ;

    it( "RN-10: invitar a un miembro actual falla y no crea invitación" , async () => {
      sesionDe( ownerA , orgA ) ;
      const res = await invitarMiembroAction( { email: "OWNER-A@ejemplo.com" , rol: "member" } ) ;

      expect( res.success ).toBe( false ) ;
      expect( await db.select().from( invitations ).where( eq( invitations.organizationId , orgA ) ) ).toHaveLength( 0 ) ;
    } ) ;

    it( "RN-10: invitar dos veces el mismo email falla la segunda" , async () => {
      sesionDe( ownerA , orgA ) ;
      expect( (await invitarMiembroAction( { email: "dos@ejemplo.com" , rol: "member" } )).success ).toBe( true ) ;
      expect( (await invitarMiembroAction( { email: "dos@ejemplo.com" , rol: "viewer" } )).success ).toBe( false ) ;
    } ) ;

    it( "RN-10: invitar tras vencer la anterior procede y revoca la vencida" , async () => {
      sesionDe( ownerA , orgA ) ;
      await db.insert( invitations ).values( {
        organizationId: orgA ,
        email:          "tarde@ejemplo.com" ,
        role:           "member" ,
        expiresAt:      new Date( Date.now() - 1000 ) ,
      } ) ;

      expect( (await invitarMiembroAction( { email: "tarde@ejemplo.com" , rol: "member" } )).success ).toBe( true ) ;

      const todas = await db.select().from( invitations ).where( eq( invitations.email , "tarde@ejemplo.com" ) ) ;
      expect( todas.map( ( i ) => i.status ).sort() ).toEqual( [ "pending" , "revoked" ] ) ;
    } ) ;

    it( "la invitación vence a los siete días y guarda quién invitó" , async () => {
      sesionDe( ownerA , orgA ) ;
      await invitarMiembroAction( { email: "siete@ejemplo.com" , rol: "viewer" } ) ;

      const [ inv ] = await db.select().from( invitations ).where( eq( invitations.email , "siete@ejemplo.com" ) ) ;
      const dias = ( (inv.expiresAt.getTime() - Date.now()) / 86400000 ) ;

      expect( inv.invitedBy ).toBe( ownerA ) ;
      expect( inv.role ).toBe( "viewer" ) ;
      expect( dias ).toBeGreaterThan( 6.99 ) ;
      expect( dias ).toBeLessThanOrEqual( 7 ) ;
    } ) ;

    it( "Zod: email inválido y rol inventado fallan" , async () => {
      sesionDe( ownerA , orgA ) ;
      expect( (await invitarMiembroAction( { email: "no-es-email" , rol: "member" } )).success ).toBe( false ) ;
      expect( (await invitarMiembroAction( { email: "ok@ejemplo.com" , rol: "admin" as "owner" } )).success ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "revocar" , () => {
    it( "revoca una invitación pendiente propia" , async () => {
      sesionDe( ownerA , orgA ) ;
      const inv = await invitarMiembroAction( { email: "rev@ejemplo.com" , rol: "member" } ) ;
      expect( inv.success ).toBe( true ) ;
      if( !inv.success ) { return ; }

      expect( (await revocarInvitacionAction( inv.value.id )).success ).toBe( true ) ;
      expect( (await revocarInvitacionAction( inv.value.id )).success ).toBe( false ) ;
    } ) ;

    it( "AC-15: un owner de B no puede revocar la invitación de A" , async () => {
      sesionDe( ownerA , orgA ) ;
      const inv = await invitarMiembroAction( { email: "aislada@ejemplo.com" , rol: "member" } ) ;
      if( !inv.success ) { throw( new Error( "setup" ) ) ; }

      sesionDe( ownerB , orgB ) ;
      expect( (await revocarInvitacionAction( inv.value.id )).success ).toBe( false ) ;

      const [ fila ] = await db.select().from( invitations ).where( eq( invitations.id , inv.value.id ) ) ;
      expect( fila.status ).toBe( "pending" ) ;
    } ) ;
  } ) ;

  describe( "quitar" , () => {
    it( "AC-10: quitar a Ana borra su membresía, conserva sus 12 movimientos y no toca sus otras organizaciones" , async () => {
      const ana = await crearUsuarioConMembresia( { organizationId: orgA , email: "ana2@ejemplo.com" , role: "member" } ) ;
      await membershipRepository.add( ana.id , orgB , "member" ) ;
      await userRepository.registrarUltimaOrganizacion( ana.id , orgA ) ;

      const [ caja ] = await db.insert( accounts ).values( { organizationId: orgA , code: "1.1.01.01" , name: "Caja" , type: "asset" , balance: 0 , currency: "ARS" } ).returning() ;
      const [ cap ]  = await db.insert( accounts ).values( { organizationId: orgA , code: "3.1.01.01" , name: "Capital" , type: "equity" , balance: 0 , currency: "ARS" } ).returning() ;
      for( let i = 0 ; i < 12 ; i++ ) {
        const r = await createLedgerTransaction( {
          organizationId: orgA ,
          description:    `Movimiento ${i}` ,
          entries:        [
            { accountId: caja.id , debit: 100 , credit: 0 } ,
            { accountId: cap.id  , debit: 0 , credit: 100 } ,
          ] ,
        } ) ;
        expect( r.success ).toBe( true ) ;
      }

      sesionDe( ownerA , orgA ) ;
      expect( (await quitarMiembroAction( ana.id )).success ).toBe( true ) ;

      expect( await membershipRepository.findMembership( ana.id , orgA ) ).toBeNull() ;
      expect( await membershipRepository.findMembership( ana.id , orgB ) ).not.toBeNull() ;
      expect( await db.select().from( ledgerTransactions ).where( eq( ledgerTransactions.organizationId , orgA ) ) ).toHaveLength( 12 ) ;

      // El rastro de la organización activa se limpia y la revalidación del plan 2 la cambia a la otra.
      const [ fila ] = await db.select().from( users ).where( eq( users.id , ana.id ) ) ;
      expect( fila.lastOrganizationId ).toBeNull() ;
      const identidad = await userRepository.findIdentidadVigente( ana.id , orgA ) ;
      expect( identidad?.organizationId ).toBe( orgB ) ;
    } ) ;

    it( "AC-10: quien sólo estaba en esa organización pierde el acceso" , async () => {
      const solo = await crearUsuarioConMembresia( { organizationId: orgA , role: "member" } ) ;
      sesionDe( ownerA , orgA ) ;
      await quitarMiembroAction( solo.id ) ;

      expect( await userRepository.findIdentidadVigente( solo.id , orgA ) ).toBeNull() ;
    } ) ;

    it( "AC-11: el único owner no se quita, ni a sí mismo" , async () => {
      sesionDe( ownerA , orgA ) ;
      expect( (await quitarMiembroAction( ownerA )).success ).toBe( false ) ;
      expect( await membershipRepository.findMembership( ownerA , orgA ) ).not.toBeNull() ;
    } ) ;

    it( "con dos owners, uno puede quitarse a sí mismo" , async () => {
      const otro = await crearUsuarioConMembresia( { organizationId: orgA , role: "owner" } ) ;
      sesionDe( otro.id , orgA ) ;
      expect( (await quitarMiembroAction( otro.id )).success ).toBe( true ) ;
    } ) ;

    it( "AC-11 carrera: dos owners que se quitan a la vez → uno procede y nunca quedan cero" , async () => {
      const otro = await crearUsuarioConMembresia( { organizationId: orgA , role: "owner" } ) ;

      // La sesión simulada depende de quién llama: se resuelve por orden de invocación.
      vi.mocked( getServerSession )
        .mockResolvedValueOnce( { user: { id: ownerA , organizationId: orgA , role: "owner" } , expires: "" } as unknown as Session )
        .mockResolvedValueOnce( { user: { id: otro.id , organizationId: orgA , role: "owner" } , expires: "" } as unknown as Session ) ;

      // Se demora cada transacción justo después de leer a los owners: sin `FOR UPDATE` ambas verían dos y borrarían.
      const original = membershipRepository.bloquearOwners.bind( membershipRepository ) ;
      const espia    = vi.spyOn( membershipRepository , "bloquearOwners" ).mockImplementation( async ( ...args ) => {
        const owners = await original( ...args ) ;
        await new Promise( ( resolve ) => setTimeout( resolve , 150 ) ) ;
        return( owners ) ;
      } ) ;

      const [ r1 , r2 ] = await Promise.all( [ quitarMiembroAction( otro.id ) , quitarMiembroAction( ownerA ) ] ) ;
      espia.mockRestore() ;

      expect( [ r1.success , r2.success ].filter( Boolean ) ).toHaveLength( 1 ) ;
      const owners = await db.select().from( memberships ).where( and( eq( memberships.organizationId , orgA ) , eq( memberships.role , "owner" ) ) ) ;
      expect( owners ).toHaveLength( 1 ) ;
    } ) ;

    it( "AC-15: un owner de B no puede quitar a un miembro de A" , async () => {
      sesionDe( ownerB , orgB ) ;
      expect( (await quitarMiembroAction( ownerA )).success ).toBe( false ) ;
      expect( await membershipRepository.findMembership( ownerA , orgA ) ).not.toBeNull() ;
    } ) ;
  } ) ;
} ) ;

describe( "membersActions — espacio Personal (AC-7, A5)" , () => {
  let personalId: string ;
  let duenoId:    string ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ casa ] = await db.insert( organizations ).values( { name: "Casa" , slug: "casa-miembros-personal" } ).returning() ;
    duenoId        = ( await crearUsuarioConMembresia( { organizationId: casa.id , email: "dueno-personal@ejemplo.com" , role: "owner" } ) ).id ;
    personalId     = await db.transaction( ( tx ) => crearEspacioPersonal( duenoId , tx ) ) ;
    sesionDe( duenoId , personalId ) ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "AC-7: invitar como member u owner a Personal es rechazado; como viewer es aceptado" , async () => {
    const comoMember = await invitarMiembroAction( { email: "contador@x.com" , rol: "member" } ) ;
    const comoOwner  = await invitarMiembroAction( { email: "contador@x.com" , rol: "owner" } ) ;

    expect( comoMember.success ).toBe( false ) ;
    expect( comoOwner.success ).toBe( false ) ;
    if( !comoMember.success ) {
      expect( comoMember.error ).toBe( "Al espacio Personal sólo se invita como visualizador." ) ;
    }
    expect( await db.select().from( invitations ).where( eq( invitations.organizationId , personalId ) ) ).toHaveLength( 0 ) ;

    const comoViewer = await invitarMiembroAction( { email: "contador@x.com" , rol: "viewer" } ) ;
    expect( comoViewer.success ).toBe( true ) ;
    expect( await db.select().from( invitations ).where( eq( invitations.organizationId , personalId ) ) ).toHaveLength( 1 ) ;
  } ) ;

  it( "A5: cambiar el rol de un viewer de Personal a member u owner es rechazado" , async () => {
    const viewer = await crearUsuarioConMembresia( { organizationId: personalId , email: "viewer-personal@ejemplo.com" , role: "viewer" } ) ;

    const aMember = await cambiarRolAction( { userId: viewer.id , rol: "member" } ) ;
    const aOwner  = await cambiarRolAction( { userId: viewer.id , rol: "owner" } ) ;

    expect( aMember.success ).toBe( false ) ;
    expect( aOwner.success ).toBe( false ) ;
    expect( (await membershipRepository.findMembership( viewer.id , personalId ))?.role ).toBe( "viewer" ) ;
  } ) ;

  it( "una organización común sigue admitiendo member y owner (la guarda es sólo del espacio)" , async () => {
    const [ otra ] = await db.insert( organizations ).values( { name: "Otra" , slug: "otra-miembros-personal" } ).returning() ;
    await membershipRepository.add( duenoId , otra.id , "owner" ) ;
    sesionDe( duenoId , otra.id ) ;

    expect( (await invitarMiembroAction( { email: "alguien@x.com" , rol: "member" } )).success ).toBe( true ) ;
  } ) ;

  it( "el dueño no puede quitarse ni dejar de ser owner de su espacio" , async () => {
    expect( (await quitarMiembroAction( duenoId )).success ).toBe( false ) ;
    expect( (await cambiarRolAction( { userId: duenoId , rol: "viewer" } )).success ).toBe( false ) ;
    expect( (await membershipRepository.findMembership( duenoId , personalId ))?.role ).toBe( "owner" ) ;
  } ) ;
} ) ;
