// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach , afterAll } from "vitest" ;
import { getServerSession }                                               from "next-auth" ;
import type { Session }                                                   from "next-auth" ;
import { eq , and }                                                       from "drizzle-orm" ;

// Shared
import { crearUsuarioConMembresia } from "@/shared/db/testFixtures" ;
import { limpiarBase }              from "@/shared/db/testCleanup" ;
import { db }                       from "@/shared/db/client" ;

// Feature: Auth
import { organizations , memberships } from "@/features/auth/schema.db" ;

// Feature: Notifications
import { listarNotificacionesAction , marcarLeidasAction } from "./notificationsActions" ;
import { notifications }                                   from "../schema.db" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

function sesionDe( userId: string , organizationId?: string , role = "member" ) {
  vi.mocked( getServerSession ).mockResolvedValue( {
    user:    { id: userId , organizationId , role } ,
    expires: new Date().toISOString() ,
  } as unknown as Session ) ;
}

describe( "avisos de la persona con filtro por organización (plan 43)" , () => {
  let casaOrgId:     string ;
  let tallerOrgId:   string ;
  let personalOrgId: string ;
  let karlaId:       string ;
  let pepeId:        string ;

  async function crearAviso( datos: {
    organizationId:  string ;
    recipientUserId: string ;
    actorUserId?:    string ;
    type?:           string ;
    amountInCents?:  number ;
    currency?:       string ;
    readAt?:         Date | null ;
    createdAt?:      Date ;
  } ) {
    const [ nuevo ] = await db
      .insert( notifications )
      .values( {
        organizationId:  datos.organizationId ,
        recipientUserId: datos.recipientUserId ,
        actorUserId:     datos.actorUserId ?? null ,
        type:            datos.type ?? "charged_to_holder" ,
        amountInCents:   datos.amountInCents ?? 1200 ,
        currency:        datos.currency ?? "ARS" ,
        readAt:          datos.readAt ?? null ,
        createdAt:       datos.createdAt ?? new Date() ,
      } )
      .returning() ;
    return( nuevo ) ;
  }

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await limpiarBase() ;

    const [ casa ]   = await db.insert( organizations ).values( { name: "Casa"   , slug: "casa-persona"   } ).returning() ;
    const [ taller ] = await db.insert( organizations ).values( { name: "Taller" , slug: "taller-persona" } ).returning() ;
    casaOrgId   = casa.id ;
    tallerOrgId = taller.id ;

    const karlaUser = await crearUsuarioConMembresia( {
      organizationId: casaOrgId ,
      email:          "karla@ejemplo.com" ,
      name:           "Karla" ,
      role:           "member" ,
    } ) ;
    karlaId = karlaUser.id ;

    const pepeUser = await crearUsuarioConMembresia( {
      organizationId: tallerOrgId ,
      email:          "pepe@ejemplo.com" ,
      name:           "Pepe" ,
      role:           "owner" ,
    } ) ;
    pepeId = pepeUser.id ;

    const [ personal ] = await db
      .insert( organizations )
      .values( {
        name:                "Personal" ,
        slug:                "personal-karla-43" ,
        personalOwnerUserId: karlaId ,
      } )
      .returning() ;
    personalOrgId = personal.id ;

    await db.insert( memberships ).values( {
      userId:         karlaId ,
      organizationId: personalOrgId ,
      role:           "owner" ,
    } ) ;
  } ) ;

  afterEach( () => {
    vi.restoreAllMocks() ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "AC-31: Karla ve los avisos de Casa y de su Personal con la organización activa Casa y noLeidas = 2" , async () => {
    await crearAviso( { organizationId: casaOrgId     , recipientUserId: karlaId , actorUserId: pepeId } ) ;
    await crearAviso( { organizationId: personalOrgId , recipientUserId: karlaId , actorUserId: karlaId } ) ;

    sesionDe( karlaId , casaOrgId ) ;

    const res = await listarNotificacionesAction() ;
    expect( res.success ).toBe( true ) ;
    if( !res.success ) { return ; }

    expect( res.value.items ).toHaveLength( 2 ) ;
    expect( res.value.noLeidas ).toBe( 2 ) ;

    const avisoCasa     = res.value.items.find( ( i ) => i.organizacionId === casaOrgId ) ;
    const avisoPersonal = res.value.items.find( ( i ) => i.organizacionId === personalOrgId ) ;

    expect( avisoCasa ).toBeDefined() ;
    expect( avisoCasa?.organizacionNombre ).toBe( "Casa" ) ;
    expect( avisoCasa?.organizacionEsPersonal ).toBe( false ) ;

    expect( avisoPersonal ).toBeDefined() ;
    expect( avisoPersonal?.organizacionNombre ).toBe( "Personal" ) ;
    expect( avisoPersonal?.organizacionEsPersonal ).toBe( true ) ;
  } ) ;

  it( "AC-32 (servidor): filtrar por Personal devuelve solo ese aviso y noLeidas sigue siendo 2" , async () => {
    await crearAviso( { organizationId: casaOrgId     , recipientUserId: karlaId } ) ;
    await crearAviso( { organizationId: personalOrgId , recipientUserId: karlaId } ) ;

    sesionDe( karlaId , casaOrgId ) ;

    const res = await listarNotificacionesAction( { organizacionId: personalOrgId } ) ;
    expect( res.success ).toBe( true ) ;
    if( !res.success ) { return ; }

    expect( res.value.items ).toHaveLength( 1 ) ;
    expect( res.value.items[0].organizacionId ).toBe( personalOrgId ) ;
    expect( res.value.items[0].organizacionEsPersonal ).toBe( true ) ;
    expect( res.value.noLeidas ).toBe( 2 ) ;
  } ) ;

  it( "AC-33: borrar la membresía de Casa sin borrar sus avisos excluye el aviso de la lista y del contador" , async () => {
    await crearAviso( { organizationId: casaOrgId     , recipientUserId: karlaId } ) ;
    await crearAviso( { organizationId: personalOrgId , recipientUserId: karlaId } ) ;

    await db
      .delete( memberships )
      .where(
        and(
          eq( memberships.userId         , karlaId ) ,
          eq( memberships.organizationId , casaOrgId )
        )
      ) ;

    sesionDe( karlaId , personalOrgId ) ;

    const res = await listarNotificacionesAction() ;
    expect( res.success ).toBe( true ) ;
    if( !res.success ) { return ; }

    expect( res.value.items ).toHaveLength( 1 ) ;
    expect( res.value.items[0].organizacionId ).toBe( personalOrgId ) ;
    expect( res.value.noLeidas ).toBe( 1 ) ;
  } ) ;

  it( "aislamiento: filtrar con la organización de otra persona responde fail y no expone datos" , async () => {
    await crearAviso( { organizationId: tallerOrgId , recipientUserId: pepeId } ) ;

    sesionDe( karlaId , casaOrgId ) ;

    const res = await listarNotificacionesAction( { organizacionId: tallerOrgId } ) ;
    expect( res.success ).toBe( false ) ;
    if( res.success ) { return ; }

    expect( res.error ).toBe( "Organización inválida." ) ;
  } ) ;

  it( "marcarLeidas() deja en 0 los no leídos de las dos organizaciones" , async () => {
    await crearAviso( { organizationId: casaOrgId     , recipientUserId: karlaId } ) ;
    await crearAviso( { organizationId: personalOrgId , recipientUserId: karlaId } ) ;

    sesionDe( karlaId , casaOrgId ) ;

    const resMarcar = await marcarLeidasAction() ;
    expect( resMarcar.success ).toBe( true ) ;

    const resListar = await listarNotificacionesAction() ;
    expect( resListar.success ).toBe( true ) ;
    if( !resListar.success ) { return ; }

    expect( resListar.value.noLeidas ).toBe( 0 ) ;
    expect( resListar.value.items ).toHaveLength( 2 ) ;
    expect( resListar.value.items.every( ( i ) => i.leida ) ).toBe( true ) ;
  } ) ;

  it( "retención global: leídas de más de 30 días se purgan en ambas organizaciones y no leída vieja se conserva" , async () => {
    const hace31Dias = new Date( Date.now() - (31 * 24 * 60 * 60 * 1000) ) ;
    const hace90Dias = new Date( Date.now() - (90 * 24 * 60 * 60 * 1000) ) ;

    await crearAviso( { organizationId: casaOrgId     , recipientUserId: karlaId , readAt: hace31Dias , createdAt: hace31Dias } ) ;
    await crearAviso( { organizationId: personalOrgId , recipientUserId: karlaId , readAt: hace31Dias , createdAt: hace31Dias } ) ;
    await crearAviso( { organizationId: casaOrgId     , recipientUserId: karlaId , readAt: null       , createdAt: hace90Dias } ) ;

    sesionDe( karlaId , casaOrgId ) ;

    const res = await listarNotificacionesAction() ;
    expect( res.success ).toBe( true ) ;
    if( !res.success ) { return ; }

    expect( res.value.items ).toHaveLength( 1 ) ;
    expect( res.value.items[0].creadaEn ).toBe( hace90Dias.toISOString() ) ;
    expect( res.value.noLeidas ).toBe( 1 ) ;

    const filasRestantes = await db
      .select()
      .from( notifications )
      .where( eq( notifications.recipientUserId , karlaId ) ) ;
    expect( filasRestantes ).toHaveLength( 1 ) ;
  } ) ;

  it( "organizaciones trae el Personal primero y todas las membresías aunque no tengan avisos" , async () => {
    const [ beta ] = await db.insert( organizations ).values( { name: "Beta" , slug: "beta-persona" } ).returning() ;
    await db.insert( memberships ).values( { userId: karlaId , organizationId: beta.id , role: "member" } ) ;

    sesionDe( karlaId , casaOrgId ) ;

    const res = await listarNotificacionesAction() ;
    expect( res.success ).toBe( true ) ;
    if( !res.success ) { return ; }

    expect( res.value.organizaciones ).toHaveLength( 3 ) ;
    expect( res.value.organizaciones[0].esPersonal ).toBe( true ) ;
    expect( res.value.organizaciones[0].id ).toBe( personalOrgId ) ;
    expect( res.value.organizaciones[1].nombre ).toBe( "Beta" ) ;
    expect( res.value.organizaciones[2].nombre ).toBe( "Casa" ) ;
  } ) ;

  it( "sin sesión responde fail sin lanzar en listar y marcarLeidas" , async () => {
    vi.mocked( getServerSession ).mockResolvedValue( null ) ;

    const resListar = await listarNotificacionesAction() ;
    expect( resListar.success ).toBe( false ) ;

    const resMarcar = await marcarLeidasAction() ;
    expect( resMarcar.success ).toBe( false ) ;
  } ) ;

  it( "filtro con organizacionId que no es uuid responde fail sin consultar" , async () => {
    sesionDe( karlaId , casaOrgId ) ;

    const res = await listarNotificacionesAction( { organizacionId: "no-es-un-uuid" } ) ;
    expect( res.success ).toBe( false ) ;
    if( res.success ) { return ; }

    expect( res.error ).toBe( "Organización inválida." ) ;
  } ) ;
} ) ;
