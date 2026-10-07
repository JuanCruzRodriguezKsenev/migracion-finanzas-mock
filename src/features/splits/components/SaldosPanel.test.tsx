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
import { SaldosPanel }   from "./SaldosPanel" ;
import {
  obtenerSaldosAction ,
  registrarPagoAction ,
  solicitarPagoAction ,
  type VistaSaldos
} from "../actions/saldosActions" ;


vi.mock( "../actions/saldosActions" , () => ( {
  obtenerSaldosAction: vi.fn() ,
  registrarPagoAction: vi.fn() ,
  solicitarPagoAction: vi.fn() ,
} ) ) ;

const mockProfile: ProfileData = {
  userId: "11111111-1111-4111-8111-111111111111" , phone: null , currency: "ARS" , timezone: "America/Argentina/Buenos_Aires" ,
  bio: null , theme: "light" , defaultView: "dashboard" , fastLogin: true , weeklyStart: "monday" , dateFormat: "DD/MM/YYYY" ,
  numberFormat: "es-AR" , roundAmounts: false , includeTransfers: true , defaultAccount: null ,
  planName: "Básico" , planBilling: "Mensual" , planNextCharge: ""
} ;

describe( "SaldosPanel" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  const deAcreedor: VistaSaldos = {
    rol:           "member" ,
    puedeEscribir: true ,
    visible:       true ,
    saldos: [
      { contraparteId: "u-beto"  , nombre: "Beto"  , divisa: "ARS" , montoEnCentavos: 480000 } ,
      { contraparteId: "u-carla" , nombre: "Carla" , divisa: "ARS" , montoEnCentavos: -150000 } ,
      { contraparteId: null      , nombre: null    , divisa: "ARS" , montoEnCentavos: 7000 } ,
    ] ,
  } ;

  const renderizar = ( data: VistaSaldos ) => render(
    <ProfileProvider initialProfile={mockProfile}>
      <SaldosPanel initialData={data} dict={dict.splits.balances} />
    </ProfileProvider>
  ) ;

  it( "el acreedor ve los botones Solicitar y Pago sólo en la fila que le deben; «Miembro anterior» y el deudor no los llevan" , () => {
    renderizar( deAcreedor ) ;

    expect( screen.getByText( "Beto" ) ).toBeTruthy() ;
    expect( screen.getByText( "Carla" ) ).toBeTruthy() ;
    expect( screen.getByText( dict.splits.balances.formerMember ) ).toBeTruthy() ;
    expect( screen.getAllByRole( "button" , { name: dict.splits.balances.request } ) ).toHaveLength( 1 ) ;
    expect( screen.getAllByRole( "button" , { name: dict.splits.balances.pay } ) ).toHaveLength( 1 ) ;
  } ) ;

  it( "un viewer ve los saldos sin botones" , () => {
    renderizar( { ...deAcreedor , rol: "viewer" , puedeEscribir: false } ) ;

    expect( screen.getByText( "Beto" ) ).toBeTruthy() ;
    expect( screen.queryByRole( "button" ) ).toBeNull() ;
  } ) ;

  it( "sin saldos muestra «No hay saldos pendientes»" , () => {
    renderizar( { ...deAcreedor , saldos: [] } ) ;

    expect( screen.getByText( dict.splits.balances.empty ) ).toBeTruthy() ;
  } ) ;

  it( "Pago: el monto «1500,50» se convierte a 150050 centavos y la lista se refresca" , async () => {
    vi.mocked( registrarPagoAction ).mockResolvedValue( { success: true , value: null } ) ;
    vi.mocked( obtenerSaldosAction ).mockResolvedValue( { success: true , value: { ...deAcreedor , saldos: [] } } ) ;
    renderizar( deAcreedor ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.balances.pay } ) ) ;
    fireEvent.change( screen.getByLabelText( dict.splits.balances.payAmountLabel.replace( "{divisa}" , "ARS" ) ) , { target: { value: "1500,50" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.balances.paySubmit } ) ) ;

    await waitFor( () => expect( registrarPagoAction ).toHaveBeenCalledTimes( 1 ) ) ;
    expect( registrarPagoAction ).toHaveBeenCalledWith( { contraparteId: "u-beto" , divisa: "ARS" , montoEnCentavos: 150050 } ) ;
    await waitFor( () => expect( screen.getByText( dict.splits.balances.empty ) ).toBeTruthy() ) ;
  } ) ;

  it( "Pago: un monto inválido muestra el error de campo y no llama a la acción" , () => {
    renderizar( deAcreedor ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.balances.pay } ) ) ;
    fireEvent.change( screen.getByLabelText( dict.splits.balances.payAmountLabel.replace( "{divisa}" , "ARS" ) ) , { target: { value: "abc" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.balances.paySubmit } ) ) ;

    expect( screen.getByText( dict.splits.balances.payAmountInvalid ) ).toBeTruthy() ;
    expect( registrarPagoAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "Solicitar: muestra «Solicitud enviada», o el motivo del rechazo" , async () => {
    vi.mocked( solicitarPagoAction ).mockResolvedValueOnce( { success: true , value: null } ) ;
    renderizar( deAcreedor ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.balances.request } ) ) ;
    await waitFor( () => expect( screen.getByText( dict.splits.balances.requestSent ) ).toBeTruthy() ) ;
    expect( solicitarPagoAction ).toHaveBeenCalledWith( { contraparteId: "u-beto" , divisa: "ARS" } ) ;

    vi.mocked( solicitarPagoAction ).mockResolvedValueOnce( { success: false , error: "Ya solicitaste un pago hoy." } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.balances.request } ) ) ;
    await waitFor( () => expect( screen.getByText( "Ya solicitaste un pago hoy." ) ).toBeTruthy() ) ;
  } ) ;
} ) ;
