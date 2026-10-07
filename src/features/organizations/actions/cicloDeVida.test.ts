// Librerías externas
import { describe , it , expect , vi , beforeEach , afterAll } from "vitest" ;
import { getServerSession }                                   from "next-auth" ;
import type { Session }                                       from "next-auth" ;
import { eq , and }                                           from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia , crearOrganizacionRica , conteosDe } from "@/shared/db/testFixtures" ;
import { limpiarBase }                                                  from "@/shared/db/testCleanup" ;
import { db }                                                           from "@/shared/db/client" ;

// Feature: Accounting
import { createLedgerTransaction }       from "@/features/accounting/services/accountingService" ;
import { accounts , ledgerTransactions } from "@/features/accounting/schema.db" ;

// Feature: Auth
import { membershipRepository }                 from "@/features/auth/repositories/membershipRepository" ;
import { userRepository }                       from "@/features/auth/repositories/userRepository" ;
import { organizations , memberships , users } from "@/features/auth/schema.db" ;

// Feature: Organizations
import { renombrarOrganizacionAction , eliminarOrganizacionAction , abandonarOrganizacionAction } from "./organizationActions" ;
import { cambiarRolAction , quitarMiembroAction }                                                from "./membersActions" ;
import { renombrarSchema , cambiarRolSchema }                                                    from "../schemas/organization.schema" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

// `revalidatePath` exige un contexto de petición de Next que los tests no tienen.
vi.mock( "next/cache" , () => ( {
  revalidatePath: vi.fn() ,
} ) ) ;

