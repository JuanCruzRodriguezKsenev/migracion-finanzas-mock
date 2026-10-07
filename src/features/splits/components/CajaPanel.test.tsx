// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }               from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Profile
import { ProfileProvider }  from "@/features/profile/context/ProfileContext" ;
import type { ProfileData } from "@/features/profile/types" ;

// Feature: Splits
import { CajaPanel }                                                        from "./CajaPanel" ;
import { obtenerCajaAction , registrarAporteCajaAction , type VistaCaja } from "../actions/cajaActions" ;


vi.mock( "../actions/cajaActions" , () => ( {
  obtenerCajaAction:         vi.fn() ,
  registrarAporteCajaAction: vi.fn() ,
} ) ) ;

const mockProfile: ProfileData = {
  userId: "11111111-1111-4111-8111-111111111111" , phone: null , currency: "ARS" , timezone: "America/Argentina/Buenos_Aires" ,
  bio: null , theme: "light" , defaultView: "dashboard" , fastLogin: true , weeklyStart: "monday" , dateFormat: "DD/MM/YYYY" ,
  numberFormat: "es-AR" , roundAmounts: false , includeTransfers: true , defaultAccount: null ,
  planName: "Básico" , planBilling: "Mensual" , planNextCharge: ""
} ;

describe( "CajaPanel" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  const deOwner: VistaCaja = {
    yoId:            "u-ana" ,
    rol:             "owner" ,
    puedeEscribir:   true ,
    visible:         true ,
    divisas:         [ "ARS" ] ,
    participaciones: [ {
      divisa: "ARS" ,
      total:  30000000 ,
      filas:  [
        { userId: "u-ana"  , nombre: "Ana"  , neto: 20000000 , bp: 6666 } ,
        { userId: "u-beto" , nombre: "Beto" , neto: 10000000 , bp: 3333 } ,
        { userId: null     , nombre: null   , neto: 0        , bp: 0 } ,
      ] ,
    } ] ,
    aportes: [
      { id: "a1" , userId: "u-ana" , nombre: "Ana" , amountInCents: 30000000 , currency: "ARS" , note: "Alquiler" , occurredAt: "2026-10-05T12:00:00.000Z" } ,
      { id: "a2" , userId: "u-ana" , nombre: "Ana" , amountInCents: -10000000 , currency: "ARS" , note: null , occurredAt: "2026-10-06T12:00:00.000Z" } ,
    ] ,
    miembros: [ { userId: "u-ana" , nombre: "Ana" } , { userId: "u-beto" , nombre: "Beto" } ] ,
  } ;

  const renderizar = ( data: VistaCaja ) => render(
    <ProfileProvider initialProfile={mockProfile}>
      <CajaPanel initialData={data} dict={dict.splits.pot} />
    </ProfileProvider>
  ) ;

  const montoDe = () => screen.getByLabelText( dict.splits.pot.amountLabel.replace( "{divisa}" , "ARS" ) ) ;

  it( "muestra la participación con un decimal y los movimientos con su signo y su nota" , () => {
    renderizar( deOwner ) ;

    expect( screen.getByText( "Ana" ) ).toBeTruthy() ;
    expect( screen.getByText( "66,7 %" ) ).toBeTruthy() ;
    expect( screen.getByText( "33,3 %" ) ).toBeTruthy() ;
    expect( screen.getByText( "Alquiler" ) ).toBeTruthy() ;
    expect( screen.getByText( /^\+/ ) ).toBeTruthy() ;
    expect( screen.getByText( /^−/ ) ).toBeTruthy() ;
  } ) ;

  it( "«Miembro anterior» aparece sin acciones: los únicos botones son Aportar y Retirar" , () => {
    renderizar( deOwner ) ;

    expect( screen.getByText( dict.splits.pot.formerMember ) ).toBeTruthy() ;
    expect( screen.getAllByRole( "button" ).map( ( b ) => b.textContent ) ).toEqual( [ dict.splits.pot.withdraw , dict.splits.pot.contribute ] ) ;
  } ) ;

  it( "un viewer ve la caja sin botones" , () => {
    renderizar( { ...deOwner , rol: "viewer" , puedeEscribir: false , miembros: [] } ) ;

    expect( screen.getByText( "Ana" ) ).toBeTruthy() ;
    expect( screen.queryByRole( "button" ) ).toBeNull() ;
  } ) ;

  it( "Aportar: «1500,50» viaja como 150050 centavos positivos, con el miembro elegido y la nota, y se refresca" , async () => {
    vi.mocked( registrarAporteCajaAction ).mockResolvedValue( { success: true , value: null } ) ;
    vi.mocked( obtenerCajaAction ).mockResolvedValue( { success: true , value: { ...deOwner , participaciones: [] , aportes: [] } } ) ;
    renderizar( deOwner ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.pot.contribute } ) ) ;
    fireEvent.change( screen.getByLabelText( dict.splits.pot.memberLabel ) , { target: { value: "u-beto" } } ) ;
    fireEvent.change( montoDe() , { target: { value: "1500,50" } } ) ;
    fireEvent.change( screen.getByLabelText( dict.splits.pot.noteLabel ) , { target: { value: "Súper" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.pot.submit } ) ) ;

    await waitFor( () => expect( registrarAporteCajaAction ).toHaveBeenCalledTimes( 1 ) ) ;
    expect( registrarAporteCajaAction ).toHaveBeenCalledWith( { userId: "u-beto" , currency: "ARS" , amountInCents: 150050 , note: "Súper" } ) ;
    await waitFor( () => expect( screen.getByText( dict.splits.pot.empty ) ).toBeTruthy() ) ;
  } ) ;

  it( "Retirar: el mismo monto viaja con signo negativo" , async () => {
    vi.mocked( registrarAporteCajaAction ).mockResolvedValue( { success: true , value: null } ) ;
    vi.mocked( obtenerCajaAction ).mockResolvedValue( { success: true , value: deOwner } ) ;
    renderizar( deOwner ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.pot.withdraw } ) ) ;
    fireEvent.change( montoDe() , { target: { value: "1500,50" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.pot.submit } ) ) ;

    await waitFor( () => expect( registrarAporteCajaAction ).toHaveBeenCalledTimes( 1 ) ) ;
    expect( registrarAporteCajaAction ).toHaveBeenCalledWith( { userId: "u-ana" , currency: "ARS" , amountInCents: -150050 } ) ;
  } ) ;

  it( "un member no ve el selector de miembro y no envía userId" , async () => {
    vi.mocked( registrarAporteCajaAction ).mockResolvedValue( { success: true , value: null } ) ;
    vi.mocked( obtenerCajaAction ).mockResolvedValue( { success: true , value: deOwner } ) ;
    renderizar( { ...deOwner , yoId: "u-beto" , rol: "member" , miembros: [ { userId: "u-beto" , nombre: "Beto" } ] } ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.pot.contribute } ) ) ;

    expect( screen.queryByLabelText( dict.splits.pot.memberLabel ) ).toBeNull() ;

    fireEvent.change( montoDe() , { target: { value: "10" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.pot.submit } ) ) ;

    await waitFor( () => expect( registrarAporteCajaAction ).toHaveBeenCalledWith( { currency: "ARS" , amountInCents: 1000 } ) ) ;
  } ) ;

  it( "un monto inválido muestra el error de campo y no llama a la acción" , () => {
    renderizar( deOwner ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.pot.contribute } ) ) ;
    fireEvent.change( montoDe() , { target: { value: "abc" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.pot.submit } ) ) ;

    expect( screen.getByText( dict.splits.pot.amountInvalid ) ).toBeTruthy() ;
    expect( registrarAporteCajaAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "si el servidor rechaza el retiro, muestra el motivo y deja el modal abierto" , async () => {
    vi.mocked( registrarAporteCajaAction ).mockResolvedValue( { success: false , error: "No podés retirar más de lo que aportaste." } ) ;
    renderizar( deOwner ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.pot.withdraw } ) ) ;
    fireEvent.change( montoDe() , { target: { value: "999999" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.pot.submit } ) ) ;

    await waitFor( () => expect( screen.getByText( "No podés retirar más de lo que aportaste." ) ).toBeTruthy() ) ;
    expect( montoDe() ).toBeTruthy() ;
  } ) ;
} ) ;
