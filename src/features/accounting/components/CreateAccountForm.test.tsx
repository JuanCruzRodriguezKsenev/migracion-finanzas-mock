// @vitest-environment jsdom
/**
 * @file CreateAccountForm.test.tsx
 * Plan 29 (RN-14, AC-4, A1, A2): el único formulario de cuenta elige una entidad existente o crea una nueva sin
 * salir de él; la opción reservada nunca llega al servidor.
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor , within }       from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Accounting
import { createFinancialEntityAction , createAccountAction } from "../actions/accountingActions" ;
import { crearCuentaPersonalAction }                         from "../actions/cuentasPersonalesActions" ;
import { CreateAccountForm }                                 from "./CreateAccountForm" ;


vi.mock( "next/navigation" , () => ( {
  useRouter: () => ( { push: vi.fn() , refresh: vi.fn() } ) ,
} ) ) ;

vi.mock( "../actions/accountingActions" , () => ( {
  createAccountAction:            vi.fn() ,
  createFinancialEntityAction:    vi.fn() ,
} ) ) ;

vi.mock( "../actions/cuentasPersonalesActions" , () => ( {
  crearCuentaPersonalAction: vi.fn() ,
} ) ) ;

describe( "CreateAccountForm — crear entidad sin salir del formulario" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
    // La búsqueda de marcas del formulario de entidad consulta la red: acá no hay marcas
    vi.stubGlobal( "fetch" , vi.fn().mockResolvedValue( { ok: false , json: async () => [] } ) ) ;
    vi.mocked( crearCuentaPersonalAction ).mockResolvedValue( { success: true , value: {} } as never ) ;
    vi.mocked( createAccountAction ).mockResolvedValue( { success: true , value: {} } as never ) ;
  } ) ;

  const entidades = [ { id: "ent-mp" , name: "Mercado Pago" } ] ;

  const montar = ( onSuccess = vi.fn() ) => {
    render( <CreateAccountForm dict={dict.accountsPage} financialEntities={entidades} personal={true} onSuccess={onSuccess} /> ) ;
    return( onSuccess ) ;
  } ;

  const selectorEntidad = () => screen.getByLabelText( dict.accountsPage.formInstitution , { exact: false } ) as HTMLSelectElement ;
  const campoNombre     = () => screen.getByLabelText( dict.accountsPage.formName , { exact: false } ) as HTMLInputElement ;
  const campoSaldo      = () => screen.getByLabelText( dict.accountsPage.formBalance , { exact: false } ) as HTMLInputElement ;
  const guardar         = () => screen.getByRole( "button" , { name: dict.accountsPage.btnCreate } ) ;

  it( "A1: con una entidad existente no se abre nada y la cuenta se crea con esa entidad" , async () => {
    const onSuccess = montar() ;

    fireEvent.change( campoNombre() , { target: { value: "Billetera" } } ) ;
    fireEvent.change( selectorEntidad() , { target: { value: "ent-mp" } } ) ;
    fireEvent.change( campoSaldo() , { target: { value: "10" } } ) ;

    expect( screen.queryByRole( "dialog" ) ).toBeNull() ;

    fireEvent.click( guardar() ) ;

    await waitFor( () => expect( crearCuentaPersonalAction ).toHaveBeenCalledTimes( 1 ) ) ;
    expect( crearCuentaPersonalAction ).toHaveBeenCalledWith( expect.objectContaining( { name: "Billetera" , entityId: "ent-mp" , balance: 1000 } ) ) ;
    await waitFor( () => expect( onSuccess ).toHaveBeenCalled() ) ;
  } ) ;

  it( "la última opción del selector es «Crear entidad nueva…»" , () => {
    montar() ;

    const opciones = within( selectorEntidad() ).getAllByRole( "option" ) ;

    expect( opciones[ opciones.length - 1 ].textContent ).toBe( dict.accountsPage.createEntityOption ) ;
  } ) ;

  it( "AC-4: elegir «Crear entidad nueva…» abre el alta; al crear queda elegida y conserva lo escrito; el valor reservado nunca viaja" , async () => {
    vi.mocked( createFinancialEntityAction ).mockResolvedValue( { success: true , value: { id: "ent-galicia" , name: "Banco Galicia" } } as never ) ;
    montar() ;

    fireEvent.change( campoNombre() , { target: { value: "Cuenta Sueldo" } } ) ;
    fireEvent.change( selectorEntidad() , { target: { value: "__nueva__" } } ) ;

    const dialog = await screen.findByRole( "dialog" ) ;
    expect( within( dialog ).getByText( dict.accountsPage.titleCreateEntityModal ) ).toBeTruthy() ;
    expect( selectorEntidad().value ).not.toBe( "__nueva__" ) ;

    fireEvent.change( within( dialog ).getByLabelText( /Nombre o Dominio de la Entidad/ ) , { target: { value: "Banco Galicia" } } ) ;
    fireEvent.click( within( dialog ).getByRole( "button" , { name: "Crear Entidad" } ) ) ;

    await waitFor( () => expect( screen.queryByRole( "dialog" ) ).toBeNull() ) ;
    expect( createFinancialEntityAction ).toHaveBeenCalledTimes( 1 ) ;

    // La entidad creada está en el selector y elegida; el nombre de la cuenta sigue escrito
    expect( selectorEntidad().value ).toBe( "ent-galicia" ) ;
    expect( within( selectorEntidad() ).getByRole( "option" , { name: "Banco Galicia" } ) ).toBeTruthy() ;
    expect( campoNombre().value ).toBe( "Cuenta Sueldo" ) ;

    fireEvent.change( campoSaldo() , { target: { value: "1500" } } ) ;
    fireEvent.click( guardar() ) ;

    await waitFor( () => expect( crearCuentaPersonalAction ).toHaveBeenCalledTimes( 1 ) ) ;
    const enviado = vi.mocked( crearCuentaPersonalAction ).mock.calls[0][0] ;
    expect( enviado.entityId ).toBe( "ent-galicia" ) ;
    expect( JSON.stringify( enviado ) ).not.toContain( "__nueva__" ) ;
  } ) ;

  it( "A2: si falla la cuenta, la entidad queda creada y elegida y el error se muestra en el formulario" , async () => {
    vi.mocked( createFinancialEntityAction ).mockResolvedValue( { success: true , value: { id: "ent-galicia" , name: "Banco Galicia" } } as never ) ;
    vi.mocked( crearCuentaPersonalAction ).mockResolvedValue( { success: false , error: "Las cuentas personales se crean desde tu espacio Personal." } as never ) ;
    montar() ;

    fireEvent.change( campoNombre() , { target: { value: "Cuenta Sueldo" } } ) ;
    fireEvent.change( selectorEntidad() , { target: { value: "__nueva__" } } ) ;
    const dialog = await screen.findByRole( "dialog" ) ;
    fireEvent.change( within( dialog ).getByLabelText( /Nombre o Dominio de la Entidad/ ) , { target: { value: "Banco Galicia" } } ) ;
    fireEvent.click( within( dialog ).getByRole( "button" , { name: "Crear Entidad" } ) ) ;
    await waitFor( () => expect( screen.queryByRole( "dialog" ) ).toBeNull() ) ;

    fireEvent.change( campoSaldo() , { target: { value: "1" } } ) ;
    fireEvent.click( guardar() ) ;

    expect( await screen.findByText( "Las cuentas personales se crean desde tu espacio Personal." ) ).toBeTruthy() ;
    expect( selectorEntidad().value ).toBe( "ent-galicia" ) ;
    expect( campoNombre().value ).toBe( "Cuenta Sueldo" ) ;
  } ) ;

  it( "cerrar el alta sin crear deja el selector como estaba" , async () => {
    montar() ;

    fireEvent.change( selectorEntidad() , { target: { value: "ent-mp" } } ) ;
    fireEvent.change( selectorEntidad() , { target: { value: "__nueva__" } } ) ;
    await screen.findByRole( "dialog" ) ;

    expect( selectorEntidad().value ).toBe( "ent-mp" ) ;
    expect( createFinancialEntityAction ).not.toHaveBeenCalled() ;
  } ) ;
} ) ;