/** Fija la sesión simulada; `role` es lo que dice el token, no necesariamente lo que hay en la base. */
function sesionDe( userId: string , organizationId: string , role = "owner" ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

/** Sesión simulada por orden de invocación, para las carreras. */
function sesionesEnOrden( ...sesiones: { userId: string , organizationId: string }[] ) {
  const mock = vi.mocked( getServerSession ) ;
  mock.mockReset() ;
  for( const s of sesiones ) {
    mock.mockResolvedValueOnce( { user: { id: s.userId , organizationId: s.organizationId , role: "owner" } , expires: "" } as unknown as Session ) ;
  }
}

/** Demora cada transacción justo tras bloquear a los owners: sin `FOR UPDATE` ambas verían dos. */
function demorarBloqueo() {
  const original = membershipRepository.bloquearOwners.bind( membershipRepository ) ;
  return( vi.spyOn( membershipRepository , "bloquearOwners" ).mockImplementation( async ( ...args ) => {
    const owners = await original( ...args ) ;
    await new Promise( ( resolve ) => setTimeout( resolve , 150 ) ) ;
    return( owners ) ;
  } ) ) ;
}

describe( "ciclo de vida de la organización" , () => {
  let orgA:   string ;
  let orgB:   string ;
  let ownerA: string ;
  let ownerB: string ;

  beforeEach( async () => {
    vi.restoreAllMocks() ;
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ a ] = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-vida"   } ).returning() ;
    const [ b ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-vida" } ).returning() ;
    orgA = a.id ;
    orgB = b.id ;

    ownerA = ( await crearUsuarioConMembresia( { organizationId: orgA , email: "owner-a@ejemplo.com" , role: "owner" } ) ).id ;
    ownerB = ( await crearUsuarioConMembresia( { organizationId: orgB , email: "owner-b@ejemplo.com" , role: "owner" } ) ).id ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  describe( "renombrar" , () => {
    it( "AC-29: cambia el nombre; el slug y los datos no" , async () => {
      await crearOrganizacionRica( orgA ) ;
      const antes = await conteosDe( orgA ) ;
      sesionDe( ownerA , orgA ) ;

      const res = await renombrarOrganizacionAction( { nombre: "  Casa grande  " } ) ;

      expect( res.success ).toBe( true ) ;
      const [ org ] = await db.select().from( organizations ).where( eq( organizations.id , orgA ) ) ;
      expect( org.name ).toBe( "Casa grande" ) ;
      expect( org.slug ).toBe( "casa-vida" ) ;
      expect( await conteosDe( orgA ) ).toEqual( antes ) ;
    } ) ;

    it( "Zod: nombre vacío o de 101 caracteres falla y no cambia nada" , async () => {
      sesionDe( ownerA , orgA ) ;

      expect( (await renombrarOrganizacionAction( { nombre: "   " } )).success ).toBe( false ) ;
      expect( (await renombrarOrganizacionAction( { nombre: "x".repeat( 101 ) } )).success ).toBe( false ) ;
      expect( renombrarSchema.safeParse( { nombre: "x".repeat( 100 ) } ).success ).toBe( true ) ;

      const [ org ] = await db.select().from( organizations ).where( eq( organizations.id , orgA ) ) ;
      expect( org.name ).toBe( "Casa" ) ;
    } ) ;
  } ) ;

  describe( "cambiar rol" , () => {
    it( "AC-28: la fila dice viewer de inmediato" , async () => {
      const ana = await crearUsuarioConMembresia( { organizationId: orgA , role: "member" } ) ;
      sesionDe( ownerA , orgA ) ;

      expect( (await cambiarRolAction( { userId: ana.id , rol: "viewer" } )).success ).toBe( true ) ;

      const m = await membershipRepository.findMembership( ana.id , orgA ) ;
      expect( m?.role ).toBe( "viewer" ) ;
    } ) ;

    it( "AC-25: el único owner no puede pasarse a member y la organización queda intacta" , async () => {
      sesionDe( ownerA , orgA ) ;

      expect( (await cambiarRolAction( { userId: ownerA , rol: "member" } )).success ).toBe( false ) ;

      expect( (await membershipRepository.findMembership( ownerA , orgA ))?.role ).toBe( "owner" ) ;
    } ) ;

    it( "un owner puede degradarse si hay otro owner" , async () => {
      const otro = await crearUsuarioConMembresia( { organizationId: orgA , role: "owner" } ) ;
      sesionDe( ownerA , orgA ) ;

      expect( (await cambiarRolAction( { userId: ownerA , rol: "member" } )).success ).toBe( true ) ;
      expect( (await membershipRepository.findMembership( otro.id , orgA ))?.role ).toBe( "owner" ) ;
    } ) ;

    it( "si el rol no cambia devuelve ok sin escribir" , async () => {
      const ana = await crearUsuarioConMembresia( { organizationId: orgA , role: "member" } ) ;
      sesionDe( ownerA , orgA ) ;
      const espia = vi.spyOn( membershipRepository , "cambiarRol" ) ;

      expect( (await cambiarRolAction( { userId: ana.id , rol: "member" } )).success ).toBe( true ) ;
      expect( espia ).not.toHaveBeenCalled() ;
    } ) ;

    it( "no limpia last_organization_id (la membresía sigue)" , async () => {
      const ana = await crearUsuarioConMembresia( { organizationId: orgA , role: "member" } ) ;
      sesionDe( ownerA , orgA ) ;

      await cambiarRolAction( { userId: ana.id , rol: "viewer" } ) ;

      const [ u ] = await db.select().from( users ).where( eq( users.id , ana.id ) ) ;
      expect( u.lastOrganizationId ).toBe( orgA ) ;
    } ) ;

    it( "Zod: rol inventado y userId que no es uuid" , async () => {
      sesionDe( ownerA , orgA ) ;

      expect( (await cambiarRolAction( { userId: ownerA , rol: "admin" as never } )).success ).toBe( false ) ;
      expect( (await cambiarRolAction( { userId: "no-es-uuid" , rol: "member" } )).success ).toBe( false ) ;
      expect( cambiarRolSchema.safeParse( { userId: "no-es-uuid" , rol: "member" } ).success ).toBe( false ) ;
    } ) ;
  } ) ;

  describe( "abandonar" , () => {
    it( "AC-24: un member abandona; su membresía desaparece, sus 12 movimientos siguen y devuelve la siguiente" , async () => {
      const ana = await crearUsuarioConMembresia( { organizationId: orgA , email: "ana@ejemplo.com" , role: "member" } ) ;
      await membershipRepository.add( ana.id , orgB , "member" ) ;
      await userRepository.registrarUltimaOrganizacion( ana.id , orgA ) ;

      const [ caja ] = await db.insert( accounts ).values( { organizationId: orgA , code: "1.1.01.01" , name: "Caja"    , type: "asset"  , balance: 0 , currency: "ARS" } ).returning() ;
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

      sesionDe( ana.id , orgA , "member" ) ;
      const res = await abandonarOrganizacionAction() ;

      expect( res.success ).toBe( true ) ;
      if( res.success ) {
        expect( res.value ).toEqual( { organizationId: orgB , nombreAnterior: "Casa" } ) ;
      }
      expect( await membershipRepository.findMembership( ana.id , orgA ) ).toBeNull() ;
      expect( await db.select().from( ledgerTransactions ).where( eq( ledgerTransactions.organizationId , orgA ) ) ).toHaveLength( 12 ) ;

      const [ u ] = await db.select().from( users ).where( eq( users.id , ana.id ) ) ;
      expect( u.lastOrganizationId ).toBeNull() ;
    } ) ;

    it( "AC-25: el único owner abandona → fail y la organización queda intacta" , async () => {
      await membershipRepository.add( ownerA , orgB , "member" ) ;
      sesionDe( ownerA , orgA ) ;

      const res = await abandonarOrganizacionAction() ;

      expect( res.success ).toBe( false ) ;
      expect( (await membershipRepository.findMembership( ownerA , orgA ))?.role ).toBe( "owner" ) ;
    } ) ;

    it( "AC-26: con una sola membresía falla" , async () => {
      const m = await crearUsuarioConMembresia( { organizationId: orgA , role: "member" } ) ;
      sesionDe( m.id , orgA , "member" ) ;

      expect( (await abandonarOrganizacionAction()).success ).toBe( false ) ;
      expect( await membershipRepository.findMembership( m.id , orgA ) ).not.toBeNull() ;
    } ) ;

    it( "AC-27: promover a Ana a owner y después abandonar procede; Ana queda como único owner" , async () => {
      const ana = await crearUsuarioConMembresia( { organizationId: orgA , role: "member" } ) ;
      await membershipRepository.add( ownerA , orgB , "member" ) ;
      sesionDe( ownerA , orgA ) ;

      expect( (await cambiarRolAction( { userId: ana.id , rol: "owner" } )).success ).toBe( true ) ;
      expect( (await abandonarOrganizacionAction()).success ).toBe( true ) ;

      const owners = await db.select().from( memberships ).where( and( eq( memberships.organizationId , orgA ) , eq( memberships.role , "owner" ) ) ) ;
      expect( owners.map( ( o ) => o.userId ) ).toEqual( [ ana.id ] ) ;
    } ) ;

    it( "AC-33: un member y un viewer sí pueden abandonar" , async () => {
      const miembro = await crearUsuarioConMembresia( { organizationId: orgA , role: "member" } ) ;
      const viewer  = await crearUsuarioConMembresia( { organizationId: orgA , role: "viewer" } ) ;
      await membershipRepository.add( miembro.id , orgB , "member" ) ;
      await membershipRepository.add( viewer.id  , orgB , "member" ) ;

      sesionDe( miembro.id , orgA , "member" ) ;
      expect( (await abandonarOrganizacionAction()).success ).toBe( true ) ;
      sesionDe( viewer.id , orgA , "viewer" ) ;
      expect( (await abandonarOrganizacionAction()).success ).toBe( true ) ;
    } ) ;
  } ) ;

  describe( "eliminar" , () => {
    it( "AC-31: elimina la organización rica sin tocar la otra y devuelve la siguiente del owner" , async () => {
      await membershipRepository.add( ownerA , orgB , "member" ) ;
      await crearOrganizacionRica( orgA ) ;
      await crearOrganizacionRica( orgB ) ;
      const antesB = await conteosDe( orgB ) ;
      sesionDe( ownerA , orgA ) ;

      const res = await eliminarOrganizacionAction( { confirmacion: "Casa" } ) ;

      expect( res.success ).toBe( true ) ;
      if( res.success ) {
        expect( res.value ).toEqual( { organizationId: orgB , nombreAnterior: "Casa" } ) ;
      }
      for( const [ tabla , cantidad ] of Object.entries( await conteosDe( orgA ) ) ) {
        expect( cantidad , `quedaron filas en ${tabla}` ).toBe( 0 ) ;
      }
      expect( await conteosDe( orgB ) ).toEqual( antesB ) ;
      expect( await db.select().from( organizations ).where( eq( organizations.id , orgA ) ) ).toHaveLength( 0 ) ;
    } ) ;

    it( "AC-30: una confirmación distinta (mayúsculas, espacio extra, vacía) falla y no borra nada" , async () => {
      await membershipRepository.add( ownerA , orgB , "member" ) ;
      await crearOrganizacionRica( orgA ) ;
      const antes = await conteosDe( orgA ) ;
      sesionDe( ownerA , orgA ) ;

      for( const confirmacion of [ "casa" , "Casa " , " Casa" , "" ] ) {
        expect( (await eliminarOrganizacionAction( { confirmacion } )).success , `"${confirmacion}"` ).toBe( false ) ;
      }

      expect( await conteosDe( orgA ) ).toEqual( antes ) ;
    } ) ;

    it( "AC-26: con una sola membresía falla aunque la confirmación coincida" , async () => {
      sesionDe( ownerA , orgA ) ;

      expect( (await eliminarOrganizacionAction( { confirmacion: "Casa" } )).success ).toBe( false ) ;
      expect( await db.select().from( organizations ).where( eq( organizations.id , orgA ) ) ).toHaveLength( 1 ) ;
    } ) ;

    it( "AC-32: Ana en Taller y Casa; al eliminar Taller su identidad vigente es Casa" , async () => {
      const ana = await crearUsuarioConMembresia( { organizationId: orgB , email: "ana@ejemplo.com" , role: "member" } ) ;
      await membershipRepository.add( ana.id , orgA , "member" ) ;
      await userRepository.registrarUltimaOrganizacion( ana.id , orgB ) ;
      await membershipRepository.add( ownerB , orgA , "member" ) ;
      sesionDe( ownerB , orgB ) ;

      expect( (await eliminarOrganizacionAction( { confirmacion: "Taller" } )).success ).toBe( true ) ;

      const identidad = await userRepository.findIdentidadVigente( ana.id ) ;
      expect( identidad?.organizationId ).toBe( orgA ) ;
    } ) ;
  } ) ;

  describe( "autorización y aislamiento" , () => {
    it( "AC-33: un member y un viewer reciben fail en renombrar, eliminar y cambiar rol" , async () => {
      await membershipRepository.add( ownerA , orgB , "member" ) ;

      for( const rol of [ "member" , "viewer" ] ) {
        const u = await crearUsuarioConMembresia( { organizationId: orgA , role: rol } ) ;
        sesionDe( u.id , orgA , rol ) ;

        expect( (await renombrarOrganizacionAction( { nombre: "Otra" } )).success ).toBe( false ) ;
        expect( (await eliminarOrganizacionAction( { confirmacion: "Casa" } )).success ).toBe( false ) ;
        expect( (await cambiarRolAction( { userId: u.id , rol: "owner" } )).success ).toBe( false ) ;
      }

      const [ org ] = await db.select().from( organizations ).where( eq( organizations.id , orgA ) ) ;
      expect( org.name ).toBe( "Casa" ) ;
    } ) ;

    it( "AC-33: un owner cuya sesión dice owner pero cuya membresía ya es member recibe fail (el rol sale de la base)" , async () => {
      await membershipRepository.add( ownerA , orgB , "member" ) ;
      await db.update( memberships ).set( { role: "member" } ).where( and( eq( memberships.userId , ownerA ) , eq( memberships.organizationId , orgA ) ) ) ;
      sesionDe( ownerA , orgA , "owner" ) ;

      expect( (await renombrarOrganizacionAction( { nombre: "Otra" } )).success ).toBe( false ) ;
      expect( (await eliminarOrganizacionAction( { confirmacion: "Casa" } )).success ).toBe( false ) ;
      expect( (await cambiarRolAction( { userId: ownerA , rol: "viewer" } )).success ).toBe( false ) ;
    } ) ;

    it( "AC-34: un owner de B no cambia nada de A con las tres acciones" , async () => {
      await membershipRepository.add( ownerB , orgA , "member" ) ;
      await crearOrganizacionRica( orgA ) ;
      const antes = await conteosDe( orgA ) ;
      sesionDe( ownerB , orgB ) ;

      // `cambiarRol` con el userId de un miembro de A bajo la sesión de B → fail
      expect( (await cambiarRolAction( { userId: ownerA , rol: "viewer" } )).success ).toBe( false ) ;
      // renombrar y eliminar sólo ven la organización de la sesión (B), nunca A
      expect( (await eliminarOrganizacionAction( { confirmacion: "Casa" } )).success ).toBe( false ) ;
      expect( (await renombrarOrganizacionAction( { nombre: "Hackeada" } )).success ).toBe( true ) ;

      const [ a ] = await db.select().from( organizations ).where( eq( organizations.id , orgA ) ) ;
      expect( a.name ).toBe( "Casa" ) ;
      expect( (await membershipRepository.findMembership( ownerA , orgA ))?.role ).toBe( "owner" ) ;
      expect( await conteosDe( orgA ) ).toEqual( antes ) ;
    } ) ;
  } ) ;

  describe( "carreras (RN-38)" , () => {
    it( "dos owner se degradan a la vez: uno procede, el otro falla; nunca cero owner" , async () => {
      const otro = await crearUsuarioConMembresia( { organizationId: orgA , role: "owner" } ) ;
      sesionesEnOrden( { userId: ownerA , organizationId: orgA } , { userId: otro.id , organizationId: orgA } ) ;
      const espia = demorarBloqueo() ;

      const [ r1 , r2 ] = await Promise.all( [
        cambiarRolAction( { userId: ownerA , rol: "member" } ) ,
        cambiarRolAction( { userId: otro.id , rol: "member" } ) ,
      ] ) ;
      espia.mockRestore() ;

      expect( [ r1.success , r2.success ].filter( Boolean ) ).toHaveLength( 1 ) ;
      const owners = await db.select().from( memberships ).where( and( eq( memberships.organizationId , orgA ) , eq( memberships.role , "owner" ) ) ) ;
      expect( owners ).toHaveLength( 1 ) ;
    } ) ;

    it( "un owner abandona mientras el otro se degrada, a la vez: nunca cero owner" , async () => {
      const otro = await crearUsuarioConMembresia( { organizationId: orgA , role: "owner" } ) ;
      await membershipRepository.add( ownerA , orgB , "member" ) ;
      sesionesEnOrden( { userId: ownerA , organizationId: orgA } , { userId: otro.id , organizationId: orgA } ) ;
      const espia = demorarBloqueo() ;

      const [ r1 , r2 ] = await Promise.all( [
        abandonarOrganizacionAction() ,
        cambiarRolAction( { userId: otro.id , rol: "member" } ) ,
      ] ) ;
      espia.mockRestore() ;

      expect( [ r1.success , r2.success ].filter( Boolean ) ).toHaveLength( 1 ) ;
      const owners = await db.select().from( memberships ).where( and( eq( memberships.organizationId , orgA ) , eq( memberships.role , "owner" ) ) ) ;
      expect( owners ).toHaveLength( 1 ) ;
    } ) ;

    it( "dos owner se quitan entre sí a la vez (quitarMiembroAction del plan 06): nunca cero owner" , async () => {
      const otro = await crearUsuarioConMembresia( { organizationId: orgA , role: "owner" } ) ;
      sesionesEnOrden( { userId: ownerA , organizationId: orgA } , { userId: otro.id , organizationId: orgA } ) ;
      const espia = demorarBloqueo() ;

      const [ r1 , r2 ] = await Promise.all( [ quitarMiembroAction( otro.id ) , quitarMiembroAction( ownerA ) ] ) ;
      espia.mockRestore() ;

      expect( [ r1.success , r2.success ].filter( Boolean ) ).toHaveLength( 1 ) ;
      const owners = await db.select().from( memberships ).where( and( eq( memberships.organizationId , orgA ) , eq( memberships.role , "owner" ) ) ) ;
      expect( owners ).toHaveLength( 1 ) ;
    } ) ;
  } ) ;
} ) ;
