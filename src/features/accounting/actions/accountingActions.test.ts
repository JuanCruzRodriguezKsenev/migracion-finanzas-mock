// Librerías externas
import { describe , it , expect , vi , beforeEach , afterEach , afterAll } from "vitest" ;
import { getServerSession }                                                from "next-auth" ;

// Shared
import { db }          from "@/shared/db/client" ;
import { limpiarBase } from "@/shared/db/testCleanup" ;

// Feature: Auth
import { organizations } from "@/features/auth/schema.db" ;

// Feature: Accounting
import {
  financialEntities ,
  accounts ,
  categoryAccounts ,
  ledgerTransactions ,
  ledgerEntries
} from "../schema.db" ;
import {
  createFinancialEntityAction ,
  createAccountForEntityAction ,
  createAccountAction
} from "./accountingActions" ;
import { accountRepository } from "../repositories/accountRepository" ;


vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

describe( "accountingActions - Manejo de error de sesión huérfana (FK 23503)" , () => {
  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  it( "createFinancialEntityAction debería capturar FK violation y devolver mensaje amigable" , async () => {
    // Simular sesión con organizationId huérfano (no existe en DB)
    vi.mocked( getServerSession ).mockResolvedValue( {
      user: {
        id:             "00000000-0000-0000-0000-000000000001" ,
        organizationId: "00000000-0000-0000-0000-000000000002" ,
        role:           "owner" ,
      } ,
      expires: new Date().toISOString() ,
    } ) ;

    const res = await createFinancialEntityAction( {
      name:        "Banco Fantasma" ,
      logo:        "bank" ,
      brandDomain: "fantasma.com" ,
      color:       "#6366f1" ,
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ){
      expect( res.error ).toBe( "Tu sesión referencia una organización inexistente. Cerrá sesión y volvé a ingresar." ) ;
    }
  } ) ;

  it( "createAccountAction debería capturar FK violation y devolver mensaje amigable" , async () => {
    vi.mocked( getServerSession ).mockResolvedValue( {
      user: {
        id:             "00000000-0000-0000-0000-000000000001" ,
        organizationId: "00000000-0000-0000-0000-000000000002" ,
        role:           "owner" ,
      } ,
      expires: new Date().toISOString() ,
    } ) ;

    const res = await createAccountAction( {
      name:    "Cuenta Fantasma" ,
      type:    "asset" ,
      balance: 50000 ,
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ){
      expect( res.error ).toBe( "Tu sesión referencia una organización inexistente. Cerrá sesión y volvé a ingresar." ) ;
    }
  } ) ;
} ) ;

describe( "createFinancialEntityAction & createAccountForEntityAction — Lógica de entidades y cuentas" , () => {
  let orgId:      string ;
  let otherOrgId: string ;

  const cleanDb = async () => {
    await limpiarBase() ;
  } ;

  beforeEach( async () => {
    vi.clearAllMocks() ;
    await cleanDb() ;

    const [ org1 ] = await db
      .insert( organizations )
      .values( { name: "Org Principal" , slug: "org-principal" } )
      .returning() ;
    orgId = org1.id ;

    const [ org2 ] = await db
      .insert( organizations )
      .values( { name: "Org Secundaria" , slug: "org-secundaria" } )
      .returning() ;
    otherOrgId = org2.id ;
  } ) ;

  afterEach( async () => {
    await cleanDb() ;
  } ) ;

  afterAll( async () => {
    await limpiarBase() ;
  } ) ;

  it( "createFinancialEntityAction no crea ninguna cuenta propia (alta pura)" , async () => {
    vi.mocked( getServerSession ).mockResolvedValue( {
      user: {
        id:             "00000000-0000-0000-0000-000000000001" ,
        organizationId: orgId ,
        role:           "owner" ,
      } ,
      expires: new Date().toISOString() ,
    } ) ;

    const res = await createFinancialEntityAction( {
      name:        "Banco Galicia" ,
      brandDomain: "galicia.ar" ,
      logo:        "bank" ,
      color:       "#e67e22" ,
    } ) ;

    expect( res.success ).toBe( true ) ;
    if( res.success ) {
      expect( res.value.name ).toBe( "Banco Galicia" ) ;
      expect( res.value.brandDomain ).toBe( "galicia.ar" ) ;
    }

    // Invariante crítico: no debe haber creado ninguna cuenta en el plan de cuentas
    const cuentas = await accountRepository.findAll( orgId ) ;
    expect( cuentas ).toHaveLength( 0 ) ;
  } ) ;

  it( "createAccountForEntityAction con balance > 0 emite el asiento de apertura y actualiza saldo" , async () => {
    // 1. Crear cuenta de patrimonio requerida para el asiento de apertura
    await db.insert( accounts ).values( {
      organizationId: orgId ,
      code:           "3.1.01.01" ,
      name:           "Patrimonio Neto Inicial" ,
      type:           "equity" ,
      balance:        0 ,
      currency:       "ARS" ,
    } ) ;

    // 2. Crear entidad financiera previa
    const [ entidad ] = await db.insert( financialEntities ).values( {
      organizationId: orgId ,
      name:           "Banco Santander" ,
      brandDomain:    "santander.com.ar" ,
      logo:           "bank" ,
    } ).returning() ;

    vi.mocked( getServerSession ).mockResolvedValue( {
      user: {
        id:             "00000000-0000-0000-0000-000000000001" ,
        organizationId: orgId ,
        role:           "owner" ,
      } ,
      expires: new Date().toISOString() ,
    } ) ;

    const balanceInicial = 75000 ; // 750.00 ARS en centavos
    const res = await createAccountForEntityAction( {
      entityId: entidad.id ,
      balance:  balanceInicial ,
    } ) ;

    expect( res.success ).toBe( true ) ;
    if( res.success ) {
      expect( res.value.balance ).toBe( balanceInicial ) ;
      expect( res.value.name ).toBe( "Cuenta Principal Banco Santander" ) ;
      expect( res.value.entityId ).toBe( entidad.id ) ;

      // Verificar en base de datos que el saldo de la cuenta sea exactamente el inicial
      const cuentaEnDb = await accountRepository.findById( res.value.id , orgId ) ;
      expect( cuentaEnDb?.balance ).toBe( balanceInicial ) ;
    }

    // Verificar que se emitieron las 2 entradas del asiento contable
    const entries = await db.select().from( ledgerEntries ) ;
    expect( entries ).toHaveLength( 2 ) ;
    const debitEntry  = entries.find( ( e ) => e.debit === balanceInicial ) ;
    const creditEntry = entries.find( ( e ) => e.credit === balanceInicial ) ;
    expect( debitEntry ).toBeDefined() ;
    expect( creditEntry ).toBeDefined() ;
  } ) ;

  it( "createAccountForEntityAction con balance 0 o ausente no emite ningún asiento" , async () => {
    const [ entidad ] = await db.insert( financialEntities ).values( {
      organizationId: orgId ,
      name:           "Mercado Pago" ,
      brandDomain:    "mercadopago.com.ar" ,
      logo:           "bank" ,
    } ).returning() ;

    vi.mocked( getServerSession ).mockResolvedValue( {
      user: {
        id:             "00000000-0000-0000-0000-000000000001" ,
        organizationId: orgId ,
        role:           "owner" ,
      } ,
      expires: new Date().toISOString() ,
    } ) ;

    const res = await createAccountForEntityAction( {
      entityId: entidad.id ,
    } ) ;

    expect( res.success ).toBe( true ) ;
    if( res.success ) {
      expect( res.value.balance ).toBe( 0 ) ;
    }

    const entries = await db.select().from( ledgerEntries ) ;
    expect( entries ).toHaveLength( 0 ) ;
  } ) ;

  it( "sin cuenta de patrimonio devuelve fail y no crea la cuenta" , async () => {
    const [ entidad ] = await db.insert( financialEntities ).values( {
      organizationId: orgId ,
      name:           "Ualá" ,
      brandDomain:    "uala.com.ar" ,
      logo:           "bank" ,
    } ).returning() ;

    vi.mocked( getServerSession ).mockResolvedValue( {
      user: {
        id:             "00000000-0000-0000-0000-000000000001" ,
        organizationId: orgId ,
        role:           "owner" ,
      } ,
      expires: new Date().toISOString() ,
    } ) ;

    const res = await createAccountForEntityAction( {
      entityId: entidad.id ,
      balance:  10000 ,
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ) {
      expect( res.error ).toContain( "patrimonio" ) ;
    }

    // Comprobar que no se creó ninguna cuenta de activo
    const cuentas = await accountRepository.findAll( orgId ) ;
    expect( cuentas ).toHaveLength( 0 ) ;
  } ) ;

  it( "con una entityId de otra organización devuelve fail (aislamiento multi-tenant)" , async () => {
    // Entidad creada bajo otherOrgId
    const [ entidadAjena ] = await db.insert( financialEntities ).values( {
      organizationId: otherOrgId ,
      name:           "Banco Inquilino B" ,
      brandDomain:    "inquilinob.com" ,
      logo:           "bank" ,
    } ).returning() ;

    // Sesión autenticada en orgId
    vi.mocked( getServerSession ).mockResolvedValue( {
      user: {
        id:             "00000000-0000-0000-0000-000000000001" ,
        organizationId: orgId ,
        role:           "owner" ,
      } ,
      expires: new Date().toISOString() ,
    } ) ;

    const res = await createAccountForEntityAction( {
      entityId: entidadAjena.id ,
      balance:  5000 ,
    } ) ;

    expect( res.success ).toBe( false ) ;
    if( !res.success ) {
      expect( res.error ).toContain( "no pertenece a la organización" ) ;
    }
  } ) ;
} ) ;
